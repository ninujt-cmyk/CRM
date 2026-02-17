import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Force Next.js to never cache this route
export const dynamic = 'force-dynamic';

// Initialize Supabase Admin Client (Service Role bypasses RLS)
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

    // 2. Extract the fields based on Fonada's report format
    const customerPhone = body.mobileNumber || body.mobile_number || body.phone;
    const digitsPressed = body.digitsPressed || body.digits_pressed;
    const callDuration = body.callDuration;
    const campaignName = body.campaignName;
    const disposition = body.disposition;

    if (!customerPhone) {
      console.log("⚠️ [IGNORED] Missing mobileNumber in payload");
      return NextResponse.json({ status: "ignored", reason: "no_mobile_number" });
    }

    // 3. Normalize Phone: Extract last 10 digits
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

    const digitText = digitsPressed ? `Digit Pressed: **${digitsPressed}**` : "No digit pressed";
    const ivrNote = `🤖 [IVR Auto-Log | Campaign: ${campaignName || 'Unknown'}]\nStatus: ${disposition}\n${digitText}\nDuration: ${callDuration || 0}s.`;

    // -------------------------------------------------------------
    // CASE A: LEAD ALREADY EXISTS -> Update Notes
    // -------------------------------------------------------------
    if (lead) {
        const existingNotes = lead.notes ? `${lead.notes}\n\n${ivrNote}` : ivrNote;

        const { error: updateError } = await supabase
            .from("leads")
            .update({ notes: existingNotes })
            .eq("id", lead.id);

        if (updateError) {
             console.error("❌ [DB ERROR] Updating lead notes:", updateError);
        } else {
             console.log(`✅ [SUCCESS] Updated existing Lead ID: ${lead.id} with IVR digit.`);
        }
    } 
    // -------------------------------------------------------------
    // CASE B: COMPLETELY NEW LEAD -> Create & Assign Automatically
    // -------------------------------------------------------------
    else {
        console.log(`✨ [NEW LEAD] Phone ${dbPhone} not found. Creating and assigning...`);

        // Step B1: Find active telecallers
        // NOTE: Adjust '.eq("role", "telecaller")' if your column name is different
        let { data: activeTelecallers } = await supabase
            .from("users")
            .select("id")
            // ---> Add your specific "Checked In" condition here if you have one! <---
            // Example: .eq("is_active", true) OR .eq("attendance_status", "checked_in")
            // For now, it fetches all standard telecallers:
            .in("role", ["telecaller", "agent", "user"]); 

        let assignedToId = null;

        // Step B2: Pick a random active telecaller (Round Robin effect)
        if (activeTelecallers && activeTelecallers.length > 0) {
            const randomIndex = Math.floor(Math.random() * activeTelecallers.length);
            assignedToId = activeTelecallers[randomIndex].id;
        }

        // Step B3: Insert the new lead
        const { data: newLead, error: insertError } = await supabase
            .from("leads")
            .insert({
                name: `IVR Lead - ${dbPhone.slice(-4)}`, // e.g. "IVR Lead - 4829"
                phone: dbPhone,
                status: "new",
                notes: ivrNote,
                assigned_to: assignedToId,
                // Add any other required columns for your 'leads' table here (e.g. 'source': 'IVR')
            })
            .select("id")
            .single();

        if (insertError) {
            console.error("❌ [DB ERROR] Failed to insert new IVR lead:", insertError);
        } else {
            console.log(`✅ [SUCCESS] Created Lead ID: ${newLead.id} & Assigned to User ID: ${assignedToId}`);
        }
    }

    return NextResponse.json({ status: "success", message: "IVR data processed successfully" });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] IVR Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "success", message: "IVR Webhook is ready to receive POST requests!" });
}
