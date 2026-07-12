"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarChart, Download, PhoneOutgoing, PhoneCall, Clock, Coins, Hash, Loader2, PieChart as PieChartIcon, Activity, AlertCircle } from "lucide-react"
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts"
import { toast } from "sonner"

export default function IvrReportsPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [selectedBatch, setSelectedBatch] = useState<string>("")
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // Load available batches on mount
  useEffect(() => {
    const fetchBatches = async () => {
      const { data } = await supabase.from('ivr_campaign_history')
        .select('id, lead_batch_name, campaign_name, created_at')
        .order('created_at', { ascending: false })
      
      if (data && data.length > 0) {
        setBatches(data)
        setSelectedBatch(data[0].id) 
      }
    }
    fetchBatches()
  }, [supabase])

  // Load logs when a batch is selected
  useEffect(() => {
    if (!selectedBatch) return
    
    const fetchLogs = async () => {
      setLoading(true)
      const { data } = await supabase.from('ivr_call_logs')
        .select('*')
        .eq('batch_id', selectedBatch)
        .order('created_at', { ascending: false })
      
      if (data) setLogs(data)
      setLoading(false)
    }
    fetchLogs()
  }, [selectedBatch, supabase])

  // Process data for KPIs and Charts
  const analytics = useMemo(() => {
    const attempted = logs.length;
    const answeredLogs = logs.filter(d => d.disposition === 'ANSWERED');
    const connected = answeredLogs.length;
    const dtmfPressed = logs.filter(d => d.digits_pressed !== null && d.digits_pressed !== "").length;
    const totalBillSec = logs.reduce((acc, curr) => acc + (curr.bill_seconds || 0), 0);
    const creditsUsed = logs.reduce((acc, curr) => acc + (curr.credits_used || 0), 0);
    const listenRate = attempted > 0 ? Math.round((connected / attempted) * 100) : 0;

    // Data for Pie Chart (Dispositions)
    const dispositionsMap: Record<string, number> = {};
    logs.forEach(l => {
        const d = l.disposition || 'UNKNOWN';
        dispositionsMap[d] = (dispositionsMap[d] || 0) + 1;
    });
    const pieData = Object.keys(dispositionsMap).map(key => ({ name: key, value: dispositionsMap[key] }));

    // Data for Timeline Chart (Calls per hour based on created_at or answer_date)
    const timelineMap: Record<string, number> = {};
    logs.forEach(l => {
        if (!l.created_at) return;
        const hour = new Date(l.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }).substring(0, 5); // Just HH:mm group
        // Round to nearest 10 mins for better grouping if many calls, or just use sequence
        // For simplicity, we just sequence them if they were batched
        timelineMap[hour] = (timelineMap[hour] || 0) + 1;
    });
    // Sort and map
    const areaData = Object.keys(timelineMap).sort().map(key => ({ time: key, calls: timelineMap[key] }));

    return {
        kpis: { attempted, connected, dtmfPressed, totalBillSec, creditsUsed, listenRate },
        pieData,
        areaData
    }
  }, [logs])

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const exportCSV = (type: 'detailed' | 'dtmf') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "mobileNumber,attemptNum,startDate,answerDate,endDate,callDuration,billSeconds,disposition,hangupCause,hangupCode,clid,dtmfTime,digitsPressed\n";

    let dataToExport = logs;
    if (type === 'dtmf') {
        dataToExport = logs.filter(row => row.digits_pressed !== null && row.digits_pressed !== "");
    }

    if (dataToExport.length === 0) return toast.error("No data to export.");

    dataToExport.forEach(row => {
        const r = [
            row.mobile_number || "",
            row.attempt_num || "1",
            row.start_date || "",
            row.answer_date || "",
            row.end_date || "",
            row.call_duration || "0",
            row.bill_seconds || "0",
            row.disposition || "",
            row.hangup_cause || "",
            row.hangup_code || "",
            row.clid || "",
            "", 
            row.digits_pressed || ""
        ];
        csvContent += r.join(",") + "\n";
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Campaign_Report_${type}_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Download started successfully.");
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <BarChart className="h-8 w-8 text-indigo-600 drop-shadow-sm" /> Campaign Analytics
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Analyze CDR logs, digit presses, and campaign performance metrics.</p>
        </div>
        
        <div className="w-full md:w-80 relative z-20">
            <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 block">Select Campaign Batch</Label>
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="bg-white border-slate-200 shadow-sm rounded-xl h-11 font-medium focus:ring-indigo-500">
                    <SelectValue placeholder="Select Campaign Batch..." />
                </SelectTrigger>
                <SelectContent>
                    {batches.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                            {b.lead_batch_name} <span className="text-slate-400 text-xs ml-2">({new Date(b.created_at).toLocaleDateString()})</span>
                        </SelectItem>
                    ))}
                    {batches.length === 0 && <div className="p-4 text-center text-sm text-slate-500">No campaigns found</div>}
                </SelectContent>
            </Select>
        </div>
      </div>

      {selectedBatch && (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <Card className="border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center bg-white h-full">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Attempted</p>
                        <h3 className="text-3xl font-black text-slate-800 flex items-center gap-2"><PhoneOutgoing className="w-5 h-5 text-slate-400"/>{analytics.kpis.attempted}</h3>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-emerald-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center bg-emerald-50/30 h-full">
                        <p className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-widest mb-2">Connected</p>
                        <h3 className="text-3xl font-black text-emerald-600 flex items-center gap-2"><PhoneCall className="w-5 h-5"/>{analytics.kpis.connected}</h3>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-purple-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-purple-500" />
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center bg-purple-50/30 h-full">
                        <p className="text-[10px] text-purple-600/70 font-bold uppercase tracking-widest mb-2">DTMF Inputs</p>
                        <h3 className="text-3xl font-black text-purple-600 flex items-center gap-2"><Hash className="w-5 h-5"/>{analytics.kpis.dtmfPressed}</h3>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-blue-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-blue-500" />
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center bg-blue-50/30 h-full">
                        <p className="text-[10px] text-blue-600/70 font-bold uppercase tracking-widest mb-2">Listen Rate</p>
                        <h3 className="text-3xl font-black text-blue-600 flex items-center gap-2"><Activity className="w-5 h-5"/>{analytics.kpis.listenRate}%</h3>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center bg-white h-full">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-2">Total Bill Sec</p>
                        <h3 className="text-3xl font-black text-slate-800 flex items-center gap-2"><Clock className="w-5 h-5 text-slate-400"/>{analytics.kpis.totalBillSec}s</h3>
                    </CardContent>
                </Card>
                <Card className="border-0 shadow-sm ring-1 ring-amber-200 rounded-2xl overflow-hidden hover:shadow-md transition-shadow relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-amber-500" />
                    <CardContent className="p-5 flex flex-col items-center justify-center text-center bg-amber-50 h-full">
                        <p className="text-[10px] text-amber-600/70 font-bold uppercase tracking-widest mb-2">Credits Used</p>
                        <h3 className="text-3xl font-black text-amber-600 flex items-center gap-2"><Coins className="w-5 h-5"/>{analytics.kpis.creditsUsed}</h3>
                    </CardContent>
                </Card>
            </div>

            {/* CHARTS SECTION */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl bg-white overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 py-4">
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-indigo-500" /> Connect Timeline
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-[300px]">
                        {loading ? (
                            <div className="w-full h-full flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
                        ) : analytics.areaData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={analytics.areaData}>
                                    <defs>
                                        <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dx={-10} />
                                    <RechartsTooltip 
                                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                                        itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                                    />
                                    <Area type="monotone" dataKey="calls" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorCalls)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                                <AlertCircle className="w-8 h-8 mb-2" />
                                <p className="text-sm font-medium">No timeline data available</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl bg-white overflow-hidden">
                    <CardHeader className="border-b bg-slate-50/50 py-4">
                        <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <PieChartIcon className="w-4 h-4 text-indigo-500" /> Dispositions Breakdown
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 h-[300px] flex items-center justify-center">
                        {loading ? (
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                        ) : analytics.pieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={analytics.pieData}
                                        cx="50%"
                                        cy="45%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {analytics.pieData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip 
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                    />
                                    <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '600', color: '#475569' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                             <div className="flex flex-col items-center justify-center text-slate-400">
                                <AlertCircle className="w-8 h-8 mb-2" />
                                <p className="text-sm font-medium">No disposition data</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ACTION BAR */}
            <div className="flex justify-between items-end">
                <h3 className="text-lg font-bold text-slate-800">Call Detail Records</h3>
                <div className="flex gap-3">
                    <Button variant="outline" className="text-purple-700 border-purple-200 hover:bg-purple-50 rounded-full font-semibold shadow-sm" onClick={() => exportCSV('dtmf')}>
                        <Download className="w-4 h-4 mr-2" /> Download DTMF Only
                    </Button>
                    <Button className="bg-indigo-600 hover:bg-indigo-700 rounded-full font-bold shadow-md transition-all active:scale-95" onClick={() => exportCSV('detailed')}>
                        <Download className="w-4 h-4 mr-2" /> Download Full Report
                    </Button>
                </div>
            </div>

            {/* DATA TABLE */}
            <Card className="border-0 shadow-sm ring-1 ring-slate-200 rounded-2xl bg-white overflow-hidden">
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center p-16"><Loader2 className="w-10 h-10 animate-spin text-indigo-600" /></div>
                    ) : (
                        <div className="max-h-[500px] overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-50/90 backdrop-blur-md shadow-sm z-10 border-b">
                                    <TableRow>
                                        <TableHead className="font-bold text-slate-700">Phone Number</TableHead>
                                        <TableHead className="font-bold text-slate-700">Disposition</TableHead>
                                        <TableHead className="text-center font-bold text-slate-700">Duration</TableHead>
                                        <TableHead className="text-center font-bold text-slate-700">Bill Sec</TableHead>
                                        <TableHead className="text-center font-bold text-slate-700">DTMF Input</TableHead>
                                        <TableHead className="text-right font-bold text-slate-700">Credits</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors">
                                            <TableCell className="font-bold text-slate-800">{log.mobile_number}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" 
                                                       className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 border ${
                                                        log.disposition === 'ANSWERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                                        log.disposition === 'FAILED' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
                                                        'bg-slate-100 text-slate-600 border-slate-200'
                                                       }`}>
                                                    {log.disposition}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center text-sm font-medium text-slate-500">{log.call_duration}s</TableCell>
                                            <TableCell className="text-center text-sm font-mono font-bold text-slate-700">{log.bill_seconds}s</TableCell>
                                            <TableCell className="text-center">
                                                {log.digits_pressed ? (
                                                    <Badge className="bg-purple-100 text-purple-800 border-0 font-black px-2.5 py-0.5 shadow-sm text-sm">{log.digits_pressed}</Badge>
                                                ) : <span className="text-slate-300">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-black text-amber-600">
                                                {log.credits_used ? `-${Math.abs(log.credits_used)}` : '0'}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {logs.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="text-center py-16 text-slate-500 font-medium">No logs found for this batch.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
          </>
      )}
    </div>
  )
}
