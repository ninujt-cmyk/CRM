import { createClient } from "@/lib/supabase/server"
import { UserForm } from "@/components/admin/user-form"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, Mail, Phone, Shield } from "lucide-react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export default async function EditUserPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  
  // 1. Fetch User Data
  const { data: user, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", params.id)
    .single()
    
  if (error || !user) {
    notFound()
  }

  // 2. Fetch User Stats (Optional but powerful context)
  const { count: leadCount } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("assigned_to", user.id)

  const { count: tasksPending } = await supabase
    .from("follow_ups")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "pending")

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-8 bg-slate-50/50 min-h-screen">
      
      {/* HEADER with Context */}
      <div className="flex items-center gap-4">
        <Link href="/admin/users">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-full bg-white shadow-sm hover:bg-slate-50">
            <ArrowLeft className="h-5 w-5 text-slate-600" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {user.full_name}
            </h1>
            <Badge variant={user.is_active ? "outline" : "destructive"} className={user.is_active ? "text-green-600 bg-green-50 border-green-200" : ""}>
              {user.is_active ? "Active Account" : "Inactive"}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5"/> {user.email}</span>
            {user.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5"/> {user.phone}</span>}
            <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5"/> Joined {new Date(user.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* LEFT COLUMN: Main Form */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle className="text-base font-semibold">Profile Settings</CardTitle>
                </CardHeader>
                <CardContent>
                    <UserForm initialData={user} isEditing={true} />
                </CardContent>
            </Card>
          </div>

          {/* RIGHT COLUMN: Context & Stats */}
          <div className="space-y-6">
             {/* Stats Card */}
             <Card className="shadow-sm border-slate-200">
                <CardHeader className="pb-3 border-b bg-slate-50/50">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Shield className="h-4 w-4 text-indigo-600" /> Work Snapshot
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Total Leads</span>
                        <span className="font-mono font-bold text-slate-900">{leadCount || 0}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Pending Tasks</span>
                        <span className="font-mono font-bold text-orange-600">{tasksPending || 0}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-slate-500">Role</span>
                        <Badge variant="secondary" className="capitalize">{user.role.replace('_', ' ')}</Badge>
                    </div>
                </CardContent>
             </Card>

             {/* Danger Zone (Separate from main form for safety) */}
             <Card className="border-red-100 bg-red-50/30">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold text-red-800">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-xs text-red-600 mb-4">
                        Deactivating a user prevents them from logging in, but preserves their data. Deleting is permanent.
                    </p>
                    <Button variant="destructive" size="sm" className="w-full">
                        Deactivate User
                    </Button>
                </CardContent>
             </Card>
          </div>
      </div>
    </div>
  )
}
