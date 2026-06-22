"use server"

import { createClient } from "@/lib/supabase/server"

export async function getAgentRoster() {
    try {
        const supabase = await createClient()
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
        if (!profile?.tenant_id) throw new Error("Tenant not found")

        const { data, error } = await supabase
            .from('users')
            .select('id, full_name, email, role, is_active, is_on_shift, last_shift_change')
            .eq('tenant_id', profile.tenant_id)
            .in('role', ['telecaller', 'admin', 'manager'])
            .order('full_name', { ascending: true })

        if (error) throw error

        return { success: true, data }
    } catch (error: any) {
        console.error("Error fetching roster:", error)
        return { success: false, error: error.message }
    }
}

export async function updateAgentShift(agentId: string, isOnShift: boolean) {
    try {
        const supabase = await createClient()
        
        // Ensure admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (profile?.role !== 'admin' && profile?.role !== 'super_admin' && profile?.role !== 'manager') {
            throw new Error("Only admins can update another agent's shift")
        }

        const { error } = await supabase
            .from('users')
            .update({ 
                is_on_shift: isOnShift, 
                last_shift_change: new Date().toISOString() 
            })
            .eq('id', agentId)

        if (error) throw error

        return { success: true }
    } catch (error: any) {
        console.error("Error updating agent shift:", error)
        return { success: false, error: error.message }
    }
}
