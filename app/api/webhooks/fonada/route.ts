import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; 

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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

        // 🔴 ONLY keep the call if it was ANSWERED
        if (disposition === "ANSWERED") {
            insertData.push({
                source: 'fonada_ivr',
                payload: payload,
                status: 'pending'
            });
        }
    }

    // 🔴 INSTANT TRASH: If no calls in this payload were answered, drop it immediately!
    if (insertData.length === 0) {
        return NextResponse.json({ status: "ignored_unanswered", count: 0 });
    }

    // INSTANT BULK INSERT (Only the answered calls get saved)
    const { error } = await supabaseAdmin.from('webhook_buffer').insert(insertData);

    if (error) {
        console.error("🚨 [BUFFER ERROR] Database rejected insert:", error);
        return NextResponse.json({ status: "db_error", details: error.message });
    }

    console.log(`✅ [EDGE CATCHER] Successfully queued ${insertData.length} ANSWERED calls to Buffer!`);
    return NextResponse.json({ status: "queued_in_db", count: insertData.length });

  } catch (error) {
    console.error("🔥 [CATCHER CRITICAL ERROR]:", error);
    return NextResponse.json({ status: "caught_error" });
  }
}

export async function GET() {
    return NextResponse.json({ status: "ready", message: "Edge Webhook Catcher is active." });
}
