// app/api/webhooks/fonada/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log("🔔 [FONADA WEBHOOK HIT] IVR Call ended, analyzing CDR data.");

  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } 
      catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }
    }

    console.log("📋 [FONADA PAYLOAD]:", body);

    // Extract mapped variables (See instructions below on how to map these in Fonada)
    const phone = body.phone || body.dst || "";
    const duration = parseInt(body.duration || body.billsec || "0");
    const status = (body.status || body.disposition || "UNKNOWN").toUpperCase();
    
    // We need tenant context to bill them. You MUST pass this in Fonada's Static Data Fields.
    const tenantId = body.tenant_id; 
    const campaignId = body.campaign_id || null;

    if (!phone || !tenantId) {
        return NextResponse.json({ status: "ignored", reason: "Missing phone or tenant_id" });
    }

    let dbPhone = phone.replace(/^\+?91/, '').slice(-10);

    // 1. Save the Call Log
    const { data: callLog } = await supabaseAdmin.from("call_logs").insert({
        tenant_id: tenantId,
        call_type: "ivr_campaign",
        duration_seconds: duration,
        disposition: status,
        notes: `IVR Auto-Dial. Campaign ID: ${campaignId}. Status: ${status}.`,
        // Store raw metadata if you need to debug later
        metadata: body 
    }).select().single();

    // 2. DYNAMIC CREDIT DEDUCTION (Only if answered and duration > 0)
    if (duration > 0 && status === "ANSWERED" && callLog) {
        const { data: settings } = await supabaseAdmin.from('tenant_settings')
            .select('billing_pulse_seconds, credits_per_pulse')
            .eq('tenant_id', tenantId)
            .single();

        const pulseSecs = settings?.billing_pulse_seconds || 15;
        const creditsPerPulse = settings?.credits_per_pulse || 1;

        const pulses = Math.ceil(duration / pulseSecs); 
        const totalCreditsToDeduct = pulses * creditsPerPulse;

        // Deduct from Ledger
        await supabaseAdmin.from("wallet_ledger").insert({
            tenant_id: tenantId,
            credits: -Math.abs(totalCreditsToDeduct),
            transaction_type: 'IVR_CAMPAIGN',
            description: `IVR Call to ${dbPhone} (${duration}s = ${pulses} pulses)`,
            reference_id: callLog.id
        });
        
        console.log(`🪙 [WALLET] Deducted ${totalCreditsToDeduct} credits from Tenant ${tenantId} for IVR Call.`);
    }

    return NextResponse.json({ status: "success", message: "IVR Call logged successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] Fonada Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}
