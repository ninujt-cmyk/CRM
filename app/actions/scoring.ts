"use server"

import { createClient } from "@/lib/supabase/server"

export const SCORING_RULES = {
    CALL_ANSWERED: { points: 10, reason: "Call Answered" },
    CALL_UNANSWERED: { points: -5, reason: "Call Unanswered" },
    WHATSAPP_SENT: { points: 5, reason: "WhatsApp Message Sent" },
    WHATSAPP_REPLIED: { points: 20, reason: "WhatsApp Reply Received" },
    SITE_VISIT_SCHEDULED: { points: 50, reason: "Site Visit Scheduled" },
    SITE_VISIT_CONDUCTED: { points: 100, reason: "Site Visit Conducted" },
    SITE_VISIT_NO_SHOW: { points: -30, reason: "Site Visit No-Show" },
    DEAL_STAGE_ADVANCED: { points: 30, reason: "Deal Stage Advanced" },
    HIGH_BUDGET_IDENTIFIED: { points: 40, reason: "High Budget Identified" },
}

export async function addLeadScore(leadId: string, rule: keyof typeof SCORING_RULES) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single()
        if (!profile?.tenant_id) throw new Error("No tenant found")

        const { points, reason } = SCORING_RULES[rule]

        // 1. Get current score
        const { data: lead } = await supabase.from('leads').select('score').eq('id', leadId).single()
        const currentScore = lead?.score || 0
        const newScore = Math.max(0, currentScore + points) // Prevent negative total score

        // 2. Update lead score
        await supabase.from('leads').update({ score: newScore }).eq('id', leadId)

        // 3. Log the score change
        await supabase.from('lead_score_logs').insert({
            tenant_id: profile.tenant_id,
            lead_id: leadId,
            agent_id: user.id,
            points_changed: points,
            reason: reason
        })

        return { success: true, newScore }
    } catch (error: any) {
        console.error("Score update error:", error)
        return { success: false, error: error.message }
    }
}
