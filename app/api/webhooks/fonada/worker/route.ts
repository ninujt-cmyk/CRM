// app/api/webhooks/fonada/worker/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { verifySignatureEdge } from "@upstash/qstash/nextjs";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function processWebhook(request: NextRequest) {
  console.log("👷 [QSTASH WORKER] Processing queued CDR data.");

  try {
    // 1. Grab the payload that QStash forwarded to us
    const { rawPayload } = await request.json();
    
    let body: any = {};
    try { body = JSON.parse(rawPayload); } 
    catch(e) { body = Object.fromEntries(new URLSearchParams(rawPayload)); }

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
    
    // 4. DTMF EXTRACTION
    let rawDigits = [
        body.digitsPressed, body.digitpressed, body.digits_pressed, body.digit_pressed,
        safeBody.digitspressed, safeBody.digitpressed, safeBody.digits_pressed, safeBody.digit_pressed,
        body['digitsPressed=CDR.digitpressed'], safeBody['digitspressed=cdr.digitpressed']
    ].find(val => val !== undefined && val !== null && String(val).trim() !== "");

    if (!rawDigits) {
        const multiLevel = [
            body.level1 || safeBody.level1 || body.digitpressedLevel1 || safeBody.digitpressedlevel1,
            body.level2 || safeBody.level2 || body.digitpressedLevel2 || safeBody.digitpressedlevel2,
            body.level3 || safeBody.level3 || body.digitpressedLevel3 || safeBody.digitpressedlevel3,
            body.level4 || safeBody.level4 || body.digitpressedLevel4 || safeBody.digitpressedlevel4,
            body.level5 || safeBody.level5 || body.digitpressedLevel5 || safeBody.digitpressedlevel5
        ].filter(val => val !== undefined && val !== null && String(val).trim() !== "").join(',');

        if (multiLevel.length > 0) {
            rawDigits = multiLevel;
        }
    }

    const digitsPressed = rawDigits ? String(rawDigits).trim() : null;

    if (!tenantId || !mobileNumber) {
      console.error(`🚨 [SECURITY WARNING] Unmapped Call. LeadID: ${fonadaLeadId} | Mobile: ${mobileNumber}`);
      return NextResponse.json({ status: "ignored", reason: "Missing tenant ID mapping" });
    }

    let creditsToDeduct = 0;

    // 5. DYNAMIC BILLING MATH
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

        if (ledgerError) console.error("🚨 [DB ERROR] Wallet Ledger Insert Failed:", ledgerError);
    }

    // 6. LOG THE INDIVIDUAL CALL
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

    if (insertError) throw new Error(insertError.message);

    console.log(`✅ [WORKER] Logged ${mobileNumber} | Digits: ${digitsPressed} | Credits: -${creditsToDeduct}`);
    
    return NextResponse.json({ status: "success" });

  } catch (error) {
    console.error("🔥 [WORKER CRITICAL ERROR]:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// 🛡️ SECURITY: Wrap the POST function to verify the request actually came from QStash
export const POST = verifySignatureEdge(processWebhook);
