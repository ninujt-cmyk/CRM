"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { 
  Settings, Megaphone, UploadCloud, Play, Loader2, FileSpreadsheet, 
  Coins, ArrowUpRight, Receipt, PhoneCall, Download, Wand2, RefreshCw, AlertTriangle, BarChart, RotateCcw, Calendar, CheckCircle2, FileUp, X
} from "lucide-react"
import { toast } from "sonner"
import { launchIvrCampaign } from "@/app/actions/ivr-actions"

type DateFilter = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom'

export default function IvrCampaignsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [batchName, setBatchName] = useState("")
  const [selectedConfigId, setSelectedConfigId] = useState("")
  const [retryCount, setRetryCount] = useState("1")
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Campaign State
  const [configs, setConfigs] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  
  // Wallet State
  const [balance, setBalance] = useState<number>(0)
  const [usedCredits, setUsedCredits] = useState<number>(0)
  const [ledger, setLedger] = useState<any[]>([])

  const [dateFilter, setDateFilter] = useState<DateFilter>('today')
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false)
  const alertShownRef = useRef(false) 

  const supabase = createClient()

  const getDateRange = useCallback(() => {
    const now = new Date()
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let start: Date, end: Date

    switch (dateFilter) {
        case 'today':
            start = startOfToday
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            break
        case 'yesterday':
            start = new Date(startOfToday)
            start.setDate(start.getDate() - 1)
            end = new Date(start)
            end.setHours(23, 59, 59)
            break
        case 'this_week':
            start = new Date(startOfToday)
            start.setDate(start.getDate() - start.getDay())
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            break
        case 'this_month':
            start = new Date(now.getFullYear(), now.getMonth(), 1)
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            break
        case 'last_month':
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59) 
            break
        case 'custom':
            if (customStart && customEnd) {
                start = new Date(customStart)
                end = new Date(customEnd)
                end.setHours(23, 59, 59)
            } else {
                start = startOfToday
                end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
            }
            break
        default:
            start = startOfToday
            end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59)
    }

    return { startIso: start.toISOString(), endIso: end.toISOString() }
  }, [dateFilter, customStart, customEnd])

  const fetchData = useCallback(async () => {
    setIsRefreshing(true)
    try {
        const { startIso, endIso } = getDateRange()

        const { data: cData } = await supabase.from('ivr_campaign_configs').select('id, campaign_name')
        if (cData) setConfigs(cData)

        const { data: wallet } = await supabase.from('tenant_wallets').select('credits_balance').maybeSingle()
        if (wallet) {
            setBalance(wallet.credits_balance || 0)
            if ((wallet.credits_balance || 0) < 1000 && !alertShownRef.current) {
                setShowLowBalanceModal(true)
                alertShownRef.current = true
            }
        }

        const { data: hData } = await supabase.from('ivr_campaign_history')
            .select('*')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: false })
            .limit(500)
        if (hData) setHistory(hData)

        const { data: lData } = await supabase.from('wallet_ledger')
            .select('*')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .order('created_at', { ascending: false })
            .limit(500)
        if (lData) setLedger(lData)

        const now = new Date();
        const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const { data: usageData } = await supabase.from('wallet_ledger')
            .select('credits')
            .lt('credits', 0)
            .gte('created_at', startOfTodayIso)
            
        if (usageData) {
          const totalUsed = usageData.reduce((acc: number, row: any) => acc + Math.abs(row.credits), 0)
          setUsedCredits(totalUsed)
        }
    } finally {
        setIsRefreshing(false)
    }
  }, [supabase, getDateRange])

  useEffect(() => { 
    fetchData() 
  }, [fetchData])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }

  const handleDragLeave = () => {
    setIsDragging(false);
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === "text/csv" || droppedFile.name.endsWith('.csv')) {
        setCsvFile(droppedFile);
      } else {
        toast.error("Please upload a valid CSV file.");
      }
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0])
    }
  }

  const handleDownloadSample = () => {
    const csvContent = "data:text/csv;charset=utf-8,Phone\n9876543210\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "sample_contacts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const exportLedgerCSV = () => {
      let csvContent = "data:text/csv;charset=utf-8,Date,Transaction Type,Description,Credits\n";
      ledger.forEach(tx => {
          const date = new Date(tx.created_at).toLocaleString('en-IN').replace(/,/g, '');
          const row = `"${date}","${tx.transaction_type}","${tx.description}",${tx.credits}`;
          csvContent += row + "\n";
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `wallet_ledger_${dateFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }

  const exportHistoryCSV = () => {
      let csvContent = "data:text/csv;charset=utf-8,Date,Campaign,Batch Name,Contacts,Status\n";
      history.forEach(h => {
          const date = new Date(h.created_at).toLocaleString('en-IN').replace(/,/g, '');
          const row = `"${date}","${h.campaign_name}","${h.lead_batch_name}",${h.total_contacts},${h.status}`;
          csvContent += row + "\n";
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `campaign_history_${dateFilter}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }

  const generateBatchName = () => {
    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleString('default', { month: 'short' }).toLowerCase()
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    
    const todaysCampaigns = history.filter(h => new Date(h.created_at) >= startOfToday)
    const nextNum = todaysCampaigns.length + 1
    setBatchName(`${day}${month}_batch${nextNum}`)
  }

  const handleLaunch = async () => {
    if (!selectedConfigId) return toast.error("Please select a Campaign Theme.")
    if (!batchName) return toast.error("Please enter a Batch Name.")
    if (!csvFile) return toast.error("Please upload a CSV file with contacts.")
    
    setIsUploading(true)

    try {
        const text = await csvFile.text()
        const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0)
        
        const phoneNumbers: string[] = []
        rows.forEach(row => {
            const cleanRow = row.replace(/\s+/g, '')
            const match = cleanRow.match(/[6-9]\d{9}/)
            if (match) phoneNumbers.push(match[0])
        })

        const uniquePhones = Array.from(new Set(phoneNumbers));
        if (uniquePhones.length === 0) throw new Error("Could not find any valid 10-digit phone numbers in the CSV.")

        const res = await launchIvrCampaign(selectedConfigId, batchName, uniquePhones, parseInt(retryCount))

        if (res.success) {
            toast.success(res.message)
            setBatchName("")
            setCsvFile(null)
            fetchData() 
        } else {
            toast.error(res.error)
        }
    } catch (err: any) {
        toast.error(err.message || "Failed to process CSV file.")
    } finally {
        setIsUploading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3 tracking-tight">
            <Megaphone className="h-8 w-8 text-indigo-600 drop-shadow-sm" /> 
            Campaign Launcher
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Broadcast IVR messages to thousands of contacts instantly.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
            <Link href="/admin/ivr-configs">
                <Button variant="outline" className="gap-2 bg-white text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 border-indigo-200 shadow-sm transition-all rounded-full px-5">
                    <Settings className="w-4 h-4" /> Manage Configs
                </Button>
            </Link>
            <Link href="/admin/ivr-reports">
                <Button className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all rounded-full px-5">
                    <BarChart className="w-4 h-4" /> View Analytics
                </Button>
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Launch Form & Wallet Balance */}
        <div className="lg:col-span-4 space-y-6">
          
          <Card className="shadow-lg border-0 bg-white overflow-hidden rounded-2xl ring-1 ring-slate-200">
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
            <CardHeader className="bg-white pb-2 pt-6">
              <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-500" /> New Broadcast
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-slate-700">Select Campaign Theme</Label>
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl h-11"><SelectValue placeholder="Choose campaign..." /></SelectTrigger>
                    <SelectContent>
                        {configs.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-slate-700">Lead Batch Name</Label>
                    <button type="button" onClick={generateBatchName} className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold transition-colors bg-indigo-50 px-2 py-1 rounded-md">
                        <Wand2 className="w-3 h-3" /> AUTO-GENERATE
                    </button>
                </div>
                <Input placeholder="e.g. 21march_batch1" value={batchName} onChange={e=>setBatchName(e.target.value)} className="bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl h-11 font-medium" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                   Auto-Retry Strategy
                </Label>
                <Select value={retryCount} onValueChange={setRetryCount}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-indigo-500 rounded-xl h-11"><SelectValue placeholder="Select retries..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1 Retry (Standard - Saves Credits)</SelectItem>
                        <SelectItem value="2">2 Retries (Aggressive)</SelectItem>
                        <SelectItem value="3">3 Retries (Maximum Reach)</SelectItem>
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold text-slate-700">Contact List (.csv)</Label>
                    <button type="button" onClick={handleDownloadSample} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors">
                        <Download className="w-3 h-3" /> Sample Format
                    </button>
                </div>
                
                {/* Drag and Drop Zone */}
                <div 
                    className={`relative border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center text-center transition-all duration-200 ${isDragging ? 'border-indigo-500 bg-indigo-50/50 scale-[1.02]' : csvFile ? 'border-emerald-500 bg-emerald-50/30' : 'border-slate-300 bg-slate-50 hover:bg-slate-100'}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {csvFile ? (
                        <div className="flex flex-col items-center gap-2 w-full animate-in zoom-in-95 duration-200">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                            </div>
                            <p className="text-sm font-bold text-slate-800 truncate w-full px-4">{csvFile.name}</p>
                            <p className="text-xs text-slate-500">{(csvFile.size / 1024).toFixed(2)} KB</p>
                            <button onClick={() => setCsvFile(null)} className="absolute top-2 right-2 p-1 bg-white rounded-full text-slate-400 hover:text-rose-500 shadow-sm border border-slate-100">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center mb-3">
                                <FileUp className="w-5 h-5 text-slate-400" />
                            </div>
                            <p className="text-sm font-semibold text-slate-700">Drag & drop your CSV here</p>
                            <p className="text-xs text-slate-500 mt-1 mb-4">or click to browse from files</p>
                            <Button variant="outline" size="sm" className="bg-white border-slate-200 shadow-sm rounded-full text-xs" onClick={() => document.getElementById('csv-upload')?.click()}>
                                Select File
                            </Button>
                            <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
                        </>
                    )}
                </div>
              </div>

              <Button onClick={handleLaunch} disabled={isUploading || !csvFile || !batchName || !selectedConfigId} className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-md mt-4 h-12 rounded-xl text-base font-semibold tracking-wide transition-all active:scale-[0.98]">
                 {isUploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <Play className="w-5 h-5 mr-2 fill-current"/>}
                 {isUploading ? 'Launching...' : 'Launch Campaign'}
              </Button>
            </CardContent>
          </Card>

          {/* Premium Wallet Card */}
          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 border-0 shadow-lg relative overflow-hidden rounded-2xl text-white">
            {/* Background Decorations */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 w-32 h-32 bg-white/10 rounded-full blur-2xl" />
            <div className="absolute bottom-0 left-0 -mb-8 -ml-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl" />
            
            <CardContent className="p-6 relative z-10">
              <div className="flex items-center gap-2 text-slate-300 font-medium text-sm mb-4">
                 <Coins className="h-4 w-4 text-amber-400" /> Wallet Balance
              </div>
              
              <div className="flex justify-between items-end">
                  <div>
                    <h2 className={`text-4xl font-black tracking-tight ${balance < 1000 ? 'text-rose-400' : 'text-white'}`}>
                      {balance.toLocaleString()}
                    </h2>
                    <p className="text-slate-400 text-xs mt-1 font-medium tracking-wide">AVAILABLE CREDITS</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold text-slate-300">
                      -{usedCredits.toLocaleString()}
                    </h2>
                    <p className="text-slate-400 text-xs mt-1 font-medium tracking-wide">USED TODAY</p>
                  </div>
              </div>

              {balance < 1000 && (
                  <div className="mt-5 bg-rose-500/20 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2 backdrop-blur-md">
                      <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-rose-200 leading-snug font-medium">Low balance warning. Contact your account manager to recharge.</p>
                  </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: History Tables with Filters */}
        <div className="lg:col-span-8 space-y-6">
          
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm gap-4 ring-1 ring-slate-900/5">
             <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Calendar className="w-5 h-5 text-indigo-500" /> Activity Timeline
             </div>
             
             <div className="flex items-center gap-3">
                 {dateFilter === 'custom' && (
                     <div className="flex items-center gap-2 animate-in slide-in-from-right-5">
                         <Input type="date" className="h-9 w-[130px] text-xs border-slate-300 rounded-lg focus:ring-indigo-500" value={customStart} onChange={e=>setCustomStart(e.target.value)} />
                         <span className="text-slate-400">-</span>
                         <Input type="date" className="h-9 w-[130px] text-xs border-slate-300 rounded-lg focus:ring-indigo-500" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} />
                     </div>
                 )}
                 <Select value={dateFilter} onValueChange={(v:any) => setDateFilter(v)}>
                    <SelectTrigger className="w-[150px] bg-white border-slate-300 h-9 rounded-lg font-medium text-slate-700">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">Today</SelectItem>
                        <SelectItem value="yesterday">Yesterday</SelectItem>
                        <SelectItem value="this_week">This Week</SelectItem>
                        <SelectItem value="this_month">This Month</SelectItem>
                        <SelectItem value="last_month">Last Month</SelectItem>
                        <SelectItem value="custom">Custom Date</SelectItem>
                    </SelectContent>
                 </Select>

                 <Button variant="outline" size="icon" onClick={fetchData} disabled={isRefreshing} className="h-9 w-9 rounded-lg border-slate-300 text-slate-600 hover:bg-slate-50 shadow-sm">
                    <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                 </Button>
             </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
              <Card className="shadow-sm border-slate-200 rounded-2xl overflow-hidden">
                <CardHeader className="bg-white border-b py-4">
                  <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base text-slate-800 font-bold">Campaign History</CardTitle>
                        <CardDescription className="text-xs">Recent broadcasts sent to the dialer.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportHistoryCSV} className="gap-2 bg-white border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm">
                        <Download className="w-3.5 h-3.5" /> Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Date & Time</TableHead>
                        <TableHead className="font-bold text-slate-700">Campaign</TableHead>
                        <TableHead className="font-bold text-slate-700">Batch</TableHead>
                        <TableHead className="text-center font-bold text-slate-700">Volume</TableHead>
                        <TableHead className="text-right font-bold text-slate-700">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map(c => (
                          <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                              <TableCell className="text-xs font-medium text-slate-500 whitespace-nowrap">
                                  {new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </TableCell>
                              <TableCell className="font-bold text-sm text-slate-800">{c.campaign_name}</TableCell>
                              <TableCell className="text-xs font-medium text-slate-600 bg-slate-100/50 rounded px-2 py-1 inline-block mt-2">{c.lead_batch_name}</TableCell>
                              <TableCell className="text-center text-sm font-mono font-bold text-indigo-600">{c.total_contacts}</TableCell>
                              <TableCell className="text-right">
                                  <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0 text-[10px] uppercase font-bold tracking-wider px-2 py-0.5">
                                      <Play className="w-3 h-3 mr-1.5 fill-emerald-700"/> Launched
                                  </Badge>
                              </TableCell>
                          </TableRow>
                      ))}
                      {history.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center py-12 text-sm text-slate-500 font-medium">No campaigns launched during this period.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="shadow-sm border-slate-200 rounded-2xl overflow-hidden">
                <CardHeader className="bg-white border-b py-4">
                  <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base text-slate-800 font-bold flex items-center gap-2">
                            Wallet Ledger
                        </CardTitle>
                        <CardDescription className="text-xs">Credit consumption logs.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportLedgerCSV} className="gap-2 bg-white border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg shadow-sm">
                        <Download className="w-3.5 h-3.5" /> Export
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[300px] overflow-auto">
                  <Table>
                    <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                      <TableRow>
                        <TableHead className="font-bold text-slate-700">Date</TableHead>
                        <TableHead className="font-bold text-slate-700">Type</TableHead>
                        <TableHead className="font-bold text-slate-700">Description</TableHead>
                        <TableHead className="text-right font-bold text-slate-700">Credits</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledger.map((tx) => (
                        <TableRow key={tx.id} className="hover:bg-slate-50/50 transition-colors">
                          <TableCell className="text-xs font-medium text-slate-500 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                          </TableCell>
                          <TableCell>
                            {tx.transaction_type === 'RECHARGE' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0 text-[10px] font-bold"><ArrowUpRight className="w-3 h-3 mr-1"/> Recharge</Badge>}
                            {tx.transaction_type === 'C2C_CALL' && <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px] font-bold"><PhoneCall className="w-3 h-3 mr-1"/> C2C Call</Badge>}
                            {tx.transaction_type === 'IVR_CAMPAIGN' && <Badge variant="outline" className="text-indigo-700 bg-indigo-50 border-indigo-200 text-[10px] font-bold"><Megaphone className="w-3 h-3 mr-1"/> IVR Call</Badge>}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-700">{tx.description}</TableCell>
                          <TableCell className={`text-right font-black text-sm ${tx.credits > 0 ? 'text-emerald-500' : 'text-slate-800'}`}>
                            {tx.credits > 0 ? '+' : ''}{tx.credits}
                          </TableCell>
                        </TableRow>
                      ))}
                      {ledger.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-sm text-slate-500 font-medium">No transactions found for this period.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
          </div>

        </div>
      </div>

      <Dialog open={showLowBalanceModal} onOpenChange={setShowLowBalanceModal}>
        <DialogContent className="sm:max-w-md border-rose-200 bg-rose-50 shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 font-black text-xl">
              <AlertTriangle className="h-6 w-6" /> Action Required
            </DialogTitle>
            <DialogDescription className="text-rose-600/90 font-semibold text-sm mt-2">
              Your wallet balance is critically low: <span className="text-rose-900 bg-rose-200 px-2 py-0.5 rounded-md">{balance.toLocaleString()} credits</span>
            </DialogDescription>
          </DialogHeader>
          <div className="bg-white p-5 rounded-xl border border-rose-100 text-center space-y-4 shadow-sm mt-2">
            <p className="text-sm text-slate-600 leading-relaxed font-medium">
              If your balance reaches zero, active IVR campaigns will automatically pause. Please recharge immediately to avoid service disruption.
            </p>
            <Button onClick={() => setShowLowBalanceModal(false)} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-5 shadow-md rounded-xl text-base transition-all">
              Acknowledge Warning
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
