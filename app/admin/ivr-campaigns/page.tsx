"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Megaphone, UploadCloud, Play, Pause, FileAudio, FileSpreadsheet, Loader2 } from "lucide-react"

export default function IvrCampaignsPage() {
  const [isUploading, setIsUploading] = useState(false)
  const [campaignName, setCampaignName] = useState("")

  // Dummy state for demonstration until connected to your backend
  const [campaigns] = useState([
    { id: 1, name: "Diwali Promo Blast", contacts: 1450, status: "completed", date: "2026-03-10", cost: 1450 },
    { id: 2, name: "Pending KYC Reminder", contacts: 820, status: "running", date: "2026-03-21", cost: 410 },
  ])

  const handleLaunch = () => {
    setIsUploading(true)
    setTimeout(() => {
        setIsUploading(false)
        alert("In a real environment, this will parse the CSV, check Wallet Balance, upload the MP3 to your storage, and ping the Fonada Campaign API!")
    }, 2000)
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Megaphone className="h-8 w-8 text-purple-600" /> IVR Auto-Dial Campaigns
        </h1>
        <p className="text-slate-500 mt-1">Upload voice recordings and contact lists to launch automated OBD blasts.</p>
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
                <Label>Campaign Name</Label>
                <Input placeholder="e.g. March Follow-ups" value={campaignName} onChange={e=>setCampaignName(e.target.value)} />
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2"><FileAudio className="w-4 h-4 text-slate-400"/> Voice Recording (.mp3)</Label>
                <Input type="file" accept="audio/mp3" className="cursor-pointer bg-white" />
                <p className="text-[10px] text-slate-500">Max size 5MB. Must be clear audio.</p>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-slate-400"/> Contact List (.csv)</Label>
                <Input type="file" accept=".csv" className="cursor-pointer bg-white" />
                <p className="text-[10px] text-slate-500">Must contain a column named "phone".</p>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200 text-xs text-slate-600 text-center">
                 Estimated Cost: <strong>1 Credit per contact</strong>
              </div>

              <Button onClick={handleLaunch} disabled={isUploading} className="w-full bg-purple-600 hover:bg-purple-700">
                 {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <UploadCloud className="w-4 h-4 mr-2"/>}
                 Upload & Launch Campaign
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* CAMPAIGN HISTORY */}
        <div className="md:col-span-2">
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-lg">Campaign History</CardTitle>
              <CardDescription>Track the status and cost of your previous blasts.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Contacts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Credits Used</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                   {campaigns.map(c => (
                       <TableRow key={c.id}>
                           <TableCell className="font-semibold text-slate-700">
                               {c.name}<br/><span className="text-[10px] text-slate-400 font-normal">{c.date}</span>
                           </TableCell>
                           <TableCell>{c.contacts}</TableCell>
                           <TableCell>
                               {c.status === 'running' && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-0"><Play className="w-3 h-3 mr-1 fill-amber-700"/> Running</Badge>}
                               {c.status === 'completed' && <Badge variant="outline" className="text-emerald-700"><Pause className="w-3 h-3 mr-1"/> Completed</Badge>}
                           </TableCell>
                           <TableCell className="text-right font-medium text-slate-600">-{c.cost}</TableCell>
                       </TableRow>
                   ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  )
}
