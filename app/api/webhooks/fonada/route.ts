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

    // 1. Extract Fields (Defensively handle empty strings from Fonada)
    // We assume you mapped your internal tenant/batch IDs to 'accountcode' or 'userfield'
    const rawTenantId = body.tenant_id || body.accountcode;
    const tenantId = typeof rawTenantId === 'string' && rawTenantId.trim() !== '' ? rawTenantId.trim() : null;

    const rawBatchId = body.batch_id || body.userfield;
    const batchId = typeof rawBatchId === 'string' && rawBatchId.trim() !== '' ? rawBatchId.trim() : null;

    const mobileNumber = body.dst;
    const billsec = parseInt(body.billsec || "0");
    const duration = parseInt(body.duration || "0");
    const disposition = body.disposition || "UNKNOWN";
    
    // Concatenate digits pressed if multiple levels exist
    const digitsPressed = [body.digit_1, body.digit_2, body.digit_3].filter(Boolean).join(',') || null;

    // We can't log anything if we don't know who the tenant is, or who they called.
    if (!tenantId || !mobileNumber) {
      console.error("🚨 Missing required routing context (tenantId or mobile).", body);
      return NextResponse.json({ status: "ignored", reason: "Missing routing context" });
    }

    let creditsToDeduct = 0;

    // 2. DYNAMIC BILLING MATH (Only if call answered)
    if (billsec > 0 && disposition === "ANSWERED") {
        const { data: settings } = await supabaseAdmin.from('tenant_settings')
            .select('billing_pulse_seconds, credits_per_pulse')
            .eq('tenant_id', tenantId)
            .single();

        const pulseSecs = settings?.billing_pulse_seconds || 15;
        const creditsPerPulse = settings?.credits_per_pulse || 1;

        const pulses = Math.ceil(billsec / pulseSecs); 
        creditsToDeduct = pulses * creditsPerPulse;

        // Deduct from Ledger
        await supabaseAdmin.from("wallet_ledger").insert({
            tenant_id: tenantId,
            credits: -Math.abs(creditsToDeduct),
            transaction_type: 'IVR_CAMPAIGN',
            description: `IVR Call to ${mobileNumber} (${billsec}s = ${pulses} pulses)`,
            reference_id: batchId || null 
        });
    }

    // 3. LOG THE INDIVIDUAL CALL
    const { error: insertError } = await supabaseAdmin.from("ivr_call_logs").insert({
        tenant_id: tenantId || null,
        batch_id: batchId || null, // Forced to null to avoid UUID empty string crashes
        mobile_number: mobileNumber,
        attempt_num: parseInt(body.attempt_num || "1"),
        start_date: body.start_date || null,
        answer_date: body.answer_date || null,
        end_date: body.end_date || null,
        call_duration: duration,
        bill_seconds: billsec,
        disposition: disposition,
        hangup_cause: body.hangup_cause || null,
        hangup_code: body.hangup_code || null,
        clid: body.clid || null,
        digits_pressed: digitsPressed,
        credits_used: creditsToDeduct
    });

    if (insertError) {
        console.error("❌ [DB ERROR] Failed to insert call log:", insertError);
        return NextResponse.json({ status: "error", message: insertError.message }, { status: 500 });
    }

    console.log(`✅ [FONADA] Logged ${mobileNumber} | BillSec: ${billsec} | Credits: ${creditsToDeduct}`);
    return NextResponse.json({ status: "success" });

  } catch (error) {
    console.error("🔥 [CRITICAL] Fonada Webhook failed:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
