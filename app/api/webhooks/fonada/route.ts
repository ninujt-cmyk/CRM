// app/api/webhooks/fonada/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log("🔔 [FONADA WEBHOOK] Incoming CDR Data");

  try {
    const rawBody = await request.text();
    let body: any = {};
    try { body = JSON.parse(rawBody); } 
    catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }

    // 1. 🔴 EXTRACT FONADA'S INTERNAL BATCH ID
    let fonadaLeadId = body.leadid || null;
    
    if (!fonadaLeadId && body.accountcode) {
        // Safe extraction with .trim() to prevent space-mismatch errors
        fonadaLeadId = String(body.accountcode.split('^')[0]).trim(); 
    }

    let tenantId = null;
    let batchId = null;

    // 2. 🔴 THE SMART LOOKUP
    if (fonadaLeadId) {
        const { data: batch } = await supabaseAdmin
            .from('ivr_campaign_history')
            .select('id, tenant_id')
            .eq('fonada_lead_id', String(fonadaLeadId))
            .maybeSingle();

        if (batch) {
            tenantId = batch.tenant_id;
            batchId = batch.id;
        }
    }

    const mobileNumber = body.dst || body.customerNumber || null;
    const billsec = parseInt(body.billsec || "0");
    const duration = parseInt(body.duration || "0");
    const disposition = body.disposition || "UNKNOWN";
    
    // Safely extract digits pressed
    const digitsPressed = [body.digitpressedLevel1, body.digitpressedLevel2, body.digitpressedLevel3]
        .filter(Boolean).join(',') || body.digit_1 || null;

    if (!tenantId || !mobileNumber) {
      console.error(`🚨 [SECURITY WARNING] Unmapped Call. LeadID: ${fonadaLeadId} | Mobile: ${mobileNumber}`);
      return NextResponse.json({ status: "ignored", reason: "Missing or invalid tenant ID mapping" });
    }

    let creditsToDeduct = 0;

    // 3. DYNAMIC BILLING MATH
    if (billsec > 0 && disposition === "ANSWERED") {
        const { data: settings } = await supabaseAdmin.from('tenant_settings')
            .select('billing_pulse_seconds, credits_per_pulse')
            .eq('tenant_id', tenantId)
            .single();

        const pulseSecs = settings?.billing_pulse_seconds || 15;
        const creditsPerPulse = settings?.credits_per_pulse || 1;

        const pulses = Math.ceil(billsec / pulseSecs); 
        creditsToDeduct = pulses * creditsPerPulse;

        await supabaseAdmin.from("wallet_ledger").insert({
            tenant_id: tenantId,
            credits: -Math.abs(creditsToDeduct),
            transaction_type: 'IVR_CAMPAIGN',
            description: `IVR Call to ${mobileNumber} (${billsec}s = ${pulses} pulses)`,
            reference_id: batchId || null 
        });
    }

    // 4. LOG THE INDIVIDUAL CALL
    const { error: insertError } = await supabaseAdmin.from("ivr_call_logs").insert({
        tenant_id: tenantId,
        batch_id: batchId, 
        mobile_number: mobileNumber,
        attempt_num: parseInt(body.attemptnum || body.attempt_num || "1"),
        start_date: body.start || body.start_date || null,
        answer_date: body.answer || body.answer_date || null,
        end_date: body.end || body.end_date || null,
        call_duration: duration,
        bill_seconds: billsec,
        disposition: disposition,
        hangup_cause: body.hangupcause || body.hangup_cause || null,
        hangup_code: body.hangupcode || body.hangup_code || null,
        clid: body.clid || null,
        digits_pressed: digitsPressed,
        credits_used: creditsToDeduct
    });

    if (insertError) {
        console.error("❌ [DB ERROR] Failed to insert call log:", insertError);
        return NextResponse.json({ status: "error", message: insertError.message }, { status: 500 });
    }

    console.log(`✅ [FONADA] Logged ${mobileNumber} for Tenant ${tenantId} | Credits: -${creditsToDeduct}`);
    return NextResponse.json({ status: "success" });

  } catch (error) {
    console.error("🔥 [CRITICAL] Fonada Webhook failed:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
