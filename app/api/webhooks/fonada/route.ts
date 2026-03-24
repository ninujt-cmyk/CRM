// app/api/webhooks/fonada/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // 1. THIS MUST PRINT IF FONADA HITS THE URL
  console.log("🚨 [WEBHOOK CATCHER] Fonada just knocked on the door!");

  try {
    // 2. SAFE INITIALIZATION (Prevents crashes if Vercel env vars are missing)
    if (!process.env.QSTASH_TOKEN) {
        throw new Error("CRITICAL: QSTASH_TOKEN is missing in Environment Variables!");
    }

    const qstashClient = new Client({
      token: process.env.QSTASH_TOKEN,
    });

    const rawBody = await request.text();
    const searchParams = request.nextUrl.searchParams.toString();

    // 3. SAFE URL FORMATTING (Removes trailing slashes from NEXT_PUBLIC_APP_URL)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://crm.hanva.in';
    const workerUrl = `${baseUrl}/api/webhooks/fonada/worker${searchParams ? `?${searchParams}` : ''}`;

    console.log(`📤 [WEBHOOK CATCHER] Attempting to queue to Worker URL: ${workerUrl}`);

    // 4. PUBLISH TO QSTASH
    const res = await qstashClient.publishJSON({
      url: workerUrl,
      body: { rawPayload: rawBody },
    });

    console.log(`⚡ [WEBHOOK CATCHER] SUCCESS! Queued in Upstash with Message ID: ${res.messageId}`);

    return NextResponse.json({ status: "queued", messageId: res.messageId });

  } catch (error: any) {
    console.error("🔥 [WEBHOOK CATCHER ERROR]:", error.message || error);
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }
}
