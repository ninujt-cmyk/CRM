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
  Megaphone, UploadCloud, Play, Loader2, FileSpreadsheet, CalendarDays,
  Coins, ArrowUpRight, Receipt, PhoneCall, TrendingDown, Download, Wand2, RefreshCw, AlertTriangle, BarChart, RotateCcw
} from "lucide-react"
import { toast } from "sonner"
import { launchIvrCampaign } from "@/app/actions/ivr-actions"

// --- Helper for Date Ranges ---
const getDateRange = (filter: string, start?: string, end?: string) => {
  const now = new Date()
  let startDate = new Date(now)
  let endDate = new Date(now)
  startDate.setHours(0, 0, 0, 0)
  endDate.setHours(23, 59, 59, 999)

  if (filter === 'yesterday') {
    startDate.setDate(startDate.getDate() - 1)
    endDate.setDate(endDate.getDate() - 1)
    endDate.setHours(23, 59, 59, 999)
  } else if (filter === 'this_week') {
    const day = startDate.getDay() || 7
    if (day !== 1) startDate.setHours(-24 * (day - 1))
  } else if (filter === 'this_month') {
    startDate.setDate(1)
  } else if (filter === 'last_month') {
    startDate.setMonth(startDate.getMonth() - 1)
    startDate.setDate(1)
    endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 1)
    endDate.setDate(0)
    endDate.setHours(23, 59, 59, 999)
  } else if (filter === 'custom' && start && end) {
    startDate = new Date(start)
    startDate.setHours(0, 0, 0, 0)
    endDate = new Date(end)
    endDate.setHours(23, 59, 59, 999)
  }

  return { startStr: startDate.toISOString(), endStr: endDate.toISOString() }
}

