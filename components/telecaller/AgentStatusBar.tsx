"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { updateAgentStatus } from "@/app/actions/agent-state"
import { initiateC2CCall } from "@/app/actions/c2c-dialer"
import { 
  PhoneCall, Coffee, Power, Clock, CheckCircle2, AlertCircle, ChevronDown, Rocket, Loader2
} from "lucide-react"
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"

export function AgentStatusBar({ userId }: { userId: string }) {
  const [status, setStatus] = useState('offline')
  const [reason, setReason] = useState<string | null>(null)
  const [timer, setTimer] = useState(0)
  const [loading, setLoading] = useState(false)
  
  // 🔴 THE AUTO-DIALER ENGINE STATE
  const [autoDialEnabled, setAutoDialEnabled] = useState(false)
  const [isDialing, setIsDialing] = useState(false)
  const [wrapUpCountdown, setWrapUpCountdown] = useState<number | null>(null)
  
  const supabase = createClient()
  const router = useRouter()
  const { toast } = useToast()
  const isDialingRef = useRef(false) // Prevents double-firing

  // 1. Fetch initial status & Listen to Webhook Realtime changes
  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase.from('users').select('current_status, status_reason, status_updated_at').eq('id', userId).single()
      if (data) {
        setStatus(data.current_status || 'offline')
        setReason(data.status_reason)
        setTimer(Math.floor((Date.now() - new Date(data.status_updated_at).getTime()) / 1000))
      }
    }
    fetchStatus()

    // Listen to changes from the Fonada Webhook (e.g., when call ends and webhook sets to 'wrap_up')
    const channel = supabase.channel('agent_status_updates')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users', filter: `id=eq.${userId}` }, (payload) => {
          setStatus(payload.new.current_status)
          setReason(payload.new.status_reason)
          setTimer(0) // Reset timer on state change
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  // 2. Standard Real-time Clock
  useEffect(() => {
    const interval = setInterval(() => setTimer(prev => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // 3. 🚨 THE CORE AUTO-DIALER LOOP 🚨
  useEffect(() => {
    const triggerNextCall = async () => {
        if (status !== 'ready' || !autoDialEnabled || isDialingRef.current) return;
        
        isDialingRef.current = true;
        setIsDialing(true);

        try {
            // Find highest priority lead
            const { data: potentialLeads } = await supabase
                .from('leads')
                .select('id, name, phone, priority, created_at')
                .eq('assigned_to', userId)
                .in('status', ['New Lead', 'Follow Up', 'new']) 
                .limit(20) 

            if (!potentialLeads || potentialLeads.length === 0) {
                toast({ title: "Queue Empty", description: "No leads left to dial. Auto-Dialer paused.", variant: "destructive" })
                setAutoDialEnabled(false); // Turn off auto-dial if queue is empty
                isDialingRef.current = false;
                setIsDialing(false);
                return;
            }

            // Priority Sorting
            const priorityWeights: Record<string, number> = { "urgent": 4, "high": 3, "medium": 2, "low": 1, "none": 0 };
            const sortedLeads = potentialLeads.sort((a, b) => {
                const weightA = priorityWeights[a.priority || "none"] || 0;
                const weightB = priorityWeights[b.priority || "none"] || 0;
                if (weightA !== weightB) return weightB - weightA; 
                return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); 
            });

            const nextLead = sortedLeads[0];
            toast({ title: "Auto-Dialing 🚀", description: `Connecting to ${nextLead.name}...` })

            // Fire C2C Call
            const res = await initiateC2CCall(nextLead.id, nextLead.phone);

            if (res.success) {
                // Instantly pop the lead profile on screen!
                router.push(`/telecaller/leads/${nextLead.id}`);
            } else {
                toast({ title: "Call Failed", description: res.error, variant: "destructive" })
            }
        } catch (error) {
            console.error("Auto-dial error:", error)
        }

        setIsDialing(false);
        // Note: We leave isDialingRef.current = true because initiateC2CCall sets status to 'on_call',
        // which will unmount this specific effect condition anyway.
    };

    triggerNextCall();

  }, [status, autoDialEnabled, userId, supabase, router, toast]);

  // 4. ⏳ THE 5-SECOND AUTO-WRAP-UP TIMER
  useEffect(() => {
      let countdownInterval: NodeJS.Timeout;

      if (status === 'wrap_up' && autoDialEnabled) {
          setWrapUpCountdown(5); // Start at 5 seconds

          countdownInterval = setInterval(() => {
              setWrapUpCountdown(prev => {
                  if (prev && prev <= 1) {
                      clearInterval(countdownInterval);
                      handleStatusChange('ready'); // Auto-flip back to Ready!
                      return null;
                  }
                  return prev ? prev - 1 : null;
              });
          }, 1000);
      } else {
          setWrapUpCountdown(null);
      }

      return () => clearInterval(countdownInterval);
  }, [status, autoDialEnabled]);

  // --- HANDLERS & HELPERS ---
  const handleStatusChange = async (newStatus: string, newReason: string | null = null) => {
    if (status === newStatus && reason === newReason) return;
    setLoading(true);
    
    // Reset dialing lock if they manually intervene
    if (newStatus !== 'ready') isDialingRef.current = false;
    
    const res = await updateAgentStatus(userId, newStatus, newReason);
    if (res.success) {
      setStatus(newStatus);
      setReason(newReason);
      setTimer(0); 
    }
    setLoading(false);
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  const getStatusColor = () => {
    switch(status) {
      case 'ready': return 'bg-emerald-500 hover:bg-emerald-600 text-white';
      case 'on_call': return 'bg-blue-500 hover:bg-blue-600 text-white';
      case 'wrap_up': return 'bg-amber-500 hover:bg-amber-600 text-white';
      case 'break': return 'bg-orange-500 hover:bg-orange-600 text-white';
      default: return 'bg-slate-500 hover:bg-slate-600 text-white';
    }
  }

  const getStatusIcon = () => {
    switch(status) {
      case 'ready': return <CheckCircle2 className="h-4 w-4 mr-2" />;
      case 'on_call': return <PhoneCall className="h-4 w-4 mr-2 animate-pulse" />;
      case 'wrap_up': return <Clock className="h-4 w-4 mr-2" />;
      case 'break': return <Coffee className="h-4 w-4 mr-2" />;
      default: return <Power className="h-4 w-4 mr-2" />;
    }
  }

  return (
    <div className="bg-white border-b px-6 py-2 flex flex-col md:flex-row items-center justify-between shadow-sm sticky top-0 z-50 gap-4">
      
      {/* LEFT: STATUS CONTROLS */}
      <div className="flex items-center gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={loading || isDialing} className={`${getStatusColor()} w-48 justify-between shadow-sm`}>
              <div className="flex items-center">
                {getStatusIcon()}
                <span className="capitalize">{reason || status.replace('_', ' ')}</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48">
            <DropdownMenuItem onClick={() => handleStatusChange('ready')} className="text-emerald-600 font-bold cursor-pointer"><CheckCircle2 className="h-4 w-4 mr-2" /> Ready</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleStatusChange('break', 'Tea Break')} className="text-orange-600 cursor-pointer"><Coffee className="h-4 w-4 mr-2" /> Tea Break</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('break', 'Lunch')} className="text-orange-600 cursor-pointer"><Coffee className="h-4 w-4 mr-2" /> Lunch Break</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleStatusChange('offline')} className="text-slate-600 cursor-pointer"><Power className="h-4 w-4 mr-2" /> Offline</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md border">
          <Clock className="h-4 w-4 text-slate-400" /> {formatTime(timer)}
        </div>
      </div>

      {/* RIGHT: THE AUTO-DIALER POWER SWITCH */}
      <div className={`flex items-center gap-4 px-4 py-1.5 rounded-full border transition-colors ${autoDialEnabled ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'}`}>
        {isDialing ? (
            <div className="flex items-center text-indigo-600 text-sm font-bold animate-pulse">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Dialing Next...
            </div>
        ) : wrapUpCountdown !== null ? (
            <div className="flex items-center text-amber-600 text-sm font-bold">
                Auto-Dialing in {wrapUpCountdown}s...
            </div>
        ) : (
            <div className="flex items-center gap-2">
                <Rocket className={`h-4 w-4 ${autoDialEnabled ? 'text-indigo-600' : 'text-slate-400'}`} />
                <Label htmlFor="auto-dial-mode" className={`font-bold cursor-pointer ${autoDialEnabled ? 'text-indigo-700' : 'text-slate-500'}`}>
                    Hands-Free Auto-Dialer
                </Label>
            </div>
        )}
        
        <Switch 
            id="auto-dial-mode" 
            checked={autoDialEnabled} 
            onCheckedChange={(val) => {
                setAutoDialEnabled(val);
                if (!val) isDialingRef.current = false; // Reset lock if turned off
            }} 
        />
      </div>

    </div>
  )
}
