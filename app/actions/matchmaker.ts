"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Finds properties that match a lead's requirements.
 */
export async function getSmartMatchesForLead(tenantId: string, leadId: string) {
    try {
        const supabase = await createClient()

        // 1. Fetch Lead
        const { data: lead, error: leadError } = await supabase
            .from('leads')
            .select('id, requirements')
            .eq('id', leadId)
            .eq('tenant_id', tenantId)
            .single()
        
        if (leadError) throw leadError;
        
        if (!lead || !lead.requirements) {
            return { success: true, matches: [], message: "No requirements specified for this lead." }
        }

        const reqs = typeof lead.requirements === 'string' ? JSON.parse(lead.requirements) : lead.requirements;

        // 2. Build Property Query based on requirements
        let query = supabase
            .from('properties')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('status', 'available') // Only show available properties

        if (reqs.budget_min) query = query.gte('price', reqs.budget_min);
        if (reqs.budget_max) query = query.lte('price', reqs.budget_max);
        
        if (reqs.bhk) {
             query = query.ilike('bhk_config', `%${reqs.bhk}%`);
        }

        if (reqs.location) {
             // Location can be partial match
             query = query.ilike('location', `%${reqs.location}%`);
        }

        // Limit matches to top 5
        query = query.limit(5);

        const { data: matches, error: propError } = await query;

        if (propError) throw propError;

        return { success: true, matches: matches || [] };

    } catch (error: any) {
        console.error("Matchmaker error:", error);
        return { success: false, error: error.message };
    }
}
