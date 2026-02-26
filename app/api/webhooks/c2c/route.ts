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

    // 1. Extract Fonada's incoming numbers
    const customerPhone = body.customerNumber || body.customer_number || body.destination || body.mobile;
    const agentPhone = body.agentNumber || body.agent_number || body.caller || body.src;
    const duration = parseInt(body.billsec || body.duration || "0");
    const disposition = body.disposition || body.status || "UNKNOWN";
    const recordingUrl = body.recordingUrl || body.recording_url || body.recordingLink || null;

    if (!customerPhone || !agentPhone) {
      return NextResponse.json({ status: "ignored", reason: "Missing phone numbers" });
    }

    // Normalize phones (grab exact last 10 digits)
    let dbCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);
    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    // 2. Find the Agent First
    const { data: agent } = await supabase
        .from("users")
        .select("id")
        .ilike("phone", `%${dbAgentPhone}%`)
        .limit(1)
        .maybeSingle();

    if (!agent) {
      console.log(`⚠️ [ORPHAN CALL] Agent phone ${dbAgentPhone} not found in DB.`);
      return NextResponse.json({ status: "ignored", reason: "agent_not_found" });
    }

    // 3. 🧠 THE SMART MATCH: Find the Lead
    // We look for a lead with this phone number, ASSIGNED to this specific agent, 
    // and we grab the one that was most recently "contacted" (which we updated when the dialer started).
    const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .ilike("phone", `%${dbCustomerPhone}%`)
        .eq("assigned_to", agent.id) 
        .order("last_contacted", { ascending: false }) 
        .limit(1);

    let finalLeadId = leads?.[0]?.id;

    // Fallback: If for some reason the lead was reassigned mid-call, just grab the newest lead with that phone number.
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

    if (!finalLeadId) {
      console.log(`⚠️ [ORPHAN CALL] Lead phone ${dbCustomerPhone} not found in DB.`);
      return NextResponse.json({ status: "ignored", reason: "lead_not_found" });
    }

    // 4. Save the Call Log with the Recording attached to the matched Lead
    const { error: logError } = await supabase.from("call_logs").insert({
        lead_id: finalLeadId,
        user_id: agent.id,
        call_type: "outbound_c2c",
        duration_seconds: duration,
        disposition: disposition,
        recording_url: recordingUrl,
        notes: `C2C Call Ended. Status: ${disposition}. Duration: ${duration}s.`
    });

    if (logError) console.error("❌ [DB ERROR] Saving call log:", logError);

    // 5. The "Wrap-Up" Protection
    await supabase.from("users").update({
        current_status: 'wrap_up',
        status_reason: 'Post-Call Notes',
        status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    console.log(`✅ [SUCCESS] Call log mapped to Lead ${finalLeadId} and saved. Agent moved to Wrap-Up.`);

    return NextResponse.json({ status: "success", message: "C2C Call logged successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
