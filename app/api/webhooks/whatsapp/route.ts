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

      // 🔴 FIX: Added imageUrl, documentUrl, and videoUrl to perfectly match Fonada's payload
      let mediaUrl = body.imageUrl || body.documentUrl || body.videoUrl || body.mediaUrl || body.media_url || body.MediaUrl0 || body.url || body.fileUrl || body?.message?.document?.link || body?.message?.image?.link || "";
      let isMedia = !!mediaUrl;

      if (typeof messageText !== 'string') messageText = JSON.stringify(messageText);

      // If customer sent an image without a caption, give it a placeholder
      if (isMedia && !messageText) {
          messageText = "📎 [Media Attachment]";
      }

      if (!customerPhone || !messageText) {
        console.log("⚠️ [IGNORED] Missing phone or text/media payload");
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

      // --- 4. DETECT AND HANDLE MEDIA ATTACHMENTS ---
      let finalContentToSave = messageText; 

      if (isMedia && lead) {
          console.log(`📥 [MEDIA DETECTED] Fetching from Fonada: ${mediaUrl}`);
          try {
              // Download the file from Fonada
              const mediaRes = await fetch(mediaUrl);
              const arrayBuffer = await mediaRes.arrayBuffer();
              
              // Guess the file extension (jpg, pdf, png)
              const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';
              const ext = contentType.split('/')[1] || 'bin';
              
              // Create a clean filename: lead_id/timestamp.ext
              const fileName = `${lead.id}/kyc_${Date.now()}.${ext}`;

              // Upload directly to Supabase Storage
              const { error: uploadError } = await supabase.storage
                  .from('kyc_documents')
                  .upload(fileName, arrayBuffer, {
                      contentType: contentType,
                      upsert: true
                  });

              if (uploadError) throw uploadError;

              // Get the permanent Public URL
              const publicUrlData = supabase.storage.from('kyc_documents').getPublicUrl(fileName);
              const filePublicUrl = publicUrlData.data.publicUrl;

              console.log(`✅ [STORAGE SUCCESS] File securely saved: ${filePublicUrl}`);
              
              // Change the chat text so the admin can click it in the CRM
              finalContentToSave = `📁 *Document Uploaded:*\n${filePublicUrl}`;

          } catch (err) {
              console.error("❌ [STORAGE ERROR] Failed to process media:", err);
              finalContentToSave = "⚠️ *[Failed to download customer document]*";
          }
      }

      // 5. SAVE INCOMING MESSAGE & UPDATE SIDEBAR PREVIEW
      if (lead) {
          // A. Save Message (Now handles both Text and File Links)
          await supabase.from("chat_messages").insert({
              lead_id: lead.id,
              phone_number: customerPhone,
              direction: 'inbound',
              message_type: isMedia ? 'document' : 'text',
              content: finalContentToSave,
              fonada_message_id: body.msgId || null,
              status: 'received'
          });

          // B. Update Lead (Timestamp + Sidebar Preview)
          await supabase
            .from("leads")
            .update({ 
                last_message_at: new Date().toISOString(),
                last_message_content: isMedia ? "📁 Document Received" : messageText.substring(0, 100),
                last_message_type: 'inbound' 
            })
            .eq("id", lead.id);

          // C. Increment Badge
          await supabase.rpc('increment_unread_count', { row_id: lead.id });
      } else {
          console.log("⚠️ [NO LEAD MATCH] Message received, but no matching lead found.");
      }

      // 6. SMART AUTO-REPLY LOGIC
      // If it's a media attachment, we usually don't want to trigger the auto-reply bot
      if (!isMedia) {
          const textLower = messageText.toLowerCase();
          
          // --- Keyword Checks ---
          const isPersonalLoan = textLower.includes("personal loan") || textLower.includes("apply") || textLower.includes("documents are required");
          const isSpeakToAgent = textLower.includes("speak with an agent") || textLower.includes("speak to an agent");
          const isHelp = textLower.includes("help");
          const isComplete = textLower.includes("complete"); 
          const isInterested = ["interested", "intrested", "yes", "plan", "details", "call me"].some(k => textLower.includes(k));

          // --- HANDLE PERSONAL LOAN / DOCUMENTS REQUEST ---
          if (isPersonalLoan) {
            console.log(`✅ [MATCHED KEYWORD] Personal Loan Request triggered.`);
            const plMessage = `Thank you for your interest in a Personal Loan. To proceed with your application, please share the following documents:\n\n✅ *Aadhar Card*\n✅ *PAN Card*\n✅ *One month's payslip*\n\nYou can upload them here or reply to this message with the attachments. We'll begin the verification process right away.`;
            await sendFonadaMessage(customerPhone, plMessage, lead?.id);
            return NextResponse.json({ status: "success", action: "pl_bot_reply_sent" });
          }

          // --- HANDLE "SPEAK WITH AN AGENT" ---
          if (isSpeakToAgent) {
            console.log(`✅ [MATCHED KEYWORD] Speak to Agent Request triggered.`);
            if (lead?.assigned_to) {
              const { data: agent } = await supabase.from("users").select("full_name, phone").eq("id", lead.assigned_to).maybeSingle();
              if (agent && agent.phone) {
                const agentMsg = `Hello! I understand you would like to speak with an agent.\n\nOur expert *${agent.full_name}* is assigned to your application. You can reach them directly at: *${agent.phone}*\n\nThey have been notified and will also contact you shortly.`;
                await sendFonadaMessage(customerPhone, agentMsg, lead.id);
                return NextResponse.json({ status: "success", action: "speak_agent_reply_sent" });
              }
            }
            const fallbackAgentMsg = `Hello! I understand you would like to speak with an agent. Our team has been notified and a representative will call you shortly.`;
            await sendFonadaMessage(customerPhone, fallbackAgentMsg, lead?.id);
            return NextResponse.json({ status: "success", action: "speak_agent_fallback_sent" });
          }

          // --- HANDLE GENERAL INTEREST / HELP (With Office Hours) ---
          if (isHelp || isComplete || isInterested) {
            console.log(`✅ [MATCHED KEYWORD] General Auto-reply triggered.`);
            const now = new Date();
            const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
            const istDate = new Date(utc + (3600000 * 5.5)); 
            const currentHour = istDate.getHours();
            const isOfficeHours = currentHour >= 9 && currentHour < 20; 

            let introMsg = "Thank you for your interest.";
            if (isHelp) introMsg = "We are here to help!";
            if (isComplete) introMsg = "Let's get your application completed!";

            if (lead?.assigned_to) {
              const { data: agent } = await supabase.from("users").select("full_name, phone").eq("id", lead.assigned_to).maybeSingle();
              if (agent && agent.phone) {
                let replyMessage = isOfficeHours 
                    ? `${introMsg}\n\nOur representative *${agent.full_name}* has been assigned and will contact you shortly.\n\nDirect: ${agent.phone}`
                    : `${introMsg}\n\nOur representative *${agent.full_name}* has been assigned.\n\nWe are currently offline, but ${agent.full_name} will call you *tomorrow morning* first thing.\n\nDirect: ${agent.phone}`;
                await sendFonadaMessage(customerPhone, replyMessage, lead.id);
                return NextResponse.json({ status: "success", action: "agent_reply_sent" });
              }
            } 
            const genericReply = isOfficeHours ? `${introMsg} Our team will contact you shortly.` : `${introMsg} Our team is currently offline but will contact you tomorrow morning.`;
            await sendFonadaMessage(customerPhone, genericReply, lead?.id);
            return NextResponse.json({ status: "success", action: "generic_reply_sent" });
          }
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
          const { error } = await supabase.from('chat_messages').update({ status: status }).eq('fonada_message_id', msgId);
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
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
        await supabase.from("chat_messages").insert({
            lead_id: leadId,
            phone_number: mobile,
            direction: 'outbound',
            message_type: 'text',
            content: text,
            fonada_message_id: data.msgId || null,
            status: 'sent'
        });
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
