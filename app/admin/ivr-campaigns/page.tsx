"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Megaphone, UploadCloud, Play, Loader2, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { launchIvrCampaign } from "@/app/actions/ivr-actions"

export default function IvrCampaignsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [batchName, setBatchName] = useState("")
  const [selectedConfigId, setSelectedConfigId] = useState("")
  const [csvFile, setCsvFile] = useState<File | null>(null)

  const [configs, setConfigs] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const supabase = createClient()

  const fetchData = async () => {
    const { data: cData } = await supabase.from('ivr_campaign_configs').select('id, campaign_name')
    if (cData) setConfigs(cData)

    const { data: hData } = await supabase.from('ivr_campaign_history').select('*').order('created_at', { ascending: false }).limit(20)
    if (hData) setHistory(hData)
  }

  useEffect(() => { fetchData() }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0])
    }
  }

  const handleLaunch = async () => {
    if (!selectedConfigId || !batchName || !csvFile) {
        return toast.error("Please fill all fields and select a CSV file.")
    }

    setIsUploading(true)

    try {
        // Simple manual CSV parsing (Assumes a single column of phone numbers, or comma-separated rows where one is a phone)
        const text = await csvFile.text()
        const rows = text.split('\n').map(row => row.trim()).filter(row => row.length > 0)
        
        // Extract anything that looks like a 10-digit Indian phone number
        const phoneNumbers: string[] = []
        rows.forEach(row => {
            const match = row.match(/(?:(?:\\+|0{0,2})91(\\s*[\\-]\\s*)?|[0]?)?[6789]\\d{9}/)
            if (match) phoneNumbers.push(match[0])
        })

        if (phoneNumbers.length === 0) {
            throw new Error("Could not find any valid phone numbers in the CSV.")
        }

        const res = await launchIvrCampaign(selectedConfigId, batchName, phoneNumbers)

        if (res.success) {
            toast.success(res.message)
            setBatchName("")
            setCsvFile(null)
            fetchData() // Refresh history table
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
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-purple-600" /> IVR Auto-Dial Campaigns
        </h1>
        <p className="text-slate-500 mt-1">Select a campaign and upload your contact list to launch automated blasts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* NEW CAMPAIGN BUILDER */}
        <div className="md:col-span-1">
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
                <Label>Lead Batch Name</Label>
                <Input placeholder="e.g. March 21st Follow-ups" value={batchName} onChange={e=>setBatchName(e.target.value)} className="bg-white" />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-slate-400"/> Contact List (.csv)</Label>
                <Input type="file" accept=".csv" onChange={handleFileChange} className="cursor-pointer bg-white" />
                <p className="text-[10px] text-slate-500">File should contain valid 10-digit mobile numbers.</p>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200 text-xs text-slate-600 text-center">
                 Credits will be deducted directly from your wallet as calls are answered based on duration.
              </div>

              <Button onClick={handleLaunch} disabled={isUploading} className="w-full bg-purple-600 hover:bg-purple-700">
                 {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UploadCloud className="w-4 h-4 mr-2"/>}
                 Launch Campaign
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* CAMPAIGN HISTORY */}
        <div className="md:col-span-2">
          <Card className="shadow-sm h-full">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg">Campaign Launch History</CardTitle>
              <CardDescription>Track the batches you have sent to the dialer.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
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
                           <TableCell className="text-xs text-slate-500">
                               {new Date(c.created_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
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
                       <TableRow>
                           <TableCell colSpan={5} className="text-center py-10 text-slate-400">No campaigns launched yet.</TableCell>
                       </TableRow>
                   )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
