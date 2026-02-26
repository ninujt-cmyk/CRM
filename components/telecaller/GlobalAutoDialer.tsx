"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { PhoneForwarded, Loader2, Timer, CheckCircle2, StopCircle, User, FastForward } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"
import { Button } from "@/components/ui/button"

export function GlobalAutoDialer() {
    const [dialState, setDialState] = useState<'idle' | 'dialing' | 'on_call' | 'wrap_up' | 'empty' | 'offline'>('offline')
    const [countdown, setCountdown] = useState(5)
    const [isVisible, setIsVisible] = useState(false)
    const [currentCustomer, setCurrentCustomer] = useState<string | null>(null)
    
    const supabase = createClient()
    const router = useRouter()
    const { toast } = useToast()

    const stateLock = useRef<'idle' | 'dialing' | 'on_call' | 'wrap_up' | 'empty' | 'offline'>('offline')
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const userIdRef = useRef<string | null>(null)

    const changeState = (newState: typeof stateLock.current) => {
        stateLock.current = newState;
        setDialState(newState);
    }

    // 1. Initial Setup and WebSocket Listener
    useEffect(() => {
        const initDialer = async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            userIdRef.current = user.id

            const { data } = await supabase.from('users').select('current_status').eq('id', user.id).single()
            if (data) handleDatabaseStatusChange(data.current_status)

            const channel = supabase.channel('auto_dialer_sync')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${user.id}` }, 
                (payload) => handleDatabaseStatusChange(payload.new.current_status))
                .subscribe()

            return () => { supabase.removeChannel(channel) }
        }
        initDialer()
    }, [supabase])

    // 💡 2. THE NEW SAFETY NET: Active Polling during calls
    // If WebSockets fail, this guarantees we catch the Webhook's update!
    useEffect(() => {
        let pollInterval: NodeJS.Timeout;
        
        if (dialState === 'on_call' && userIdRef.current) {
            pollInterval = setInterval(async () => {
                const { data } = await supabase
                    .from('users')
                    .select('current_status')
                    .eq('id', userIdRef.current!)
                    .single();
                
                // If the webhook changed the DB to wrap_up, update the UI instantly!
                if (data && data.current_status !== 'on_call' && data.current_status !== 'dialing') {
                    handleDatabaseStatusChange(data.current_status);
                }
            }, 3000); // Check every 3 seconds
        }

        return () => {
            if (pollInterval) clearInterval(pollInterval);
        }
    }, [dialState, supabase]);

    const handleDatabaseStatusChange = (dbStatus: string) => {
        const normalizedStatus = (dbStatus === 'ready' || dbStatus === 'active') ? 'active' : dbStatus;

        if (normalizedStatus === 'active') {
            if (['offline', 'wrap_up', 'empty', 'idle'].includes(stateLock.current)) {
                changeState('idle');
                setIsVisible(true);
                executeAutoDial(); 
            }
        } else if (normalizedStatus === 'on_call') {
            changeState('on_call');
            setIsVisible(true);
            if (timerRef.current) clearInterval(timerRef.current);
        } else if (normalizedStatus === 'wrap_up') {
            changeState('wrap_up');
            setIsVisible(true);
            startWrapUpCountdown();
        } else {
            changeState('offline');
            setIsVisible(false);
            setCurrentCustomer(null);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }

    const startWrapUpCountdown = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setCountdown(5) 
        
        timerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!)
                    if (userIdRef.current) supabase.from('users').update({ current_status: 'active' }).eq('id', userIdRef.current).then()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const executeAutoDial = async () => {
        const uid = userIdRef.current
        if (!uid || stateLock.current === 'dialing' || stateLock.current === 'on_call') return;
        
        changeState('dialing');

        try {
            const { data: potentialLeads } = await supabase
                .from('leads')
                .select('id, name, phone, priority, created_at')
                .eq('assigned_to', uid)
                .in('status', ['New Lead', 'Follow Up', 'new'])
                .limit(50)

            if (!potentialLeads || potentialLeads.length === 0) {
                changeState('empty');
                setCurrentCustomer(null);
                setTimeout(async () => {
                    const { data } = await supabase.from('users').select('current_status').eq('id', uid).single()
                    if (data?.current_status === 'active' || data?.current_status === 'ready') executeAutoDial()
                }, 10000)
                return
            }

            const priorityWeights: Record<string, number> = { "urgent": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };
            const sortedLeads = potentialLeads.sort((a, b) => {
                const weightA = priorityWeights[a.priority || "none"] || 0;
                const weightB = priorityWeights[b.priority || "none"] || 0;
                if (weightA !== weightB) return weightB - weightA; 
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); 
            });

            const nextLead = sortedLeads[0];
            setCurrentCustomer(nextLead.name);

            const res = await initiateC2CCall(nextLead.id, nextLead.phone);

            if (res.success) {
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

    const forceSkip = async () => {
        if (!userIdRef.current) return;
        toast({ title: "Skipping Call", description: "Moving to next lead..." });
        await supabase.from('users').update({ current_status: 'wrap_up', status_reason: 'Force Skipped' }).eq('id', userIdRef.current);
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

            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Button 
                    variant="outline" size="sm" onClick={pauseDialer}
                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 text-xs h-8"
                >
                    <StopCircle className="h-3 w-3 mr-1" /> Stop
                </Button>

                {dialState === 'on_call' && (
                    <Button 
                        variant="outline" size="sm" onClick={forceSkip}
                        className="flex-1 border-amber-200 text-amber-600 hover:bg-amber-50 hover:text-amber-700 text-xs h-8"
                    >
                        <FastForward className="h-3 w-3 mr-1" /> Skip
                    </Button>
                )}
            </div>
        </div>
    )
}
