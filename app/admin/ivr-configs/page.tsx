"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Settings, Plus, Workflow, Edit2, Trash2, Key, Loader2, ShieldCheck, Activity } from "lucide-react"
import { toast } from "sonner"
import { fetchIvrConfigs, createIvrConfig, updateIvrConfig, deleteIvrConfig } from "@/app/actions/ivr-actions"

export default function IvrConfigsPage() {
  const [configs, setConfigs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    campaign_name: "",
    fonada_campaign_id: "",
    fonada_user_id: "",
    fonada_ukey: ""
  })

  useEffect(() => {
    loadConfigs()
  }, [])

  const loadConfigs = async () => {
    setLoading(true)
    const res = await fetchIvrConfigs()
    if (res.success && res.data) {
      setConfigs(res.data)
    } else {
      toast.error(res.error || "Failed to load configurations")
    }
    setLoading(false)
  }

  const handleOpenModal = (config: any = null) => {
    if (config) {
      setEditingId(config.id)
      setFormData({
        campaign_name: config.campaign_name,
        fonada_campaign_id: config.fonada_campaign_id,
        fonada_user_id: config.fonada_user_id,
        fonada_ukey: config.fonada_ukey
      })
    } else {
      setEditingId(null)
      setFormData({
        campaign_name: "",
        fonada_campaign_id: "",
        fonada_user_id: "",
        fonada_ukey: ""
      })
    }
    setShowModal(true)
  }

  const handleSubmit = async () => {
    if (!formData.campaign_name || !formData.fonada_campaign_id || !formData.fonada_user_id || !formData.fonada_ukey) {
      return toast.error("All fields are required.")
    }

    setIsSubmitting(true)
    let res
    if (editingId) {
      res = await updateIvrConfig(editingId, formData)
    } else {
      res = await createIvrConfig(formData)
    }

    if (res.success) {
      toast.success(res.message)
      setShowModal(false)
      loadConfigs()
    } else {
      toast.error(res.error)
    }
    setIsSubmitting(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this configuration? This action cannot be undone.")) return
    
    const res = await deleteIvrConfig(id)
    if (res.success) {
      toast.success(res.message)
      loadConfigs()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Workflow className="h-8 w-8 text-indigo-600" /> IVR Configurations
          </h1>
          <p className="text-slate-500 mt-1">Manage telecom provider credentials and campaign blueprints.</p>
        </div>
        
        <div className="flex items-center gap-3">
            <Button onClick={() => handleOpenModal()} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm gap-2">
                <Plus className="w-4 h-4" /> New Configuration
            </Button>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b py-4">
            <CardTitle className="text-base text-slate-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-slate-500" /> Active Configurations
            </CardTitle>
            <CardDescription>All your registered OBD/IVR endpoints.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {loading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            ) : (
                <Table>
                    <TableHeader className="bg-slate-100/50">
                        <TableRow>
                            <TableHead className="font-semibold text-slate-600">Campaign Name</TableHead>
                            <TableHead className="font-semibold text-slate-600">Provider ID</TableHead>
                            <TableHead className="font-semibold text-slate-600">User ID</TableHead>
                            <TableHead className="font-semibold text-slate-600">Status</TableHead>
                            <TableHead className="text-right font-semibold text-slate-600">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {configs.map((c) => (
                            <TableRow key={c.id} className="hover:bg-slate-50">
                                <TableCell className="font-medium text-slate-800">{c.campaign_name}</TableCell>
                                <TableCell className="text-slate-600 font-mono text-sm">{c.fonada_campaign_id}</TableCell>
                                <TableCell className="text-slate-600 font-mono text-sm">{c.fonada_user_id}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full w-max text-xs font-medium border border-emerald-200">
                                        <Activity className="w-3.5 h-3.5" /> Active
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-2">
                                        <Button variant="ghost" size="icon" onClick={() => handleOpenModal(c)} className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                                            <Edit2 className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)} className="text-rose-600 hover:text-rose-700 hover:bg-rose-50">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {configs.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-16 text-slate-500">
                                    <div className="flex flex-col items-center gap-3">
                                        <ShieldCheck className="w-12 h-12 text-slate-300" />
                                        <p>No IVR configurations found.</p>
                                        <Button variant="outline" onClick={() => handleOpenModal()} className="mt-2 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
                                            Create your first config
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            )}
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-indigo-800">
                <Settings className="w-5 h-5" /> {editingId ? "Edit Configuration" : "New Configuration"}
            </DialogTitle>
            <DialogDescription>
                Enter the API credentials provided by your telecom operator (Fonada/Hanva).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
              <div className="space-y-2">
                  <Label>Campaign Alias <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. Sales Welcome IVR" value={formData.campaign_name} onChange={e => setFormData({...formData, campaign_name: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <Label>Provider Campaign ID <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. 543210" value={formData.fonada_campaign_id} onChange={e => setFormData({...formData, fonada_campaign_id: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <Label>Provider User ID <span className="text-red-500">*</span></Label>
                  <Input placeholder="e.g. 12345" value={formData.fonada_user_id} onChange={e => setFormData({...formData, fonada_user_id: e.target.value})} />
              </div>
              <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-slate-500" /> Secure U-Key <span className="text-red-500">*</span>
                  </Label>
                  <Input type="password" placeholder="Enter provider API token" value={formData.fonada_ukey} onChange={e => setFormData({...formData, fonada_ukey: e.target.value})} />
              </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isSubmitting}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700">
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingId ? "Save Changes" : "Create Configuration"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
