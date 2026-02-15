import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Initialize Supabase Admin Client (to bypass RLS for lookups)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const updateType = searchParams.get("type"); // 'mo' or 'dlr'
    
    // Parse incoming webhook data (Gracefully handle JSON or URL-encoded)
    const bodyText = await request.text();
    let body: any = {};
    try {
      body = JSON.parse(bodyText);
    } catch(e) {
      const params = new URLSearchParams(bodyText);
      body = Object.fromEntries(params);
    }

    console.log(`Received ${updateType} Webhook:`, body);

    // ---------------------------------------------------------
    // CASE 1: HANDLE "MO" (Mobile Originated / Customer Reply)
    // ---------------------------------------------------------
    if (updateType === 'mo') {
      // Fonada typically sends the customer's number in 'mobile', 'sender', or 'from'
      const customerPhone = body?.mobile || body?.sender || body?.from; 
      const messageText = body?.msg || body?.text || body?.message || "";

      if (!customerPhone || !messageText) {
        return NextResponse.json({ status: "ignored", reason: "no_data" });
      }

      // 1. Check for Keywords
      const keywords = ["interested", "intrested", "yes", "plan", "details", "call me"];
      const isInterested = keywords.some(k => messageText.toLowerCase().includes(k));

      if (isInterested) {
        // 2. Normalize Phone: Extract the 10-digit number to match your Supabase DB format
        // Fonada usually sends numbers with '91'. We safely extract the last 10 digits.
        let dbPhone = customerPhone.replace(/^\+?91/, '');
        if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

        // 3. Find Lead & Assigned Telecaller using a fuzzy match
        const { data: lead } = await supabase
          .from("leads")
          .select("assigned_to")
          .ilike("phone", `%${dbPhone}%`)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (lead?.assigned_to) {
          // 4. Get Telecaller Details
          const { data: agent } = await supabase
            .from("users")
            .select("full_name, phone")
            .eq("id", lead.assigned_to)
            .single();

          if (agent && agent.phone) {
            // 5. Send Personalized Reply
            const replyMessage = `Hi! Thank you for your interest.\n\nOur representative *${agent.full_name}* has been assigned to you and will contact you shortly.\n\nYou can also reach them directly at: ${agent.phone}`;
            
            await sendFonadaMessage(customerPhone, replyMessage);
            return NextResponse.json({ status: "success", action: "agent_reply_sent" });
          }
        } 
        
        // Fallback: If lead is unassigned or not found
        await sendFonadaMessage(customerPhone, "Thank you for your interest! Our team will contact you shortly.");
        return NextResponse.json({ status: "success", action: "generic_reply_sent" });
      }
      
      return NextResponse.json({ status: "success", action: "no_keyword_match" });
    }

    // ---------------------------------------------------------
    // CASE 2: HANDLE "DLR" (Delivery Reports)
    // ---------------------------------------------------------
    if (updateType === 'dlr') {
      // Fonada telling you a message was delivered/read.
      // You can log it in your database later if needed. For now, just accept it.
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
  
  // Create Form Data as requested by Fonada's API Collection
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
      body: formData // Notice we send formData, not JSON
    });
    
    const data = await res.json();
    console.log("Fonada Send Reply Response:", data);
  } catch (e) {
    console.error("Failed to send WhatsApp reply:", e);
  }
}
