"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { updateAgentStatus } from "@/app/actions/agent-state"
import { 
  PhoneCall, Coffee, Power, Clock, CheckCircle2, AlertCircle, ChevronDown
} from "lucide-react"
import { 
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
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
    setLoading(true);
    
    const res = await updateAgentStatus(userId, newStatus, newReason);
    
    if (res.success) {
      setStatus(newStatus);
      setReason(newReason);
      setTimer(0); // Reset timer on state change
      toast({ description: `Status updated to ${newReason || newStatus}` })
    } else {
      toast({ description: "Failed to update status", variant: "destructive" })
    }
    setLoading(false);
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

  return (
    <div className="bg-white border-b px-6 py-2 flex items-center justify-between shadow-sm sticky top-0 z-50">
      <div className="flex items-center gap-4">
        <span className="font-semibold text-slate-700 hidden sm:inline-block">Dialer State:</span>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={loading} className={`${getStatusColor()} w-48 justify-between transition-colors shadow-sm`}>
              <div className="flex items-center">
                {getStatusIcon()}
                <span className="capitalize">{reason || status.replace('_', ' ')}</span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-70" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 font-medium">
            <DropdownMenuLabel>Available Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleStatusChange('ready')} className="text-emerald-600 focus:text-emerald-700 focus:bg-emerald-50 cursor-pointer">
              <CheckCircle2 className="h-4 w-4 mr-2" /> Ready for Calls
            </DropdownMenuItem>
            
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-slate-400 font-normal uppercase">Take a Break</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => handleStatusChange('break', 'Tea Break')} className="text-orange-600 focus:text-orange-700 focus:bg-orange-50 cursor-pointer">
              <Coffee className="h-4 w-4 mr-2" /> Tea / Coffee Break
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('break', 'Lunch')} className="text-orange-600 focus:text-orange-700 focus:bg-orange-50 cursor-pointer">
              <Coffee className="h-4 w-4 mr-2" /> Lunch Break
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('break', 'Meeting')} className="text-orange-600 focus:text-orange-700 focus:bg-orange-50 cursor-pointer">
              <AlertCircle className="h-4 w-4 mr-2" /> Team Meeting
            </DropdownMenuItem>

            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => handleStatusChange('offline')} className="text-slate-600 focus:text-slate-700 focus:bg-slate-50 cursor-pointer">
              <Power className="h-4 w-4 mr-2" /> Go Offline (Logout)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

      </div>

      <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-100 px-3 py-1.5 rounded-md border">
        <Clock className="h-4 w-4 text-slate-400" />
        {formatTime(timer)}
      </div>
    </div>
  )
}
