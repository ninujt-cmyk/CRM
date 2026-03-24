import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";

export const dynamic = 'force-dynamic';

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    // 1. Grab the raw payload from Fonada
    const rawBody = await request.text();
    const searchParams = request.nextUrl.searchParams.toString();

    // 2. The URL where QStash should send the data for processing
    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fonada/worker?${searchParams}`;

    // 3. Publish to the Queue
    // We send the raw string so we don't waste CPU time parsing it here.
    await qstashClient.publishJSON({
      url: workerUrl,
      body: { rawPayload: rawBody },
      // Optional: Delay the processing if you want
      // delay: "5s", 
    });

    console.log("⚡ [WEBHOOK CATCHER] Payload queued successfully.");

    // 4. Instantly reply 200 OK to Fonada (Takes < 50ms)
    return NextResponse.json({ status: "queued" });

  } catch (error) {
    console.error("🔥 [WEBHOOK CATCHER ERROR]:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
