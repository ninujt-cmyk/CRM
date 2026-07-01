"use client"

import { useState } from "react"
import { PlaySquare, Plus, ShoppingCart, ToggleLeft, ToggleRight, Save, Trash2, Edit } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export default function CampaignsPage() {
  const [isSaving, setIsSaving] = useState(false)
  
  // Mock data for Shopify auto-call settings
  const [shopifySettings, setShopifySettings] = useState({
    abandonedCheckout: true,
    codConfirmation: false,
    orderConfirmation: true,
    shippingUpdates: false,
    delayMinutes: "15"
  })

  // Mock data for Custom Campaign Rules
  const [campaigns, setCampaigns] = useState([
    { id: 1, name: "Winback Campaign", status: "active", triggers: "Tag: VIP", calls_made: 145 },
    { id: 2, name: "Feedback Survey", status: "paused", triggers: "Delivered > 7 days", calls_made: 82 }
  ])

  const handleSaveShopify = () => {
    setIsSaving(true)
    setTimeout(() => {
      setIsSaving(false)
      toast.success("Shopify Auto-Call settings updated")
    }, 1000)
  }

  const handleToggleShopifySetting = (key: keyof typeof shopifySettings) => {
    setShopifySettings(prev => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <PlaySquare className="h-6 w-6 text-blue-600" />
          Auto Campaigns
        </h1>
        <p className="text-slate-500 mt-1">Set up automated calling rules based on customer actions and store events.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Shopify Auto-Call Settings */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-indigo-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Shopify Auto-Call Rules</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Abandoned Checkouts</h4>
                <p className="text-sm text-slate-500">Automatically call customers who abandon their cart.</p>
              </div>
              <Switch 
                checked={shopifySettings.abandonedCheckout} 
                onCheckedChange={() => handleToggleShopifySetting("abandonedCheckout")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">COD Confirmation</h4>
                <p className="text-sm text-slate-500">Call to verify Cash on Delivery orders before shipping.</p>
              </div>
              <Switch 
                checked={shopifySettings.codConfirmation} 
                onCheckedChange={() => handleToggleShopifySetting("codConfirmation")}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900 dark:text-white">Order Confirmation</h4>
                <p className="text-sm text-slate-500">Call to thank customers and confirm prepaid orders.</p>
              </div>
              <Switch 
                checked={shopifySettings.orderConfirmation} 
                onCheckedChange={() => handleToggleShopifySetting("orderConfirmation")}
              />
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <label className="text-sm font-medium mb-1.5 block">Trigger Delay (Minutes)</label>
              <div className="flex items-center gap-3">
                <Input 
                  type="number" 
                  value={shopifySettings.delayMinutes} 
                  onChange={(e) => setShopifySettings({...shopifySettings, delayMinutes: e.target.value})}
                  className="w-24"
                />
                <span className="text-sm text-slate-500">Wait this long after the event to make the call.</span>
              </div>
            </div>

            <Button onClick={handleSaveShopify} disabled={isSaving} className="w-full gap-2">
              <Save className="h-4 w-4" />
              {isSaving ? "Saving..." : "Save Shopify Settings"}
            </Button>
          </div>
        </div>

        {/* Custom Campaign Rules */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 flex justify-between items-center">
            <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <PlaySquare className="h-5 w-5 text-emerald-500" />
              Custom Campaigns
            </h2>
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 gap-1">
                  <Plus className="h-3.5 w-3.5" />
                  New Campaign
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Custom Campaign</DialogTitle>
                  <DialogDescription>Define a new segment rule to trigger automatic calls.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Campaign Name</label>
                    <Input placeholder="e.g. VIP Thank You" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Trigger Event</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select trigger event" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer_tagged">Customer Tagged</SelectItem>
                        <SelectItem value="order_delivered">Order Delivered</SelectItem>
                        <SelectItem value="refund_requested">Refund Requested</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Assign Script</label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select script to use" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="s1">Order Confirmation</SelectItem>
                        <SelectItem value="s2">Winback Offer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full">Create Campaign</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          <div className="p-0 flex-1">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Campaign</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Calls</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{camp.name}</div>
                      <div className="text-xs text-slate-500">{camp.triggers}</div>
                    </td>
                    <td className="px-4 py-3">
                      {camp.status === "active" ? (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-200 bg-emerald-50">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Paused</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{camp.calls_made}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-blue-600">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
