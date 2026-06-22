"use server"

import { createClient } from "@/lib/supabase/server"

export async function sendBulkCampaign(leadIds: string[], type: 'email' | 'sms' | 'whatsapp', subject: string, template: string) {
    try {
        const supabase = await createClient()
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        // In a real application, you would queue this for a background worker.
        // For this CRM upgrade, we will:
        // 1. Fetch the selected leads.
        // 2. Parse the template replacing {{name}}, {{company}} etc.
        // 3. Log a "Campaign Sent" interaction for each lead.

        const { data: leads, error: leadsError } = await supabase
            .from('leads')
            .select('id, name, email, phone, company')
            .in('id', leadIds)
            
        if (leadsError) throw leadsError

        const interactions = leads.map(lead => {
            let personalizedBody = template
                .replace(/{{name}}/gi, lead.name || 'Customer')
                .replace(/{{company}}/gi, lead.company || 'your company')
                .replace(/{{phone}}/gi, lead.phone || '')
                .replace(/{{email}}/gi, lead.email || '')

            return {
                lead_id: lead.id,
                user_id: user.id,
                type: 'campaign',
                notes: `[Bulk ${type.toUpperCase()}] ${subject ? 'Subject: ' + subject + '\n' : ''}Body: ${personalizedBody}`,
                created_at: new Date().toISOString()
            }
        })

        // Insert interactions to track that the campaign was sent
        const { error: insertError } = await supabase
            .from('interactions')
            .insert(interactions)

        if (insertError) throw insertError

        // Also update last_contacted
        await supabase
            .from('leads')
            .update({ last_contacted: new Date().toISOString() })
            .in('id', leadIds)

        return { success: true, count: leads.length }
    } catch (error: any) {
        console.error("Bulk campaign error:", error)
        return { success: false, error: error.message }
    }
}
