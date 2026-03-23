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
  Coins, ArrowUpRight, Receipt, PhoneCall, TrendingDown, Download, Wand2, RefreshCw, AlertTriangle, BarChart, RotateCcw, Calendar
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

        // 🔴 UPDATED: Today's Usage instead of Lifetime
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: Launch Form & Wallet Balance */}
        <div className="md:col-span-1 space-y-6">
          
          <Card className="shadow-sm border-slate-200 bg-white">
            <CardHeader className="border-b bg-slate-50 rounded-t-xl py-4">
              <CardTitle className="text-base text-slate-800">Launch New Campaign</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-5">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Select Campaign Theme</Label>
                <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
                    <SelectTrigger className="bg-white border-slate-300"><SelectValue placeholder="Choose campaign..." /></SelectTrigger>
                    <SelectContent>
                        {configs.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.campaign_name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Lead Batch Name</Label>
                    <button type="button" onClick={generateBatchName} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors">
                        <Wand2 className="w-3 h-3" /> Auto-Generate
                    </button>
                </div>
                <Input placeholder="e.g. 21march_batch1" value={batchName} onChange={e=>setBatchName(e.target.value)} className="bg-white border-slate-300" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-semibold">
                  <RotateCcw className="w-4 h-4 text-slate-500" /> Auto-Retry Count
                </Label>
                <Select value={retryCount} onValueChange={setRetryCount}>
                    <SelectTrigger className="bg-white border-slate-300"><SelectValue placeholder="Select retries..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1 Retry (Standard)</SelectItem>
                        <SelectItem value="2">2 Retries (Aggressive)</SelectItem>
                        <SelectItem value="3">3 Retries (Maximum)</SelectItem>
                    </SelectContent>
                </Select>
                <p className="text-[11px] text-slate-500 leading-tight">Number of times the dialer will retry failed or unanswered calls.</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-semibold"><FileSpreadsheet className="w-4 h-4 text-slate-500"/> Contact List (.csv)</Label>
                    <button type="button" onClick={handleDownloadSample} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-medium transition-colors">
                        <Download className="w-3 h-3" /> Sample CSV
                    </button>
                </div>
                <Input type="file" accept=".csv" onChange={handleFileChange} className="cursor-pointer bg-white border-slate-300 text-sm" />
                <p className="text-[11px] text-slate-500 leading-tight">File should contain valid 10-digit mobile numbers.</p>
              </div>

              <Button onClick={handleLaunch} disabled={isUploading} className="w-full bg-slate-900 hover:bg-slate-800 text-white shadow-sm mt-2">
                 {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UploadCloud className="w-4 h-4 mr-2"/>}
                 Launch Campaign
              </Button>
            </CardContent>
          </Card>

          {/* 🔴 UPDATED: Professional Wallet Balance Card */}
          <Card className="bg-white border border-slate-200 shadow-sm relative overflow-hidden">
            {balance < 1000 && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-rose-500"></div>
            )}
            <CardHeader className="bg-slate-50 border-b py-4">
              <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                 <Coins className="h-5 w-5 text-amber-500" /> Wallet Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex justify-between items-center gap-4">
                  <div className="w-1/2">
                    <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px] mb-1">Available Credits</p>
                    <h2 className={`text-2xl font-bold flex items-center gap-1.5 ${balance < 1000 ? 'text-rose-600' : 'text-slate-800'}`}>
                      {balance.toLocaleString()}
                    </h2>
                  </div>
                  <div className="w-px h-10 bg-slate-200"></div>
                  <div className="w-1/2 text-right">
                    <p className="text-slate-500 font-medium uppercase tracking-wider text-[10px] mb-1">Today's Used</p>
                    <h2 className="text-xl font-bold text-slate-600 flex items-center justify-end gap-1">
                      {usedCredits.toLocaleString()}
                    </h2>
                  </div>
              </div>
              <div className="mt-5 bg-slate-50 px-4 py-3 rounded border border-slate-100 text-center">
                 <p className="text-[11px] text-slate-500 font-medium">To add credits to your account,</p>
                 <p className="text-[12px] font-semibold text-slate-700 mt-0.5">Contact your Account Manager</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: History Tables with Filters */}
        <div className="md:col-span-2 space-y-6">
          
          <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-3 rounded-lg border border-slate-200 shadow-sm gap-4">
             <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Calendar className="w-5 h-5 text-indigo-500" /> Date Range Filter
             </div>
             
             <div className="flex items-center gap-3">
                 {dateFilter === 'custom' && (
                     <div className="flex items-center gap-2">
                         <Input type="date" className="h-9 w-[130px] text-xs border-slate-300" value={customStart} onChange={e=>setCustomStart(e.target.value)} />
                         <span className="text-slate-400">-</span>
                         <Input type="date" className="h-9 w-[130px] text-xs border-slate-300" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} />
                     </div>
                 )}
                 <Select value={dateFilter} onValueChange={(v:any) => setDateFilter(v)}>
                    <SelectTrigger className="w-[150px] bg-white border-slate-300 h-9">
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

                 <Button variant="ghost" size="icon" onClick={fetchData} disabled={isRefreshing} className="h-9 w-9 hover:bg-slate-100">
                    <RefreshCw className={`w-4 h-4 text-slate-500 ${isRefreshing ? 'animate-spin' : ''}`} />
                 </Button>
             </div>
          </div>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b pb-4">
              <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                        <Receipt className="h-4 w-4 text-slate-500" /> Wallet Ledger
                    </CardTitle>
                    <CardDescription className="text-xs">Credit deductions and recharges for the selected period.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportLedgerCSV} className="gap-2 bg-white border-slate-300 text-xs text-slate-600 hover:bg-slate-50">
                    <Download className="w-3 h-3" /> Export Ledger
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[350px] overflow-auto">
              <Table>
                <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm border-b">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-600">Date</TableHead>
                    <TableHead className="font-semibold text-slate-600">Type</TableHead>
                    <TableHead className="font-semibold text-slate-600">Description</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Credits</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((tx) => (
                    <TableRow key={tx.id} className="animate-in fade-in duration-300 hover:bg-slate-50">
                      <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                        {new Date(tx.created_at).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'})}
                      </TableCell>
                      <TableCell>
                        {tx.transaction_type === 'RECHARGE' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0 text-[10px]"><ArrowUpRight className="w-3 h-3 mr-1"/> Recharge</Badge>}
                        {tx.transaction_type === 'C2C_CALL' && <Badge variant="outline" className="text-blue-700 bg-blue-50 border-blue-200 text-[10px]"><PhoneCall className="w-3 h-3 mr-1"/> C2C Call</Badge>}
                        {tx.transaction_type === 'IVR_CAMPAIGN' && <Badge variant="outline" className="text-purple-700 bg-purple-50 border-purple-200 text-[10px]"><Megaphone className="w-3 h-3 mr-1"/> IVR Call</Badge>}
                      </TableCell>
                      <TableCell className="text-xs font-medium text-slate-700">{tx.description}</TableCell>
                      <TableCell className={`text-right font-bold text-sm ${tx.credits > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                        {tx.credits > 0 ? '+' : ''}{tx.credits}
                      </TableCell>
                    </TableRow>
                  ))}
                  {ledger.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center py-10 text-sm text-slate-400">No transactions found for this period.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200">
            <CardHeader className="bg-slate-50 border-b pb-4">
               <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="text-base text-slate-800">Campaign Launch History</CardTitle>
                    <CardDescription className="text-xs">Track the batches sent to the dialer for the selected period.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={exportHistoryCSV} className="gap-2 bg-white border-slate-300 text-xs text-slate-600 hover:bg-slate-50">
                    <Download className="w-3 h-3" /> Export History
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 max-h-[350px] overflow-auto">
              <Table>
                <TableHeader className="bg-slate-100 sticky top-0 z-10 shadow-sm border-b">
                  <TableRow>
                    <TableHead className="font-semibold text-slate-600">Date</TableHead>
                    <TableHead className="font-semibold text-slate-600">Campaign</TableHead>
                    <TableHead className="font-semibold text-slate-600">Batch Name</TableHead>
                    <TableHead className="text-center font-semibold text-slate-600">Contacts</TableHead>
                    <TableHead className="text-right font-semibold text-slate-600">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {history.map(c => (
                       <TableRow key={c.id} className="hover:bg-slate-50">
                           <TableCell className="text-xs text-slate-500">
                               {new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                           </TableCell>
                           <TableCell className="font-medium text-sm text-slate-700">{c.campaign_name}</TableCell>
                           <TableCell className="text-xs text-slate-600">{c.lead_batch_name}</TableCell>
                           <TableCell className="text-center text-xs font-mono text-slate-600">{c.total_contacts}</TableCell>
                           <TableCell className="text-right">
                               <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-0 text-[10px]">
                                   <Play className="w-3 h-3 mr-1 fill-emerald-700"/> Launched
                               </Badge>
                           </TableCell>
                       </TableRow>
                   ))}
                   {history.length === 0 && (
                       <TableRow><TableCell colSpan={5} className="text-center py-10 text-sm text-slate-400">No campaigns launched during this period.</TableCell></TableRow>
                   )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

        </div>
      </div>

      <Dialog open={showLowBalanceModal} onOpenChange={setShowLowBalanceModal}>
        <DialogContent className="sm:max-w-md border-rose-200 bg-rose-50 shadow-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-700 font-bold text-lg">
              <AlertTriangle className="h-5 w-5" /> Low Wallet Balance
            </DialogTitle>
            <DialogDescription className="text-rose-600/90 font-medium text-sm">
              Your workspace balance has dropped to <strong className="text-rose-800">{balance.toLocaleString()} credits</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-white p-4 rounded-lg border border-rose-100 text-center space-y-4 shadow-sm mt-2">
            <p className="text-xs text-slate-600 leading-relaxed">
              If your balance reaches zero, active IVR campaigns and Click-to-Call dialing will automatically pause. Please reach out to your Account Manager to top up your virtual wallet.
            </p>
            <Button onClick={() => setShowLowBalanceModal(false)} className="w-full bg-rose-600 hover:bg-rose-700 text-white font-semibold py-4 shadow-sm transition-all text-sm">
              I Understand
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
