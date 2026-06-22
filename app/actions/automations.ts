"use server"

import { createClient } from "@/lib/supabase/server"

// In a real production app, this would be triggered by a Cron Job (e.g. Vercel Cron or Supabase pg_cron)
// or triggered via webhook on database changes.
export async function runStaleLeadAutomation(tenantId: string) {
    try {
        const supabase = await createClient()

        // 1. Find the active automation for "Stale Lead Nudge"
        const { data: automations } = await supabase
            .from('automations')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .eq('trigger_type', 'TIME_IN_STATUS')
        
        if (!automations || automations.length === 0) return { success: true, processed: 0, message: "No active automations found." }

        let processedCount = 0;

        for (const automation of automations) {
            const statusTarget = automation.trigger_condition.status;
            const hoursTarget = automation.trigger_condition.hours;

            // 2. Find leads matching the condition that HAVEN'T been logged yet
            // This is a complex query, we'll simplify for the action by fetching potential candidates
            // In production, use raw SQL for performance.
            
            // Calculate time threshold
            const thresholdDate = new Date();
            thresholdDate.setHours(thresholdDate.getHours() - hoursTarget);

            const { data: leads } = await supabase
                .from('leads')
                .select('id, name, phone, created_at, updated_at')
                .eq('tenant_id', tenantId)
                .eq('status', statusTarget)
                .lt('updated_at', thresholdDate.toISOString()) // hasn't been updated in X hours
            
            if (!leads) continue;

            for (const lead of leads) {
                // 3. Check if already processed
                const { data: existingLog } = await supabase
                    .from('automation_logs')
                    .select('id')
                    .eq('automation_id', automation.id)
                    .eq('lead_id', lead.id)
                    .single();
                
                if (existingLog) continue; // Already processed

                // 4. Execute Action
                let success = false;
                let errorMsg = null;

                try {
                    if (automation.action_type === 'SEND_WHATSAPP') {
                        // Logic to trigger whatsapp template
                        // await sendWhatsappMessage(lead.phone, automation.action_payload.message)
                        console.log(`[AUTOMATION] Sending WhatsApp to ${lead.name} (${lead.phone})`)
                    } else if (automation.action_type === 'UPDATE_STATUS') {
                         await supabase.from('leads').update({ status: automation.action_payload.status }).eq('id', lead.id)
                    }
                    success = true;
                } catch (e: any) {
                    success = false;
                    errorMsg = e.message;
                }

                // 5. Log Execution
                await supabase.from('automation_logs').insert({
                    tenant_id: tenantId,
                    automation_id: automation.id,
                    lead_id: lead.id,
                    status: success ? 'SUCCESS' : 'FAILED',
                    error_message: errorMsg
                })

                if (success) processedCount++;
            }
        }

        return { success: true, processed: processedCount }
    } catch (error: any) {
        console.error("Automation error:", error)
        return { success: false, error: error.message }
    }
}

export async function createTemplateAutomation(tenantId: string, templateType: 'STALE_LEAD' | 'HOT_PROSPECT') {
    const supabase = await createClient();
    
    let automationData = {};
    if (templateType === 'STALE_LEAD') {
        automationData = {
            tenant_id: tenantId,
            name: 'Stale Lead Nudge',
            trigger_type: 'TIME_IN_STATUS',
            trigger_condition: { status: 'new', hours: 48 },
            action_type: 'SEND_WHATSAPP',
            action_payload: { message: 'Hi there, are you still interested? Let us know if you have any questions.' },
            is_active: true
        }
    } else if (templateType === 'HOT_PROSPECT') {
        automationData = {
            tenant_id: tenantId,
            name: 'Hot Prospect Alert',
            trigger_type: 'SCORE_THRESHOLD',
            trigger_condition: { score: 50 },
            action_type: 'CREATE_TASK',
            action_payload: { priority: 'high', title: 'Follow up with hot prospect immediately' },
            is_active: true
        }
    }

    const { data, error } = await supabase.from('automations').insert(automationData).select().single();
    if (error) return { success: false, error: error.message }
    return { success: true, data }
}

export async function toggleAutomation(id: string, currentStatus: boolean) {
    const supabase = await createClient();
    const { error } = await supabase.from('automations').update({ is_active: !currentStatus }).eq('id', id);
    if (error) return { success: false, error: error.message }
    return { success: true }
}

export async function deleteAutomation(id: string) {
    const supabase = await createClient();
    const { error } = await supabase.from('automations').delete().eq('id', id);
    if (error) return { success: false, error: error.message }
    return { success: true }
}
