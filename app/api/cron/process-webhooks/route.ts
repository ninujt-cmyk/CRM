import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow up to 5 minutes on Vercel

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  // 🔴 1. THE SECURITY LOCK
  // Ensure the request has the correct secret password
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_KEY}`) {
      console.error("🚨 Unauthorized attempt to run cron job.");
      return NextResponse.json({ status: "unauthorized" }, { status: 401 });
  }

  console.log("👷 [BATCH PROCESSOR] Starting secure queue check...");

  try {
    // We grab up to 300 logs at a time to handle high volume quickly
    const { data: pendingEvents, error: fetchError } = await supabaseAdmin
        .from('webhook_buffer')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .limit(300);

    if (fetchError || !pendingEvents || pendingEvents.length === 0) {
        return NextResponse.json({ status: "idle", message: "No pending webhooks." });
    }

    console.log(`📦 Found ${pendingEvents.length} payloads to process.`);

    const eventIds = pendingEvents.map(e => e.id);
    await supabaseAdmin.from('webhook_buffer').update({ status: 'processing' }).in('id', eventIds);

    let successCount = 0;
    let failCount = 0;

    // LOOP THROUGH EACH PAYLOAD
    for (const event of pendingEvents) {
        try {
            const body = event.payload;
            
            const safeBody: any = {};
            for (const key in body) {
                if (body.hasOwnProperty(key)) safeBody[key.toLowerCase()] = body[key];
            }

            let fonadaLeadId = safeBody.leadid || null;
            if (!fonadaLeadId && safeBody.accountcode) {
                fonadaLeadId = String(safeBody.accountcode.split('^')[0]).trim(); 
            }

            let tenantId = null;
            let batchId = null;
            const mobileNumber = safeBody.mobilenumber || safeBody.customernumber || safeBody.dst || null;

            if (fonadaLeadId) {
                const { data: batch } = await supabaseAdmin.from('ivr_campaign_history').select('id, tenant_id').eq('fonada_lead_id', String(fonadaLeadId)).maybeSingle();
                if (batch) {
                    tenantId = batch.tenant_id;
                    batchId = batch.id;
                    await supabaseAdmin.from('ivr_campaign_history').update({ last_webhook_received_at: new Date().toISOString() }).eq('id', batchId);
                }
            }

            if (!tenantId && mobileNumber) {
                let dbCustomerPhone = mobileNumber.replace(/^\+?91/, '').slice(-10);
                const { data: lead } = await supabaseAdmin.from('leads').select('tenant_id').ilike('phone', `%${dbCustomerPhone}%`).limit(1).maybeSingle();
                if (lead && lead.tenant_id) tenantId = lead.tenant_id;
            }

            const billsec = parseInt(safeBody.customerbillsec || safeBody.totalbillsec || safeBody.billsec || "0");
            const duration = parseInt(safeBody.duration || "0");
            const disposition = (safeBody.customerdisposition || safeBody.disposition || "UNKNOWN").toUpperCase();
            
            let rawDigits = [
                body.digitsPressed, body.digitpressed, safeBody.digitspressed, safeBody.digitpressed,
                body['digitsPressed=CDR.digitpressed'], safeBody['digitspressed=cdr.digitpressed']
            ].find(val => val !== undefined && val !== null && String(val).trim() !== "");

            if (!rawDigits) {
                rawDigits = [
                    body.level1 || safeBody.level1 || safeBody.digitpressedlevel1,
                    body.level2 || safeBody.level2 || safeBody.digitpressedlevel2,
                    body.level3 || safeBody.level3 || safeBody.digitpressedlevel3,
                ].filter(val => val !== undefined && val !== null && String(val).trim() !== "").join(',');
            }

            const digitsPressed = rawDigits ? String(rawDigits).trim() : null;

            if (!tenantId || !mobileNumber) {
                throw new Error(`Unmapped Call. LeadID: ${fonadaLeadId} | Mobile: ${mobileNumber}`);
            }

            let creditsToDeduct = 0;
            if (billsec > 0 && disposition === "ANSWERED") {
                const { data: settings } = await supabaseAdmin.from('tenant_settings').select('billing_pulse_seconds, credits_per_pulse').eq('tenant_id', tenantId).single();
                const pulses = Math.ceil(billsec / (settings?.billing_pulse_seconds || 15)); 
                creditsToDeduct = pulses * (settings?.credits_per_pulse || 1);

                await supabaseAdmin.from("wallet_ledger").insert({
                    tenant_id: tenantId, credits: -Math.abs(creditsToDeduct), transaction_type: 'IVR_CAMPAIGN',
                    description: `IVR Call to ${mobileNumber} (${billsec}s = ${pulses} pulses)`, reference_id: batchId || null 
                });
            }

            const { error: insertError } = await supabaseAdmin.from("ivr_call_logs").insert({
                tenant_id: tenantId, batch_id: batchId, mobile_number: mobileNumber,
                attempt_num: parseInt(safeBody.attemptnum || "1"), start_date: safeBody.start || null,
                answer_date: safeBody.answer || null, end_date: safeBody.end || null, call_duration: duration,
                bill_seconds: billsec, disposition: disposition, hangup_cause: safeBody.hangupcause || null,
                hangup_code: safeBody.hangupcode || null, clid: safeBody.clid || null, digits_pressed: digitsPressed, credits_used: creditsToDeduct
            });

            if (insertError) throw insertError;

            // Mark this specific event as successful!
            await supabaseAdmin.from('webhook_buffer').update({ status: 'completed', processed_at: new Date().toISOString() }).eq('id', event.id);
            successCount++;

        } catch (err: any) {
            console.error(`❌ Failed to process event ${event.id}:`, err);
            await supabaseAdmin.from('webhook_buffer').update({ status: 'failed', error_log: err.message || 'Unknown error', processed_at: new Date().toISOString() }).eq('id', event.id);
            failCount++;
        }
    }

    console.log(`✅ Batch Complete. Success: ${successCount}, Failed: ${failCount}`);
    return NextResponse.json({ status: "success", processed: successCount, failed: failCount });

  } catch (error) {
    console.error("🔥 [BATCH PROCESSOR CRITICAL ERROR]:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
