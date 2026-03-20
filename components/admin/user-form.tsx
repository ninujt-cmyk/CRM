"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertCircle, Loader2, Building2 } from "lucide-react"

interface UserFormProps {
  initialData?: {
    id: string
    email: string
    full_name: string
    phone: string
    role: string
    manager_id: string | null
    tenant_id?: string | null // Added for Super Admin editing
  }
  isEditing?: boolean
}

export function UserForm({ initialData, isEditing = false }: UserFormProps) {
  const router = useRouter()
  const supabase = createClient()
  
  const [formData, setFormData] = useState({
    email: initialData?.email || "",
    full_name: initialData?.full_name || "",
    phone: initialData?.phone || "",
    role: initialData?.role || "telecaller",
    manager_id: initialData?.manager_id || "none",
    tenant_id: initialData?.tenant_id || "none", // Added to form state
    password: "", 
  })
  
  const [admins, setAdmins] = useState<{ id: string; full_name: string }[]>([])
  
  // 🔴 NEW: Super Admin State
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [tenants, setTenants] = useState<{ id: string; name: string }[]>([])
  
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const initForm = async () => {
      // 1. Get the current user's role to determine if they are a Super Admin
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from("users").select("role").eq("id", user.id).single()
        if (profile) {
          setCurrentUserRole(profile.role)
          
          // 2. If Super Admin, fetch all available organizations (tenants)
          if (profile.role === "super_admin") {
            const { data: orgData } = await supabase.from("organizations").select("id, name").order("name")
            if (orgData) setTenants(orgData)
          }
        }
      }

      // 3. Fetch managers for the assignment dropdown
      const { data: adminData } = await supabase
        .from("users")
        .select("id, full_name")
        .in("role", ["admin", "tenant_admin", "team_leader", "super_admin"])
        .eq("is_active", true) 
        .order("full_name", { ascending: true }) 
      
      if (adminData) setAdmins(adminData)
    }
    
    initForm()
  }, [supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Prepare payload
    const payload = {
      email: formData.email,
      full_name: formData.full_name,
      phone: formData.phone,
      role: formData.role,
      password: formData.password, // Ignored in PATCH usually
      manager_id: formData.manager_id === "none" || formData.manager_id === "" ? null : formData.manager_id,
      // Pass tenant_id ONLY if super_admin selected one
      tenant_id: formData.tenant_id === "none" || formData.tenant_id === "" ? undefined : formData.tenant_id
    }

    try {
      if (isEditing && initialData) {
        const response = await fetch(`/api/admin/users/${initialData.id}`, {
          method: "PATCH", 
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to update user")
        }
        
        alert("User updated successfully")
        router.push("/admin/users")
        router.refresh()
      } else {
        const response = await fetch("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
        
        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || "Failed to create user")
        }

        alert("User created successfully")
        router.push("/admin/users")
        router.refresh()
      }
    } catch (err: any) {
      console.error("Error saving user:", err)
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit User" : "Create New User"}</CardTitle>
        <CardDescription>
          {isEditing ? "Update user details and assignment" : "Add a new user to the system"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* 🔴 NEW: Super Admin Tenant Selection */}
          {currentUserRole === 'super_admin' && (
            <div className="grid gap-2 p-4 bg-indigo-50 border border-indigo-100 rounded-lg mb-4">
              <Label htmlFor="tenant" className="flex items-center gap-2 text-indigo-900">
                <Building2 className="h-4 w-4" />
                Assign to Workspace (Super Admin Only)
              </Label>
              <Select 
                value={formData.tenant_id} 
                onValueChange={(value) => setFormData({ ...formData, tenant_id: value })}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Select a workspace..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-slate-400 italic">Inherit My Workspace</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-indigo-600 mt-1">
                Select the company this user belongs to. Leave default to add them to your current active workspace.
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              required
            />
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
              disabled={isEditing} 
            />
          </div>

          {!isEditing && (
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role">Role</Label>
            <Select 
              value={formData.role} 
              onValueChange={(value) => setFormData({ ...formData, role: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="telecaller">Telecaller</SelectItem>
                <SelectItem value="team_leader">Team Leader</SelectItem>
                <SelectItem value="kyc_team">KYC Team</SelectItem>
                <SelectItem value="marketing_manager">Marketing Manager</SelectItem>
                <SelectItem value="tenant_admin">Tenant Admin</SelectItem>
                <SelectItem value="super_admin">Super Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="manager">Reports To (Manager)</Label>
            <Select 
              value={formData.manager_id || "none"} 
              onValueChange={(value) => setFormData({ ...formData, manager_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select manager" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Manager (Top Level)</SelectItem>
                {admins.map((admin) => (
                  <SelectItem key={admin.id} value={admin.id}>
                    {admin.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Assign a manager for this user. Admins can manage their own team.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
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
              {isEditing ? "Update User" : "Create User"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
