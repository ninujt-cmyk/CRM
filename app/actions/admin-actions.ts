// app/actions/admin-actions.ts
"use server"

import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function forceUpdateAgentStatus(agentId: string, newStatus: string, reason: string) {
    try {
        // 🚀 Use Admin client to forcefully bypass RLS
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error } = await supabaseAdmin.from("users")
            .update({
                current_status: newStatus,
                status_reason: reason,
                status_updated_at: new Date().toISOString()
            })
            .eq("id", agentId);

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error("🔥 Admin Force Status Error:", error);
        return { success: false, error: error.message || "Failed to force update status" };
    }
}
