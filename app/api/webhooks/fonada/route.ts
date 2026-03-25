import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    
    // Parse it safely just to ensure it's valid, but store as JSONB
    let body: any = {};
    try { body = JSON.parse(rawBody); } 
    catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }

    // 🔴 1. INSTANTLY DUMP INTO DATABASE BUFFER
    const { error } = await supabaseAdmin.from('webhook_buffer').insert({
        source: 'fonada_ivr',
        payload: body,
        status: 'pending'
    });

    if (error) {
        console.error("🚨 [BUFFER ERROR] Failed to save webhook to buffer:", error);
        return NextResponse.json({ status: "error" }, { status: 500 });
    }

    // 2. Reply to Fonada instantly!
    return NextResponse.json({ status: "queued_in_db" });

  } catch (error) {
    console.error("🔥 [CATCHER CRITICAL ERROR]:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
