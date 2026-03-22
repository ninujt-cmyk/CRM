"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart, Download, PhoneOutgoing, PhoneCall, Clock, Coins, 
  Search, Loader2, Calendar, User, Headphones 
} from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

export default function C2CReportsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [agents, setAgents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [dateRange, setDateRange] = useState<string>("today")
  const [agentFilter, setAgentFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [search, setSearch] = useState<string>("")

  const supabase = createClient()

  useEffect(() => {
    const fetchDropdowns = async () => {
      const { data } = await supabase.from('users').select('id, full_name').in('role', ['telecaller', 'agent'])
      if (data) setAgents(data)
    }
    fetchDropdowns()
  }, [supabase])

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true)
      
      let query = supabase
        .from('call_logs')
        .select(`
          id, created_at, duration_seconds, talk_time_seconds, disposition, recording_url, credits_used,
          users:user_id (id, full_name),
          leads:lead_id (id, name, phone)
        `)
        .eq('call_type', 'outbound_c2c')
        .order('created_at', { ascending: false })
        .limit(1000) // Limit for performance, consider pagination for massive datasets

      // Apply Date Filter
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      if (dateRange === "today") {
          query = query.gte('created_at', today.toISOString())
      } else if (dateRange === "yesterday") {
          const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
          query = query.gte('created_at', yesterday.toISOString()).lt('created_at', today.toISOString())
      } else if (dateRange === "week") {
          const lastWeek = new Date(today); lastWeek.setDate(lastWeek.getDate() - 7)
          query = query.gte('created_at', lastWeek.toISOString())
      }

      if (agentFilter !== "all") query = query.eq('user_id', agentFilter)
      if (statusFilter !== "all") query = query.eq('disposition', statusFilter)

      const { data } = await query
      if (data) setLogs(data)
      setLoading(false)
    }

    fetchLogs()
  }, [dateRange, agentFilter, statusFilter, supabase])

  // --- Derived State (Search & KPIs) ---
  const filteredLogs = useMemo(() => {
      if (!search) return logs;
      const lowerSearch = search.toLowerCase();
      return logs.filter(log => 
          log.leads?.name?.toLowerCase().includes(lowerSearch) || 
          log.leads?.phone?.includes(lowerSearch) ||
          log.users?.full_name?.toLowerCase().includes(lowerSearch)
      );
  }, [logs, search]);

  const kpis = useMemo(() => {
      const attempted = filteredLogs.length;
      const connected = filteredLogs.filter(d => d.disposition === 'ANSWERED').length;
      const totalTalkTime = filteredLogs.reduce((acc, curr) => acc + (curr.talk_time_seconds || 0), 0);
      const totalCredits = filteredLogs.reduce((acc, curr) => acc + (curr.credits_used || 0), 0);
      
      // Build Chart Data (Group by Day or Hour)
      const chartMap = new Map();
      filteredLogs.forEach(log => {
          // If 'today', group by hour. Else group by day.
          const dateObj = new Date(log.created_at);
          const key = dateRange === 'today' 
              ? `${dateObj.getHours()}:00` 
              : dateObj.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
          
          if (!chartMap.has(key)) chartMap.set(key, { name: key, calls: 0, connected: 0 });
          const entry = chartMap.get(key);
          entry.calls += 1;
          if (log.disposition === 'ANSWERED') entry.connected += 1;
      });

      const chartData = Array.from(chartMap.values()).reverse(); // Reverse so oldest is left, newest right

      return { attempted, connected, totalTalkTime, totalCredits, chartData };
  }, [filteredLogs, dateRange]);

  const formatTime = (seconds: number) => {
      if (!seconds) return "0s";
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Date,Agent,Customer Name,Phone,Status,Ring Duration,Talk Time,Credits,Recording URL\n";
    filteredLogs.forEach(row => {
        const r = [
            new Date(row.created_at).toLocaleString('en-IN'),
            `"${row.users?.full_name || 'Unknown'}"`,
            `"${row.leads?.name || 'Unknown'}"`,
            row.leads?.phone || "",
            row.disposition || "",
            row.duration_seconds || 0,
            row.talk_time_seconds || 0,
            row.credits_used || 0,
            row.recording_url || ""
        ];
        csvContent += r.join(",") + "\n";
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `C2C_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      
      {/* HEADER & FILTERS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Headphones className="h-8 w-8 text-indigo-600" /> Click-to-Call Analytics
          </h1>
          <p className="text-slate-500 mt-1">Audit agent calls, review recordings, and track wallet usage.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-[140px] bg-white"><Calendar className="w-4 h-4 mr-2 text-slate-500"/><SelectValue/></SelectTrigger>
                <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="week">Last 7 Days</SelectItem>
                    <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
                <SelectTrigger className="w-[160px] bg-white"><User className="w-4 h-4 mr-2 text-slate-500"/><SelectValue placeholder="All Agents"/></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    {agents.map(a => <SelectItem key={a.id} value={a.id}>{a.full_name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] bg-white"><SelectValue placeholder="All Statuses"/></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="ANSWERED">Answered</SelectItem>
                    <SelectItem value="NO ANSWER">No Answer</SelectItem>
                    <SelectItem value="BUSY">Busy</SelectItem>
                    <SelectItem value="CANCEL">Canceled</SelectItem>
                </SelectContent>
            </Select>
            <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Search phone or name..." value={search} onChange={e=>setSearch(e.target.value)} className="pl-9 bg-white" />
            </div>
            <Button variant="outline" className="border-indigo-200 text-indigo-700 hover:bg-indigo-50" onClick={exportCSV}>
                <Download className="w-4 h-4 mr-2" /> Export
            </Button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card><CardContent className="p-5 flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Dials</p>
              <h3 className="text-3xl font-black text-slate-800 flex items-center gap-2"><PhoneOutgoing className="w-5 h-5 text-slate-400"/>{kpis.attempted}</h3>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex flex-col justify-center border-b-4 border-emerald-500">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Connected</p>
              <h3 className="text-3xl font-black text-emerald-600 flex items-center gap-2"><PhoneCall className="w-5 h-5"/>{kpis.connected}</h3>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Connection Rate</p>
              <h3 className="text-3xl font-black text-blue-600">
                  {kpis.attempted > 0 ? Math.round((kpis.connected / kpis.attempted) * 100) : 0}%
              </h3>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex flex-col justify-center">
              <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Talk Time</p>
              <h3 className="text-3xl font-black text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-slate-400"/>{formatTime(kpis.totalTalkTime)}</h3>
          </CardContent></Card>
          <Card><CardContent className="p-5 flex flex-col justify-center border-b-4 border-amber-400 bg-amber-50/30">
              <p className="text-xs text-amber-700 font-bold uppercase tracking-wider mb-1">Credits Billed</p>
              <h3 className="text-3xl font-black text-amber-600 flex items-center gap-2"><Coins className="w-5 h-5"/>{kpis.totalCredits}</h3>
          </CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CHART AREA */}
        <Card className="lg:col-span-1 shadow-sm">
            <CardHeader className="border-b bg-slate-50 py-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-indigo-500"/> Connection Trend
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={kpis.chartData}>
                        <defs>
                            <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/><stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorConn" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                        <Area type="monotone" name="Total Dials" dataKey="calls" stroke="#94a3b8" fillOpacity={1} fill="url(#colorCalls)" />
                        <Area type="monotone" name="Connected" dataKey="connected" stroke="#10b981" fillOpacity={1} fill="url(#colorConn)" />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>

        {/* DATA TABLE */}
        <Card className="lg:col-span-2 shadow-sm">
            <CardHeader className="bg-slate-50 border-b py-4">
                <CardTitle className="text-sm flex justify-between items-center">
                    <span>Call Detail Records (CDR)</span>
                    <span className="text-xs font-normal text-slate-500 bg-white px-2 py-1 rounded border">Showing {filteredLogs.length} logs</span>
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
                ) : (
                    <div className="h-[400px] overflow-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-slate-100 shadow-sm z-10">
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Customer</TableHead>
                                    <TableHead>Agent</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-center">Talk Time</TableHead>
                                    <TableHead className="text-center">Credits</TableHead>
                                    <TableHead className="text-center min-w-[200px]">Recording</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-slate-50/50">
                                        <TableCell className="text-[11px] text-slate-500 whitespace-nowrap">
                                            {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}<br/>
                                            {new Date(log.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-semibold text-slate-800 text-xs">{log.leads?.name || 'Unknown'}</div>
                                            <div className="text-[10px] text-slate-500 font-mono">{log.leads?.phone}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="font-normal text-[10px] bg-white">{log.users?.full_name?.split(' ')[0]}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={log.disposition === 'ANSWERED' ? 'default' : 'secondary'} 
                                                    className={`text-[10px] ${log.disposition === 'ANSWERED' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0' : 'bg-slate-100 text-slate-600'}`}>
                                                {log.disposition}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center font-mono text-xs text-slate-600">
                                            {formatTime(log.talk_time_seconds)}
                                        </TableCell>
                                        <TableCell className="text-center font-bold text-amber-600 text-xs">
                                            {log.credits_used > 0 ? `-${log.credits_used}` : '0'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {log.recording_url ? (
                                                <audio controls preload="none" className="h-8 w-48 mx-auto grayscale opacity-80 hover:grayscale-0 hover:opacity-100 transition-all">
                                                    <source src={log.recording_url} type="audio/wav" />
                                                </audio>
                                            ) : <span className="text-[10px] text-slate-400 italic">No audio</span>}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredLogs.length === 0 && (
                                    <TableRow><TableCell colSpan={7} className="text-center py-12 text-slate-400">No call logs match your filters.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
