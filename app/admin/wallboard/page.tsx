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

// --- SUB-COMPONENT: Live Timer for Each Agent ---
function AgentCard({ agent }: { agent: Agent }) {
  const [timer, setTimer] = useState(0)

  // Calculate time spent in current status
  useEffect(() => {
    // 💡 BUG FIX: Safe fallback if status_updated_at is missing so Math doesn't return NaN
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

  // 💡 BUG FIX: Normalize the status string to lowercase so 'Active' and 'active' both work
  const normalizedStatus = (agent.current_status || 'offline').toLowerCase()

  switch(normalizedStatus) {
    case 'ready': 
    case 'active': // 💡 ADDED THIS: Now it catches the Auto-Dialer's status!
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

  // 💡 BUG FIX: Metrics calculations also updated to recognize 'active' as a valid Ready state
  const onlineAgents = agents.filter(a => {
      const s = (a.current_status || '').toLowerCase();
      return s !== 'offline' && s !== '';
  })
  
  const readyCount = agents.filter(a => {
      const s = (a.current_status || '').toLowerCase();
      return s === 'ready' || s === 'active';
  }).length
  
  const onCallCount = agents.filter(a => (a.current_status || '').toLowerCase() === 'on_call').length
  const breakCount = agents.filter(a => (a.current_status || '').toLowerCase() === 'break').length

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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white shadow-sm border-slate-200">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Online</p>
              <h2 className="text-3xl font-bold text-slate-800">{onlineAgents.length}</h2>
            </div>
            <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600"><Users /></div>
          </CardContent>
        </Card>
        
        <Card className="bg-emerald-50 border-emerald-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600 font-medium">Ready (Waiting)</p>
              <h2 className="text-3xl font-bold text-emerald-700">{readyCount}</h2>
            </div>
            <div className="h-10 w-10 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-700"><CheckCircle2 /></div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium">On Active Call</p>
              <h2 className="text-3xl font-bold text-blue-700">{onCallCount}</h2>
            </div>
            <div className="h-10 w-10 bg-blue-200 rounded-full flex items-center justify-center text-blue-700"><PhoneCall /></div>
          </CardContent>
        </Card>

        <Card className="bg-orange-50 border-orange-200 shadow-sm">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-600 font-medium">On Break</p>
              <h2 className="text-3xl font-bold text-orange-700">{breakCount}</h2>
            </div>
            <div className="h-10 w-10 bg-orange-200 rounded-full flex items-center justify-center text-orange-700"><Coffee /></div>
          </CardContent>
        </Card>
      </div>

      {/* AGENT GRID */}
      <h3 className="text-lg font-bold text-slate-700 mt-8 mb-4 border-b pb-2">Agent Status Grid</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map(agent => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
        {agents.length === 0 && (
          <div className="col-span-full text-center p-10 text-slate-500 bg-slate-50 rounded-lg border border-dashed">
            No telecallers found in the database.
          </div>
        )}
      </div>
    </div>
  )
}
