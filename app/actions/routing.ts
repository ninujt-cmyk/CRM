"use server"

import { createClient } from "@/lib/supabase/server"

/**
 * Assigns a lead to the most eligible telecaller using a Load Balanced approach.
 * It assigns the lead to the active telecaller who has received the fewest leads today.
 */
export async function assignLeadRoundRobin(tenantId: string, leadId: string) {
    try {
        const supabase = await createClient()

        // 1. Get all active telecallers for the tenant who are currently on shift
        const { data: telecallers, error: userError } = await supabase
            .from('users')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('role', 'telecaller')
            .eq('is_active', true)
            .eq('is_on_shift', true)
        
        if (userError) throw userError;
        if (!telecallers || telecallers.length === 0) {
            console.warn(`[ROUTING] No active telecallers found for tenant ${tenantId}. Lead ${leadId} remains unassigned.`);
            return { success: false, reason: 'NO_ACTIVE_TELECALLERS' };
        }

        const telecallerIds = telecallers.map(t => t.id);

        // 2. Count leads assigned to each telecaller today to balance the load
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const { data: leadsToday, error: leadError } = await supabase
            .from('leads')
            .select('assigned_to')
            .eq('tenant_id', tenantId)
            .gte('created_at', startOfDay.toISOString())
            .in('assigned_to', telecallerIds)
        
        if (leadError) throw leadError;

        // Tally assignments
        const counts: Record<string, number> = {};
        telecallerIds.forEach(id => counts[id] = 0);
        
        if (leadsToday) {
            leadsToday.forEach(lead => {
                if (lead.assigned_to && counts[lead.assigned_to] !== undefined) {
                    counts[lead.assigned_to]++;
                }
            })
        }

        // 3. Find the telecaller with the minimum leads today
        let minCount = Infinity;
        let selectedAgentId = telecallerIds[0];

        for (const [id, count] of Object.entries(counts)) {
            if (count < minCount) {
                minCount = count;
                selectedAgentId = id;
            }
        }

        // 4. Assign the lead
        const { error: updateError } = await supabase
            .from('leads')
            .update({ assigned_to: selectedAgentId, status: 'new' })
            .eq('id', leadId)
        
        if (updateError) throw updateError;

        console.log(`[ROUTING] Lead ${leadId} assigned to agent ${selectedAgentId} (Current load: ${minCount})`);
        return { success: true, agent_id: selectedAgentId };

    } catch (error: any) {
        console.error("[ROUTING] Error in round robin assignment:", error);
        return { success: false, error: error.message };
    }
}
