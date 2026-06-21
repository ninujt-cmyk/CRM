"use server"

import { createClient } from "@/lib/supabase/server"

export async function getProperties() {
  try {
    const supabase = await createClient()
    
    // Auth & Tenant check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) throw new Error("Tenant not found")

    const { data: properties, error } = await supabase
      .from('properties')
      .select('*')
      .eq('tenant_id', profile.tenant_id)
      .order('created_at', { ascending: false })

    if (error) throw error

    return { success: true, data: properties }
  } catch (error: any) {
    console.error("Error fetching properties:", error)
    return { success: false, error: error.message }
  }
}

export async function addProperty(propertyData: any) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
    if (!profile?.tenant_id) throw new Error("Tenant not found")

    const { data, error } = await supabase
      .from('properties')
      .insert({ ...propertyData, tenant_id: profile.tenant_id })
      .select()
      .single()

    if (error) throw error

    return { success: true, data }
  } catch (error: any) {
    console.error("Error adding property:", error)
    return { success: false, error: error.message }
  }
}

export async function updateProperty(id: string, updates: any) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
      .from('properties')
      .update(updates)
      .eq('id', id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error("Error updating property:", error)
    return { success: false, error: error.message }
  }
}

export async function deleteProperty(id: string) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Unauthorized")

    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error("Error deleting property:", error)
    return { success: false, error: error.message }
  }
}
