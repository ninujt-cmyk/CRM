"use server"

import { createClient } from "@/lib/supabase/server"

export async function getSiteVisits() {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) throw new Error("Tenant not found")

    // Fetch site visits with lead and property details joined
    const { data: siteVisits, error } = await supabase
      .from('site_visits')
      .select(`
        *,
        lead:leads(name, phone, email),
        property:properties(title, location, price),
        agent:users(full_name)
      `)
      .eq('tenant_id', profile.tenant_id)
      .order('scheduled_at', { ascending: true })

    if (error) throw error

    return { success: true, data: siteVisits }
  } catch (error: any) {
    console.error("Error fetching site visits:", error)
    return { success: false, error: error.message }
  }
}

export async function addSiteVisit(visitData: any) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) throw new Error("Tenant not found")

    const { data, error } = await supabase
      .from('site_visits')
      .insert({ ...visitData, tenant_id: profile.tenant_id })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error adding site visit:", error)
    return { success: false, error: error.message }
  }
}

export async function updateSiteVisitStatus(id: string, status: string, feedback?: string) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
      .from('site_visits')
      .update({ status, feedback })
      .eq('id', id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error("Error updating site visit:", error)
    return { success: false, error: error.message }
  }
}
