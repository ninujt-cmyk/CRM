import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
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

    // 1. Extract standard variables
    const customerPhone = body.customerNumber || body.customer_number || body.destination || body.mobile || null;
    const agentPhone = body.agentNumber || body.agent_number || body.caller || body.src || null;
    const duration = parseInt(body.duration || body.billsec || "0");
    const recordingUrl = body.recordingUrl || body.recording_url || body.recordingLink || null;
    
    // 2. Extract CDR variables
    const agentDisposition = (body.agentDisposition || "").toUpperCase();
    const customerDisposition = (body.customerDisposition || body.disposition || body.status || "UNKNOWN").toUpperCase();

    if (!agentPhone) {
      return NextResponse.json({ status: "ignored", reason: "Missing agent phone" });
    }

    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    const { data: agent } = await supabase
        .from("users")
        .select("id")
        .ilike("phone", `%${dbAgentPhone}%`)
        .limit(1)
        .maybeSingle();

    if (!agent) {
      return NextResponse.json({ status: "ignored", reason: "agent_not_found" });
    }

    // Agent didn't pick up at all
    if (["FAILED", "BUSY", "NO ANSWER", "CANCEL"].includes(agentDisposition)) {
        await supabase.from("users").update({
            current_status: 'wrap_up',
            status_reason: `Agent Leg: ${agentDisposition}`,
            status_updated_at: new Date().toISOString()
        }).eq("id", agent.id);

        return NextResponse.json({ status: "success", message: "Agent leg failed, loop continued." });
    }

    let dbCustomerPhone = customerPhone ? customerPhone.replace(/^\+?91/, '').slice(-10) : null;
    let finalLeadId = null;

    if (dbCustomerPhone) {
        const { data: leads } = await supabase
            .from("leads")
            .select("id")
            .ilike("phone", `%${dbCustomerPhone}%`)
            .eq("assigned_to", agent.id) 
            .order("last_contacted", { ascending: false }) 
            .limit(1);

        finalLeadId = leads?.[0]?.id;

        if (!finalLeadId) {
            const { data: fallbackLead } = await supabase
                .from("leads")
                .select("id")
                .ilike("phone", `%${dbCustomerPhone}%`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            finalLeadId = fallbackLead?.id;
        }
    }

    // Save Call Log
    if (finalLeadId) {
        await supabase.from("call_logs").insert({
            lead_id: finalLeadId,
            user_id: agent.id,
            call_type: "outbound_c2c",
            duration_seconds: duration,
            disposition: customerDisposition, 
            recording_url: recordingUrl,
            notes: `C2C Auto-Dial. Customer Status: ${customerDisposition}. Duration: ${duration}s.`
        });

        // 🔥 THE NEW LOGIC: If duration is < 5s OR Customer didn't answer
        if (duration < 5 || ["NO ANSWER", "FAILED", "BUSY", "CANCEL"].includes(customerDisposition)) {
             console.log(`⚠️ Short call detected (${duration}s). Marking as NR and skipping wrap-up!`);
             
             // 1. Auto-update lead to 'nr'
             await supabase.from('leads').update({ status: 'nr' }).eq('id', finalLeadId);
             
             // 2. Put agent straight back to 'active' to instantly trigger the next dial!
             await supabase.from("users").update({
                 current_status: 'active',
                 status_reason: 'Auto-Skipped NR Call',
                 status_updated_at: new Date().toISOString()
             }).eq("id", agent.id);
             
             return NextResponse.json({ status: "success", message: "Short call auto-marked NR. Instant next dial triggered." });
        }
    }

    // ⏳ NORMAL CALL LOGIC (> 5s): Push agent to wrap-up for the 10-second countdown
    await supabase.from("users").update({
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
