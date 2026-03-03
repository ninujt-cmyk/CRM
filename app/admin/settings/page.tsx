"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { 
  Building2, PhoneCall, MessageSquare, 
  Save, KeyRound, Loader2, ShieldCheck 
} from "lucide-react"

// Import our new Server Action
import { updateWorkspaceSettings } from "@/app/actions/tenant-settings"

export default function WorkspaceSettingsPage() {
  const supabase = createClient()
  
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  
  // Form State
  const [formData, setFormData] = useState({
    fonada_client_id: "",
    fonada_secret: "",
    whatsapp_api_key: ""
  })

  // Fetch existing settings on load
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('tenant_settings')
          .select('fonada_client_id, fonada_secret, whatsapp_api_key')
          .maybeSingle()

        if (error) throw error

        if (data) {
          setFormData({
            fonada_client_id: data.fonada_client_id || "",
            fonada_secret: data.fonada_secret || "",
            whatsapp_api_key: data.whatsapp_api_key || ""
          })
        }
      } catch (err: any) {
        console.error("Error fetching settings:", err)
        toast.error("Failed to load workspace settings")
      } finally {
        setIsLoading(false)
      }
    }

    fetchSettings()
  }, [supabase])

  const handleSave = async () => {
    setIsSaving(true)
    
    const response = await updateWorkspaceSettings(formData)
    
    if (response.success) {
      toast.success(response.message)
    } else {
      toast.error(response.error)
    }
    
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 pb-20">
      
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
          <Building2 className="h-8 w-8 text-indigo-600" />
          Workspace Configuration
        </h1>
        <p className="text-slate-500 mt-1">
          Manage your API keys, integrations, and company-wide CRM settings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8">
        
        {/* TELEPHONY (FONADA) CARD */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b bg-slate-50/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
              <PhoneCall className="h-5 w-5 text-blue-600" />
              Telephony Dialer (Click-to-Call)
            </CardTitle>
            <CardDescription>
              Connect your Fonada account to enable auto-dialing and call recording directly inside the CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold flex items-center gap-2">
                  Client ID <KeyRound className="h-3 w-3 text-slate-400" />
                </Label>
                <Input 
                  placeholder="e.g. Help_call_services" 
                  value={formData.fonada_client_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, fonada_client_id: e.target.value }))}
                  className="font-mono text-sm bg-slate-50"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold flex items-center gap-2">
                  Secret Key <ShieldCheck className="h-3 w-3 text-green-500" />
                </Label>
                <Input 
                  type="password"
                  placeholder="Paste your Fonada secret key..." 
                  value={formData.fonada_secret}
                  onChange={(e) => setFormData(prev => ({ ...prev, fonada_secret: e.target.value }))}
                  className="font-mono text-sm bg-slate-50"
                />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800">
              <strong>Note:</strong> Telecallers must have their exact 10-digit phone number saved in their profile for the dialer to ring their device.
            </div>
          </CardContent>
        </Card>

        {/* WHATSAPP CARD */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b bg-slate-50/50 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
              <MessageSquare className="h-5 w-5 text-emerald-600" />
              WhatsApp Automation
            </CardTitle>
            <CardDescription>
              Configure your Meta/Cloud API keys to send automated KYC lists and Missed Call alerts.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-700 font-semibold flex items-center gap-2">
                WhatsApp API Bearer Token <KeyRound className="h-3 w-3 text-slate-400" />
              </Label>
              <Input 
                type="password"
                placeholder="EAAI..." 
                value={formData.whatsapp_api_key}
                onChange={(e) => setFormData(prev => ({ ...prev, whatsapp_api_key: e.target.value }))}
                className="font-mono text-sm bg-slate-50"
              />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* SAVE ACTIONS - Sticky Footer */}
      <div className="sticky bottom-6 z-10 flex justify-end bg-white/80 backdrop-blur-md p-4 rounded-xl border border-slate-200 shadow-lg">
        <Button 
          onClick={handleSave} 
          disabled={isSaving} 
          className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-md w-full sm:w-auto px-8"
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Workspace Settings
        </Button>
      </div>

    </div>
  )
}
