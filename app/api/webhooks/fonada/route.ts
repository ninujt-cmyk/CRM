// app/api/webhooks/fonada/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/qstash";

export const dynamic = 'force-dynamic';

const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN!,
});

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const searchParams = request.nextUrl.searchParams.toString();

    // Sends it to the worker URL
    const workerUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/fonada/worker?${searchParams}`;

    await qstashClient.publishJSON({
      url: workerUrl,
      body: { rawPayload: rawBody },
    });

    console.log("⚡ [WEBHOOK CATCHER] Payload queued to Upstash successfully.");
    return NextResponse.json({ status: "queued" });

  } catch (error) {
    console.error("🔥 [WEBHOOK CATCHER ERROR]:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}
