import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; 

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key"
);

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    
    // Parse the data safely
    let parsedData: any = {};
    try { 
        parsedData = JSON.parse(rawBody); 
    } catch(e) { 
        parsedData = Object.fromEntries(new URLSearchParams(rawBody)); 
    }

    const payloads = Array.isArray(parsedData) ? parsedData : [parsedData];

    // 🔴 THE NEW FILTER ENGINE
    const insertData = [];

    for (const payload of payloads) {
        // Convert keys to lowercase to safely find the status
        const safePayload: any = {};
        for (const key in payload) {
            if (payload.hasOwnProperty(key)) {
                safePayload[key.toLowerCase()] = payload[key];
            }
        }

        // Extract the disposition (status)
        const disposition = String(safePayload.customerdisposition || safePayload.disposition || safePayload.status || "UNKNOWN").toUpperCase();

        // 🔴 1. STALE REPLAY PROTECTION: Ignore webhooks for calls older than 72 hours
        const callTimeStr = safePayload.starttime || safePayload.answertime || safePayload.start_time || safePayload.answer_time || null;
        if (callTimeStr) {
            const callTime = new Date(callTimeStr).getTime();
            const ageHours = (Date.now() - callTime) / (1000 * 60 * 60);
            if (!isNaN(ageHours) && ageHours > 72) {
                console.log(`⏳ [EDGE CATCHER] Dropped stale replay from ${Math.round(ageHours)}h ago: ${safePayload.mobilenumber || safePayload.customernumber}`);
                continue;
            }
        }

        // 🔴 2. ONLY keep the call if it was ANSWERED
        if (disposition === "ANSWERED") {
            insertData.push({
                source: 'fonada_ivr',
                payload: payload,
                status: 'pending'
            });
        }
    }

    // 🔴 INSTANT TRASH: If no valid new calls in this payload, drop immediately!
    if (insertData.length === 0) {
        return NextResponse.json({ status: "ignored_unanswered_or_stale", count: 0 });
    }

    // INSTANT BULK INSERT (Only valid answered calls get saved)
    const { error } = await supabaseAdmin.from('webhook_buffer').insert(insertData);

    if (error) {
        console.error("🚨 [BUFFER ERROR] Database rejected insert:", error);
        return NextResponse.json({ status: "db_error", details: error.message });
    }

    console.log(`✅ [EDGE CATCHER] Successfully queued ${insertData.length} ANSWERED calls to Buffer!`);

    // 🔴 INSTANT BACKGROUND TRIGGER: Drain buffer immediately without waiting for cron
    try {
        const origin = request.nextUrl.origin;
        const cronSecret = process.env.CRON_SECRET || "my_secure_cron_password_958";
        fetch(`${origin}/api/cron/process-webhooks`, {
            method: 'GET',
            headers: {
                'Authorization': cronSecret.startsWith('Bearer ') ? cronSecret : `Bearer ${cronSecret}`
            }
        }).catch(() => {});
    } catch (e) {}

    return NextResponse.json({ status: "queued_in_db", count: insertData.length });

  } catch (error) {
    console.error("🔥 [CATCHER CRITICAL ERROR]:", error);
    return NextResponse.json({ status: "caught_error" });
  }
}

export async function GET() {
    return NextResponse.json({ status: "ready", message: "Edge Webhook Catcher is active." });
}
