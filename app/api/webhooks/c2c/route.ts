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

    const customerPhone = body.customerNumber || body.customer_number || body.destination || body.mobile || null;
    const agentPhone = body.agentNumber || body.agent_number || body.caller || body.src || null;
    const duration = parseInt(body.billsec || body.duration || "0");
    const disposition = body.disposition || body.status || "UNKNOWN";
    const recordingUrl = body.recordingUrl || body.recording_url || body.recordingLink || null;

    if (!agentPhone) {
      return NextResponse.json({ status: "ignored", reason: "Missing agent phone" });
    }

    // Normalize Agent Phone
    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    // 1. Find the Agent
    const { data: agent } = await supabase
        .from("users")
        .select("id")
        .ilike("phone", `%${dbAgentPhone}%`)
        .limit(1)
        .maybeSingle();

    if (!agent) {
      return NextResponse.json({ status: "ignored", reason: "agent_not_found" });
    }

    // 💡 THE FIX: If the Agent rejected the call, Fonada might not send the Customer Phone. 
    // We instantly push the agent to wrap_up so the loop continues!
    if (!customerPhone) {
        console.log("⚠️ Agent rejected/failed call. Pushing agent straight to wrap_up.");
        await supabase.from("users").update({
            current_status: 'wrap_up',
            status_reason: 'Agent Rejected Call',
            status_updated_at: new Date().toISOString()
        }).eq("id", agent.id);
        return NextResponse.json({ status: "success", message: "Agent leg failed, moved to wrap-up." });
    }

    // Normalize Customer Phone
    let dbCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);

    // 2. Find the Lead
    const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .ilike("phone", `%${dbCustomerPhone}%`)
        .eq("assigned_to", agent.id) 
        .order("last_contacted", { ascending: false }) 
        .limit(1);

    let finalLeadId = leads?.[0]?.id;

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

    // 3. Save Call Log (If Lead was found)
    if (finalLeadId) {
        await supabase.from("call_logs").insert({
            lead_id: finalLeadId,
            user_id: agent.id,
            call_type: "outbound_c2c",
            duration_seconds: duration,
            disposition: disposition,
            recording_url: recordingUrl,
            notes: `C2C Call Ended. Status: ${disposition}. Duration: ${duration}s.`
        });
    }

    // 4. Wrap-Up Protection (Moves agent to next call)
    await supabase.from("users").update({
        current_status: 'wrap_up',
        status_reason: 'Post-Call Notes',
        status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    return NextResponse.json({ status: "success", message: "C2C Call logged successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
