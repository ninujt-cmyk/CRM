"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { PhoneForwarded, Loader2, Timer, CheckCircle2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"

export function GlobalAutoDialer() {
    // UI States
    const [dialState, setDialState] = useState<'idle' | 'dialing' | 'on_call' | 'wrap_up' | 'empty' | 'offline'>('offline')
    const [countdown, setCountdown] = useState(5)
    const [isVisible, setIsVisible] = useState(false)
    
    const supabase = createClient()
    const router = useRouter()
    const { toast } = useToast()

    // Refs for safe background processing
    const isProcessing = useRef(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const userIdRef = useRef<string | null>(null) // 💡 Now stores the User ID internally

    useEffect(() => {
        const initDialer = async () => {
            // 1. Fetch the User ID automatically
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return
            
            userIdRef.current = user.id

            // 2. Initial Sync
            const { data } = await supabase.from('users').select('current_status').eq('id', user.id).single()
            if (data) handleStatusChange(data.current_status)

            // 3. Real-time Subscription (Listens for your Webhook!)
            const channel = supabase.channel('auto_dialer_sync')
                .on('postgres_changes', { 
                    event: 'UPDATE', 
                    schema: 'public', 
                    table: 'users', 
                    filter: `id=eq.${user.id}` 
                }, (payload) => {
                    handleStatusChange(payload.new.current_status)
                })
                .subscribe()

            return () => { supabase.removeChannel(channel) }
        }

        initDialer()
    }, [supabase])

    const handleStatusChange = (status: string) => {
        // 💡 Accepts both 'ready' and 'active' depending on your button's wording
        if (status === 'ready' || status === 'active') {
            setDialState('idle')
            setIsVisible(true)
            executeAutoDial()
        } else if (status === 'on_call') {
            setDialState('on_call')
            setIsVisible(true)
            if (timerRef.current) clearInterval(timerRef.current)
        } else if (status === 'wrap_up') {
            setDialState('wrap_up')
            setIsVisible(true)
            startWrapUpCountdown()
        } else {
            setDialState('offline')
            setIsVisible(false) // Hide the widget completely when offline/on break
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }

    const startWrapUpCountdown = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setCountdown(5) // 5 Second Wrap-up Timer
        
        timerRef.current = setInterval(async () => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!)
                    // 🚀 TIMER FINISHED: Auto-flip status to 'ready' to trigger the next call
                    if (userIdRef.current) {
                        supabase.from('users').update({ current_status: 'ready' }).eq('id', userIdRef.current).then()
                    }
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const executeAutoDial = async () => {
        const uid = userIdRef.current
        if (!uid || isProcessing.current) return;
        
        isProcessing.current = true;
        setDialState('dialing')

        try {
            // Fetch lead queue
            const { data: potentialLeads } = await supabase
                .from('leads')
                .select('id, name, phone, priority, created_at')
                .eq('assigned_to', uid)
                .in('status', ['New Lead', 'Follow Up', 'new'])
                .limit(50)

            // If queue is empty, wait 10 seconds and check again
            if (!potentialLeads || potentialLeads.length === 0) {
                setDialState('empty')
                isProcessing.current = false
                
                setTimeout(async () => {
                    const { data } = await supabase.from('users').select('current_status').eq('id', uid).single()
                    if (data?.current_status === 'ready' || data?.current_status === 'active') executeAutoDial()
                }, 10000)
                return
            }

            // Priority sorting logic
            const priorityWeights: Record<string, number> = { "urgent": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };
            const sortedLeads = potentialLeads.sort((a, b) => {
                const weightA = priorityWeights[a.priority || "none"] || 0;
                const weightB = priorityWeights[b.priority || "none"] || 0;
                if (weightA !== weightB) return weightB - weightA; 
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); 
            });

            const nextLead = sortedLeads[0];
            console.log("👉 [AUTO-DIALER] Calling Next Lead:", nextLead.name)

            // Trigger Fonada
            const res = await initiateC2CCall(nextLead.id, nextLead.phone);

            if (res.success) {
                // Instantly open the profile!
                router.push(`/telecaller/leads/${nextLead.id}`)
            } else {
                toast({ title: "Call Failed", description: res.error, variant: "destructive" })
                // Safety feature: Push agent to 'offline' so it doesn't infinite loop on broken API
                await supabase.from('users').update({ current_status: 'offline', status_reason: 'API Error' }).eq('id', uid)
            }

        } catch (err) {
            console.error("AutoDial Error", err)
        } finally {
            setTimeout(() => { isProcessing.current = false }, 2000)
        }
    }

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-6 left-6 z-50 bg-white border-2 border-emerald-500 rounded-lg shadow-2xl p-4 w-72 animate-in slide-in-from-bottom-5">
            <div className="flex items-center gap-4">
                {dialState === 'dialing' && <Loader2 className="h-6 w-6 text-emerald-600 animate-spin" />}
                {dialState === 'on_call' && <PhoneForwarded className="h-6 w-6 text-emerald-600 animate-pulse" />}
                {dialState === 'wrap_up' && <Timer className="h-6 w-6 text-amber-500 animate-pulse" />}
                {dialState === 'empty' && <CheckCircle2 className="h-6 w-6 text-slate-400" />}

                <div>
                    <h4 className="font-bold text-slate-800 text-sm">
                        {dialState === 'dialing' && "Dialing Customer..."}
                        {dialState === 'on_call' && "Call in Progress"}
                        {dialState === 'wrap_up' && "Wrap-Up Mode"}
                        {dialState === 'empty' && "Queue Empty"}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                        {dialState === 'wrap_up' && `Next call starts in ${countdown}s...`}
                        {dialState === 'on_call' && "Waiting for hangup..."}
                        {dialState === 'dialing' && "Please answer your phone."}
                        {dialState === 'empty' && "Auto-polling for leads."}
                    </p>
                </div>
            </div>
        </div>
    )
}
