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
    const updateType = searchParams.get("type"); // 'mo' (Message) or 'dlr' (Delivery Report)
    
    // --- ROBUST BODY PARSING ---
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

    // =================================================================================
    // CASE 1: HANDLE "MO" (Mobile Originated / Customer Reply)
    // =================================================================================
    if (updateType === 'mo') {
      
      // 1. EXTRACT DATA
      let customerPhone = body.mobile || body.sender || body.from || body?.message?.from;
      let messageText = body.text || body.msg || body?.message?.text?.body || "";

      if (typeof messageText !== 'string') messageText = JSON.stringify(messageText);

      if (!customerPhone || !messageText) {
        return NextResponse.json({ status: "ignored", reason: "no_data" });
      }

      // 2. FORMAT PHONE
      let dbPhone = customerPhone.replace(/^\+?91/, '');
      if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

      // 3. FIND THE LEAD
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, assigned_to")
        .ilike("phone", `%${dbPhone}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadError) console.error("❌ [DB ERROR] Finding lead:", leadError);

      // 4. SAVE INCOMING MESSAGE & UPDATE SIDEBAR PREVIEW
      if (lead) {
          // A. Save Message
          await supabase.from("chat_messages").insert({
              lead_id: lead.id,
              phone_number: customerPhone,
              direction: 'inbound',
              message_type: 'text',
              content: messageText,
              fonada_message_id: body.msgId || null,
              status: 'received'
          });

          // B. Update Lead (Timestamp + Sidebar Preview)
          await supabase
            .from("leads")
            .update({ 
                last_message_at: new Date().toISOString(),
                last_message_content: messageText.substring(0, 100), // Save snippet
                last_message_type: 'inbound' // Tag as Customer Message
            })
            .eq("id", lead.id);

          // C. Increment Badge
          const { error: rpcError } = await supabase.rpc('increment_unread_count', { row_id: lead.id });
          if (rpcError) console.log("⚠️ [DB NOTE] increment_unread_count RPC failed.");
      } else {
          console.log("⚠️ [NO LEAD MATCH] Message received, but no matching lead found.");
      }

      // 5. SMART AUTO-REPLY LOGIC (With Office Hours)
      const textLower = messageText.toLowerCase();
      const isHelp = textLower.includes("help");
      const isComplete = textLower.includes("complete"); 
      const isInterested = ["interested", "intrested", "yes", "plan", "details", "call me"].some(k => textLower.includes(k));

      if (isHelp || isComplete || isInterested) {
        console.log(`✅ [MATCHED KEYWORD] Auto-reply triggered.`);
        
        // --- 🕒 TIME CHECK (IST) ---
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const istDate = new Date(utc + (3600000 * 5.5)); // UTC + 5.5 for IST
        const currentHour = istDate.getHours();
        const isOfficeHours = currentHour >= 9 && currentHour < 20; // 9 AM - 8 PM

        let introMsg = "Thank you for your interest.";
        if (isHelp) introMsg = "We are here to help!";
        if (isComplete) introMsg = "Let's get your application completed!";

        if (lead?.assigned_to) {
          const { data: agent } = await supabase.from("users").select("full_name, phone").eq("id", lead.assigned_to).maybeSingle();

          if (agent && agent.phone) {
            let replyMessage = "";
            if (isOfficeHours) {
                replyMessage = `${introMsg}\n\nOur representative *${agent.full_name}* has been assigned and will contact you shortly.\n\nDirect: ${agent.phone}`;
            } else {
                replyMessage = `${introMsg}\n\nOur representative *${agent.full_name}* has been assigned.\n\nWe are currently offline, but ${agent.full_name} will call you *tomorrow morning* first thing.\n\nDirect: ${agent.phone}`;
            }
            // Pass lead.id to save reply
            await sendFonadaMessage(customerPhone, replyMessage, lead.id);
            return NextResponse.json({ status: "success", action: "agent_reply_sent" });
          }
        } 
        
        // Fallback
        const genericReply = isOfficeHours
            ? `${introMsg} Our team will contact you shortly.`
            : `${introMsg} Our team is currently offline but will contact you tomorrow morning.`;

        await sendFonadaMessage(customerPhone, genericReply, lead?.id);
        return NextResponse.json({ status: "success", action: "generic_reply_sent" });
      }
      
      return NextResponse.json({ status: "success", action: "message_saved_no_reply" });
    }

    // =================================================================================
    // CASE 2: HANDLE "DLR" (Delivery Reports - Blue Ticks)
    // =================================================================================
    if (updateType === 'dlr') {
      const msgId = body.msgId || body.id;
      let status = body.status ? body.status.toLowerCase() : 'unknown';
      if (status.includes('deliv')) status = 'delivered';
      
      console.log(`📬 [DLR UPDATE] MsgID: ${msgId}, Status: ${status}`);

      if (msgId && (status === 'delivered' || status === 'read')) {
          const { error } = await supabase
              .from('chat_messages')
              .update({ status: status }) 
              .eq('fonada_message_id', msgId);

          if (error) console.error("❌ Failed to update DLR:", error);
      }
      return NextResponse.json({ status: "success", action: "dlr_updated" });
    }

    return NextResponse.json({ status: "error", message: "Unknown type" }, { status: 400 });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] Webhook failed:", error);
    return NextResponse.json({ status: "error", message: "Internal Server Error" }, { status: 500 });
  }
}

// =================================================================================
// HELPER: Send Message via Fonada & Save to DB + Update Sidebar Snippet
// =================================================================================
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
    const res = await fetch(apiUrl, { method: "POST", body: formData });
    const data = await res.json();

    if (leadId && data.status !== "error") {
        // Need a fresh client instance here since this might be called outside main scope
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        
        // 1. Save Message
        await supabase.from("chat_messages").insert({
            lead_id: leadId,
            phone_number: mobile,
            direction: 'outbound',
            message_type: 'text',
            content: text,
            fonada_message_id: data.msgId || null,
            status: 'sent'
        });

        // 2. Update Lead Sidebar Preview (Outbound)
        await supabase.from("leads").update({ 
            last_message_at: new Date().toISOString(),
            last_message_content: text.substring(0, 100),
            last_message_type: 'outbound'
        }).eq("id", leadId);
    }
  } catch (e) {
    console.error("❌ [FONADA ERROR] Failed to send reply:", e);
  }
}
