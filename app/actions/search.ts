"use server"

import { createClient } from "@/lib/supabase/server"

export interface SearchResult {
  id: string
  type: 'lead' | 'property' | 'action'
  title: string
  subtitle?: string
  href: string
}

export async function globalSearch(query: string): Promise<SearchResult[]> {
  try {
    if (!query || query.trim().length < 2) return []
    
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    // Fetch user tenant and role
    const { data: profile } = await supabase.from('users').select('tenant_id, role').eq('id', user.id).single()
    if (!profile?.tenant_id) return []

    const tenantId = profile.tenant_id
    const isAdmin = profile.role === 'admin' || profile.role === 'super_admin'

    const term = `%${query.trim()}%`
    
    // 1. Search Leads
    const leadsQuery = supabase
      .from('leads')
      .select('id, name, email, phone, company')
      .eq('tenant_id', tenantId)
      .or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},company.ilike.${term}`)
      .limit(5)
    
    // Non-admins can only search their own leads
    if (!isAdmin) {
      leadsQuery.eq('assigned_to', user.id)
    }
    
    // 2. Search Properties
    const propertiesQuery = supabase
      .from('properties')
      .select('id, title, location, type')
      .eq('tenant_id', tenantId)
      .or(`title.ilike.${term},location.ilike.${term}`)
      .limit(5)

    const [leadsRes, propsRes] = await Promise.all([leadsQuery, propertiesQuery])

    const results: SearchResult[] = []

    if (leadsRes.data) {
      results.push(...leadsRes.data.map(lead => ({
        id: lead.id,
        type: 'lead' as const,
        title: lead.name || 'Unnamed Lead',
        subtitle: [lead.phone, lead.company].filter(Boolean).join(' • '),
        href: `/admin/leads/${lead.id}`
      })))
    }

    if (propsRes.data) {
      results.push(...propsRes.data.map(prop => ({
        id: prop.id,
        type: 'property' as const,
        title: prop.title,
        subtitle: `${prop.type || 'Property'} in ${prop.location || 'Unknown'}`,
        href: `/admin/properties?search=${encodeURIComponent(prop.title)}`
      })))
    }

    // Sort by type then title
    return results.sort((a, b) => a.type.localeCompare(b.type))
  } catch (error) {
    console.error("Global search error:", error)
    return []
  }
}
