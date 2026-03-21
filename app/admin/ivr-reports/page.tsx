// app/admin/ivr-reports/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download, Phone, Loader2, Calendar } from "lucide-react"

export default function IvrReportsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchLogs = async () => {
      // Fetch IVR call logs and their associated ledger deduction if it exists
      const { data } = await supabase
        .from('call_logs')
        .select(`
            *,
            wallet_ledger ( credits )
        `)
        .eq('call_type', 'ivr_campaign')
        .order('created_at', { ascending: false })
        .limit(100)

      if (data) setLogs(data)
      setLoading(false)
    }
    fetchLogs()
  }, [supabase])

  const handleDownloadCSV = () => {
    if (logs.length === 0) return

    // Create CSV Headers
    const headers = ["Date", "Phone Number", "Status", "Duration (sec)", "Credits Deducted", "Notes"]
    
    // Map data rows
    const csvRows = logs.map(log => {
      const date = new Date(log.created_at).toLocaleString('en-IN').replace(',', '')
      // Extract phone from notes or metadata if needed, assuming it's in notes or we parse it
      const credits = log.wallet_ledger?.[0]?.credits ? Math.abs(log.wallet_ledger[0].credits) : 0
      
      // Escape commas in notes
      const safeNotes = `"${(log.notes || "").replace(/"/g, '""')}"`

      return `${date},${log.metadata?.phone || log.metadata?.dst || 'N/A'},${log.disposition},${log.duration_seconds},${credits},${safeNotes}`
    })

    const csvContent = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `IVR_Campaign_Report_${new Date().toISOString().split('T')[0]}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Phone className="h-8 w-8 text-indigo-600" /> IVR Call Reports
          </h1>
          <p className="text-slate-500 mt-1">Detailed logs of all automated campaign dials and billing metrics.</p>
        </div>
        <Button onClick={handleDownloadCSV} className="bg-indigo-600 hover:bg-indigo-700" disabled={logs.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export to CSV
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b pb-4">
          <CardTitle className="text-lg">Recent Dials</CardTitle>
          <CardDescription>Showing the last 100 calls from your campaigns.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Duration</TableHead>
                <TableHead className="text-right">Credits Used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                 <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600"/></TableCell></TableRow>
              ) : logs.length === 0 ? (
                 <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-500">No IVR call logs found.</TableCell></TableRow>
              ) : (
                logs.map((log) => {
                    const credits = log.wallet_ledger?.[0]?.credits ? Math.abs(log.wallet_ledger[0].credits) : 0;
                    return (
                        <TableRow key={log.id}>
                        <TableCell className="text-xs text-slate-500 flex items-center gap-2">
                            <Calendar className="w-3 h-3"/>
                            {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </TableCell>
                        <TableCell className="font-medium text-slate-700">
                            {log.metadata?.phone || log.metadata?.dst || "Hidden"}
                        </TableCell>
                        <TableCell>
                            <Badge variant={log.disposition === 'ANSWERED' ? 'default' : 'secondary'} 
                                   className={log.disposition === 'ANSWERED' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : ''}>
                                {log.disposition}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono text-sm">{log.duration_seconds}s</TableCell>
                        <TableCell className={`text-right font-bold ${credits > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                            {credits > 0 ? `-${credits}` : '0'}
                        </TableCell>
                        </TableRow>
                    )
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
