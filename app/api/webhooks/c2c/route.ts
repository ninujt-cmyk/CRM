"use server"

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log("🔔 [C2C WEBHOOK HIT] Call ended, analyzing CDR data.");

  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } 
      catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }
    }

    const customerPhone = body.customerNumber || body.destination || body.mobile || null;
    const agentPhone = body.agentNumber || body.caller || body.src || null;
    const duration = parseInt(body.duration || body.billsec || "0");
    const recordingUrl = body.recordingUrl || body.recordingLink || null;
    
    const agentDisposition = (body.agentDisposition || "").toUpperCase();
    const customerDisposition = (body.customerDisposition || body.disposition || body.status || "UNKNOWN").toUpperCase();

    if (!agentPhone) return NextResponse.json({ status: "ignored", reason: "Missing agent phone" });

    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    // 🔴 1. SMART LOOKUP: Find the agent by their unique phone number to get their Tenant ID
    const { data: agent } = await supabaseAdmin
        .from("users")
        .select("id, tenant_id")
        .ilike("phone", `%${dbAgentPhone}%`)
        .limit(1)
        .maybeSingle();

    if (!agent || !agent.tenant_id) {
      console.error(`🚨 [SECURITY WARNING] Agent not found for phone: ${dbAgentPhone}`);
      return NextResponse.json({ status: "ignored", reason: "agent_or_tenant_not_found" });
    }

    const tenantId = agent.tenant_id;

    if (["FAILED", "BUSY", "NO ANSWER", "CANCEL"].includes(agentDisposition)) {
        await supabaseAdmin.from("users").update({
            current_status: 'wrap_up', status_reason: `Agent Leg: ${agentDisposition}`, status_updated_at: new Date().toISOString()
        }).eq("id", agent.id);
        return NextResponse.json({ status: "success", message: "Agent leg failed." });
    }

    let dbCustomerPhone = customerPhone ? customerPhone.replace(/^\+?91/, '').slice(-10) : null;
    let finalLeadId = null;

    if (dbCustomerPhone) {
        const { data: leads } = await supabaseAdmin.from("leads").select("id").eq("tenant_id", tenantId)
            .ilike("phone", `%${dbCustomerPhone}%`).eq("assigned_to", agent.id) 
            .order("last_contacted", { ascending: false }).limit(1);

        finalLeadId = leads?.[0]?.id;

        if (!finalLeadId) {
            const { data: fallbackLead } = await supabaseAdmin.from("leads").select("id").eq("tenant_id", tenantId)
                .ilike("phone", `%${dbCustomerPhone}%`).order("created_at", { ascending: false })
                .limit(1).maybeSingle();
            finalLeadId = fallbackLead?.id;
        }
    }

    if (finalLeadId) {
        // 🔴 2. INSERT CALL LOG
        const { data: callLog } = await supabaseAdmin.from("call_logs").insert({
            tenant_id: tenantId,
            lead_id: finalLeadId,
            user_id: agent.id,
            call_type: "outbound_c2c",
            duration_seconds: duration,
            disposition: customerDisposition, 
            recording_url: recordingUrl,
            notes: `C2C Call. Customer Status: ${customerDisposition}. Duration: ${duration}s.`
        }).select().single();

        // 🔴 3. DEDUCT CREDITS FROM WALLET
        if (duration > 0 && callLog) {
            const { data: settings } = await supabaseAdmin.from('tenant_settings')
                .select('billing_pulse_seconds, credits_per_pulse')
                .eq('tenant_id', tenantId).single();

            const pulseSecs = settings?.billing_pulse_seconds || 15;
            const creditsPerPulse = settings?.credits_per_pulse || 1;

            const pulses = Math.ceil(duration / pulseSecs); 
            const totalCreditsToDeduct = pulses * creditsPerPulse;

            await supabaseAdmin.from("wallet_ledger").insert({
                tenant_id: tenantId,
                credits: -Math.abs(totalCreditsToDeduct), 
                transaction_type: 'C2C_CALL',
                description: `C2C Call to ${dbCustomerPhone} (${duration}s = ${pulses} pulses)`,
                reference_id: callLog.id
            });
            console.log(`🪙 [WALLET] Deducted ${totalCreditsToDeduct} credits from Tenant ${tenantId}`);
        }

        // Short Call Logic
        if (duration < 5 || ["NO ANSWER", "FAILED", "BUSY", "CANCEL"].includes(customerDisposition)) {
             await supabaseAdmin.from('leads').update({ status: 'nr' }).eq('id', finalLeadId);
             await supabaseAdmin.from("users").update({
                 current_status: 'active', status_reason: 'Auto-Skipped NR', status_updated_at: new Date().toISOString()
             }).eq("id", agent.id);
             return NextResponse.json({ status: "success", message: "Short call auto-marked NR." });
        }
    }

    // Normal Call Wrap-up
    await supabaseAdmin.from("users").update({
        current_status: 'wrap_up', status_reason: 'Call Completed', status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    return NextResponse.json({ status: "success", message: "C2C Call logged securely." });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
