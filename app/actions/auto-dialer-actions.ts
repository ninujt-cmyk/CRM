"use server"

import { createClient } from "@/lib/supabase/server"

export async function setAutoDialerStatus(userId: string | 'ALL', status: 'active' | 'paused') {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return { success: false, error: "Unauthorized" }

        // Fetch caller's role and tenant
        const { data: profile } = await supabase.from('users').select('role, tenant_id').eq('id', user.id).single()
        
        if (!['admin', 'super_admin', 'manager', 'team_leader'].includes(profile?.role || '')) {
            return { success: false, error: "Forbidden: You do not have permission to manage dialers." }
        }

        // RLS will automatically ensure we only update users in OUR tenant
        if (userId === 'ALL') {
            const { error } = await supabase.from('users')
                .update({ auto_dialer_status: status })
                .in('role', ['telecaller', 'agent'])
            if (error) throw error;
        } else {
            const { error } = await supabase.from('users')
                .update({ auto_dialer_status: status })
                .eq('id', userId)
            if (error) throw error;
        }

        return { success: true }
    } catch (error: any) {
        console.error("Auto-Dialer Toggle Error:", error);
        return { success: false, error: error.message || "Failed to toggle auto-dialer." }
    }
}
