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

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    status: "new", // Default status
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

      // Insert into Supabase
      const { error } = await supabase.from("leads").insert({
        name: formData.name,
        phone: formData.phone,
        status: formData.status,
        assigned_to: currentUserId, // Auto-assign to self
        source: "other", // FIX: Changed to 'Other' to match DB constraint
        created_at: new Date().toISOString(),
        last_contacted: new Date().toISOString(),
      })

      if (error) throw error

      toast.success("Lead created successfully!")
      setFormData({ name: "", phone: "", status: "new" }) // Reset form
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
          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
