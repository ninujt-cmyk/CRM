import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log("🔔 [C2C WEBHOOK HIT] Call ended, receiving CDR from Fonada.");

  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } 
      catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }
    }

    console.log("📋 [C2C PAYLOAD]:", body);

    // 1. Extract Fonada's typical C2C parameters
    // Note: Adjust these keys if Fonada's API documentation uses different names for C2C
    const customerPhone = body.customer_number || body.destination || body.mobile;
    const agentPhone = body.agent_number || body.caller;
    const duration = parseInt(body.billsec || body.duration || "0");
    const disposition = body.disposition || body.status || "UNKNOWN";
    const recordingUrl = body.recording_url || body.voiceFileName || null;

    if (!customerPhone || !agentPhone) {
      return NextResponse.json({ status: "ignored", reason: "Missing phone numbers" });
    }

    // Normalize phones for DB matching
    let dbCustomerPhone = customerPhone.replace(/^\+?91/, '');
    if (dbCustomerPhone.length > 10) dbCustomerPhone = dbCustomerPhone.slice(-10);

    let dbAgentPhone = agentPhone.replace(/^\+?91/, '');
    if (dbAgentPhone.length > 10) dbAgentPhone = dbAgentPhone.slice(-10);

    // 2. Find the Lead and the Agent
    const { data: lead } = await supabase.from("leads").select("id").ilike("phone", `%${dbCustomerPhone}%`).limit(1).maybeSingle();
    const { data: agent } = await supabase.from("users").select("id").ilike("phone", `%${dbAgentPhone}%`).limit(1).maybeSingle();

    if (!lead || !agent) {
      console.log("⚠️ [ORPHAN CALL] Could not match lead or agent phone numbers.");
      return NextResponse.json({ status: "ignored", reason: "no_db_match" });
    }

    // 3. Save the Call Log with the Recording
    const { error: logError } = await supabase.from("call_logs").insert({
        lead_id: lead.id,
        user_id: agent.id,
        call_type: "outbound_c2c",
        duration_seconds: duration,
        disposition: disposition,
        recording_url: recordingUrl,
        notes: `C2C Call Ended. Status: ${disposition}. Duration: ${duration}s.`
    });

    if (logError) console.error("❌ [DB ERROR] Saving call log:", logError);

    // 4. THE "WRAP-UP" PROTECTION (Crucial for Auto-Dialers)
    // We instantly change the agent's status from 'on_call' to 'wrap_up'. 
    // This stops the Auto-Dialer from instantly calling the next person before the agent types their notes!
    await supabase.from("users").update({
        current_status: 'wrap_up',
        status_reason: 'Post-Call Notes',
        status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    console.log(`✅ [SUCCESS] Call log saved. Agent ${agent.id} moved to Wrap-Up.`);

    return NextResponse.json({ status: "success", message: "C2C Call logged successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
