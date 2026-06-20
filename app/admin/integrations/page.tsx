"use client"

import { useState, useEffect } from "react"
import { useTenant } from "@/context/tenant-provider"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Facebook, Code, Zap, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

export default function IntegrationsPage() {
  const { org } = useTenant()
  const [webhookUrl, setWebhookUrl] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (org?.id) {
      // In production, this would use window.location.origin
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm.hanva.in'
      setWebhookUrl(`${baseUrl}/api/webhooks/incoming-leads?org_id=${org.id}`)
    }
  }, [org])

  const copyToClipboard = () => {
    if (!webhookUrl) return
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    toast.success("Webhook URL copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-800">Lead Sources & Integrations</h1>
        <p className="text-slate-500 mt-2">
          Automatically pull leads from external sources directly into your CRM using your unique Webhook URL.
        </p>
      </div>

      <Card className="border-indigo-100 shadow-sm bg-indigo-50/30">
        <CardHeader>
          <CardTitle className="text-indigo-900 flex items-center gap-2">
            <Code className="h-5 w-5 text-indigo-600" />
            Your Unique Webhook URL
          </CardTitle>
          <CardDescription className="text-indigo-700/70">
            Use this URL as the destination for incoming lead data (POST requests). Keep this URL secret as it connects directly to your database.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Input 
              value={webhookUrl} 
              readOnly 
              className="bg-white font-mono text-sm text-slate-600 focus-visible:ring-indigo-500"
            />
            <Button 
              onClick={copyToClipboard}
              className={`min-w-[120px] transition-all ${copied ? 'bg-green-600 hover:bg-green-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
            >
              {copied ? (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Copied!</>
              ) : (
                <><Copy className="w-4 h-4 mr-2" /> Copy URL</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Facebook Leads */}
        <Card className="shadow-sm border-slate-200 hover:border-blue-300 transition-colors">
          <CardHeader className="pb-4 border-b bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Facebook className="h-6 w-6 text-blue-600" />
              </div>
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Recommended</Badge>
            </div>
            <CardTitle>Facebook Lead Ads</CardTitle>
            <CardDescription>
              Connect your Facebook Ad campaigns to instantly receive form fills into the CRM.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm text-slate-600">
            <p><strong>Setup Instructions:</strong></p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Go to your Facebook Page settings &gt; Lead Access.</li>
              <li>Setup a Webhook connection.</li>
              <li>Paste your Unique Webhook URL.</li>
              <li>Map the fields: <code className="bg-slate-100 px-1 rounded text-slate-800">name</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">phone</code>, <code className="bg-slate-100 px-1 rounded text-slate-800">email</code>.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Zapier / Make */}
        <Card className="shadow-sm border-slate-200 hover:border-orange-300 transition-colors">
          <CardHeader className="pb-4 border-b bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <CardTitle>Zapier & Make.com</CardTitle>
            <CardDescription>
              Connect 5,000+ apps via Zapier or Make by triggering a Webhook Action.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm text-slate-600">
            <p><strong>Setup Instructions:</strong></p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Create a new Zap/Scenario.</li>
              <li>Select <strong>Webhook by Zapier (POST)</strong> as the Action.</li>
              <li>Paste your Unique Webhook URL.</li>
              <li>Send data as JSON payload with your lead fields.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Custom Website */}
        <Card className="shadow-sm border-slate-200 hover:border-slate-400 transition-colors">
          <CardHeader className="pb-4 border-b bg-slate-50/50">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-slate-100 rounded-lg">
                <Code className="h-6 w-6 text-slate-600" />
              </div>
            </div>
            <CardTitle>Custom Website API</CardTitle>
            <CardDescription>
              Push leads from your WordPress site, landing pages, or custom frontend.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm text-slate-600">
            <p><strong>Setup Instructions:</strong></p>
            <p>Send a POST request with the following JSON format:</p>
            <pre className="bg-slate-900 text-slate-50 p-3 rounded-lg text-xs overflow-x-auto">
{`{
  "name": "John Doe",
  "phone": "9876543210",
  "source": "Website Form",
  "project": "Luxury Villas",
  "notes": "Interested in 3BHK"
}`}
            </pre>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
