"use server"

import { createClient } from "@/lib/supabase/server"

export async function fetchDeals() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: profile } = await supabase.from('users').select('role, tenant_id').eq('id', user.id).single()
        if (!profile?.tenant_id) throw new Error("No tenant found")

        let query = supabase.from('deals')
            .select(`
                *,
                lead:leads(name, email, phone),
                property:properties(title, type, price),
                agent:users(full_name)
            `)
            .eq('tenant_id', profile.tenant_id)
            .order('created_at', { ascending: false })

        // If not admin, only show assigned deals
        if (profile.role !== 'admin' && profile.role !== 'super_admin') {
            query = query.eq('agent_id', user.id)
        }

        const { data, error } = await query
        if (error) throw new Error(error.message)

        return { success: true, data }
    } catch (error: any) {
        console.error("Fetch deals error:", error)
        return { success: false, error: error.message }
    }
}

export async function createDeal(dealData: any) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
        if (!profile?.tenant_id) throw new Error("No tenant found")

        const { data, error } = await supabase.from('deals')
            .insert({ ...dealData, tenant_id: profile.tenant_id })
            .select()
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (error: any) {
        console.error("Create deal error:", error)
        return { success: false, error: error.message }
    }
}

export async function updateDealStage(dealId: string, newStage: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data, error } = await supabase.from('deals')
            .update({ stage: newStage, updated_at: new Date().toISOString() })
            .eq('id', dealId)
            .select()
            .single()

        if (error) throw new Error(error.message)
        return { success: true, data }
    } catch (error: any) {
        console.error("Update deal stage error:", error)
        return { success: false, error: error.message }
    }
}

export async function deleteDeal(dealId: string) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { error } = await supabase.from('deals')
            .delete()
            .eq('id', dealId)

        if (error) throw new Error(error.message)
        return { success: true }
    } catch (error: any) {
        console.error("Delete deal error:", error)
        return { success: false, error: error.message }
    }
}
