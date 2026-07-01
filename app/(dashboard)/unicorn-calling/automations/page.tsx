"use client"

import { useState } from "react"
import { Zap, Webhook, PhoneForwarded, Save, Copy, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function AutomationsPage() {
  const [isSaving, setIsSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  
  const [retrySettings, setRetrySettings] = useState({
    busyRetries: "1",
    noAnswerRetries: "2",
    failedRetries: "1",
    retryDelay: "30"
  })

  const [webhookUrl, setWebhookUrl] = useState("https://your-server.com/api/webhooks/unicorn-call-outcomes")

  const handleSave = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast.success("Automation settings saved successfully")
    }, 1000)
  }

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    toast.success("Webhook URL copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <Zap className="h-6 w-6 text-amber-500" />
          Automations & Routing
        </h1>
        <p className="text-slate-500 mt-1">Configure call retries and third-party webhook integrations.</p>
      </div>

      <div className="space-y-6">
        {/* Call Retry Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center gap-2">
            <PhoneForwarded className="h-5 w-5 text-blue-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Auto Retry Settings</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Busy Line Retries</label>
                <Select value={retrySettings.busyRetries} onValueChange={(v) => setRetrySettings({...retrySettings, busyRetries: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Do not retry</SelectItem>
                    <SelectItem value="1">1 time</SelectItem>
                    <SelectItem value="2">2 times</SelectItem>
                    <SelectItem value="3">3 times</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">If the customer's line is busy.</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">No Answer Retries</label>
                <Select value={retrySettings.noAnswerRetries} onValueChange={(v) => setRetrySettings({...retrySettings, noAnswerRetries: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Do not retry</SelectItem>
                    <SelectItem value="1">1 time</SelectItem>
                    <SelectItem value="2">2 times</SelectItem>
                    <SelectItem value="3">3 times</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">If the customer does not pick up.</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Failed/Error Retries</label>
                <Select value={retrySettings.failedRetries} onValueChange={(v) => setRetrySettings({...retrySettings, failedRetries: v})}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Do not retry</SelectItem>
                    <SelectItem value="1">1 time</SelectItem>
                    <SelectItem value="2">2 times</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">If the call fails due to network issues.</p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">Delay Between Retries</label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    value={retrySettings.retryDelay} 
                    onChange={(e) => setRetrySettings({...retrySettings, retryDelay: e.target.value})}
                  />
                  <span className="text-sm font-medium text-slate-500">Minutes</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Webhooks */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-emerald-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Call Outcome Webhooks</h2>
            </div>
            <Switch defaultChecked />
          </div>
          
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Receive real-time HTTP POST payloads whenever a call completes. Useful for syncing call statuses and transcripts back into your primary CRM or external tools.
            </p>
            
            <div>
              <label className="text-sm font-medium mb-1.5 block">Webhook Endpoint URL</label>
              <div className="flex items-center gap-2">
                <Input 
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  placeholder="https://"
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="icon" onClick={handleCopyWebhook} className="shrink-0">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} className="gap-2 px-8">
            <Save className="h-4 w-4" />
            {isSaving ? "Saving..." : "Save Automations"}
          </Button>
        </div>
      </div>
    </div>
  )
}