export default function IvrCampaignsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // Launch Form State
  const [batchName, setBatchName] = useState("")
  const [selectedConfigId, setSelectedConfigId] = useState("")
  const [retryCount, setRetryCount] = useState("1")
  const [csvFile, setCsvFile] = useState<File | null>(null)

  // Data State
  const [configs, setConfigs] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [usedCredits, setUsedCredits] = useState<number>(0)
  const [ledger, setLedger] = useState<any[]>([])

  // 🔴 NEW: Filters State (Default Today)
  const [dateFilter, setDateFilter] = useState("today")
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")

  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false)
  const alertShownRef = useRef(false) 
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setIsRefreshing(true)
    try {
        const { startStr, endStr } = getDateRange(dateFilter, customStart, customEnd)

        // Fetch Campaigns (No date filter needed)
        const { data: cData } = await supabase.from('ivr_campaign_configs').select('id, campaign_name')
        if (cData) setConfigs(cData)

        // 🔴 FILTERED: Fetch History
        const { data: hData } = await supabase.from('ivr_campaign_history')
            .select('*')
            .gte('created_at', startStr)
            .lte('created_at', endStr)
            .order('created_at', { ascending: false })
            .limit(500)
        if (hData) setHistory(hData)

        // Fetch Wallet Balance (Lifetime)
        const { data: wallet } = await supabase.from('tenant_wallets').select('credits_balance').maybeSingle()
        if (wallet) {
            setBalance(wallet.credits_balance || 0)
            if ((wallet.credits_balance || 0) < 1000 && !alertShownRef.current) {
                setShowLowBalanceModal(true)
                alertShownRef.current = true
            }
        }

        // 🔴 FILTERED: Fetch Ledger
        const { data: lData } = await supabase.from('wallet_ledger')
          .select('*')
          .gte('created_at', startStr)
          .lte('created_at', endStr)
          .order('created_at', { ascending: false })
          .limit(500)
        if (lData) setLedger(lData)

        // Fetch Lifetime Used Credits
        const { data: usageData } = await supabase.from('wallet_ledger').select('credits').lt('credits', 0) 
        if (usageData) {
          const totalUsed = usageData.reduce((acc, row) => acc + Math.abs(row.credits), 0)
          setUsedCredits(totalUsed)
        }
    } finally {
        setIsRefreshing(false)
    }
  }, [dateFilter, customStart, customEnd, supabase])

  // Trigger fetch when standard filter changes (except custom, which requires manual apply)
  useEffect(() => {
      if (dateFilter !== 'custom') { fetchData() }
  }, [dateFilter, fetchData])

  // Live Subscription (only update if viewing 'today')
  useEffect(() => { 
    const channel = supabase.channel('live-wallet-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_ledger' }, (payload) => {
          if (dateFilter === 'today') {
              setLedger(prev => [payload.new, ...prev].slice(0, 500))
          }
          if (payload.new.credits < 0) setUsedCredits(prev => prev + Math.abs(payload.new.credits))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tenant_wallets' }, (payload) => {
          setBalance(payload.new.credits_balance)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, dateFilter])

  // --- Export Utilities ---
  const handleExportLedger = () => {
      if (ledger.length === 0) return toast.error("No ledger data to export.");
      const headers = ["Date", "Transaction Type", "Description", "Credits"];
      const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + ledger.map(tx => [
          new Date(tx.created_at).toLocaleString('en-IN').replace(/,/g, ''),
          tx.transaction_type,
          `"${tx.description}"`, // Escape commas in description
          tx.credits
      ].join(",")).join("\n");
      triggerDownload(csvContent, `Wallet_Ledger_${dateFilter}.csv`);
  }

  const handleExportHistory = () => {
      if (history.length === 0) return toast.error("No campaign history to export.");
      const headers = ["Date", "Campaign Theme", "Batch Name", "Total Contacts", "Status"];
      const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + history.map(h => [
          new Date(h.created_at).toLocaleString('en-IN').replace(/,/g, ''),
          `"${h.campaign_name}"`,
          `"${h.lead_batch_name}"`,
          h.total_contacts,
          h.status
      ].join(",")).join("\n");
      triggerDownload(csvContent, `Campaign_History_${dateFilter}.csv`);
  }

  const triggerDownload = (content: string, filename: string) => {
      const encodedUri = encodeURI(content);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) setCsvFile(e.target.files[0])
  }

  const generateBatchName = () => {
    const today = new Date()
    const day = today.getDate()
    const month = today.toLocaleString('default', { month: 'short' }).toLowerCase()
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
    const todaysCampaigns = history.filter(h => new Date(h.created_at) >= startOfToday)
    setBatchName(`${day}${month}_batch${todaysCampaigns.length + 1}`)
  }

  const handleLaunch = async () => {
    if (!selectedConfigId || !batchName || !csvFile) return toast.error("Please fill all fields and select a CSV file.")
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
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Megaphone className="h-8 w-8 text-purple-600" /> IVR Auto-Dial Campaigns
          </h1>
          <p className="text-slate-500 mt-1">Select a campaign and upload your contact list to launch automated blasts.</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
            <Link href="/admin/ivr-reports">
                <Button variant="outline" className="gap-2 bg-white text-purple-700 hover:text-purple-800 hover:bg-purple-50 border-purple-200 shadow-sm">
                    <BarChart className="w-4 h-4" /> IVR Reports
                </Button>
            </Link>
            <Link href="/admin/c2c-reports">
                <Button variant="outline" className="gap-2 bg-white text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200 shadow-sm">
                    <PhoneCall className="w-4 h-4" /> C2C Reports
                </Button>
            </Link>
        </div>
      </div>

      {/* 🔴 NEW: GLOBAL DATE FILTER BAR */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-4 justify-between">
         <div className="flex items-center gap-3 w-full md:w-auto">
            <CalendarDays className="h-5 w-5 text-slate-400 shrink-0" />
            <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[180px] bg-slate-50"><SelectValue placeholder="Select period" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="today">Today</SelectItem>
                    <SelectItem value="yesterday">Yesterday</SelectItem>
                    <SelectItem value="this_week">This Week</SelectItem>
                    <SelectItem value="this_month">This Month</SelectItem>
                    <SelectItem value="last_month">Last Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
            </Select>

            {dateFilter === 'custom' && (
                <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <Input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="h-9" />
                    <span className="text-slate-400">to</span>
                    <Input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="h-9" />
                    <Button onClick={fetchData} variant="secondary" className="h-9">Apply</Button>
                </div>
            )}
         </div>

         <Button variant="ghost" onClick={fetchData} disabled={isRefreshing} className="gap-2">
             <RefreshCw className={`w-4 h-4 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
         </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Launch Form & Wallet Balance */}
        <div className="md:col-span-1 space-y-6">
          
          {/* CAMPAIGN LAUNCHER */}
          <Card className="shadow-sm border-purple-100 bg-purple-50/30">
            <CardHeader className="border-b bg-white rounded-t-xl">
              <CardTitle className="text-lg text-purple-900">Launch New Campaign</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-5">
              
              <div className="space-y-2">
                <Label>Select Campaign Theme</Label>
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Choose campaign..." /></SelectTrigger>
                    <SelectContent>
                        {configs.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label>Lead Batch Name</Label>
                    <button type="button" onClick={generateBatchName} className="text-xs text-purple-600 hover:text-purple-800 flex items-center gap-1 font-medium transition-colors">
                        <Wand2 className="w-3 h-3" /> Auto-Generate
                    </button>
                </div>
                <Input placeholder="e.g. 21march_batch1" value={batchName} onChange={e=>setBatchName(e.target.value)} className="bg-white" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-slate-400" /> Auto-Retry Count
                </Label>
                <Select value={retryCount} onValueChange={setRetryCount}>
                    <SelectTrigger className="bg-white"><SelectValue placeholder="Select retries..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1 Retry (Standard)</SelectItem>
                        <SelectItem value="2">2 Retries (Aggressive)</SelectItem>
                        <SelectItem value="3">3 Retries (Maximum)</SelectItem>
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-slate-400"/> Contact List (.csv)
                    </Label>
                </div>
                <Input type="file" accept=".csv" onChange={handleFileChange} className="cursor-pointer bg-white" />
              </div>

              <Button onClick={handleLaunch} disabled={isUploading} className="w-full bg-purple-600 hover:bg-purple-700 shadow-md">
                 {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UploadCloud className="w-4 h-4 mr-2"/>}
                 Launch Campaign
              </Button>
            </CardContent>
          </Card>

          {/* WALLET BALANCE CARD (Lifetime values) */}
          <Card className={`bg-gradient-to-br ${balance < 1000 ? 'from-rose-900 to-amber-900' : 'from-slate-900 to-indigo-900'} text-white shadow-xl overflow-hidden relative transition-colors duration-500`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
            <CardContent className="p-6 space-y-6 relative z-10">
              <div className="flex justify-between items-center">
                  <div className="text-center w-1/2 border-r border-white/20">
                    <p className="text-white/70 font-medium uppercase tracking-wider text-[10px] mb-1">Available Credits</p>
                    <h2 className={`text-3xl font-black flex items-center justify-center gap-1.5 transition-all duration-500 ${balance < 1000 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      <Coins className="h-6 w-6" />
                      {balance.toLocaleString()}
                    </h2>
                  </div>
                  <div className="text-center w-1/2">
                    <p className="text-white/70 font-medium uppercase tracking-wider text-[10px] mb-1">Lifetime Used</p>
                    <h2 className="text-3xl font-black flex items-center justify-center gap-1.5 text-rose-400 transition-all duration-500">
                      <TrendingDown className="h-6 w-6" />
                      {usedCredits.toLocaleString()}
                    </h2>
                  </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* RIGHT COLUMN: Filtered History Tables */}
        <div className="md:col-span-2 space-y-6">
          
          {/* LEDGER HISTORY TABLE */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b py-3 px-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-slate-600" /> Wallet Ledger
                </CardTitle>
                <Button variant="outline" size="sm" onClick={handleExportLedger} className="h-7 text-xs gap-1">
                    <Download className="w-3 h-3" /> Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[300px] overflow-auto">
              <Table>
                <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </TableCell>
                      <TableCell>
                        {tx.transaction_type === 'RECHARGE' && <Badge className="bg-emerald-100 text-emerald-700 border-0"><ArrowUpRight className="w-3 h-3 mr-1"/> Recharge</Badge>}
                        {tx.transaction_type === 'C2C_CALL' && <Badge variant="outline" className="text-blue-700 bg-blue-50"><PhoneCall className="w-3 h-3 mr-1"/> C2C Call</Badge>}
                        {tx.transaction_type === 'IVR_CAMPAIGN' && <Badge variant="outline" className="text-purple-700 bg-purple-50"><Megaphone className="w-3 h-3 mr-1"/> IVR Call</Badge>}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">{tx.description}</TableCell>
                      <TableCell className={`text-right font-black text-sm ${tx.credits > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {tx.credits > 0 ? '+' : ''}{tx.credits}
                      </TableCell>
                    </TableRow>
                  ))}
                  {ledger.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-slate-400">No transactions found for this period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* CAMPAIGN HISTORY */}
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 border-b py-3 px-4">
              <div className="flex justify-between items-center">
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-slate-600" /> Campaign History
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExportHistory} className="h-7 text-xs gap-1">
                      <Download className="w-3 h-3" /> Export CSV
                  </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[300px] overflow-auto">
              <Table>
                <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm">
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Batch Name</TableHead>
                    <TableHead className="text-center">Contacts</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {history.map(c => (
                       <TableRow key={c.id}>
                           <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                               {new Date(c.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                           </TableCell>
                           <TableCell className="font-medium text-slate-700">{c.campaign_name}</TableCell>
                           <TableCell className="text-slate-600">{c.lead_batch_name}</TableCell>
                           <TableCell className="text-center font-mono">{c.total_contacts}</TableCell>
                           <TableCell className="text-right">
                               <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0">
                                   <Play className="w-3 h-3 mr-1 fill-emerald-700"/> Launched
                               </Badge>
                           </TableCell>
                       </TableRow>
                   ))}
                   {history.length === 0 && (
                       <TableRow><TableCell colSpan={5} className="text-center py-10 text-slate-400">No campaigns launched in this period.</TableCell></TableRow>
                   )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>
      </div>

      {/* LOW BALANCE MODAL */}
      <Dialog open={showLowBalanceModal} onOpenChange={setShowLowBalanceModal}>
        <DialogContent className="sm:max-w-md border-rose-200 bg-rose-50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 font-bold text-xl">
              <AlertTriangle className="h-6 w-6" /> Low Wallet Balance
            </DialogTitle>
            <DialogDescription className="text-rose-600/90 font-medium">
              Your workspace balance has dropped to <strong className="text-rose-800">{balance.toLocaleString()} credits</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-white p-5 rounded-lg border border-rose-100 text-center space-y-4 shadow-sm">
            <p className="text-sm text-slate-600 leading-relaxed">
              If your balance reaches zero, active IVR campaigns and Click-to-Call dialing will automatically pause. Please reach out to your Account Manager to top up your virtual wallet.
            </p>
            <Button onClick={() => setShowLowBalanceModal(false)} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-6 shadow-md transition-all">
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
