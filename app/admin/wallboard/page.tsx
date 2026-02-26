"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Users, PhoneCall, Coffee, Power, Clock, CheckCircle2, Loader2, AlertCircle 
} from "lucide-react"

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

// --- SUB-COMPONENT: Live Timer for Each Agent ---
function AgentCard({ agent }: { agent: Agent }) {
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
    <Card className={`transition-all duration-300 ${bgColor}`}>
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

      {/* METRICS ROW - NOW CLICKABLE! */}
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
          <AgentCard key={agent.id} agent={agent} />
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
    </div>
  )
}
