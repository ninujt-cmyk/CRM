// app/api/webhooks/c2c/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ⚠️ We MUST use the Service Role key here because Webhooks don't have a logged-in user.
// We manually enforce Tenant Isolation in the queries below instead of relying on RLS.
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

    console.log("📋 [C2C PAYLOAD]:", body);

    // 1. Extract standard variables
    const customerPhone = body.customerNumber || body.customer_number || body.destination || body.mobile || null;
    const agentPhone = body.agentNumber || body.agent_number || body.caller || body.src || null;
    const duration = parseInt(body.duration || body.billsec || "0");
    const recordingUrl = body.recordingUrl || body.recording_url || body.recordingLink || null;
    
    // 2. Extract CDR variables
    const agentDisposition = (body.agentDisposition || "").toUpperCase();
    const customerDisposition = (body.customerDisposition || body.disposition || body.status || "UNKNOWN").toUpperCase();

    // 🔴 3. NEW: Extract the Tenant ID we injected during the API call
    const tenantId = body.calledId || null;

    if (!agentPhone) {
      return NextResponse.json({ status: "ignored", reason: "Missing agent phone" });
    }

    if (!tenantId) {
      console.error("🚨 [SECURITY WARNING] Webhook received without Tenant ID. Cannot securely route data.");
      return NextResponse.json({ status: "ignored", reason: "Missing tenant context" });
    }

    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    // 🔴 4. SCOPE TO TENANT: Find the agent *only* inside this specific company
    const { data: agent } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("tenant_id", tenantId) // STRICT ISOLATION
        .ilike("phone", `%${dbAgentPhone}%`)
        .limit(1)
        .maybeSingle();

    if (!agent) {
      return NextResponse.json({ status: "ignored", reason: "agent_not_found_in_tenant" });
    }

    // Agent didn't pick up at all
    if (["FAILED", "BUSY", "NO ANSWER", "CANCEL"].includes(agentDisposition)) {
        await supabaseAdmin.from("users").update({
            current_status: 'wrap_up',
            status_reason: `Agent Leg: ${agentDisposition}`,
            status_updated_at: new Date().toISOString()
        }).eq("id", agent.id);

        return NextResponse.json({ status: "success", message: "Agent leg failed, loop continued." });
    }

    let dbCustomerPhone = customerPhone ? customerPhone.replace(/^\+?91/, '').slice(-10) : null;
    let finalLeadId = null;

    if (dbCustomerPhone) {
        // 🔴 5. SCOPE TO TENANT: Find the lead *only* inside this specific company
        const { data: leads } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("tenant_id", tenantId) // STRICT ISOLATION
            .ilike("phone", `%${dbCustomerPhone}%`)
            .eq("assigned_to", agent.id) 
            .order("last_contacted", { ascending: false }) 
            .limit(1);

        finalLeadId = leads?.[0]?.id;

        if (!finalLeadId) {
            const { data: fallbackLead } = await supabaseAdmin
                .from("leads")
                .select("id")
                .eq("tenant_id", tenantId) // STRICT ISOLATION
                .ilike("phone", `%${dbCustomerPhone}%`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            finalLeadId = fallbackLead?.id;
        }
    }

    // Save Call Log
    if (finalLeadId) {
        // 🔥 Modified to capture the created call_log row for the ledger reference
        const { data: callLog } = await supabaseAdmin.from("call_logs").insert({
            tenant_id: tenantId, // 🔴 Inject Tenant ID into the new row
            lead_id: finalLeadId,
            user_id: agent.id,
            call_type: "outbound_c2c",
            duration_seconds: duration,
            disposition: customerDisposition, 
            recording_url: recordingUrl,
            notes: `C2C Auto-Dial. Customer Status: ${customerDisposition}. Duration: ${duration}s.`
        }).select().single();

        // 🔴 NEW: DYNAMIC CREDIT DEDUCTION
        if (duration > 0 && callLog) {
            // 1. Fetch this specific company's billing rules
            const { data: settings } = await supabaseAdmin.from('tenant_settings')
                .select('billing_pulse_seconds, credits_per_pulse')
                .eq('tenant_id', tenantId)
                .single();

            const pulseSecs = settings?.billing_pulse_seconds || 15;
            const creditsPerPulse = settings?.credits_per_pulse || 1;

            // 2. The Math (e.g., 41s / 15s = 2.73 -> rounds up to 3 pulses)
            const pulses = Math.ceil(duration / pulseSecs); 
            const totalCreditsToDeduct = pulses * creditsPerPulse;

            // 3. Deduct from Ledger
            await supabaseAdmin.from("wallet_ledger").insert({
                tenant_id: tenantId,
                credits: -Math.abs(totalCreditsToDeduct), // Force negative
                transaction_type: 'C2C_CALL',
                description: `C2C Call to ${dbCustomerPhone} (${duration}s = ${pulses} pulses)`,
                reference_id: callLog.id
            });
            console.log(`🪙 [WALLET] Deducted ${totalCreditsToDeduct} credits from Tenant ${tenantId}`);
        }

        // 🔥 THE LOGIC: If duration is < 5s OR Customer didn't answer
        if (duration < 5 || ["NO ANSWER", "FAILED", "BUSY", "CANCEL"].includes(customerDisposition)) {
             console.log(`⚠️ Short call detected (${duration}s). Marking as NR and skipping wrap-up!`);
             
             // 1. Auto-update lead to 'nr'
             await supabaseAdmin.from('leads').update({ status: 'nr' }).eq('id', finalLeadId);
             
             // 2. Put agent straight back to 'active' to instantly trigger the next dial!
             await supabaseAdmin.from("users").update({
                 current_status: 'active',
                 status_reason: 'Auto-Skipped NR Call',
                 status_updated_at: new Date().toISOString()
             }).eq("id", agent.id);
             
             return NextResponse.json({ status: "success", message: "Short call auto-marked NR. Instant next dial triggered." });
        }
    }

    // ⏳ NORMAL CALL LOGIC (> 5s): Push agent to wrap-up for the countdown
    await supabaseAdmin.from("users").update({
        current_status: 'wrap_up',
        status_reason: 'Call Completed',
        status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    return NextResponse.json({ status: "success", message: "C2C Call logged successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
