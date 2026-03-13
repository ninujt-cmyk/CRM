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

    console.log("📋 [C2C PAYLOAD]:", body);

    // 1. Extract standard variables
    const customerPhone = body.customerNumber || body.customer_number || body.destination || body.mobile || null;
    const agentPhone = body.agentNumber || body.agent_number || body.caller || body.src || null;
    const duration = parseInt(body.duration || body.billsec || "0");
    const recordingUrl = body.recordingUrl || body.recording_url || body.recordingLink || null;
    
    const agentDisposition = (body.agentDisposition || "").toUpperCase();
    const customerDisposition = (body.customerDisposition || body.disposition || body.status || "UNKNOWN").toUpperCase();

    if (!agentPhone) return NextResponse.json({ status: "ignored", reason: "Missing agent phone" });

    let dbAgentPhone = agentPhone.replace(/^\+?91/, '').slice(-10);

    // 🔴 THE FIX: SMART TENANT LOOKUP
    // Since Fonada stripped the custom ID, we find the agent by their phone number
    // and extract their isolated Tenant ID directly from our database!
    const { data: agent } = await supabaseAdmin
        .from("users")
        .select("id, tenant_id")
        .ilike("phone", `%${dbAgentPhone}%`)
        .limit(1)
        .maybeSingle();

    if (!agent || !agent.tenant_id) {
      console.error(`🚨 [SECURITY WARNING] Agent not found or missing Tenant ID for phone: ${dbAgentPhone}`);
      return NextResponse.json({ status: "ignored", reason: "agent_or_tenant_not_found" });
    }

    const tenantId = agent.tenant_id;
    console.log(`🔐 [SMART LOOKUP] Successfully mapped call to Tenant ID: ${tenantId}`);

    // Agent didn't pick up
    if (["FAILED", "BUSY", "NO ANSWER", "CANCEL"].includes(agentDisposition)) {
        await supabaseAdmin.from("users").update({
            current_status: 'wrap_up',
            status_reason: `Agent Leg: ${agentDisposition}`,
            status_updated_at: new Date().toISOString()
        }).eq("id", agent.id);
        return NextResponse.json({ status: "success", message: "Agent leg failed." });
    }

    // 2. SCOPE LEAD SEARCH TO THE EXACT TENANT
    let dbCustomerPhone = customerPhone ? customerPhone.replace(/^\+?91/, '').slice(-10) : null;
    let finalLeadId = null;

    if (dbCustomerPhone) {
        const { data: leads } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("tenant_id", tenantId) // STRICT ISOLATION APPLIED
            .ilike("phone", `%${dbCustomerPhone}%`)
            .eq("assigned_to", agent.id) 
            .order("last_contacted", { ascending: false }) 
            .limit(1);

        finalLeadId = leads?.[0]?.id;

        if (!finalLeadId) {
            const { data: fallbackLead } = await supabaseAdmin
                .from("leads")
                .select("id")
                .eq("tenant_id", tenantId) // STRICT ISOLATION APPLIED
                .ilike("phone", `%${dbCustomerPhone}%`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            finalLeadId = fallbackLead?.id;
        }
    }

    // Save Call Log
    if (finalLeadId) {
        await supabaseAdmin.from("call_logs").insert({
            tenant_id: tenantId, // Explicitly attribute to the correct company
            lead_id: finalLeadId,
            user_id: agent.id,
            call_type: "outbound_c2c",
            duration_seconds: duration,
            disposition: customerDisposition, 
            recording_url: recordingUrl,
            notes: `C2C Auto-Dial. Customer Status: ${customerDisposition}. Duration: ${duration}s.`
        });
    }

    // Push agent to wrap-up
    await supabaseAdmin.from("users").update({
        current_status: 'wrap_up',
        status_reason: 'Call Completed',
        status_updated_at: new Date().toISOString()
    }).eq("id", agent.id);

    return NextResponse.json({ status: "success", message: "C2C Call logged securely." });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
