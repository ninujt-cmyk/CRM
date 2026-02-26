"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, PhoneCall, Coffee, Power, Clock, CheckCircle2, Loader2, AlertCircle, CalendarClock 
} from "lucide-react"
// ✅ ADDED DIALOG IMPORTS
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// --- TYPES ---
interface Agent {
  id: string
  full_name: string
  phone: string
  current_status: string
  status_reason: string | null
  status_updated_at: string | null
}

type FilterState = 'all' | 'online' | 'ready' | 'on_call' | 'break' | 'offline';

// --- HELPER: FORMAT TIME ---
const formatDuration = (seconds: number) => {
  if (isNaN(seconds) || seconds < 0) return "00:00:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

// --- SUB-COMPONENT: Agent Stats Modal ---
function AgentStatsModal({ agent, open, onClose }: { agent: Agent | null, open: boolean, onClose: () => void }) {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ ready: 0, on_call: 0, wrap_up: 0, break: 0, offline: 0 });
  const supabase = createClient();

  useEffect(() => {
    if (!open || !agent) return;
    
    const fetchStats = async () => {
      setLoading(true);
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('agent_state_logs')
        .select('status, started_at, ended_at, duration_seconds')
        .eq('user_id', agent.id)
        .gte('started_at', startOfDay.toISOString());

      if (error) {
        console.error("Error fetching logs:", error);
        setLoading(false);
        return;
      }

      const totals = { ready: 0, on_call: 0, wrap_up: 0, break: 0, offline: 0 };

      if (data) {
        data.forEach(log => {
          let duration = log.duration_seconds || 0;
          
          // If the log hasn't ended, calculate live duration up to this exact moment
          if (!log.ended_at) {
            duration = Math.floor((Date.now() - new Date(log.started_at).getTime()) / 1000);
          }

          const status = (log.status || '').toLowerCase();
          if (status === 'ready' || status === 'active') totals.ready += duration;
          else if (status === 'on_call' || status === 'on call') totals.on_call += duration;
          else if (status === 'wrap_up' || status === 'wrap up') totals.wrap_up += duration;
          else if (status === 'break') totals.break += duration;
          else if (status === 'offline') totals.offline += duration;
        });
      }

      setStats(totals);
      setLoading(false);
    };

    fetchStats();
    
    // Optional: Refresh stats every 10 seconds while modal is open
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);

  }, [agent, open, supabase]);

  if (!agent) return null;

  const totalLoginTime = stats.ready + stats.on_call + stats.wrap_up + stats.break;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span className="text-xl font-bold text-slate-800">{agent.full_name}</span>
            <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">
              Today's Report
            </Badge>
          </DialogTitle>
          <p className="text-sm text-slate-500 font-mono">{agent.phone}</p>
        </DialogHeader>

        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>
        ) : (
          <div className="space-y-4 pt-4">
            {/* Total Login Time Banner */}
            <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-700">
                <CalendarClock className="h-5 w-5" />
                <span className="font-semibold text-sm uppercase tracking-wide">Total Login Time</span>
              </div>
              <span className="text-xl font-black text-indigo-900">{formatDuration(totalLoginTime)}</span>
            </div>

            {/* Detailed Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-lg flex flex-col justify-center">
                <span className="text-xs text-emerald-600 font-bold uppercase mb-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3"/> Ready / Waiting</span>
                <span className="text-lg font-bold text-emerald-800">{formatDuration(stats.ready)}</span>
              </div>
              
              <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex flex-col justify-center">
                <span className="text-xs text-blue-600 font-bold uppercase mb-1 flex items-center gap-1"><PhoneCall className="h-3 w-3"/> On Call</span>
                <span className="text-lg font-bold text-blue-800">{formatDuration(stats.on_call)}</span>
              </div>

              <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg flex flex-col justify-center">
                <span className="text-xs text-amber-600 font-bold uppercase mb-1 flex items-center gap-1"><Clock className="h-3 w-3"/> Wrap-Up</span>
                <span className="text-lg font-bold text-amber-800">{formatDuration(stats.wrap_up)}</span>
              </div>

              <div className="bg-orange-50 border border-orange-100 p-3 rounded-lg flex flex-col justify-center">
                <span className="text-xs text-orange-600 font-bold uppercase mb-1 flex items-center gap-1"><Coffee className="h-3 w-3"/> On Break</span>
                <span className="text-lg font-bold text-orange-800">{formatDuration(stats.break)}</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex justify-between items-center px-1">
              <span className="text-sm text-slate-500 flex items-center gap-1"><Power className="h-4 w-4"/> Offline Time Logged:</span>
              <span className="text-sm font-bold text-slate-700">{formatDuration(stats.offline)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// --- SUB-COMPONENT: Live Timer for Each Agent ---
function AgentCard({ agent, onClick }: { agent: Agent, onClick: () => void }) {
  const [timer, setTimer] = useState(0)

  // Calculate time spent in current status
  useEffect(() => {
    const startTime = agent.status_updated_at ? new Date(agent.status_updated_at).getTime() : Date.now()
    setTimer(Math.floor((Date.now() - startTime) / 1000))
    const interval = setInterval(() => {
      setTimer(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [agent.status_updated_at, agent.current_status])

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return "00:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  // Visuals based on current status
  let bgColor = "bg-slate-100 border-slate-200"
  let icon = <Power className="h-5 w-5 text-slate-500" />
  let statusText = "Offline"
  let textColor = "text-slate-700"
  let isWarning = false

  const normalizedStatus = (agent.current_status || 'offline').toLowerCase()

  switch(normalizedStatus) {
    case 'ready': 
    case 'active':
      bgColor = "bg-emerald-50 border-emerald-200"
      icon = <CheckCircle2 className="h-5 w-5 text-emerald-600" />
      statusText = "Ready for Calls"
      textColor = "text-emerald-700"
      break;
    case 'on_call': 
    case 'on call':
      bgColor = "bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-400"
      icon = <PhoneCall className="h-5 w-5 text-blue-600 animate-pulse" />
      statusText = "On Call"
      textColor = "text-blue-700"
      break;
    case 'wrap_up': 
    case 'wrap up':
      bgColor = "bg-amber-50 border-amber-200"
      icon = <Clock className="h-5 w-5 text-amber-600" />
      statusText = "Wrap-Up (Notes)"
      textColor = "text-amber-700"
      if (timer > 300) isWarning = true; 
      break;
    case 'break': 
      bgColor = "bg-orange-50 border-orange-200"
      icon = <Coffee className="h-5 w-5 text-orange-600" />
      statusText = agent.status_reason || "On Break"
      textColor = "text-orange-700"
      if (timer > 1800) isWarning = true; 
      break;
  }

  return (
    // ✅ ADDED ONCLICK AND HOVER EFFECTS TO CARD
    <Card onClick={onClick} className={`transition-all duration-300 cursor-pointer hover:shadow-md hover:scale-[1.02] ${bgColor}`}>
      <CardContent className="p-5 flex flex-col justify-between h-full">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-lg text-slate-800">{agent.full_name || "Unknown Agent"}</h3>
            <p className="text-xs text-slate-500 font-mono">{agent.phone || "No Phone"}</p>
          </div>
          <div className={`p-2 rounded-full bg-white shadow-sm`}>
            {icon}
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-auto pt-4 border-t border-black/5">
          <Badge variant="outline" className={`border-none px-0 ${textColor} font-semibold text-sm`}>
            {statusText}
          </Badge>
          <div className={`text-sm font-bold flex items-center gap-1 ${isWarning ? 'text-red-600 animate-pulse' : 'text-slate-600'}`}>
            {isWarning && <AlertCircle className="h-4 w-4" />}
            {formatTime(timer)}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// --- MAIN PAGE ---
export default function AdminWallboardPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [activeFilter, setActiveFilter] = useState<FilterState>('all')
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null) // ✅ ADDED SELECTED AGENT STATE
  const supabase = createClient()

  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await supabase
        .from('users')
        .select('id, full_name, phone, current_status, status_reason, status_updated_at')
        .in('role', ['telecaller', 'agent'])
        .order('full_name', { ascending: true })

      if (data) setAgents(data as Agent[])
      setLoading(false)
    }

    fetchAgents()

    const channel = supabase.channel('wallboard_updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'users' 
      }, (payload) => {
        const updatedUser = payload.new as Agent
        setAgents(prev => prev.map(agent => 
          agent.id === updatedUser.id ? { ...agent, ...updatedUser } : agent
        ))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  // --- METRIC COUNTS ---
  const onlineAgents = agents.filter(a => {
      const s = (a.current_status || '').toLowerCase();
      return s !== 'offline' && s !== '';
  })
  
  const readyCount = agents.filter(a => {
      const s = (a.current_status || '').toLowerCase();
      return s === 'ready' || s === 'active';
  }).length
  
  const onCallCount = agents.filter(a => {
      const s = (a.current_status || '').toLowerCase();
      return s === 'on_call' || s === 'on call';
  }).length
  
  const breakCount = agents.filter(a => (a.current_status || '').toLowerCase() === 'break').length
  
  const offlineCount = agents.filter(a => {
      const s = (a.current_status || '').toLowerCase();
      return s === 'offline' || s === '';
  }).length

  // --- FILTER LOGIC ---
  const toggleFilter = (filterName: FilterState) => {
    setActiveFilter(prev => prev === filterName ? 'all' : filterName)
  }

  const filteredAgents = agents.filter(a => {
    const s = (a.current_status || 'offline').toLowerCase();
    if (activeFilter === 'all') return true;
    if (activeFilter === 'online') return s !== 'offline' && s !== '';
    if (activeFilter === 'ready') return s === 'ready' || s === 'active';
    if (activeFilter === 'on_call') return s === 'on_call' || s === 'on call';
    if (activeFilter === 'break') return s === 'break';
    if (activeFilter === 'offline') return s === 'offline' || s === '';
    return true;
  })

  const filterLabels = {
    all: "All Agents",
    online: "Total Online",
    ready: "Ready (Waiting)",
    on_call: "On Active Call",
    break: "On Break",
    offline: "Offline"
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600" />
            Live Floor Wallboard
          </h1>
          <p className="text-slate-500 mt-1">Real-time monitoring of all telecaller activities.</p>
        </div>
      </div>

      {/* METRICS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        
        <Card 
          onClick={() => toggleFilter('online')}
          className={`bg-white shadow-sm border-slate-200 cursor-pointer hover:shadow-md transition-all ${activeFilter === 'online' ? 'ring-2 ring-indigo-500 scale-[1.02]' : 'hover:scale-[1.02]'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Online</p>
              <h2 className="text-3xl font-bold text-slate-800">{onlineAgents.length}</h2>
            </div>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activeFilter === 'online' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
              <Users />
            </div>
          </CardContent>
        </Card>
        
        <Card 
          onClick={() => toggleFilter('ready')}
          className={`bg-emerald-50 border-emerald-200 shadow-sm cursor-pointer hover:shadow-md transition-all ${activeFilter === 'ready' ? 'ring-2 ring-emerald-500 scale-[1.02]' : 'hover:scale-[1.02]'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 font-medium">Ready (Waiting)</p>
              <h2 className="text-3xl font-bold text-emerald-700">{readyCount}</h2>
            </div>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activeFilter === 'ready' ? 'bg-emerald-600 text-white' : 'bg-emerald-200 text-emerald-700'}`}>
              <CheckCircle2 />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => toggleFilter('on_call')}
          className={`bg-blue-50 border-blue-200 shadow-sm cursor-pointer hover:shadow-md transition-all ${activeFilter === 'on_call' ? 'ring-2 ring-blue-500 scale-[1.02]' : 'hover:scale-[1.02]'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">On Active Call</p>
              <h2 className="text-3xl font-bold text-blue-700">{onCallCount}</h2>
            </div>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activeFilter === 'on_call' ? 'bg-blue-600 text-white' : 'bg-blue-200 text-blue-700'}`}>
              <PhoneCall />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => toggleFilter('break')}
          className={`bg-orange-50 border-orange-200 shadow-sm cursor-pointer hover:shadow-md transition-all ${activeFilter === 'break' ? 'ring-2 ring-orange-500 scale-[1.02]' : 'hover:scale-[1.02]'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">On Break</p>
              <h2 className="text-3xl font-bold text-orange-700">{breakCount}</h2>
            </div>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activeFilter === 'break' ? 'bg-orange-600 text-white' : 'bg-orange-200 text-orange-700'}`}>
              <Coffee />
            </div>
          </CardContent>
        </Card>

        <Card 
          onClick={() => toggleFilter('offline')}
          className={`bg-slate-50 border-slate-200 shadow-sm cursor-pointer hover:shadow-md transition-all ${activeFilter === 'offline' ? 'ring-2 ring-slate-500 scale-[1.02]' : 'hover:scale-[1.02]'}`}
        >
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Offline</p>
              <h2 className="text-3xl font-bold text-slate-700">{offlineCount}</h2>
            </div>
            <div className={`h-10 w-10 rounded-full flex items-center justify-center ${activeFilter === 'offline' ? 'bg-slate-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
              <Power />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* AGENT GRID */}
      <div className="flex items-end justify-between mt-8 mb-4 border-b pb-2">
        <h3 className="text-lg font-bold text-slate-700">
          Agent Status Grid 
          <span className="text-sm font-normal text-slate-500 ml-2">
            ({activeFilter === 'all' ? 'Showing All Agents' : `Filtered: ${filterLabels[activeFilter]}`})
          </span>
        </h3>
        {activeFilter !== 'all' && (
          <button 
            onClick={() => setActiveFilter('all')} 
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Clear Filter
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredAgents.map(agent => (
          {/* ✅ UPDATED CARD WITH ONCLICK */}
          <AgentCard key={agent.id} agent={agent} onClick={() => setSelectedAgent(agent)} />
        ))}
        {filteredAgents.length === 0 && (
          <div className="col-span-full text-center p-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
            {activeFilter === 'all' 
              ? "No telecallers found in the database." 
              : `No agents currently matching: ${filterLabels[activeFilter]}`
            }
          </div>
        )}
      </div>

      {/* ✅ ADDED THE MODAL TO THE PAGE */}
      <AgentStatsModal 
        agent={selectedAgent} 
        open={!!selectedAgent} 
        onClose={() => setSelectedAgent(null)} 
      />

    </div>
  )
}
