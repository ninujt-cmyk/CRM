"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { updateAgentStatus } from "@/app/actions/agent-state"
import { 
  PhoneCall, Coffee, Power, Clock, CheckCircle2, AlertCircle, Loader2
} from "lucide-react"
// ✅ CHANGED: Imported Select components exactly like LeadFilters
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel, SelectSeparator 
} from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

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
      const res = await updateAgentStatus(userId, newStatus, newReason);
      
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

  // ✅ NEW: Map the current dual-state into a single string for the Select component
  let selectValue = status;
  if (status === 'break' && reason) {
    if (reason === 'Tea Break') selectValue = 'break_tea';
    if (reason === 'Lunch') selectValue = 'break_lunch';
    if (reason === 'Meeting') selectValue = 'break_meeting';
  }

  // ✅ NEW: Decode the Select value back into status & reason
  const onSelectChange = (val: string) => {
    if (val === 'ready') handleStatusChange('ready', null);
    else if (val === 'break_tea') handleStatusChange('break', 'Tea Break');
    else if (val === 'break_lunch') handleStatusChange('break', 'Lunch');
    else if (val === 'break_meeting') handleStatusChange('break', 'Meeting');
    else if (val === 'offline') handleStatusChange('offline', null);
  };

  return (
    <div className="bg-white border-b px-6 py-2 flex items-center justify-between shadow-sm sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-slate-700 hidden sm:inline-block">Dialer State:</span>
        
        {/* ✅ CHANGED: Implemented Select Pattern */}
        <Select value={selectValue} onValueChange={onSelectChange} disabled={loading}>
          <SelectTrigger className={`${getStatusColor()} w-56 shadow-sm border-0 focus:ring-0`}>
            <div className="flex items-center">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : getStatusIcon()}
              <SelectValue>
                <span className="capitalize">{loading ? "Updating..." : (reason || status.replace('_', ' '))}</span>
              </SelectValue>
            </div>
          </SelectTrigger>
          <SelectContent>
            
            <SelectGroup>
              <SelectLabel className="text-xs font-semibold text-slate-400 uppercase">Available Actions</SelectLabel>
              <SelectItem value="ready" className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer">
                <div className="flex items-center">
                  <CheckCircle2 className="h-4 w-4 mr-2" /> Ready for Calls
                </div>
              </SelectItem>
            </SelectGroup>
            
            <SelectSeparator />
            
            <SelectGroup>
              <SelectLabel className="text-xs font-semibold text-slate-400 uppercase">Take a Break</SelectLabel>
              <SelectItem value="break_tea" className="text-orange-600 focus:text-orange-700 focus:bg-orange-50 cursor-pointer">
                <div className="flex items-center">
                  <Coffee className="h-4 w-4 mr-2" /> Tea / Coffee Break
                </div>
              </SelectItem>
              <SelectItem value="break_lunch" className="text-orange-600 focus:text-orange-700 focus:bg-orange-50 cursor-pointer">
                <div className="flex items-center">
                  <Coffee className="h-4 w-4 mr-2" /> Lunch Break
                </div>
              </SelectItem>
              <SelectItem value="break_meeting" className="text-orange-600 focus:text-orange-700 focus:bg-orange-50 cursor-pointer">
                <div className="flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" /> Team Meeting
                </div>
              </SelectItem>
            </SelectGroup>

            <SelectSeparator />
            
            <SelectGroup>
              <SelectItem value="offline" className="text-slate-600 focus:text-slate-700 focus:bg-slate-50 cursor-pointer">
                <div className="flex items-center">
                  <Power className="h-4 w-4 mr-2" /> Go Offline (Logout)
                </div>
              </SelectItem>
            </SelectGroup>

          </SelectContent>
        </Select>

      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md border">
        <Clock className="h-4 w-4 text-slate-400" />
        {formatTime(timer)}
      </div>
    </div>
  )
}
