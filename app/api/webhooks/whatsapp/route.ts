import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Initialize Supabase Admin Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const updateType = searchParams.get("type"); // 'mo' or 'dlr'
    
    const bodyText = await request.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch(e) {
      const params = new URLSearchParams(bodyText);
      body = Object.fromEntries(params);
    }

    console.log(`\n=== Received ${updateType?.toUpperCase()} Webhook ===`);
    console.log(JSON.stringify(body, null, 2));

    // ---------------------------------------------------------
    // CASE 1: HANDLE "MO" (Mobile Originated / Customer Reply)
    // ---------------------------------------------------------
    if (updateType === 'mo') {
      // 1. Extract Customer Phone
      // Look for the phone number in various common Fonada payload locations
      let customerPhone = body.mobile || body.sender || body.from || body?.message?.from;
      
      // 2. Extract Message Text
      // Look for text in various common payload locations (Text reply or Button reply)
      let messageText = 
        body.text || 
        body.msg || 
        body?.message?.text?.body || 
        body?.message?.button?.text ||
        body?.button_text ||
        "";

      if (typeof messageText !== 'string') {
          messageText = JSON.stringify(messageText);
      }

      console.log(`Extracted Phone: ${customerPhone}, Text: ${messageText}`);

      if (!customerPhone || !messageText) {
        console.log("Ignored: Missing phone or text");
        return NextResponse.json({ status: "ignored", reason: "no_data" });
      }

      // 3. Check for Keywords
      // We look for common positive responses
      const keywords = ["interested", "intrested", "yes", "plan", "details", "call me"];
      const isInterested = keywords.some(k => messageText.toLowerCase().includes(k));

      if (isInterested) {
        console.log("Keyword matched! Finding lead...");
        // Normalize Phone: Extract last 10 digits
        let dbPhone = customerPhone.replace(/^\+?91/, '');
        if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

        // Find Lead
        const { data: lead } = await supabase
          .from("leads")
          .select("assigned_to")
          .ilike("phone", `%${dbPhone}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lead?.assigned_to) {
          // Get Telecaller Details
          const { data: agent } = await supabase
            .from("users")
            .select("full_name, phone")
            .eq("id", lead.assigned_to)
            .single();

          if (agent && agent.phone) {
            console.log(`Found Agent: ${agent.full_name}. Sending reply.`);
            const replyMessage = `Hi! Thank you for your interest.\n\nOur representative *${agent.full_name}* has been assigned to you and will contact you shortly.\n\nYou can also reach them directly at: ${agent.phone}`;
            
            await sendFonadaMessage(customerPhone, replyMessage);
            return NextResponse.json({ status: "success", action: "agent_reply_sent" });
          }
        } 
        
        console.log("Lead unassigned or not found. Sending generic reply.");
        await sendFonadaMessage(customerPhone, "Thank you for your interest! Our team will contact you shortly.");
        return NextResponse.json({ status: "success", action: "generic_reply_sent" });
      }
      
      console.log("No keywords matched. Taking no action.");
      return NextResponse.json({ status: "success", action: "no_keyword_match" });
    }

    // ---------------------------------------------------------
    // CASE 2: HANDLE "DLR" (Delivery Reports)
    // ---------------------------------------------------------
    if (updateType === 'dlr') {
      // Fonada tells you a message was Sent, Delivered, Read, or Failed.
      // E.g., body.status === 'delivered'
      console.log(`DLR Status: ${body.status || 'unknown'} for mobile: ${body.mobile || 'unknown'}`);
      return NextResponse.json({ status: "success", action: "dlr_logged" });
    }

    return NextResponse.json({ status: "error", message: "Unknown update type" }, { status: 400 });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// --- HELPER: Send "Normal Text" Message via Fonada ---
async function sendFonadaMessage(mobile: string, text: string) {
  const apiUrl = "https://waba.fonada.com/api/SendMsgOld"; 
  
  const formData = new FormData();
  formData.append("userid", process.env.FONADA_USERID || "bankscart");
  formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
  formData.append("wabaNumber", process.env.FONADA_WABA_NUMBER || "918217354172");
  formData.append("mobile", mobile); 
  formData.append("msg", text);
  formData.append("msgType", "text");
  formData.append("sendMethod", "quick");
  formData.append("output", "json");

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    console.log("Fonada Send Reply Response:", data);
  } catch (e) {
    console.error("Failed to send WhatsApp reply:", e);
  }
}
