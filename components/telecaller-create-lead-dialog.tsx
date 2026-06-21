"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Loader2 } from "lucide-react"
import { toast } from "sonner"

// --- STATUS CONFIGURATION ---
const LEAD_STATUSES = [
  { id: 'new', title: 'New Leads' },
  { id: 'contacted', title: 'Contacted' },
  { id: 'Interested', title: 'Interested' },
  { id: 'Documents_Sent', title: 'Docs Sent' },
  { id: 'Login', title: 'Login' },
  { id: 'follow_up', title: 'Follow Up' },
  { id: 'Disbursed', title: 'Disbursed' },
  { id: 'nr', title: 'Not Reachable' },
  { id: 'Not_Interested', title: 'Not Interested' },
  { id: 'recycle_pool', title: 'Recycle Pool' },
  { id: 'dead_bucket', title: 'Dead Bucket' },
  { id: 'self_employed', title: 'Self Employed' },
  { id: 'not_eligible', title: 'Not Eligible' },
]

interface TelecallerCreateLeadDialogProps {
  currentUserId: string
}

export function TelecallerCreateLeadDialog({ currentUserId }: TelecallerCreateLeadDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const { useTenant } = require("@/context/tenant-provider");
  const org = useTenant();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    status: "new", // Default status
    // Real Estate Fields
    budget: "",
    bhk: "",
    location: ""
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      if (!formData.name || !formData.phone) {
        toast.error("Name and Phone are required")
        setIsLoading(false)
        return
      }

      // Fetch tenant profile to get tenant_id for custom fields
      const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', currentUserId).single()

      // Insert into Supabase
      const { data: lead, error } = await supabase.from("leads").insert({
        name: formData.name,
        phone: formData.phone,
        status: formData.status,
        assigned_to: currentUserId, // Auto-assign to self
        source: "other", // FIX: Changed to 'Other' to match DB constraint
        created_at: new Date().toISOString(),
        last_contacted: new Date().toISOString(),
        tenant_id: profile?.tenant_id // Provide if needed
      }).select().single()

      if (error) throw error

      // Insert custom fields if it's a real estate lead
      if (org?.industry === 'real_estate' && lead?.id && profile?.tenant_id) {
        const customFields = [
          { lead_id: lead.id, tenant_id: profile.tenant_id, field_key: 'budget', field_value: formData.budget },
          { lead_id: lead.id, tenant_id: profile.tenant_id, field_key: 'bhk_preference', field_value: formData.bhk },
          { lead_id: lead.id, tenant_id: profile.tenant_id, field_key: 'preferred_location', field_value: formData.location },
        ].filter(f => f.field_value)

        if (customFields.length > 0) {
           await supabase.from('lead_custom_fields').insert(customFields)
        }
      }

      toast.success("Lead created successfully!")
      setFormData({ name: "", phone: "", status: "new", budget: "", bhk: "", location: "" }) // Reset form
      setOpen(false) // Close dialog
      router.refresh() // Refresh data on page
    } catch (error: any) {
      console.error("Error creating lead:", error)
      toast.error(error.message || "Failed to create lead")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
          <Plus className="h-4 w-4 mr-2" />
          Create Lead
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
          <DialogDescription>
            Add a quick lead. It will be automatically assigned to you.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Customer Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              placeholder="9876543210"
              maxLength={10}
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value.replace(/\D/g, "") })
              }
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="status">Initial Status</Label>
            <Select
              value={formData.status}
              onValueChange={(val) => setFormData({ ...formData, status: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Status" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {LEAD_STATUSES.map((status) => (
                  <SelectItem key={status.id} value={status.id}>
                    {status.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {org?.industry === 'real_estate' && (
            <div className="border-t pt-4 mt-2">
              <h4 className="text-sm font-semibold mb-3 text-slate-700">Property Requirements</h4>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="budget">Budget (Max)</Label>
                  <Input
                    id="budget"
                    placeholder="e.g. 8000000"
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="bhk">BHK Preference</Label>
                    <Select
                      value={formData.bhk}
                      onValueChange={(val) => setFormData({ ...formData, bhk: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1 BHK">1 BHK</SelectItem>
                        <SelectItem value="2 BHK">2 BHK</SelectItem>
                        <SelectItem value="3 BHK">3 BHK</SelectItem>
                        <SelectItem value="4+ BHK">4+ BHK</SelectItem>
                        <SelectItem value="Plot">Plot / Land</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      placeholder="e.g. Noida Sector 62"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
