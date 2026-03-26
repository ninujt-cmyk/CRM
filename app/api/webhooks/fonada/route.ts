// app/api/webhooks/fonada/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
// 🔴 THE MAGIC FIX: Runs on Vercel Edge Network. Boots in 0ms. Never times out.
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

    // 🔴 BULK PROTECTION: If Fonada batches 50 calls into one array, this catches all of them!
    const payloads = Array.isArray(parsedData) ? parsedData : [parsedData];

    // Prepare all rows for a single, lightning-fast bulk insert
    const insertData = payloads.map((payload) => ({
        source: 'fonada_ivr',
        payload: payload,
        status: 'pending'
    }));

    // 🔴 INSTANT BULK INSERT
    const { error } = await supabaseAdmin.from('webhook_buffer').insert(insertData);

    if (error) {
        console.error("🚨 [BUFFER ERROR] Failed to save webhook:", error);
        // We still return 200 to Fonada so they don't block us, but we log the error
        return NextResponse.json({ status: "db_error", details: error.message });
    }

    // Reply to Fonada instantly!
    return NextResponse.json({ status: "queued_in_db", count: insertData.length });

  } catch (error) {
    console.error("🔥 [CATCHER CRITICAL ERROR]:", error);
    // Even if it fails, return 200 so Fonada doesn't blacklist the webhook URL
    return NextResponse.json({ status: "caught_error" });
  }
}

// 🔴 CATCH GET REQUESTS: Just in case Fonada does a ping test
export async function GET() {
    return NextResponse.json({ status: "ready", message: "Edge Webhook Catcher is active." });
}
