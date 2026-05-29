"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function updateTelecallerStatus(newStatus: string, reason: string = "Manual Update") {
  try {
    const supabase = await createClient()

    // 1. Verify who is making the request securely on the server
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    // 2. Use the Admin client to bypass Row Level Security (RLS)
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // 3. Force the update for ONLY the logged-in user
    const { error } = await supabaseAdmin
        .from('users')
        .update({
            current_status: newStatus,
            status_reason: reason,
            status_updated_at: new Date().toISOString()
        })
        .eq('id', user.id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error("Status Update Error:", error)
    return { success: false, error: error.message }
  }
}
