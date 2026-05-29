import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from "@/lib/supabase/server"
import { NextResponse } from 'next/server'

// Use Service Role to bypass RLS and set session variables
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key"
)

export async function POST(request: Request) {
  try {
    // 🔒 AUTH CHECK
    const userSupabase = await createServerClient();
    const { data: { user: currentUser }, error: authError } = await userSupabase.auth.getUser();

    if (authError || !currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: userCheck } = await userSupabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    const allowedRoles = ["super_admin", "tenant_admin", "team_leader"];
    if (!userCheck?.role || !allowedRoles.includes(userCheck.role)) {
      return NextResponse.json({ error: "Forbidden: You do not have permission to execute this admin action." }, { status: 403 });
    }
    const { leadIds, assignedTo, assignerName } = await request.json()

    if (!leadIds || leadIds.length === 0 || !assignedTo) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    }

    // 1. Start a Remote Procedure Call (RPC) or Transaction to set the variable
    // Since Supabase-js doesn't support direct transactions easily, we use a SQL function approach
    // OR we perform the update then manually insert the notification.
    
    // We will use a wrapper function in SQL for atomic safety (Best Practice)
    const { error: rpcError } = await supabase.rpc('bulk_assign_leads', {
      p_lead_ids: leadIds,
      p_assigned_to: assignedTo
    })

    if (rpcError) throw rpcError

    // 2. Manually Create ONE Notification Row
    // This will trigger the Webhook ONCE, which sends the Push Notification safely.
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id: assignedTo,
        type: 'bulk_assignment',
        title: 'Bulk Leads Assigned',
        message: `${assignerName || 'Admin'} has assigned ${leadIds.length} new leads to you.`,
        read: false
      })

    if (notifError) throw notifError

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error("Bulk Assign Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
