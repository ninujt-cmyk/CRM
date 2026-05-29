"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, IndianRupee, Building2, User } from "lucide-react"
import { toast } from "sonner"

interface CreateLeadFormProps {
  telecallers: { id: string; full_name: string }[]
  currentUserId: string
  userRole: string
}

export function CreateLeadForm({ telecallers, currentUserId, userRole }: CreateLeadFormProps) {
  const router = useRouter()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    loan_amount: "",
    bank_name: "",
    assigned_to: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // 1. Basic Validation
      if (!formData.name || !formData.phone || !formData.loan_amount || !formData.bank_name) {
        toast.error("Please fill in all required fields")
        setIsLoading(false)
        return
      }

      // 2. Prepare Data
      // If no telecaller is selected, it stays 'Unassigned' (null)
      // OR if Team Leader creates it, they might assign to themselves by default if dropdown is skipped
      const assignee = formData.assigned_to === "unassigned" ? null : formData.assigned_to

      // 3. Insert into Supabase
      const { data, error } = await supabase
        .from("leads")
        .insert({
          name: formData.name,
          phone: formData.phone,
          loan_amount: parseFloat(formData.loan_amount),
          bank_name: formData.bank_name, // Capture Bank Selection
          assigned_to: assignee,
          assigned_by: currentUserId,
          status: "New", // Default status
          source: "Manual Entry",
          created_at: new Date().toISOString(),
        })
        .select()

      if (error) throw error

      toast.success("Lead created successfully!")
      
      // 4. Redirect based on role
      if (userRole === 'admin' || userRole === 'tenant_admin' || userRole === 'super_admin') {
        router.push("/admin/leads")
      } else {
        router.push("/telecaller") // If a telecaller created it
      }
      
      router.refresh()

    } catch (error: any) {
      console.error("Error creating lead:", error)
      toast.error(error.message || "Failed to create lead")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Create New Lead</CardTitle>
        <CardDescription>
          Enter customer details. This amount will calculate towards the telecaller's target.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Row 1: Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Customer Name</Label>
              <Input
                id="name"
                placeholder="Ex: Rahul Sharma"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="Ex: 9876543210"
                maxLength={10}
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                required
              />
            </div>
          </div>

          {/* Row 2: Financials */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="loan_amount" className="flex items-center gap-1">
                <IndianRupee className="h-3 w-3" /> Loan Amount
              </Label>
              <Input
                id="loan_amount"
                type="number"
                placeholder="Ex: 500000"
                value={formData.loan_amount}
                onChange={(e) => setFormData({ ...formData, loan_amount: e.target.value })}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Target Contribution: {(parseFloat(formData.loan_amount || "0") / 100000).toFixed(2)} Lakhs
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bank" className="flex items-center gap-1">
                <Building2 className="h-3 w-3" /> Select Bank
              </Label>
              <Select 
                value={formData.bank_name} 
                onValueChange={(val) => setFormData({ ...formData, bank_name: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose Bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ICICI Bank">ICICI Bank</SelectItem>
                  <SelectItem value="HDFC Bank">HDFC Bank</SelectItem>
                  <SelectItem value="Fi Money">Fi Money</SelectItem>
                  <SelectItem value="Axis Bank">Axis Bank</SelectItem>
                  <SelectItem value="Kotak Bank">Kotak Bank</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 3: Assignment */}
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="telecaller" className="flex items-center gap-1">
              <User className="h-3 w-3" /> Assign To Telecaller
            </Label>
            <Select 
              value={formData.assigned_to} 
              onValueChange={(val) => setFormData({ ...formData, assigned_to: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Telecaller" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned" className="text-muted-foreground">
                  -- Leave Unassigned --
                </SelectItem>
                {telecallers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              Selecting a telecaller will notify them immediately via the App and Web Push.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Lead
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
