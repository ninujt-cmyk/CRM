// app/api/webhooks/whatsapp/route.ts
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
      
      let messageText = body.text || body.msg || body.caption || body?.message?.text?.body || body?.message?.document?.caption || body?.message?.image?.caption || "";

      let mediaUrl = body.imageUrl || body.documentUrl || body.videoUrl || body.mediaUrl || body.media_url || body.MediaUrl0 || body.url || body.fileUrl || body?.message?.document?.link || body?.message?.image?.link || "";
      let isMedia = !!mediaUrl;

      if (typeof messageText !== 'string') messageText = JSON.stringify(messageText);

      if (isMedia && !messageText) {
          messageText = "📎 [Media Attachment]";
      }

      if (!customerPhone || !messageText) {
        return NextResponse.json({ status: "ignored", reason: "no_data" });
      }

      // 2. FORMAT PHONE
      let dbPhone = customerPhone.replace(/^\+?91/, '');
      if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

      // 3. FIND THE LEAD AND IDENTIFY THE TENANT
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, assigned_to, tenant_id")
        .ilike("phone", `%${dbPhone}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadError) console.error("❌ [DB ERROR] Finding lead:", leadError);

      // 🔴 MULTI-TENANT CREDENTIAL FETCHING
      let fonadaUser = process.env.FONADA_USERID || "bankscart";
      let fonadaPass = process.env.FONADA_PASSWORD || "zfsWTyKw";
      let fonadaWaba = process.env.FONADA_WABA_NUMBER || "918217354172";

      if (lead?.tenant_id) {
          const { data: settings } = await supabase.from('tenant_settings').select('*').eq('tenant_id', lead.tenant_id).maybeSingle();
          if (settings?.fonada_userid) fonadaUser = settings.fonada_userid;
          if (settings?.fonada_password) fonadaPass = settings.fonada_password;
          if (settings?.fonada_waba_number) fonadaWaba = settings.fonada_waba_number;
      }

      // --- 4. DETECT AND HANDLE MEDIA ATTACHMENTS (BULLETPROOF VERSION) ---
      let finalContentToSave = messageText; 

      if (isMedia && lead) {
          console.log(`📥 [MEDIA DETECTED] Original Fonada Link: ${mediaUrl}`);
          
          try {
              // 🔴 MULTI-TENANT: Inject specific company credentials for Media Download
              const authString = Buffer.from(`${fonadaUser}:${fonadaPass}`).toString('base64');
              const fetchHeaders = {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                  'Accept': '*/*',
                  'Authorization': `Basic ${authString}`
              };

              let mediaRes = await fetch(mediaUrl, { headers: fetchHeaders });
              let contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';

              if (contentType.includes('text/html')) {
                  console.log("⚠️ Fonada returned HTML. Scraping the portal page for the raw PDF link...");
                  const htmlContent = await mediaRes.text();
                  
                  const urlsInHtml = htmlContent.match(/https?:\/\/[^"'\s<>]+/g) || [];
                  let rawUrl = urlsInHtml.find(u => u !== mediaUrl && (u.toLowerCase().includes('.pdf') || u.includes('download') || u.includes('view-media') || u.includes('media_id')));

                  if (!rawUrl && mediaUrl.includes('view-mediaMeta')) {
                      rawUrl = mediaUrl.replace('view-mediaMeta', 'view-media');
                  }

                  if (rawUrl) {
                      // 🔴 MULTI-TENANT: Ensure correct credentials are built into URL fallback
                      if (rawUrl.includes(new URL(mediaUrl).hostname) && !rawUrl.includes('userid=')) {
                          const joinChar = rawUrl.includes('?') ? '&' : '?';
                          rawUrl = `${rawUrl}${joinChar}userid=${fonadaUser}&password=${fonadaPass}`;
                      }

                      console.log(`🔗 Found raw URL, retrying fetch: ${rawUrl}`);
                      mediaRes = await fetch(rawUrl, { headers: fetchHeaders });
                      contentType = mediaRes.headers.get('content-type') || '';
                  }
              }

              if (contentType.includes('text/html')) {
                  console.log("⚠️ [INFO] Still returning HTML. Saving the direct link instead.");
                  finalContentToSave = `📁 *Document Link Received:*\n${mediaUrl}`;
              } else {
                  const arrayBuffer = await mediaRes.arrayBuffer();
                  let ext = 'bin';
                  
                  const originalName = body.documentName || body.fileName || body?.message?.document?.filename || "";
                  if (originalName && originalName.includes('.')) {
                      ext = originalName.split('.').pop() || 'bin';
                  } 
                  else if (mediaUrl.includes('.')) {
                      const urlMatch = mediaUrl.match(/\.([a-zA-Z0-9]+)(?:&|$)/);
                      if (urlMatch) ext = urlMatch[1];
                  }
                  
                  if (ext === 'bin' || ext.length > 4) {
                      const mime = contentType.toLowerCase();
                      if (mime.includes('pdf')) ext = 'pdf';
                      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
                      else if (mime.includes('png')) ext = 'png';
                      else if (mime.includes('mp4')) ext = 'mp4';
                      else ext = mime.split('/')[1]?.split(';')[0] || 'bin';
                  }
                  
                  ext = ext.toLowerCase().replace(/[^a-z0-9]/g, '');

                  let finalUploadType = contentType;
                  if (ext === 'pdf') finalUploadType = 'application/pdf';
                  if (ext === 'jpg' || ext === 'jpeg') finalUploadType = 'image/jpeg';
                  if (ext === 'png') finalUploadType = 'image/png';

                  const fileName = `${lead.id}/kyc_${Date.now()}.${ext}`;

                  const { error: uploadError } = await supabase.storage
                      .from('kyc_documents')
                      .upload(fileName, arrayBuffer, {
                          contentType: finalUploadType,
                          upsert: true
                      });

                  if (uploadError) throw uploadError;

                  const publicUrlData = supabase.storage.from('kyc_documents').getPublicUrl(fileName);
                  const filePublicUrl = publicUrlData.data.publicUrl;

                  console.log(`✅ [STORAGE SUCCESS] File securely saved: ${filePublicUrl}`);
                  finalContentToSave = `📁 *Document Uploaded:*\n${filePublicUrl}`;
              }

          } catch (err: any) {
              console.error("❌ [STORAGE ERROR] Failed to process media:", err);
              finalContentToSave = `📁 *Document Link Received:*\n${mediaUrl}`;
          }
      }

      // 5. SAVE INCOMING MESSAGE & UPDATE SIDEBAR PREVIEW
      if (lead) {
          await supabase.from("chat_messages").insert({
              lead_id: lead.id,
              phone_number: customerPhone,
              direction: 'inbound',
              message_type: isMedia ? 'document' : 'text',
              content: finalContentToSave,
              fonada_message_id: body.msgId || null,
              status: 'received'
          });

          await supabase
            .from("leads")
            .update({ 
                last_message_at: new Date().toISOString(),
                last_message_content: isMedia ? `📁 Document Received` : messageText.substring(0, 100),
                last_message_type: 'inbound' 
            })
            .eq("id", lead.id);

          await supabase.rpc('increment_unread_count', { row_id: lead.id });
      } else {
          console.log("⚠️ [NO LEAD MATCH] Message received, but no matching lead found.");
      }

      // 6. SMART AUTO-REPLY LOGIC
      if (!isMedia) {
          const textLower = messageText.toLowerCase();

           // 🔴 NEW: THE "LIE-DETECTOR" RESCUE LOGIC
          if (textLower === "i am still interested" || textLower.includes("still interested")) {
              console.log(`🚨 [LIE DETECTOR TRIGGERED] Customer clicked 'Still Interested'! Rescuing lead...`);
              
              const rescueMsg = `Thank you for confirming! We apologize for the confusion. A senior executive has been notified and will contact you immediately to assist with your loan.`;
              // 🔴 MULTI-TENANT: Pass credentials to the auto-responder
              await sendFonadaMessage(customerPhone, rescueMsg, fonadaUser, fonadaPass, fonadaWaba, lead?.id);
              
              const currentNotes = lead?.notes || "";
              const auditWarning = `🚨 [SYSTEM ALERT: AGENT AUDIT FAILED]\nPrevious agent marked this lead as Not Interested. The system pinged the customer, and the customer clicked "I AM STILL INTERESTED". Lead has been stripped from previous agent and reset to New.`;
              
              await supabase.from("leads").update({
                  status: "new",
                  assigned_to: null, 
                  notes: `${currentNotes}\n\n${auditWarning}`,
                  last_contacted: new Date().toISOString() 
              }).eq("id", lead?.id);

              return NextResponse.json({ status: "success", action: "lead_rescued" });
          }

        
          const isPersonalLoan = textLower.includes("personal loan") || textLower.includes("apply") || textLower.includes("documents are required");
          const isSpeakToAgent = textLower.includes("speak with an agent") || textLower.includes("speak to an agent");
          const isHelp = textLower.includes("help");
          const isComplete = textLower.includes("complete"); 
          const isInterested = ["interested", "intrested", "yes", "plan", "details", "call me"].some(k => textLower.includes(k));

          if (isPersonalLoan) {
            const plMessage = `Thank you for your interest in a Personal Loan. To proceed with your application, please share the following documents:\n\n✅ *Aadhar Card*\n✅ *PAN Card*\n✅ *One month's payslip*\n\nYou can upload them here or reply to this message with the attachments. We'll begin the verification process right away.`;
            await sendFonadaMessage(customerPhone, plMessage, fonadaUser, fonadaPass, fonadaWaba, lead?.id);
            return NextResponse.json({ status: "success", action: "pl_bot_reply_sent" });
          }

          if (isSpeakToAgent) {
            if (lead?.assigned_to) {
              const { data: agent } = await supabase.from("users").select("full_name, phone").eq("id", lead.assigned_to).maybeSingle();
              if (agent && agent.phone) {
                const agentMsg = `Hello! I understand you would like to speak with an agent.\n\nOur expert *${agent.full_name}* is assigned to your application. You can reach them directly at: *${agent.phone}*\n\nThey have been notified and will also contact you shortly.`;
                await sendFonadaMessage(customerPhone, agentMsg, fonadaUser, fonadaPass, fonadaWaba, lead.id);
                return NextResponse.json({ status: "success", action: "speak_agent_reply_sent" });
              }
            }
            const fallbackAgentMsg = `Hello! I understand you would like to speak with an agent. Our team has been notified and a representative will call you shortly.`;
            await sendFonadaMessage(customerPhone, fallbackAgentMsg, fonadaUser, fonadaPass, fonadaWaba, lead?.id);
            return NextResponse.json({ status: "success", action: "speak_agent_fallback_sent" });
          }

          if (isHelp || isComplete || isInterested) {
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
                await sendFonadaMessage(customerPhone, replyMessage, fonadaUser, fonadaPass, fonadaWaba, lead.id);
                return NextResponse.json({ status: "success", action: "agent_reply_sent" });
              }
            } 
            const genericReply = isOfficeHours ? `${introMsg} Our team will contact you shortly.` : `${introMsg} Our team is currently offline but will contact you tomorrow morning.`;
            await sendFonadaMessage(customerPhone, genericReply, fonadaUser, fonadaPass, fonadaWaba, lead?.id);
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
      
      if (msgId && (status === 'delivered' || status === 'read')) {
          await supabase.from('chat_messages').update({ status: status }).eq('fonada_message_id', msgId);
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
// 🔴 MULTI-TENANT: Accepts dynamic credentials from the main webhook handler
async function sendFonadaMessage(mobile: string, text: string, userId: string, pass: string, waba: string, leadId?: string) {
  const apiUrl = "https://waba.fonada.com/api/SendMsgOld"; 
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  const formData = new FormData();
  formData.append("userid", userId);
  formData.append("password", pass);
  formData.append("wabaNumber", waba);
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
