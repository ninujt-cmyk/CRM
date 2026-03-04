"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Building2, Users, Loader2, Plus, Server, ShieldAlert } from "lucide-react"
import { toast } from "sonner"

import { provisionNewTenant } from "@/app/actions/super-admin"
import { useRouter } from "next/navigation"

export default function SuperAdminConsole() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(true)
  const [organizations, setOrganizations] = useState<any[]>([])
  const [isProvisioning, setIsProvisioning] = useState(false)
  const [showModal, setShowModal] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    orgName: "", plan: "pro", adminName: "", adminEmail: "", adminPassword: ""
  })

  const fetchOrganizations = async () => {
    setLoading(true)
    
    // Check if user is super admin first
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/auth/login')

    const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
    if (userData?.role !== 'super_admin') {
        toast.error("Unauthorized access.")
        return router.push('/telecaller')
    }

    // Fetch Orgs and get a rough user count
    const { data: orgs, error } = await supabase
      .from('organizations')
      .select('*, users(count)')
      .order('created_at', { ascending: false })

    if (orgs) setOrganizations(orgs)
    setLoading(false)
  }

  useEffect(() => {
    fetchOrganizations()
  }, [])

  const handleProvision = async () => {
    if (!formData.orgName || !formData.adminEmail || !formData.adminPassword) {
        return toast.error("Please fill in all required fields.")
    }

    setIsProvisioning(true)
    const res = await provisionNewTenant(formData)
    
    if (res.success) {
        toast.success(res.message)
        setShowModal(false)
        setFormData({ orgName: "", plan: "pro", adminName: "", adminEmail: "", adminPassword: "" })
        fetchOrganizations() // Refresh list
    } else {
        toast.error(res.error)
    }
    setIsProvisioning(false)
  }

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 bg-slate-50 min-h-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 flex items-center gap-3">
            <Server className="h-8 w-8 text-indigo-600" />
            Super Admin Console
          </h1>
          <p className="text-slate-500 mt-1">Manage global workspaces, billing plans, and instance provisioning.</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="bg-indigo-600 hover:bg-indigo-700 shadow-md">
            <Plus className="h-4 w-4 mr-2" /> Provision New Tenant
        </Button>
      </div>

      {/* Warning Banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3 text-amber-800">
        <ShieldAlert className="h-5 w-5 shrink-0" />
        <div className="text-sm">
            <strong>System Security Active:</strong> You are viewing global data. Standard users are strictly isolated to their own tenant IDs via Row Level Security (RLS).
        </div>
      </div>

      {/* Organization List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {organizations.map((org) => (
            <Card key={org.id} className="hover:shadow-md transition-all border-slate-200">
                <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-bold text-slate-800">{org.name}</CardTitle>
                        <Badge variant="outline" className={
                            org.plan === 'enterprise' ? "bg-purple-50 text-purple-700 border-purple-200 uppercase text-[10px]" : 
                            org.plan === 'pro' ? "bg-blue-50 text-blue-700 border-blue-200 uppercase text-[10px]" : 
                            "bg-slate-100 text-slate-600 uppercase text-[10px]"
                        }>
                            {org.plan}
                        </Badge>
                    </div>
                    <CardDescription className="text-xs font-mono text-slate-400 truncate pt-1">ID: {org.id}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between pt-4 border-t mt-2">
                        <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                            <Users className="h-4 w-4 text-slate-400" />
                            {org.users[0]?.count || 0} Total Users
                        </div>
                        <div className="text-xs text-slate-400">
                            Created {new Date(org.created_at).toLocaleDateString()}
                        </div>
                    </div>
                </CardContent>
            </Card>
        ))}
      </div>

      {/* Provisioning Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" /> Create Workspace
            </DialogTitle>
            <DialogDescription>
              This provisions a new isolated database environment and creates the founding admin account.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
                <Label>Company / Workspace Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Acme Corp" value={formData.orgName} onChange={e => setFormData({...formData, orgName: e.target.value})} />
            </div>

            <div className="space-y-2">
                <Label>Billing Plan</Label>
                <Select value={formData.plan} onValueChange={v => setFormData({...formData, plan: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="free">Free Tier</SelectItem>
                        <SelectItem value="pro">Pro Tier</SelectItem>
                        <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="pt-4 border-t space-y-4 mt-2">
                <h4 className="text-sm font-bold text-slate-700">Initial Admin Account</h4>
                
                <div className="space-y-2">
                    <Label>Admin Full Name</Label>
                    <Input placeholder="John Doe" value={formData.adminName} onChange={e => setFormData({...formData, adminName: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Admin Email <span className="text-red-500">*</span></Label>
                    <Input type="email" placeholder="admin@company.com" value={formData.adminEmail} onChange={e => setFormData({...formData, adminEmail: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Temporary Password <span className="text-red-500">*</span></Label>
                    <Input type="password" placeholder="At least 6 characters" value={formData.adminPassword} onChange={e => setFormData({...formData, adminPassword: e.target.value})} />
                </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)} disabled={isProvisioning}>Cancel</Button>
            <Button onClick={handleProvision} disabled={isProvisioning} className="bg-indigo-600 hover:bg-indigo-700">
                {isProvisioning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Server className="h-4 w-4 mr-2" />}
                Provision Tenant
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
