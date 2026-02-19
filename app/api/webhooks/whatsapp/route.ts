import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

// Initialize Supabase with Service Role Key (Bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log("🔔 [WEBHOOK HIT] Received POST request at /api/webhooks/whatsapp");

  try {
    const searchParams = request.nextUrl.searchParams;
    const updateType = searchParams.get("type"); // 'mo' or 'dlr'
    
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

    console.log(`📋 [PARSED PAYLOAD] Type: ${updateType}`, body);

    // ---------------------------------------------------------
    // CASE 1: HANDLE "MO" (Mobile Originated / Customer Reply)
    // ---------------------------------------------------------
    if (updateType === 'mo') {
      
      let customerPhone = body.mobile || body.sender || body.from || body?.message?.from;
      
      let messageText = 
        body.text || 
        body.msg || 
        body?.message?.text?.body || 
        body?.message?.button?.text ||
        body?.button_text ||
        body?.message?.interactive?.button_reply?.title ||
        "";

      if (typeof messageText !== 'string') {
          messageText = JSON.stringify(messageText);
      }

      console.log(`📱 [DATA EXTRACTED] Phone: ${customerPhone}, Text: ${messageText}`);

      if (!customerPhone || !messageText) {
        console.log("⚠️ [IGNORED] Missing phone or text");
        return NextResponse.json({ status: "ignored", reason: "no_data" });
      }

      // --- 1. FORMAT PHONE FOR DB ---
      let dbPhone = customerPhone.replace(/^\+?91/, '');
      if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

      // --- 2. FIND THE LEAD ---
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, assigned_to")
        .ilike("phone", `%${dbPhone}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadError) console.error("❌ [DB ERROR] Finding lead:", leadError);

      // --- 3. SAVE THE INCOMING MESSAGE TO DATABASE ---
      if (lead) {
          const { error: insertError } = await supabase.from("chat_messages").insert({
              lead_id: lead.id,
              phone_number: customerPhone,
              direction: 'inbound',
              message_type: 'text',
              content: messageText,
              fonada_message_id: body.msgId || null,
              status: 'received'
          });

          if (insertError) {
              console.error("❌ [DB ERROR] Saving message to chat_messages:", insertError);
          } else {
              console.log("✅ [DB SUCCESS] Message saved to chat history.");
          }

          // Bump lead to top & update unread count
          await supabase
            .from("leads")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", lead.id);

          const { error: rpcError } = await supabase.rpc('increment_unread_count', { row_id: lead.id });
          if (rpcError) console.log("⚠️ [DB NOTE] increment_unread_count RPC failed or is not set up yet.");
      } else {
          console.log("⚠️ [NO LEAD MATCH] Message received, but no matching lead found in database.");
      }

      // --- 4. SMART KEYWORD MATCHING (AUTO-REPLY) ---
      const textLower = messageText.toLowerCase();
      const isHelp = textLower.includes("help");
      const isComplete = textLower.includes("complete"); 
      const isInterested = ["interested", "intrested", "yes", "plan", "details", "call me"].some(k => textLower.includes(k));

      if (isHelp || isComplete || isInterested) {
        console.log(`✅ [MATCHED KEYWORD] Auto-reply triggered.`);
        
        let introMsg = "Thank you for your interest.";
        if (isHelp) introMsg = "We are here to help!";
        if (isComplete) introMsg = "Let's get your application completed!";

        if (lead?.assigned_to) {
          const { data: agent, error: agentError } = await supabase
            .from("users")
            .select("full_name, phone")
            .eq("id", lead.assigned_to)
            .maybeSingle();

          if (agent && agent.phone) {
            console.log(`🎯 [AGENT FOUND] ${agent.full_name}. Sending dynamic reply.`);
            
            const replyMessage = `${introMsg}\n\nOur representative *${agent.full_name}* has been assigned to you and will contact you shortly.\n\nYou can also reach them directly at: ${agent.phone}`;
            
            // 🔴 FIX 1: Passed 'lead.id' so the reply saves to the DB!
            await sendFonadaMessage(customerPhone, replyMessage, lead.id);
            
            return NextResponse.json({ status: "success", action: "agent_reply_sent" });
          }
        } 
        
        console.log("⚠️ [FALLBACK] Lead unassigned or not found. Sending generic reply.");
        // 🔴 FIX 2: Passed 'lead.id' here too!
        await sendFonadaMessage(customerPhone, `${introMsg} Our team will contact you shortly.`, lead?.id);
        
        return NextResponse.json({ status: "success", action: "generic_reply_sent" });
      }
      
      return NextResponse.json({ status: "success", action: "message_saved_no_reply" });
    }

    // ---------------------------------------------------------
    // CASE 2: HANDLE "DLR" (Delivery Reports)
    // ---------------------------------------------------------
    if (updateType === 'dlr') {
      console.log(`📬 [DLR STATUS]: ${body.status} for msgId: ${body.msgId}`);
      // Optional: Update status to 'delivered' or 'read' in DB based on msgId
      return NextResponse.json({ status: "success", action: "dlr_logged" });
    }

    return NextResponse.json({ status: "error", message: "Unknown update type" }, { status: 400 });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}

// --- HELPER: Send Message via Fonada & Save to DB ---
async function sendFonadaMessage(mobile: string, text: string, leadId?: string) {
  const apiUrl = "https://waba.fonada.com/api/SendMsgOld"; 
  
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
    console.log("📤 [FONADA RESPONSE]:", data);

    // ✅ SAVE AUTO-REPLY TO DATABASE
    if (leadId && data.status !== "error") {
        await supabase.from("chat_messages").insert({
            lead_id: leadId,
            phone_number: mobile,
            direction: 'outbound',
            message_type: 'text',
            content: text,
            fonada_message_id: data.msgId || null,
            status: 'sent'
        });
        console.log("✅ [DB SUCCESS] Auto-reply saved to history.");
    }
  } catch (e) {
    console.error("❌ [FONADA ERROR] Failed to send reply:", e);
  }
}
