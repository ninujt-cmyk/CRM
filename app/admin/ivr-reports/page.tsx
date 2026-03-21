"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { BarChart, Download, PhoneOutgoing, PhoneCall, Clock, Coins, Hash, Loader2 } from "lucide-react"

export default function IvrReportsPage() {
  const [batches, setBatches] = useState<any[]>([])
  const [selectedBatch, setSelectedBatch] = useState<string>("")
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  // KPIs
  const [kpis, setKpis] = useState({
    totalNumbers: 0, attempted: 0, connected: 0, 
    dtmfPressed: 0, totalBillSec: 0, creditsUsed: 0
  })

  // Load available batches on mount
  useEffect(() => {
    const fetchBatches = async () => {
      const { data } = await supabase.from('ivr_campaign_history')
        .select('id, lead_batch_name, campaign_name, created_at')
        .order('created_at', { ascending: false })
      if (data) setBatches(data)
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
      
      if (data) {
        setLogs(data)
        
        // Calculate KPIs
        const attempted = data.length;
        const connected = data.filter(d => d.disposition === 'ANSWERED').length;
        const dtmfPressed = data.filter(d => d.digits_pressed !== null && d.digits_pressed !== "").length;
        const totalBillSec = data.reduce((acc, curr) => acc + (curr.bill_seconds || 0), 0);
        const creditsUsed = data.reduce((acc, curr) => acc + (curr.credits_used || 0), 0);

        setKpis({
            totalNumbers: attempted, // Assuming unique numbers = attempts for this basic view
            attempted,
            connected,
            dtmfPressed,
            totalBillSec,
            creditsUsed
        })
      }
      setLoading(false)
    }
    fetchLogs()
  }, [selectedBatch, supabase])

  // CSV Exporter Helper
  const exportCSV = (type: 'detailed' | 'dtmf') => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Exact Headers you requested
    csvContent += "mobileNumber,attemptNum,startDate,answerDate,endDate,callDuration,billSeconds,disposition,hangupCause,hangupCode,clid,dtmfTime,digitsPressed\n";

    let dataToExport = logs;
    
    // Filter only DTMF rows if dtmf button clicked
    if (type === 'dtmf') {
        dataToExport = logs.filter(row => row.digits_pressed !== null && row.digits_pressed !== "");
    }

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
            "", // dtmfTime (usually hard to get exact timestamp from standard CDR, leaving blank or fill if Fonada provides)
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
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <BarChart className="h-8 w-8 text-blue-600" /> Campaign Reports
          </h1>
          <p className="text-slate-500 mt-1">Analyze CDR logs, digit presses, and billing data.</p>
        </div>
        
        <div className="w-72">
            <Select value={selectedBatch} onValueChange={setSelectedBatch}>
                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Campaign Batch..." /></SelectTrigger>
                <SelectContent>
                    {batches.map(b => (
                        <SelectItem key={b.id} value={b.id}>
                            {b.lead_batch_name} ({new Date(b.created_at).toLocaleDateString()})
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      {selectedBatch && (
          <>
            {/* KPI CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-slate-500 font-medium uppercase">Attempted</p>
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><PhoneOutgoing className="w-4 h-4"/>{kpis.attempted}</h3>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center border-b-4 border-emerald-500">
                    <p className="text-xs text-slate-500 font-medium uppercase">Connected</p>
                    <h3 className="text-2xl font-bold text-emerald-600 flex items-center gap-2"><PhoneCall className="w-4 h-4"/>{kpis.connected}</h3>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center border-b-4 border-purple-500">
                    <p className="text-xs text-slate-500 font-medium uppercase">Digits Pressed</p>
                    <h3 className="text-2xl font-bold text-purple-600 flex items-center gap-2"><Hash className="w-4 h-4"/>{kpis.dtmfPressed}</h3>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-slate-500 font-medium uppercase">Listen Rate</p>
                    {/* Basic calculation for Listen Rate: Answered / Attempted. Adjust as needed based on your business logic. */}
                    <h3 className="text-2xl font-bold text-blue-600">
                        {kpis.attempted > 0 ? Math.round((kpis.connected / kpis.attempted) * 100) : 0}%
                    </h3>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-slate-500 font-medium uppercase">Total Bill Sec</p>
                    <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-2"><Clock className="w-4 h-4"/>{kpis.totalBillSec}s</h3>
                </CardContent></Card>
                <Card><CardContent className="p-4 flex flex-col items-center justify-center text-center border-b-4 border-amber-400 bg-amber-50/30">
                    <p className="text-xs text-amber-700 font-medium uppercase">Credits Used</p>
                    <h3 className="text-2xl font-bold text-amber-600 flex items-center gap-2"><Coins className="w-4 h-4"/>{kpis.creditsUsed}</h3>
                </CardContent></Card>
            </div>

            {/* ACTION BAR */}
            <div className="flex justify-end gap-3">
                <Button variant="outline" className="text-purple-700 border-purple-200 hover:bg-purple-50" onClick={() => exportCSV('dtmf')}>
                    <Download className="w-4 h-4 mr-2" /> Download DTMF Only
                </Button>
                <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => exportCSV('detailed')}>
                    <Download className="w-4 h-4 mr-2" /> Download Full Report
                </Button>
            </div>

            {/* DATA TABLE */}
            <Card className="shadow-sm">
                <CardHeader className="bg-slate-50 border-b py-3">
                    <CardTitle className="text-sm">Call Detail Records (CDR)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="flex justify-center p-10"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>
                    ) : (
                        <div className="max-h-[500px] overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-slate-100 shadow-sm z-10">
                                    <TableRow>
                                        <TableHead>Number</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-center">Duration</TableHead>
                                        <TableHead className="text-center">Bill Sec</TableHead>
                                        <TableHead className="text-center">DTMF Input</TableHead>
                                        <TableHead className="text-right">Credits</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="font-medium text-slate-700">{log.mobile_number}</TableCell>
                                            <TableCell>
                                                <Badge variant={log.disposition === 'ANSWERED' ? 'default' : 'secondary'} 
                                                       className={log.disposition === 'ANSWERED' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0' : ''}>
                                                    {log.disposition}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-center text-slate-500">{log.call_duration}s</TableCell>
                                            <TableCell className="text-center font-mono">{log.bill_seconds}s</TableCell>
                                            <TableCell className="text-center">
                                                {log.digits_pressed ? (
                                                    <Badge className="bg-purple-100 text-purple-800 border-0">{log.digits_pressed}</Badge>
                                                ) : <span className="text-slate-300">-</span>}
                                            </TableCell>
                                            <TableCell className="text-right font-bold text-amber-600">-{log.credits_used}</TableCell>
                                        </TableRow>
                                    ))}
                                    {logs.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-400">No logs found for this batch.</TableCell></TableRow>
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
