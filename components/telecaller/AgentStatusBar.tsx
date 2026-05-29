"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
// ✅ IMPORT THE NEW SECURE SERVER ACTION
import { updateTelecallerStatus } from "@/app/actions/user-status" 
import { 
  PhoneCall, Coffee, Power, Clock, CheckCircle2, AlertCircle, Loader2, Sparkles, Network
} from "lucide-react"
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator 
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

export function AgentStatusBar({ userId }: { userId: string }) {
  const [status, setStatus] = useState('offline')
  const [reason, setReason] = useState<string | null>(null)
  const [timer, setTimer] = useState(0)
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const { toast } = useToast()

  // Fetch initial status
  useEffect(() => {
    const fetchStatus = async () => {
      const { data } = await supabase
        .from('users')
        .select('current_status, status_reason, status_updated_at')
        .eq('id', userId)
        .single()
      
      if (data) {
        setStatus(data.current_status || 'offline')
        setReason(data.status_reason)
        const updatedTime = new Date(data.status_updated_at).getTime()
        setTimer(Math.floor((Date.now() - updatedTime) / 1000))
      }
    }
    fetchStatus()
  }, [userId, supabase])

  // Real-time Timer
  useEffect(() => {
    const interval = setInterval(() => setTimer(prev => prev + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  // Format Timer (MM:SS or HH:MM:SS)
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  const handleStatusChange = async (newStatus: string, newReason: string | null = null) => {
    if (status === newStatus && reason === newReason) return;
    
    if (loading) return; 
    
    setLoading(true);
    
    try {
      // ✅ USE THE NEW RLS-BYPASSING SERVER ACTION
      const res = await updateTelecallerStatus(newStatus, newReason || "Manual Update");
      
      if (res?.success) {
        setStatus(newStatus);
        setReason(newReason);
        setTimer(0); 
        toast({ description: `Status updated to ${newReason || newStatus}` })
      } else {
        toast({ description: "Failed to update status", variant: "destructive" })
      }
    } catch (error) {
      console.error(error);
      toast({ description: "An error occurred while updating status.", variant: "destructive" })
    } finally {
      setLoading(false); 
    }
  }

  // Visuals based on current status
  const getStatusColor = () => {
    switch(status) {
      case 'ready': 
      case 'active':
        return 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/30';
      case 'on_call': 
        return 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/30';
      case 'wrap_up': 
        return 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/30';
      case 'break': 
        return 'bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20 dark:border-yellow-500/30';
      default: 
        return 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/30';
    }
  }

  const getStatusIcon = () => {
    switch(status) {
      case 'ready': 
      case 'active': 
        return (
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
        );
      case 'on_call': 
        return (
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
        );
      case 'wrap_up': 
        return (
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        );
      case 'break': 
        return (
          <span className="relative flex h-2 w-2 mr-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
          </span>
        );
      default: 
        return (
          <span className="relative flex h-2 w-2 mr-2">
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        );
    }
  }

  // Map the current dual-state into a single string for the Select component
  let selectValue = status;
  if (status === 'break' && reason) {
    if (reason === 'Tea Break') selectValue = 'break_tea';
    if (reason === 'Lunch') selectValue = 'break_lunch';
    if (reason === 'Meeting') selectValue = 'break_meeting';
  }

  // Decode the Select value back into status & reason
  const onSelectChange = (val: string) => {
    if (val === 'ready') handleStatusChange('ready', null);
    else if (val === 'break_tea') handleStatusChange('break', 'Tea Break');
    else if (val === 'break_lunch') handleStatusChange('break', 'Lunch');
    else if (val === 'break_meeting') handleStatusChange('break', 'Meeting');
    else if (val === 'offline') handleStatusChange('offline', null);
  };

  return (
    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800/80 px-4 sm:px-6 py-2 flex items-center justify-between sticky top-0 z-50 shadow-sm transition-all duration-300">
      
      <div className="flex items-center gap-3">
        {/* Network & Active Indicator badge (AI sync pulse) */}
        <div className="hidden xs:flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-800/80 text-[10px] font-bold text-slate-500 dark:text-slate-400">
          <Network className="h-3 w-3 text-indigo-500 animate-pulse" />
          <span className="uppercase tracking-wider">AI Synced</span>
        </div>

        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 hidden sm:inline-block">Status:</span>
        
        <Select value={selectValue} onValueChange={onSelectChange} disabled={loading}>
          <SelectTrigger className={cn(
            "w-48 sm:w-52 h-8.5 rounded-full shadow-sm font-extrabold text-[11px] uppercase tracking-wider focus:ring-0 active:scale-95 transition-all duration-200",
            getStatusColor()
          )}>
            <div className="flex items-center justify-start text-left w-full pl-1">
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin text-slate-400" /> : getStatusIcon()}
              <SelectValue>
                <span>{loading ? "Updating..." : (reason || status.replace('_', ' '))}</span>
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent className="rounded-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
            
            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5">Ready for Call Flow</SelectLabel>
              <SelectItem value="ready" className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 dark:focus:bg-emerald-950/20 cursor-pointer rounded-lg text-xs font-bold">
                <div className="flex items-center gap-2 py-0.5">
                  <CheckCircle2 className="h-4 w-4" /> Ready to Dial
                </div>
              </SelectItem>
            </SelectGroup>
            
            <SelectSeparator className="dark:bg-slate-800" />
            
            <SelectGroup>
              <SelectLabel className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 py-1.5">Temporary Breaks</SelectLabel>
              <SelectItem value="break_tea" className="text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/20 cursor-pointer rounded-lg text-xs font-bold">
                <div className="flex items-center gap-2 py-0.5">
                  <Coffee className="h-4 w-4" /> Tea / Coffee Break
                </div>
              </SelectItem>
              <SelectItem value="break_lunch" className="text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/20 cursor-pointer rounded-lg text-xs font-bold">
                <div className="flex items-center gap-2 py-0.5">
                  <Coffee className="h-4 w-4" /> Lunch Break
                </div>
              </SelectItem>
              <SelectItem value="break_meeting" className="text-amber-600 focus:text-amber-700 focus:bg-amber-50 dark:focus:bg-amber-950/20 cursor-pointer rounded-lg text-xs font-bold">
                <div className="flex items-center gap-2 py-0.5">
                  <AlertCircle className="h-4 w-4" /> Team Meeting
                </div>
              </SelectItem>
            </SelectGroup>

            <SelectSeparator className="dark:bg-slate-800" />
            
            <SelectGroup>
              <SelectItem value="offline" className="text-rose-600 focus:text-rose-700 focus:bg-rose-50 dark:focus:bg-rose-950/20 cursor-pointer rounded-lg text-xs font-bold">
                <div className="flex items-center gap-2 py-0.5">
                  <Power className="h-4 w-4" /> Go Offline (Logout)
                </div>
              </SelectItem>
            </SelectGroup>

          </SelectContent>
        </Select>

      </div>

      {/* Modern Compact Timer Layout */}
      <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950/80 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800/80 shadow-sm font-mono transition-all">
        <Clock className="h-3.5 w-3.5 text-indigo-500 animate-spin-slow" />
        <span>{formatTime(timer)}</span>
      </div>
      
    </div>
  )
}

