import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Force Next.js to never cache this route
export const dynamic = 'force-dynamic';

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log("🔔 [IVR WEBHOOK HIT] Received data from Fonada IVR");

  try {
    // 1. Parse incoming data (Handles both JSON and Form Data)
    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch(e) {
        const params = new URLSearchParams(rawBody);
        body = Object.fromEntries(params);
      }
    }

    console.log("📋 [IVR PAYLOAD]:", body);

    // 2. Extract the important fields based on Fonada's report format
    const customerPhone = body.mobileNumber || body.mobile_number || body.phone;
    const digitsPressed = body.digitsPressed || body.digits_pressed;
    const callDuration = body.callDuration;
    const campaignName = body.campaignName;
    const disposition = body.disposition;

    if (!customerPhone) {
      console.log("⚠️ [IGNORED] Missing mobileNumber in payload");
      return NextResponse.json({ status: "ignored", reason: "no_mobile_number" });
    }

    // 3. Normalize Phone: Extract last 10 digits to match your DB
    let dbPhone = customerPhone.replace(/^\+?91/, '');
    if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

    // 4. Find the Lead in Supabase
    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .select("id, notes")
      .ilike("phone", `%${dbPhone}%`)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (leadError) console.error("❌ [DB ERROR] Finding lead:", leadError);

    // 5. If the lead exists, update their notes with the IVR result
    if (lead) {
        const digitText = digitsPressed ? `Digit Pressed: **${digitsPressed}**` : "No digit pressed";
        const ivrNote = `🤖 [IVR Auto-Log | Campaign: ${campaignName || 'Unknown'}]\nStatus: ${disposition}\n${digitText}\nDuration: ${callDuration || 0}s.`;
        
        // Append to existing notes
        const existingNotes = lead.notes ? `${lead.notes}\n\n${ivrNote}` : ivrNote;

        const { error: updateError } = await supabase
            .from("leads")
            .update({ notes: existingNotes })
            .eq("id", lead.id);

        if (updateError) {
             console.error("❌ [DB ERROR] Updating lead notes:", updateError);
        } else {
             console.log(`✅ [SUCCESS] Updated Lead ID: ${lead.id} with IVR digit: ${digitsPressed}`);
        }
    } else {
        console.log(`⚠️ [NOT FOUND] Lead with phone ${dbPhone} not found in CRM. Creating a new lead is skipped.`);
        // NOTE: If you want the CRM to automatically CREATE a new lead when a random number presses a digit, we can add an insert() query here!
    }

    // Always return a success response to Fonada so they know we got it
    return NextResponse.json({ status: "success", message: "IVR data logged successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] IVR Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}

// Add a GET method just in case Fonada uses it to verify the URL is alive
export async function GET() {
  return NextResponse.json({ status: "success", message: "IVR Webhook is ready to receive POST requests!" });
}
