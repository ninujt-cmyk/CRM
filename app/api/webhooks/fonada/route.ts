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

    // 🔴 LOWERCASE CONVERSION LOOP
    const safeBody: any = {};
    for (const key in body) {
        if (body.hasOwnProperty(key)) {
            safeBody[key.toLowerCase()] = body[key];
        }
    }

    // 1. EXTRACT FONADA'S INTERNAL BATCH ID
    let fonadaLeadId = safeBody.leadid || null;
    
    if (!fonadaLeadId && safeBody.accountcode) {
        fonadaLeadId = String(safeBody.accountcode.split('^')[0]).trim(); 
    }

    let tenantId = null;
    let batchId = null;
    const mobileNumber = safeBody.mobilenumber || safeBody.customernumber || safeBody.dst || null;

    // 2. SMART LOOKUP: Try to find the exact Campaign Batch
    if (fonadaLeadId) {
        const { data: batch } = await supabaseAdmin
            .from('ivr_campaign_history')
            .select('id, tenant_id')
            .eq('fonada_lead_id', String(fonadaLeadId))
            .maybeSingle();

        if (batch) {
            tenantId = batch.tenant_id;
            batchId = batch.id;
            
            await supabaseAdmin.from('ivr_campaign_history')
                .update({ last_webhook_received_at: new Date().toISOString() })
                .eq('id', batchId);
                
            console.log(`🔐 [SMART LOOKUP] Found Batch for LeadID: ${fonadaLeadId}`);
        }
    }

    // 3. FAILSAFE: Fallback to Customer Phone Lookup
    if (!tenantId && mobileNumber) {
        let dbCustomerPhone = mobileNumber.replace(/^\+?91/, '').slice(-10);
        
        const { data: lead } = await supabaseAdmin
            .from('leads')
            .select('tenant_id')
            .ilike('phone', `%${dbCustomerPhone}%`)
            .limit(1)
            .maybeSingle();
            
        if (lead && lead.tenant_id) {
            tenantId = lead.tenant_id;
            console.log(`🛡️ [FAILSAFE] Found Tenant via Customer Phone: ${dbCustomerPhone}`);
        }
    }

    const billsec = parseInt(safeBody.customerbillsec || safeBody.totalbillsec || safeBody.billsec || "0");
    const duration = parseInt(safeBody.duration || "0");
    const disposition = (safeBody.customerdisposition || safeBody.disposition || "UNKNOWN").toUpperCase();
    
    // 🔴 DTMF EXTRACTION FIX: 
    // Captures the true digit pressed by the customer based on your configuration
    let digitsPressed = 
        body.digitsPressed || 
        body['digitsPressed=CDR.digitpressed'] || 
        body.digitspressed || 
        body.digits_pressed ||
        safeBody.digitspressed || 
        safeBody['digitspressed=cdr.digitpressed'] ||
        safeBody.digits_pressed ||
        safeBody.digitpressed;

    if (!digitsPressed) {
        const levelDigits = [
            safeBody.digitpressedlevel1, 
            safeBody.digitpressedlevel2, 
            safeBody.digitpressedlevel3,
            safeBody.digitpressedlevel4,
            safeBody.digitpressedlevel5
        ].filter(Boolean).join(',');

        digitsPressed = levelDigits || null;
    }

    // Make sure we don't save empty strings
    digitsPressed = digitsPressed && digitsPressed.trim() !== "" ? digitsPressed : null;

    if (!tenantId || !mobileNumber) {
      console.error(`🚨 [SECURITY WARNING] Unmapped Call. LeadID: ${fonadaLeadId} | Mobile: ${mobileNumber}`);
      return NextResponse.json({ status: "ignored", reason: "Missing or invalid tenant ID mapping" });
    }

    let creditsToDeduct = 0;

    // 4. DYNAMIC BILLING MATH
    if (billsec > 0 && disposition === "ANSWERED") {
        const { data: settings } = await supabaseAdmin.from('tenant_settings')
            .select('billing_pulse_seconds, credits_per_pulse')
            .eq('tenant_id', tenantId)
            .single();

        const pulseSecs = settings?.billing_pulse_seconds || 15;
        const creditsPerPulse = settings?.credits_per_pulse || 1;

        const pulses = Math.ceil(billsec / pulseSecs); 
        creditsToDeduct = pulses * creditsPerPulse;

        const { error: ledgerError } = await supabaseAdmin.from("wallet_ledger").insert({
            tenant_id: tenantId,
            credits: -Math.abs(creditsToDeduct),
            transaction_type: 'IVR_CAMPAIGN',
            description: `IVR Call to ${mobileNumber} (${billsec}s = ${pulses} pulses)`,
            reference_id: batchId || null 
        });

        if (ledgerError) {
            console.error("🚨 [DB ERROR] Wallet Ledger Insert Failed:", ledgerError);
        }
    }

    // 5. LOG THE INDIVIDUAL CALL
    const { error: insertError } = await supabaseAdmin.from("ivr_call_logs").insert({
        tenant_id: tenantId,
        batch_id: batchId, 
        mobile_number: mobileNumber,
        attempt_num: parseInt(safeBody.attemptnum || safeBody.attempt_num || "1"),
        start_date: safeBody.start || safeBody.start_date || null,
        answer_date: safeBody.answer || safeBody.answer_date || null,
        end_date: safeBody.end || safeBody.end_date || null,
        call_duration: duration,
        bill_seconds: billsec,
        disposition: disposition,
        hangup_cause: safeBody.hangupcause || safeBody.hangup_cause || null,
        hangup_code: safeBody.hangupcode || safeBody.hangup_code || null,
        clid: safeBody.clid || null,
        digits_pressed: digitsPressed,
        credits_used: creditsToDeduct
    });

    if (insertError) {
        console.error("❌ [DB ERROR] Failed to insert call log:", insertError);
        return NextResponse.json({ status: "error", message: insertError.message }, { status: 500 });
    }

    console.log(`✅ [FONADA] Logged ${mobileNumber} | Digits: ${digitsPressed} | Credits: -${creditsToDeduct}`);
    return NextResponse.json({ status: "success" });

  } catch (error) {
    console.error("🔥 [CRITICAL] Fonada Webhook failed:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
