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

    console.log("📋 [C2C PAYLOAD]:", body);

    // 1. Extract standard variables
    const customerPhone = body.customerNumber || body.customer_number || body.destination || body.mobile || null;
    const agentPhone = body.agentNumber || body.agent_number || body.caller || body.src || null;
    const duration = parseInt(body.duration || body.billsec || "0");
    const recordingUrl = body.recordingUrl || body.recording_url || body.recordingLink || null;
    
    // 💡 2. Extract our NEW Advanced CDR variables!
    const agentDisposition = (body.agentDisposition || "").toUpperCase();
    const customerDisposition = (body.customerDisposition || body.disposition || body.status || "UNKNOWN").toUpperCase();

    if (!agentPhone) {
      return NextResponse.json({ status: "ignored", reason: "Missing agent phone" });
    }

    // Normalize Agent Phone
    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    // Find the Agent
    const { data: agent } = await supabase
        .from("users")
        .select("id")
        .ilike("phone", `%${dbAgentPhone}%`)
        .limit(1)
        .maybeSingle();

    if (!agent) {
      return NextResponse.json({ status: "ignored", reason: "agent_not_found" });
    }

    // 🚀 THE MAGIC UN-STICKER: Did the Agent reject/miss the call?
    // If agentDisposition is FAILED, BUSY, NO ANSWER, or CANCEL
    if (["FAILED", "BUSY", "NO ANSWER", "CANCEL"].includes(agentDisposition)) {
        console.log(`⚠️ Agent did not connect (${agentDisposition}). Pushing straight to wrap_up to continue Auto-Dialer.`);
        
        await supabase.from("users").update({
            current_status: 'wrap_up',
            status_reason: `Agent Leg: ${agentDisposition}`,
            status_updated_at: new Date().toISOString()
        }).eq("id", agent.id);

        return NextResponse.json({ status: "success", message: "Agent leg failed, loop continued." });
    }

    // If agent connected, let's find the lead they were talking to
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
            disposition: customerDisposition, // Store what the customer did
            recording_url: recordingUrl,
            notes: `C2C Auto-Dial. Customer Status: ${customerDisposition}. Duration: ${duration}s.`
        });
    }

    // Push agent to wrap-up so the UI timer starts for the next call
    await supabase.from("users").update({
        current_status: 'wrap_up',
        status_reason: 'Call Completed',
        status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    console.log(`✅ [SUCCESS] Call mapped successfully. Agent moved to Wrap-Up.`);
    return NextResponse.json({ status: "success", message: "C2C Call logged successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
