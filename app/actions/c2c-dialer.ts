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

    // 🔴 2. THE FIX: SECURE TENANT RESOLUTION
    // Step A: Try to get from URL parameter (e.g., ?tenant_id=123)
    let tenantId = request.nextUrl.searchParams.get("tenant_id");

    // Step B: If missing, look up the Agent by phone number to find their Tenant
    let agentId = null;

    if (!tenantId) {
        console.log(`⚠️ Tenant ID missing from payload. Attempting to resolve via Agent Phone: ${dbAgentPhone}`);
        
        const { data: agentLookup } = await supabaseAdmin
            .from("users")
            .select("id, tenant_id")
            .ilike("phone", `%${dbAgentPhone}%`)
            .limit(1)
            .maybeSingle();

        if (agentLookup && agentLookup.tenant_id) {
            tenantId = agentLookup.tenant_id;
            agentId = agentLookup.id;
            console.log(`✅ Successfully resolved Tenant ID: ${tenantId} via Agent.`);
        } else {
            console.error("🚨 [SECURITY CRITICAL] Could not resolve Tenant ID. Agent phone not found in any workspace.");
            return NextResponse.json({ status: "error", reason: "unresolved_tenant" }, { status: 400 });
        }
    } else {
        // If we DID get tenantId from the URL, we still need the agentId
        const { data: agentLookup } = await supabaseAdmin
            .from("users")
            .select("id")
            .eq("tenant_id", tenantId)
            .ilike("phone", `%${dbAgentPhone}%`)
            .limit(1)
            .maybeSingle();
            
        agentId = agentLookup?.id;
    }

    if (!agentId) {
      return NextResponse.json({ status: "ignored", reason: "agent_not_found_in_tenant" });
    }

    // ------------------------------------------------------------------
    // REST OF THE LOGIC PROCEEDS NORMALLY WITH ISOLATED TENANT ID
    // ------------------------------------------------------------------

    // Agent didn't pick up
    if (["FAILED", "BUSY", "NO ANSWER", "CANCEL"].includes(agentDisposition)) {
        await supabaseAdmin.from("users").update({
            current_status: 'wrap_up',
            status_reason: `Agent Leg: ${agentDisposition}`,
            status_updated_at: new Date().toISOString()
        }).eq("id", agentId);
        return NextResponse.json({ status: "success", message: "Agent leg failed." });
    }

    // 3. SCOPE LEAD SEARCH TO THE EXACT TENANT
    let dbCustomerPhone = customerPhone ? customerPhone.replace(/^\+?91/, '').slice(-10) : null;
    let finalLeadId = null;

    if (dbCustomerPhone) {
        const { data: leads } = await supabaseAdmin
            .from("leads")
            .select("id")
            .eq("tenant_id", tenantId) // STRICT ISOLATION
            .ilike("phone", `%${dbCustomerPhone}%`)
            .eq("assigned_to", agentId) 
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

    // 4. Save Call Log
    if (finalLeadId) {
        await supabaseAdmin.from("call_logs").insert({
            tenant_id: tenantId, // Explicitly attribute to the correct company
            lead_id: finalLeadId,
            user_id: agentId,
            call_type: "outbound_c2c",
            duration_seconds: duration,
            disposition: customerDisposition, 
            recording_url: recordingUrl,
            notes: `C2C Auto-Dial. Customer Status: ${customerDisposition}. Duration: ${duration}s.`
        });
    }

    // 5. Push agent to wrap-up
    await supabaseAdmin.from("users").update({
        current_status: 'wrap_up',
        status_reason: 'Call Completed',
        status_updated_at: new Date().toISOString()
    }).eq("id", agentId);

    return NextResponse.json({ status: "success", message: "C2C Call logged securely." });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] C2C Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
