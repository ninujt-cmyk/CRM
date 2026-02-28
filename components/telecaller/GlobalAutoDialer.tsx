"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { PhoneForwarded, Loader2, Timer, CheckCircle2, User } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"

export function GlobalAutoDialer() {
    const [dialState, setDialState] = useState<'idle' | 'dialing' | 'on_call' | 'wrap_up' | 'empty' | 'offline'>('offline')
    const [countdown, setCountdown] = useState(10) 
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

    useEffect(() => {
        let pollInterval: NodeJS.Timeout;
        if (dialState === 'on_call' && userIdRef.current) {
            pollInterval = setInterval(async () => {
                const { data } = await supabase.from('users').select('current_status').eq('id', userIdRef.current!).single();
                if (data && data.current_status !== 'on_call' && data.current_status !== 'dialing') {
                    handleDatabaseStatusChange(data.current_status);
                }
            }, 3000);
        }
        return () => { if (pollInterval) clearInterval(pollInterval); }
    }, [dialState, supabase]);

    useEffect(() => {
        const triggerNextCall = async () => {
            if (dialState === 'wrap_up' && countdown === 0) {
                if (userIdRef.current) {
                    await supabase.from('users').update({ current_status: 'ready', status_reason: 'Auto-Dialer Ready' }).eq('id', userIdRef.current);
                }
                changeState('idle');
                executeAutoDial();
            }
        };
        triggerNextCall();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [countdown, dialState]);

    const handleDatabaseStatusChange = (dbStatus: string) => {
        const normalizedStatus = (dbStatus === 'ready' || dbStatus === 'active') ? 'active' : dbStatus;

        if (normalizedStatus === 'active') {
            if (['offline', 'wrap_up', 'empty', 'idle', 'on_call'].includes(stateLock.current)) {
                changeState('idle');
                setIsVisible(true);
                executeAutoDial(); 
            }
        } else if (normalizedStatus === 'on_call') {
            changeState('on_call');
            setIsVisible(true);
            if (timerRef.current) clearInterval(timerRef.current);
        } else if (normalizedStatus === 'wrap_up') {
            if (stateLock.current !== 'wrap_up') {
                changeState('wrap_up');
                setIsVisible(true);
                startWrapUpCountdown();
            }
        } else {
            changeState('offline');
            setIsVisible(false);
            setCurrentCustomer(null);
            if (timerRef.current) clearInterval(timerRef.current);
        }
    }

    const startWrapUpCountdown = () => {
        if (timerRef.current) clearInterval(timerRef.current)
        setCountdown(10) 
        timerRef.current = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) { clearInterval(timerRef.current!); return 0 }
                return prev - 1
            })
        }, 1000)
    }

    const executeAutoDial = async () => {
        const uid = userIdRef.current
        if (!uid || stateLock.current === 'dialing' || stateLock.current === 'on_call') return;
        
        changeState('dialing');

        try {
            let nextLead = null;

            // 💡 Helper: The "Midnight" timestamp to prevent same-day repeat calls
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const todayISO = startOfToday.toISOString();

            const sortLeads = (leads: any[], dateField: string = 'created_at') => {
                const weights: Record<string, number> = { "urgent": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };
                return leads.sort((a, b) => {
                    const wA = weights[a.priority || "none"] || 0;
                    const wB = weights[b.priority || "none"] || 0;
                    if (wA !== wB) return wB - wA; 
                    return new Date(a[dateField] || 0).getTime() - new Date(b[dateField] || 0).getTime(); 
                });
            };

            // 🪣 BUCKET 1: Own New Leads
            const { data: ownNew } = await supabase.from('leads').select('*').eq('assigned_to', uid).in('status', ['New Lead', 'new']).limit(50);
            if (ownNew && ownNew.length > 0) nextLead = sortLeads(ownNew, 'created_at')[0];

            // 🪣 BUCKET 2: Steal Leads (Unassigned OR Agents with > 5 leads)
            if (!nextLead) {
                const { data: unassignedNew } = await supabase.from('leads').select('*').is('assigned_to', null).in('status', ['New Lead', 'new']).limit(50);
                if (unassignedNew && unassignedNew.length > 0) {
                    nextLead = sortLeads(unassignedNew, 'created_at')[0];
                    await supabase.from('leads').update({ assigned_to: uid }).eq('id', nextLead.id); 
                } 
                else {
                    const { data: otherAgentsLeads } = await supabase.from('leads').select('*').in('status', ['New Lead', 'new']).neq('assigned_to', uid).not('assigned_to', 'is', null).limit(1000);
                    if (otherAgentsLeads && otherAgentsLeads.length > 0) {
                        const counts: Record<string, number> = {};
                        otherAgentsLeads.forEach(l => { counts[l.assigned_to] = (counts[l.assigned_to] || 0) + 1; });
                        
                        const overloadedAgent = Object.keys(counts).find(aId => counts[aId] > 5);
                        if (overloadedAgent) {
                            const stealableLeads = otherAgentsLeads.filter(l => l.assigned_to === overloadedAgent);
                            nextLead = sortLeads(stealableLeads, 'created_at')[0];
                            await supabase.from('leads').update({ assigned_to: uid }).eq('id', nextLead.id);
                        }
                    }
                }
            }

            // 🪣 BUCKET 3: Standard Active Queue (Follow Ups) - 🔥 NO SAME DAY CALLS
            if (!nextLead) {
                const { data: queueLeads } = await supabase.from('leads')
                    .select('*')
                    .eq('assigned_to', uid)
                    .in('status', ['Follow Up', 'Contacted', 'follow_up'])
                    .lt('last_contacted', todayISO) // Only grab leads contacted BEFORE today
                    .limit(50);
                if (queueLeads && queueLeads.length > 0) nextLead = sortLeads(queueLeads, 'last_contacted')[0];
            }

            // 🪣 BUCKET 4: Not Reachable (NR) Leads - MAX 4 ATTEMPTS PER DAY
            if (!nextLead) {
                const { data: nrLeads } = await supabase.from('leads').select('*').eq('assigned_to', uid).in('status', ['nr', 'Not Reachable']).limit(50);
                
                if (nrLeads && nrLeads.length > 0) {
                    const leadIds = nrLeads.map(l => l.id);

                    const { data: todayLogs } = await supabase
                        .from('call_logs')
                        .select('lead_id')
                        .in('lead_id', leadIds)
                        .gte('created_at', todayISO);

                    const attemptCounts: Record<string, number> = {};
                    if (todayLogs) {
                        todayLogs.forEach(log => {
                            attemptCounts[log.lead_id] = (attemptCounts[log.lead_id] || 0) + 1;
                        });
                    }

                    const callableNrLeads = nrLeads.filter(l => (attemptCounts[l.id] || 0) < 4);

                    if (callableNrLeads.length > 0) {
                        nextLead = sortLeads(callableNrLeads, 'last_contacted')[0];
                    }
                }
            }

            // 🪣 BUCKET 5: Interested (> 24 Hrs old)
            if (!nextLead) {
                const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const { data: intLeads } = await supabase.from('leads')
                    .select('*')
                    .eq('assigned_to', uid)
                    .in('status', ['Interested', 'interested'])
                    .lt('last_contacted', twentyFourHoursAgo)
                    .limit(50);
                if (intLeads && intLeads.length > 0) nextLead = sortLeads(intLeads, 'last_contacted')[0];
            }

            // 🪣 BUCKET 6: Not Interested - 🔥 NO SAME DAY CALLS
            if (!nextLead) {
                const { data: notIntLeads } = await supabase.from('leads')
                    .select('*')
                    .eq('assigned_to', uid)
                    .in('status', ['Not Interested', 'Not_Interested', 'recycle_pool'])
                    .lt('last_contacted', todayISO) // Only grab leads contacted BEFORE today
                    .limit(50);
                if (notIntLeads && notIntLeads.length > 0) nextLead = sortLeads(notIntLeads, 'last_contacted')[0];
            }

            // 🚨 IF ALL BUCKETS ARE EMPTY
            if (!nextLead) {
                changeState('empty');
                setCurrentCustomer(null);
                setTimeout(async () => {
                    const { data } = await supabase.from('users').select('current_status').eq('id', uid).single()
                    if (data?.current_status === 'active' || data?.current_status === 'ready') executeAutoDial()
                }, 10000)
                return
            }

            // 🚀 TRIGGER THE CALL
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
        </div>
    )
}
