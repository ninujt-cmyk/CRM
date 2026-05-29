import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key"
);

export async function POST(request: NextRequest) {
  console.log("🔔 [AI OBD WEBHOOK] Call ended, logging telecom data.");

  try {
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } 
      catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }
    }

    const safeBody: any = {};
    for (const key in body) {
        if (body.hasOwnProperty(key)) safeBody[key.toLowerCase()] = body[key];
    }

    const customerPhone = safeBody.customernumber || safeBody.dst || null;
    const duration = parseInt(safeBody.duration || "0");
    const billsec = parseInt(safeBody.billsec || safeBody.customerbillsec || "0");
    const callDisposition = (safeBody.disposition || safeBody.customerdisposition || "UNKNOWN").toUpperCase();

    if (!customerPhone) return NextResponse.json({ status: "ignored" });

    let dbCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);

    // 1. Find the lead that was just dialed
    const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, tenant_id, assigned_to")
        .ilike("phone", `%${dbCustomerPhone}%`)
        .order("last_contacted", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (!lead) return NextResponse.json({ status: "ignored" });

    // 2. Insert Call Log
    const { data: callLog } = await supabaseAdmin.from("call_logs").insert({
        tenant_id: lead.tenant_id, 
        lead_id: lead.id,
        user_id: lead.assigned_to,
        call_type: "ai_outbound",
        call_status: "completed",
        duration_seconds: duration,
        talk_time_seconds: billsec,
        disposition: callDisposition, 
        notes: `AI Bot Call. Telecom Disposition: ${callDisposition}.`
    }).select().single();

    // 3. ONLY handle the 'nr' status here. 
    // If the call connected (billsec > 5), the Oracle Node.js server will handle the smart status.
    if (["NO ANSWER", "FAILED", "BUSY", "CANCEL"].includes(callDisposition) || billsec < 5) {
        await supabaseAdmin.from('leads').update({ 
            status: 'nr',
            last_contacted: new Date().toISOString()
        }).eq('id', lead.id);
        console.log(`✅ [CRM UPDATE] Lead ${lead.id} updated to 'nr'`);
    }

    // 4. Deduct Wallet Credits for connected calls
    if (billsec > 0 && callLog) {
        const { data: settings } = await supabaseAdmin.from('tenant_settings')
            .select('billing_pulse_seconds, credits_per_pulse').eq('tenant_id', lead.tenant_id).single();

        const pulses = Math.ceil(billsec / (settings?.billing_pulse_seconds || 15)); 
        const totalCredits = pulses * (settings?.credits_per_pulse || 1);

        await supabaseAdmin.from("wallet_ledger").insert({
            tenant_id: lead.tenant_id, credits: -Math.abs(totalCredits), 
            transaction_type: 'AI_CALL', description: `AI Call (Talk Time: ${billsec}s)`,
            reference_id: callLog.id
        });
        await supabaseAdmin.from("call_logs").update({ credits_used: totalCredits }).eq("id", callLog.id);
    }

    return NextResponse.json({ status: "success" });

  } catch (error) {
    console.error("🔥 [WEBHOOK ERROR]:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
