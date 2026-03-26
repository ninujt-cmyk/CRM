import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';
export const runtime = 'edge'; 

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  // 🔴 1. Added entry log so Vercel proves it was hit
  console.log("⚡ [EDGE CATCHER] Webhook POST hit received!");
  
  try {
    const rawBody = await request.text();
    
    let parsedData: any = {};
    try { 
        parsedData = JSON.parse(rawBody); 
    } catch(e) { 
        parsedData = Object.fromEntries(new URLSearchParams(rawBody)); 
    }

    const payloads = Array.isArray(parsedData) ? parsedData : [parsedData];

    const insertData = payloads.map((payload) => ({
        source: 'fonada_ivr',
        payload: payload,
        status: 'pending'
    }));

    const { error } = await supabaseAdmin.from('webhook_buffer').insert(insertData);

    if (error) {
        console.error("🚨 [BUFFER ERROR] Database rejected insert:", error);
        return NextResponse.json({ status: "db_error", details: error.message });
    }

    // 🔴 2. Added success log so Vercel prints the exact count!
    console.log(`✅ [EDGE CATCHER] Successfully queued ${insertData.length} call records to Supabase Buffer!`);
    return NextResponse.json({ status: "queued_in_db", count: insertData.length });

  } catch (error) {
    console.error("🔥 [CATCHER CRITICAL ERROR]:", error);
    return NextResponse.json({ status: "caught_error" });
  }
}

export async function GET() {
    console.log("⚡ [EDGE CATCHER] Webhook GET ping received!");
    return NextResponse.json({ status: "ready", message: "Edge Webhook Catcher is active." });
}
