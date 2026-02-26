"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { PhoneForwarded, Loader2, Timer, CheckCircle2, StopCircle, User } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"
import { Button } from "@/components/ui/button"

export function GlobalAutoDialer() {
    // UI States
    const [dialState, setDialState] = useState<'idle' | 'dialing' | 'on_call' | 'wrap_up' | 'empty' | 'offline'>('offline')
    const [countdown, setCountdown] = useState(5)
    const [isVisible, setIsVisible] = useState(false)
    const [currentCustomer, setCurrentCustomer] = useState<string | null>(null)
    
    const supabase = createClient()
    const router = useRouter()
    const { toast } = useToast()

    // 💡 THE LOCKS: These prevent the infinite loop race condition
    const stateLock = useRef<'idle' | 'dialing' | 'on_call' | 'wrap_up' | 'empty' | 'offline'>('offline')
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const userIdRef = useRef<string | null>(null)

    // Helper to safely update both State and Ref simultaneously
    const changeState = (newState: typeof stateLock.current) => {
        stateLock.current = newState;
        setDialState(newState);
    }

    useEffect(() => {
        const initDialer = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            userIdRef.current = user.id

            // Initial Sync
            const { data } = await supabase.from('users').select('current_status').eq('id', user.id).single()
            if (data) handleDatabaseStatusChange(data.current_status)

            // Real-time Subscription (Listens for Webhook updates!)
            const channel = supabase.channel('auto_dialer_sync')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, 
                (payload) => {
                    handleDatabaseStatusChange(payload.new.current_status)
                })
                .subscribe()

            return () => { supabase.removeChannel(channel) }
        }

        initDialer()
    }, [supabase])

    const handleDatabaseStatusChange = (dbStatus: string) => {
        const normalizedStatus = (dbStatus === 'ready' || dbStatus === 'active') ? 'active' : dbStatus;

        if (normalizedStatus === 'active') {
            // 🔒 STRICT LOCK: Only start dialing if we are completely idle or empty.
            if (['offline', 'wrap_up', 'empty', 'idle'].includes(stateLock.current)) {
                changeState('idle');
                setIsVisible(true);
                executeAutoDial(); // Trigger the engine
            }
        } 
        else if (normalizedStatus === 'on_call') {
            changeState('on_call');
            setIsVisible(true);
            if (timerRef.current) clearInterval(timerRef.current);
        } 
        else if (normalizedStatus === 'wrap_up') {
            changeState('wrap_up');
            setIsVisible(true);
            startWrapUpCountdown();
        } 
        else {
            // Offline / Break
            changeState('offline');
            setIsVisible(false);
            setCurrentCustomer(null);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }

    const startWrapUpCountdown = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setCountdown(5) // ⏳ 5 Second Wrap-up Timer
        
        timerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!)
                    // 🚀 TIMER FINISHED: Push DB back to active to start next call
                    if (userIdRef.current) {
                        supabase.from('users').update({ current_status: 'active' }).eq('id', userIdRef.current).then()
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const executeAutoDial = async () => {
        const uid = userIdRef.current
        
        // 🔒 DOUBLE LOCK: If already dialing or on call, instantly abort to prevent loops.
        if (!uid || stateLock.current === 'dialing' || stateLock.current === 'on_call') return;
        
        changeState('dialing');

        try {
            // Fetch highest priority lead
            const { data: potentialLeads } = await supabase
                .from('leads')
                .select('id, name, phone, priority, created_at')
                .eq('assigned_to', uid)
                .in('status', ['New Lead', 'Follow Up', 'new'])
                .limit(50)

            if (!potentialLeads || potentialLeads.length === 0) {
                changeState('empty');
                setCurrentCustomer(null);
                
                // Poll again in 10s if they are still active
                setTimeout(async () => {
                    const { data } = await supabase.from('users').select('current_status').eq('id', uid).single()
                    if (data?.current_status === 'active' || data?.current_status === 'ready') executeAutoDial()
                }, 10000)
                return
            }

            // Priority Logic
            const priorityWeights: Record<string, number> = { "urgent": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };
            const sortedLeads = potentialLeads.sort((a, b) => {
                const weightA = priorityWeights[a.priority || "none"] || 0;
                const weightB = priorityWeights[b.priority || "none"] || 0;
                if (weightA !== weightB) return weightB - weightA; 
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); 
            });

            const nextLead = sortedLeads[0];
            setCurrentCustomer(nextLead.name);
            console.log("👉 [AUTO-DIALER] Calling:", nextLead.name)

            // Trigger Fonada
            const res = await initiateC2CCall(nextLead.id, nextLead.phone);

            if (res.success) {
                // 🔒 Force local state to on_call instantly so it doesn't double-dial while waiting for DB sync
                changeState('on_call'); 
                router.push(`/telecaller/leads/${nextLead.id}`);
            } else {
                toast({ title: "Call Failed", description: res.error, variant: "destructive" })
                changeState('offline');
                await supabase.from('users').update({ current_status: 'offline', status_reason: 'API Error' }).eq('id', uid)
            }

        } catch (err) {
            console.error("AutoDial Error", err)
            changeState('offline');
        }
    }

    const pauseDialer = async () => {
        if (!userIdRef.current) return;
        changeState('offline');
        setIsVisible(false);
        await supabase.from('users').update({ current_status: 'offline', status_reason: 'Manual Pause' }).eq('id', userIdRef.current);
        toast({ title: "Dialer Paused", description: "You are now offline." });
    }

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 left-6 z-50 bg-white border-2 border-emerald-500 rounded-lg shadow-2xl p-4 w-80 animate-in slide-in-from-bottom-5">
            <div className="flex items-start gap-4">
                <div className="mt-1">
                    {dialState === 'dialing' && <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />}
                    {dialState === 'on_call' && <PhoneForwarded className="h-6 w-6 text-emerald-600 animate-pulse" />}
                    {dialState === 'wrap_up' && <Timer className="h-6 w-6 text-amber-500 animate-pulse" />}
                    {dialState === 'empty' && <CheckCircle2 className="h-6 w-6 text-slate-400" />}
                </div>

                <div className="flex-1">
                    <h4 className="font-bold text-slate-800 text-sm">
                        {dialState === 'dialing' && "Dialing Customer..."}
                        {dialState === 'on_call' && "Call in Progress"}
                        {dialState === 'wrap_up' && "Wrap-Up Mode"}
                        {dialState === 'empty' && "Queue Empty"}
                    </h4>
                    
                    {currentCustomer && (dialState === 'dialing' || dialState === 'on_call') && (
                        <div className="flex items-center gap-1 mt-1 bg-slate-100 rounded px-2 py-1">
                            <User className="h-3 w-3 text-slate-500" />
                            <span className="text-xs font-semibold text-slate-700 truncate">{currentCustomer}</span>
                        </div>
                    )}

                    <p className="text-xs text-slate-500 font-medium mt-1">
                        {dialState === 'wrap_up' && `Next call starts in ${countdown}s...`}
                        {dialState === 'on_call' && "Waiting for hangup..."}
                        {dialState === 'dialing' && "Please answer your phone."}
                        {dialState === 'empty' && "Auto-polling for leads."}
                    </p>
                </div>
            </div>

            {/* Emergency Stop Button */}
            {(dialState === 'empty' || dialState === 'wrap_up' || dialState === 'dialing') && (
                <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={pauseDialer}
                    className="w-full mt-3 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-8"
                >
                    <StopCircle className="h-3 w-3 mr-2" /> Stop Dialer
                </Button>
            )}
        </div>
    )
}
