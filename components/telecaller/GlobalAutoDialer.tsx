"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { PhoneForwarded, Loader2, Timer, CheckCircle2 } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"

export function GlobalAutoDialer({ userId }: { userId: string }) {
    const [dialState, setDialState] = useState<'idle' | 'dialing' | 'on_call' | 'wrap_up' | 'empty' | 'offline'>('offline')
    const [countdown, setCountdown] = useState(5)
    
    const supabase = createClient()
    const router = useRouter()
    const { toast } = useToast()

    const isProcessing = useRef(false)
    const timerRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // 1. Initial sync on load
        syncStatus()

        // 2. Real-time listener for Status Changes (Detects Webhook updates!)
        const channel = supabase.channel('auto_dialer_sync')
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'users', 
                filter: `id=eq.${userId}` 
            }, (payload) => {
                handleStatusChange(payload.new.current_status)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [userId, supabase])

    const syncStatus = async () => {
        const { data } = await supabase.from('users').select('current_status').eq('id', userId).single()
        if (data) handleStatusChange(data.current_status)
    }

    const handleStatusChange = (status: string) => {
        if (status === 'ready') {
            setDialState('idle')
            executeAutoDial()
        } else if (status === 'on_call') {
            setDialState('on_call')
            if (timerRef.current) clearInterval(timerRef.current)
        } else if (status === 'wrap_up') {
            setDialState('wrap_up')
            startWrapUpCountdown()
        } else {
            setDialState('offline')
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }

    const startWrapUpCountdown = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setCountdown(5) // Start 5 second timer
        
        timerRef.current = setInterval(async () => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    clearInterval(timerRef.current!)
                    // 🚀 TIMER FINISHED: Auto-flip back to 'ready' to trigger next call!
                    supabase.from('users').update({ current_status: 'ready' }).eq('id', userId).then()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const executeAutoDial = async () => {
        if (isProcessing.current) return;
        isProcessing.current = true;
        setDialState('dialing')

        try {
            // Fetch lead queue
            const { data: potentialLeads } = await supabase
                .from('leads')
                .select('id, name, phone, priority, created_at')
                .eq('assigned_to', userId)
                .in('status', ['New Lead', 'Follow Up', 'new'])
                .limit(50)

            // If empty queue, wait and check again in 10 seconds
            if (!potentialLeads || potentialLeads.length === 0) {
                setDialState('empty')
                isProcessing.current = false
                
                setTimeout(async () => {
                    const { data } = await supabase.from('users').select('current_status').eq('id', userId).single()
                    if (data?.current_status === 'ready') executeAutoDial()
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

            console.log("👉 [AUTO-DIALER] Connecting:", nextLead.name)

            // Trigger Fonada
            const res = await initiateC2CCall(nextLead.id, nextLead.phone);

            if (res.success) {
                // Instantly open the profile!
                router.push(`/telecaller/leads/${nextLead.id}`)
            } else {
                toast({ title: "Call Failed", description: res.error, variant: "destructive" })
                // Safety feature: If API fails, push agent to 'offline' so it doesn't infinite loop
                await supabase.from('users').update({ current_status: 'offline', status_reason: 'API Error' }).eq('id', userId)
            }

        } catch (err) {
            console.error("AutoDial Error", err)
        } finally {
            setTimeout(() => { isProcessing.current = false }, 2000)
        }
    }

    // Only show the floating widget if they are actively in the dialing cycle
    if (dialState === 'offline') return null;

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
