import { createClient } from "@/lib/supabase/server"
import { CreateLeadForm } from "@/components/admin/create-lead-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon } from "lucide-react"

export default async function NewLeadPage() {
  const supabase = await createClient()

  // 1. Get Current User Info
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) return <div>Please login</div>

  // 2. Fetch User Role
  const { data: userProfile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  // 3. Fetch Available Telecallers
  // Since we fixed the RLS policies, this query will automatically:
  // - Show ALL telecallers if you are Tenant Admin / Super Admin
  // - Show ONLY YOUR TEAM if you are a Team Leader
  const { data: telecallers } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "telecaller")
    .eq("is_active", true)
    .order("full_name", { ascending: true })

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Lead</h1>
          <p className="text-gray-600 mt-1">Manual entry for walk-in or phone leads.</p>
        </div>
        
        {/* Serial Number Display (Visual Only - Real ID is generated on save) */}
        <div className="bg-blue-50 px-4 py-2 rounded-lg border border-blue-100">
          <span className="text-xs text-blue-600 font-semibold uppercase tracking-wider">Entry Type</span>
          <p className="text-lg font-bold text-blue-900">MANUAL-{new Date().getFullYear()}</p>
        </div>
      </div>

      <CreateLeadForm 
        telecallers={telecallers || []} 
        currentUserId={user.id}
        userRole={userProfile?.role || 'telecaller'}
      />

      <Alert className="bg-orange-50 border-orange-200">
        <InfoIcon className="h-4 w-4 text-orange-600" />
        <AlertTitle className="text-orange-800">Performance Note</AlertTitle>
        <AlertDescription className="text-orange-700 text-sm">
          The <strong>Loan Amount</strong> entered here represents the <em>Potential Value</em>. 
          The telecaller's performance target will only increase when this lead status is updated to <strong>Disbursed</strong>.
        </AlertDescription>
      </Alert>
    </div>
  )
}
