import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// ⚠️ Use Service Role key to bypass RLS since Webhooks have no logged-in user
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

    // 1. EXTRACT FIELDS BASED ON YOUR C2C DYNAMIC FIELD LIST
    const customerPhone = body.customerNumber || body.dst || null;
    const agentPhone = body.agentNumber || body.src || null;
    
    // Duration is total time including ringing
    const duration = parseInt(body.duration || "0");
    
    // 🔴 THE FIX: Extract ACTUAL customer talk time for accurate billing
    const billsec = parseInt(body.customerBillSec || body.totalbillSec || body.billsec || "0");
    
    const recordingUrl = body.recordingLink || body.recordingUrl || null;
    const agentDisposition = (body.agentDisposition || "").toUpperCase();
    const customerDisposition = (body.customerDisposition || body.disposition || "UNKNOWN").toUpperCase();

    if (!agentPhone) {
      return NextResponse.json({ status: "ignored", reason: "Missing agent phone" });
    }

    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    // 2. SMART LOOKUP: Find the agent to get their Tenant ID
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

    // If the Agent didn't pick up, the call ends immediately (No charge)
    if (["FAILED", "BUSY", "NO ANSWER", "CANCEL"].includes(agentDisposition)) {
        await supabaseAdmin.from("users").update({
            current_status: 'wrap_up',
            status_reason: `Agent Leg: ${agentDisposition}`,
            status_updated_at: new Date().toISOString()
        }).eq("id", agent.id);

        return NextResponse.json({ status: "success", message: "Agent leg failed, no charge." });
    }

    let dbCustomerPhone = customerPhone ? customerPhone.replace(/^\+?91/, '').slice(-10) : null;
    let finalLeadId = null;

    if (dbCustomerPhone) {
        // Find the lead inside this specific company
        const { data: leads } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("tenant_id", tenantId) 
            .ilike("phone", `%${dbCustomerPhone}%`)
            .eq("assigned_to", agent.id) 
            .order("last_contacted", { ascending: false }) 
            .limit(1);

        finalLeadId = leads?.[0]?.id;

        // Fallback search
        if (!finalLeadId) {
            const { data: fallbackLead } = await supabaseAdmin
                .from("leads")
                .select("id")
                .eq("tenant_id", tenantId) 
                .ilike("phone", `%${dbCustomerPhone}%`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            finalLeadId = fallbackLead?.id;
        }
    }

    if (finalLeadId) {
        // 3. INSERT CALL LOG
        const { data: callLog } = await supabaseAdmin.from("call_logs").insert({
            tenant_id: tenantId, 
            lead_id: finalLeadId,
            user_id: agent.id,
            call_type: "outbound_c2c",
            duration_seconds: duration,
            disposition: customerDisposition, 
            recording_url: recordingUrl,
            notes: `C2C Call. Customer Status: ${customerDisposition}. Talk Time: ${billsec}s.`
        }).select().single();

        // 🔴 4. DYNAMIC CREDIT DEDUCTION
        // We ONLY charge if the customer answered AND talk time is greater than 0
        if (billsec > 0 && customerDisposition === "ANSWERED" && callLog) {
            const { data: settings } = await supabaseAdmin.from('tenant_settings')
                .select('billing_pulse_seconds, credits_per_pulse')
                .eq('tenant_id', tenantId)
                .single();

            const pulseSecs = settings?.billing_pulse_seconds || 15;
            const creditsPerPulse = settings?.credits_per_pulse || 1;

            // Example: 41 seconds / 15 = 2.73 -> Math.ceil rounds it up to 3 pulses
            const pulses = Math.ceil(billsec / pulseSecs); 
            const totalCreditsToDeduct = pulses * creditsPerPulse;

            // Deduct from Ledger
            await supabaseAdmin.from("wallet_ledger").insert({
                tenant_id: tenantId,
                credits: -Math.abs(totalCreditsToDeduct), // Forces it to be a deduction
                transaction_type: 'C2C_CALL',
                description: `C2C Call to ${dbCustomerPhone} (Talk Time: ${billsec}s = ${pulses} pulses)`,
                reference_id: callLog.id
            });
            console.log(`🪙 [WALLET] Deducted ${totalCreditsToDeduct} credits from Tenant ${tenantId}`);
        } else {
            console.log(`⏩ [WALLET] Skipped Deduction. BillSec was ${billsec}, Disposition was ${customerDisposition}.`);
        }

        // 5. SHORT CALL LOGIC
        // If talk time is < 5 seconds OR the customer didn't answer
        if (billsec < 5 || ["NO ANSWER", "FAILED", "BUSY", "CANCEL"].includes(customerDisposition)) {
             await supabaseAdmin.from('leads').update({ status: 'nr' }).eq('id', finalLeadId);
             await supabaseAdmin.from("users").update({
                 current_status: 'active', 
                 status_reason: 'Auto-Skipped NR', 
                 status_updated_at: new Date().toISOString()
             }).eq("id", agent.id);
             return NextResponse.json({ status: "success", message: "Short call auto-marked NR." });
        }
    }

    // Normal Call Wrap-up (> 5 seconds of talk time)
    await supabaseAdmin.from("users").update({
        current_status: 'wrap_up', 
        status_reason: 'Call Completed', 
        status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    return NextResponse.json({ status: "success", message: "C2C Call logged & billed securely." });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
