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
  Megaphone, UploadCloud, Play, Loader2, FileSpreadsheet, 
  Coins, ArrowUpRight, Receipt, PhoneCall, TrendingDown, Download, Wand2, RefreshCw, AlertTriangle, BarChart, RotateCcw, Calendar, History
} from "lucide-react"
import { toast } from "sonner"
import { launchIvrCampaign } from "@/app/actions/ivr-actions"

type DateFilter = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom'

export default function IvrCampaignsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isGeneratingName, setIsGeneratingName] = useState(false) // New state for async name generation
  const [batchName, setBatchName] = useState("")
  const [selectedConfigId, setSelectedConfigId] = useState("")
  const [retryCount, setRetryCount] = useState("1")
  const [csvFile, setCsvFile] = useState<File | null>(null)

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

        // Fetch configs (Not date dependent)
        const { data: cData } = await supabase.from('ivr_campaign_configs').select('id, campaign_name')
        if (cData) setConfigs(cData)

        // Fetch Wallet Balance (Not date dependent)
        const { data: wallet } = await supabase.from('tenant_wallets').select('credits_balance').maybeSingle()
        if (wallet) {
            setBalance(wallet.credits_balance || 0)
            if ((wallet.credits_balance || 0) < 1000 && !alertShownRef.current) {
                setShowLowBalanceModal(true)
                alertShownRef.current = true
            }
        }

        // Fetch Data Based on Date Range
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

        // Today's Usage
        const now = new Date();
        const startOfTodayIso = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

        const { data: usageData } = await supabase.from('wallet_ledger')
            .select('credits')
            .lt('credits', 0)
            .gte('created_at', startOfTodayIso)
            
        if (usageData) {
          const totalUsed = usageData.reduce((acc, row) => acc + Math.abs(row.credits), 0)
          setUsedCredits(totalUsed)
        }
    } finally {
        setIsRefreshing(false)
    }
  }, [supabase, getDateRange])

  useEffect(() => { 
    fetchData() 
  }, [fetchData])

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

  // 🔴 THE FIX: Asynchronous Batch Name Generation from the DB
  const generateBatchName = async () => {
    setIsGeneratingName(true)
    try {
        const today = new Date()
        const day = String(today.getDate()).padStart(2, '0')
        const month = today.toLocaleString('default', { month: 'short' }).toLowerCase()
        
        const startOfTodayIso = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()

        // Direct DB query to get absolute count of today's campaigns, ignoring local UI filters
        const { count, error } = await supabase
            .from('ivr_campaign_history')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', startOfTodayIso)

        if (error) throw error

        const nextNum = (count || 0) + 1
        setBatchName(`${day}${month}_batch${nextNum}`)
    } catch (err) {
        console.error("Failed to generate batch name:", err)
        toast.error("Failed to auto-generate. Please enter manually.")
    } finally {
        setIsGeneratingName(false)
    }
  }

  const handleLaunch = async () => {
    if (!selectedConfigId || !batchName || !csvFile) {
        return toast.error("Please fill all fields and select a CSV file.")
    }
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
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-slate-50/50 min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 flex items-center gap-3 tracking-tight">
            <Megaphone className="h-8 w-8 text-indigo-600" /> IVR Auto-Dialer
          </h1>
          <p className="text-slate-500 mt-1.5 font-medium">Launch automated blasts and track real-time telecom ledger activity.</p>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
            <Link href="/admin/ivr-reports" className="flex-1 md:flex-none">
                <Button variant="outline" className="w-full gap-2 bg-white text-indigo-700 hover:text-indigo-800 hover:bg-indigo-50 border-indigo-200 shadow-sm font-semibold">
                    <BarChart className="w-4 h-4" /> IVR Reports
                </Button>
            </Link>
            <Link href="/admin/c2c-reports" className="flex-1 md:flex-none">
                <Button variant="outline" className="w-full gap-2 bg-white text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200 shadow-sm font-semibold">
                    <PhoneCall className="w-4 h-4" /> C2C Reports
                </Button>
            </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT COLUMN: Launch Form & Wallet Balance */}
        <div className="lg:col-span-4 space-y-6">
          
          <Card className="shadow-md border-slate-200 bg-white overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 py-5">
              <CardTitle className="text-lg text-white font-bold flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-indigo-300" /> New Campaign
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-bold text-slate-700">Select Campaign Theme</Label>
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 shadow-sm focus:ring-indigo-500"><SelectValue placeholder="Choose campaign..." /></SelectTrigger>
                    <SelectContent>
                        {configs.map(c => (
                            <SelectItem key={c.id} value={c.id} className="font-medium">{c.campaign_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-bold text-slate-700">Lead Batch Name</Label>
                    <button 
                      type="button" 
                      onClick={generateBatchName} 
                      disabled={isGeneratingName}
                      className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-bold transition-colors disabled:opacity-50"
                    >
                        {isGeneratingName ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                        Auto-Generate
                    </button>
                </div>
                <Input placeholder="e.g. 21mar_batch1" value={batchName} onChange={e=>setBatchName(e.target.value)} className="bg-slate-50 border-slate-200 shadow-sm focus-visible:ring-indigo-500" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <RotateCcw className="w-4 h-4 text-indigo-500" /> Auto-Retry Count
                </Label>
                <Select value={retryCount} onValueChange={setRetryCount}>
                    <SelectTrigger className="bg-slate-50 border-slate-200 shadow-sm focus:ring-indigo-500"><SelectValue placeholder="Select retries..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1 Retry (Standard)</SelectItem>
                        <SelectItem value="2">2 Retries (Aggressive)</SelectItem>
                        <SelectItem value="3">3 Retries (Maximum)</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-400 font-medium">Automatic retries for failed/unanswered calls.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500"/> Contact List (.csv)
                    </Label>
                    <button type="button" onClick={handleDownloadSample} className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-bold transition-colors">
                        <Download className="w-3 h-3" /> Sample CSV
                    </button>
                </div>
                <Input type="file" accept=".csv" onChange={handleFileChange} className="cursor-pointer bg-slate-50 border-slate-200 text-sm shadow-sm file:text-indigo-600 file:font-semibold file:bg-indigo-50 file:border-0 file:mr-4 file:px-4 file:py-1 file:rounded-full hover:file:bg-indigo-100 transition-all" />
                <p className="text-[11px] text-slate-400 font-medium">Requires valid 10-digit mobile numbers.</p>
              </div>

              <Button onClick={handleLaunch} disabled={isUploading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-md mt-4 py-6">
                 {isUploading ? <Loader2 className="w-5 h-5 mr-2 animate-spin"/> : <Play className="w-5 h-5 mr-2 fill-current"/>}
                 Launch Campaign Now
              </Button>
            </CardContent>
          </Card>

          {/* WALLET BALANCE CARD - PROFESSIONAL FINTECH STYLE */}
          <Card className="bg-white border border-slate-200 shadow-md relative overflow-hidden">
            {balance < 1000 && (
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-rose-500"></div>
            )}
            <CardHeader className="bg-slate-50 border-b py-4">
              <CardTitle className="text-sm text-slate-700 font-bold uppercase tracking-wider flex items-center gap-2">
                 <Coins className="h-5 w-5 text-amber-500" /> Account Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col gap-4">
                  <div>
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">Available Credits</p>
                    <h2 className={`text-4xl font-black tracking-tight flex items-center gap-2 ${balance < 1000 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {balance.toLocaleString()}
                    </h2>
                  </div>
                  <div className="w-full h-px bg-slate-100"></div>
                  <div>
                    <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px] mb-1.5">Today's Usage</p>
                    <h2 className="text-xl font-bold text-slate-500 flex items-center gap-1.5">
                      <TrendingDown className="w-4 h-4 text-rose-400" /> {usedCredits.toLocaleString()} <span className="text-xs font-medium text-slate-400">deducted</span>
                    </h2>
                  </div>
              </div>
              <div className="mt-6 bg-slate-50 px-4 py-3.5 rounded-lg border border-slate-200 text-center shadow-inner">
                 <p className="text-[12px] text-slate-500 font-medium">To add credits to your workspace,</p>
                 <p className="text-sm font-bold text-slate-800 mt-1">Contact your Account Manager</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: History Tables with Filters */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* UNIFIED CONTROL BAR */}
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm gap-4">
             <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                <Calendar className="w-5 h-5 text-indigo-500" /> Data View Range
             </div>
             
             <div className="flex items-center gap-3 w-full sm:w-auto">
                 {dateFilter === 'custom' && (
                     <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                         <Input type="date" className="h-9 w-[130px] text-xs font-medium border-slate-300 shadow-sm" value={customStart} onChange={e=>setCustomStart(e.target.value)} />
                         <span className="text-slate-400 font-bold">-</span>
                         <Input type="date" className="h-9 w-[130px] text-xs font-medium border-slate-300 shadow-sm" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} />
                     </div>
                 )}
                 <Select value={dateFilter} onValueChange={(v:any) => setDateFilter(v)}>
                    <SelectTrigger className="w-full sm:w-[160px] bg-slate-50 border-slate-200 shadow-sm h-9 font-semibold text-slate-700">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today" className="font-medium">Today</SelectItem>
                        <SelectItem value="yesterday" className="font-medium">Yesterday</SelectItem>
                        <SelectItem value="this_week" className="font-medium">This Week</SelectItem>
                        <SelectItem value="this_month" className="font-medium">This Month</SelectItem>
                        <SelectItem value="last_month" className="font-medium">Last Month</SelectItem>
                        <SelectItem value="custom" className="font-medium text-indigo-600">Custom Range</SelectItem>
                    </SelectContent>
                 </Select>

                 <Button variant="outline" size="icon" onClick={fetchData} disabled={isRefreshing} className="h-9 w-9 shadow-sm border-slate-200 hover:bg-slate-100 shrink-0">
                    <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
                 </Button>
             </div>
          </div>

          <div className="grid grid-cols-1 gap-6">
              {/* CAMPAIGN HISTORY TABLE */}
              <Card className="shadow-md border-slate-200 overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b py-4">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base text-slate-800 flex items-center gap-2 font-bold">
                            <History className="h-5 w-5 text-indigo-500" /> Campaign Launch History
                        </CardTitle>
                        <CardDescription className="text-xs font-medium mt-1">Track batches sent to the dialer for the selected period.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportHistoryCSV} className="gap-2 bg-white border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors">
                        <Download className="w-3 h-3" /> CSV Export
                    </Button>
                </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[350px] overflow-auto custom-scrollbar">
                <Table>
                    <TableHeader className="bg-white sticky top-0 z-10 shadow-sm border-b">
                    <TableRow>
                        <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Date</TableHead>
                        <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Campaign</TableHead>
                        <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Batch Name</TableHead>
                        <TableHead className="text-center font-bold text-slate-500 uppercase text-[10px] tracking-wider">Contacts</TableHead>
                        <TableHead className="text-right font-bold text-slate-500 uppercase text-[10px] tracking-wider">Status</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {history.map(c => (
                        <TableRow key={c.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                            <TableCell className="text-xs font-medium text-slate-500">
                                {new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </TableCell>
                            <TableCell className="font-bold text-sm text-slate-800">{c.campaign_name}</TableCell>
                            <TableCell className="text-xs font-semibold text-slate-600">{c.lead_batch_name}</TableCell>
                            <TableCell className="text-center text-xs font-mono font-bold text-slate-700">{c.total_contacts}</TableCell>
                            <TableCell className="text-right">
                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-sm text-[10px] font-bold py-0.5">
                                    <Play className="w-3 h-3 mr-1 fill-emerald-600 text-emerald-600"/> Launched
                                </Badge>
                            </TableCell>
                        </TableRow>
                    ))}
                    {history.length === 0 && (
                        <TableRow><TableCell colSpan={5} className="text-center py-12 text-sm font-medium text-slate-400">No campaigns launched during this period.</TableCell></TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
              </Card>

              {/* LEDGER HISTORY TABLE */}
              <Card className="shadow-md border-slate-200 overflow-hidden bg-white">
                <CardHeader className="bg-slate-50 border-b py-4">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-base text-slate-800 flex items-center gap-2 font-bold">
                            <Receipt className="h-5 w-5 text-indigo-500" /> Wallet Ledger
                        </CardTitle>
                        <CardDescription className="text-xs font-medium mt-1">Detailed breakdown of credit deductions and recharges.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={exportLedgerCSV} className="gap-2 bg-white border-slate-200 shadow-sm text-xs font-bold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors">
                        <Download className="w-3 h-3" /> CSV Export
                    </Button>
                </div>
                </CardHeader>
                <CardContent className="p-0 max-h-[350px] overflow-auto custom-scrollbar">
                <Table>
                    <TableHeader className="bg-white sticky top-0 z-10 shadow-sm border-b">
                    <TableRow>
                        <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Date</TableHead>
                        <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Type</TableHead>
                        <TableHead className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">Description</TableHead>
                        <TableHead className="text-right font-bold text-slate-500 uppercase text-[10px] tracking-wider">Credits</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {ledger.map((tx) => (
                        <TableRow key={tx.id} className="animate-in fade-in duration-300 hover:bg-slate-50/80 transition-colors border-b border-slate-100">
                        <TableCell className="text-xs font-medium text-slate-500 whitespace-nowrap">
                            {new Date(tx.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                        </TableCell>
                        <TableCell>
                            {tx.transaction_type === 'RECHARGE' && <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold shadow-sm"><ArrowUpRight className="w-3 h-3 mr-1"/> Recharge</Badge>}
                            {tx.transaction_type === 'C2C_CALL' && <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold shadow-sm"><PhoneCall className="w-3 h-3 mr-1"/> C2C Call</Badge>}
                            {tx.transaction_type === 'IVR_CAMPAIGN' && <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-[10px] font-bold shadow-sm"><Megaphone className="w-3 h-3 mr-1"/> IVR Call</Badge>}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700">{tx.description}</TableCell>
                        <TableCell className={`text-right font-black text-sm ${tx.credits > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                            {tx.credits > 0 ? '+' : ''}{tx.credits}
                        </TableCell>
                        </TableRow>
                    ))}
                    {ledger.length === 0 && (
                        <TableRow><TableCell colSpan={4} className="text-center py-12 text-sm font-medium text-slate-400">No transactions found for this period.</TableCell></TableRow>
                    )}
                    </TableBody>
                </Table>
                </CardContent>
              </Card>
          </div>
        </div>
      </div>

      {/* LOW BALANCE MODAL */}
      <Dialog open={showLowBalanceModal} onOpenChange={setShowLowBalanceModal}>
        <DialogContent className="sm:max-w-md border-rose-200 bg-white shadow-2xl rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-black text-xl">
              <AlertTriangle className="h-6 w-6" /> Low Wallet Balance
            </DialogTitle>
            <DialogDescription className="text-slate-600 font-medium text-sm mt-2">
              Your workspace balance has dropped to <strong className="text-rose-600">{balance.toLocaleString()} credits</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-rose-50/50 p-4 rounded-lg border border-rose-100 text-center space-y-4 mt-2">
            <p className="text-xs text-rose-800 font-medium leading-relaxed">
              If your balance reaches zero, active IVR campaigns and Click-to-Call dialing will automatically pause. Please reach out to your Account Manager to top up your virtual wallet.
            </p>
            <Button onClick={() => setShowLowBalanceModal(false)} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-5 shadow-md transition-all text-sm rounded-lg">
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
