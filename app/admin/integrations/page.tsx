"use client"

import { useState, useEffect } from "react"
import { useTenant } from "@/context/tenant-provider"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Facebook, Code, Zap, CheckCircle2, RefreshCw, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { getWebhookSecret, regenerateWebhookSecret } from "@/app/actions/integrations-actions"
import { LoadingSkeleton } from "@/components/loading-skeleton"

export default function IntegrationsPage() {
  const org = useTenant()
  const [webhookUrl, setWebhookUrl] = useState("")
  const [copied, setCopied] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)

  const loadWebhookUrl = async () => {
    if (!org?.id) return
    setIsLoading(true)
    
    const { success, secret } = await getWebhookSecret(org.id)
    
    if (success && secret) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm.hanva.in'
      setWebhookUrl(`${baseUrl}/api/webhooks/incoming-leads?token=${secret}`)
    } else {
      toast.error("Failed to load secure webhook URL.")
    }
    
    setIsLoading(false)
  }

  useEffect(() => {
    loadWebhookUrl()
  }, [org])

  const copyToClipboard = () => {
    if (!webhookUrl) return
    navigator.clipboard.writeText(webhookUrl)
    setCopied(true)
    toast.success("Webhook URL copied to clipboard!")
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRegenerate = async () => {
    if (!org?.id) return
    
    if (!confirm("Are you sure? This will instantly break any existing integrations using the old URL.")) {
        return
    }

    setIsRegenerating(true)
    const { success, secret, message } = await regenerateWebhookSecret(org.id)
    
    if (success && secret) {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://crm.hanva.in'
      setWebhookUrl(`${baseUrl}/api/webhooks/incoming-leads?token=${secret}`)
      toast.success(message)
    } else {
      toast.error(message || "Failed to regenerate URL.")
    }
    
    setIsRegenerating(false)
  }

  if (isLoading) {
    return <div className="p-6 max-w-6xl mx-auto"><LoadingSkeleton /></div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="slide-in-from-bottom-4 animate-in duration-700">
        <h1 className="text-3xl font-bold text-slate-800">Lead Sources & Integrations</h1>
        <p className="text-slate-500 mt-2">
          Automatically pull leads from external sources directly into your CRM using your secure Webhook URL.
        </p>
      </div>

      <Card className="border-indigo-100 shadow-sm bg-indigo-50/30 slide-in-from-bottom-8 animate-in duration-700 delay-100">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
                <CardTitle className="text-indigo-900 flex items-center gap-2">
                <Code className="h-5 w-5 text-indigo-600" />
                Your Secure Webhook URL
                </CardTitle>
                <CardDescription className="text-indigo-700/70 mt-1">
                Use this URL as the destination for incoming lead data (POST requests). 
                <span className="font-semibold text-rose-600 block mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-4 w-4" /> Keep this URL secret as it connects directly to your database.
                </span>
                </CardDescription>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="text-indigo-700 border-indigo-200 hover:bg-indigo-100 bg-white"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isRegenerating ? 'animate-spin' : ''}`} />
              Regenerate Token
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <Input 
              value={webhookUrl} 
              readOnly 
              className="bg-white font-mono text-sm text-slate-600 focus-visible:ring-indigo-500 w-full"
            />
            <Button 
              onClick={copyToClipboard}
              className={`min-w-[140px] transition-all shadow-sm ${copied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 slide-in-from-bottom-12 animate-in duration-700 delay-200">
        
        {/* Facebook Leads */}
        <Card className="shadow-sm border-slate-200 hover:border-blue-300 transition-all duration-300 hover:shadow-md group">
          <CardHeader className="pb-4 border-b bg-slate-50/50 group-hover:bg-blue-50/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-blue-100 rounded-lg group-hover:scale-110 transition-transform">
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
            <p className="font-semibold text-slate-800">Setup Instructions:</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Go to your Facebook Page settings &gt; Lead Access.</li>
              <li>Setup a Webhook connection.</li>
              <li>Paste your Secure Webhook URL.</li>
              <li>Map the fields: <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 border border-slate-200">name</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 border border-slate-200">phone</code>, <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 border border-slate-200">email</code>.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Zapier / Make */}
        <Card className="shadow-sm border-slate-200 hover:border-orange-300 transition-all duration-300 hover:shadow-md group">
          <CardHeader className="pb-4 border-b bg-slate-50/50 group-hover:bg-orange-50/30 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-orange-100 rounded-lg group-hover:scale-110 transition-transform">
                <Zap className="h-6 w-6 text-orange-600" />
              </div>
            </div>
            <CardTitle>Zapier & Make.com</CardTitle>
            <CardDescription>
              Connect 5,000+ apps via Zapier or Make by triggering a Webhook Action.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Setup Instructions:</p>
            <ol className="list-decimal pl-4 space-y-2">
              <li>Create a new Zap/Scenario.</li>
              <li>Select <strong>Webhook by Zapier (POST)</strong> as the Action.</li>
              <li>Paste your Secure Webhook URL.</li>
              <li>Send data as JSON payload with your lead fields.</li>
            </ol>
          </CardContent>
        </Card>

        {/* Custom Website */}
        <Card className="shadow-sm border-slate-200 hover:border-slate-400 transition-all duration-300 hover:shadow-md group">
          <CardHeader className="pb-4 border-b bg-slate-50/50 group-hover:bg-slate-100/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-slate-100 rounded-lg group-hover:scale-110 transition-transform shadow-sm">
                <Code className="h-6 w-6 text-slate-700" />
              </div>
            </div>
            <CardTitle>Custom Website API</CardTitle>
            <CardDescription>
              Push leads from your WordPress site, landing pages, or custom frontend.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-800">Setup Instructions:</p>
            <p>Send a POST request with the following JSON format:</p>
            <div className="relative rounded-lg overflow-hidden border border-slate-800 shadow-sm">
                <div className="bg-slate-800 px-3 py-1.5 flex items-center gap-2 border-b border-slate-700">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                    <span className="text-[10px] text-slate-400 font-mono ml-2">payload.json</span>
                </div>
                <pre className="bg-slate-900 text-slate-50 p-4 text-xs overflow-x-auto font-mono">
{`{
  "name": "John Doe",
  "phone": "9876543210",
  "source": "Website Form",
  "project": "Luxury Villas",
  "notes": "Interested in 3BHK"
}`}
                </pre>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
