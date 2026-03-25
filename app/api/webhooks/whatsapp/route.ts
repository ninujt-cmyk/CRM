// app/api/webhooks/whatsapp/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  console.log("🔔 [WA WEBHOOK HIT] Received POST request");

  try {
    const searchParams = request.nextUrl.searchParams;
    const updateType = searchParams.get("type"); 
    
    // 🔴 1. THE MULTI-TENANT KEY: Extract the Tenant ID from the URL
    const tenantId = searchParams.get("tenant_id");

    if (!tenantId) {
        console.error("🚨 [SECURITY WARNING] WhatsApp Webhook received without a tenant_id in the URL.");
        return NextResponse.json({ status: "ignored", reason: "missing_tenant_id" });
    }

    const rawBody = await request.text();
    let body: any = {};
    if (rawBody) {
      try { body = JSON.parse(rawBody); } 
      catch(e) { body = Object.fromEntries(new URLSearchParams(rawBody)); }
    }

    // 🔴 2. FETCH THIS SPECIFIC COMPANY'S CREDENTIALS
    let fonadaUser = process.env.FONADA_USERID || "bankscart";
    let fonadaPass = process.env.FONADA_PASSWORD || "zfsWTyKw";
    let fonadaWaba = process.env.FONADA_WABA_NUMBER || "918217354172";

    const { data: settings } = await supabase.from('tenant_settings').select('*').eq('tenant_id', tenantId).maybeSingle();
    if (settings?.fonada_userid) fonadaUser = settings.fonada_userid;
    if (settings?.fonada_password) fonadaPass = settings.fonada_password;
    if (settings?.fonada_waba_number) fonadaWaba = settings.fonada_waba_number;


    // =================================================================================
    // CASE 1: HANDLE "MO" (Mobile Originated / Customer Reply)
    // =================================================================================
    if (updateType === 'mo') {
      
      let customerPhone = body.mobile || body.sender || body.from || body?.message?.from;
      let messageText = body.text || body.msg || body.caption || body?.message?.text?.body || body?.message?.document?.caption || body?.message?.image?.caption || "";
      let mediaUrl = body.imageUrl || body.documentUrl || body.videoUrl || body.mediaUrl || body.media_url || body.MediaUrl0 || body.url || body.fileUrl || body?.message?.document?.link || body?.message?.image?.link || "";
      
      let isMedia = !!mediaUrl;
      if (typeof messageText !== 'string') messageText = JSON.stringify(messageText);
      if (isMedia && !messageText) messageText = "📎 [Media Attachment]";
      if (!customerPhone || !messageText) return NextResponse.json({ status: "ignored", reason: "no_data" });

      let dbPhone = customerPhone.replace(/^\+?91/, '');
      if (dbPhone.length > 10) dbPhone = dbPhone.slice(-10);

      // 🔴 3. STRICT ISOLATION: Find the lead ONLY within this specific company
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, assigned_to, notes")
        .eq("tenant_id", tenantId) // SECURE LOOKUP
        .ilike("phone", `%${dbPhone}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (leadError) console.error("❌ [DB ERROR] Finding lead:", leadError);

      let finalContentToSave = messageText; 

      // --- 4. SECURE MEDIA DOWNLOAD USING COMPANY CREDENTIALS ---
      if (isMedia && lead) {
          try {
              const authString = Buffer.from(`${fonadaUser}:${fonadaPass}`).toString('base64');
              const fetchHeaders = {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                  'Accept': '*/*',
                  'Authorization': `Basic ${authString}`
              };

              let mediaRes = await fetch(mediaUrl, { headers: fetchHeaders });
              let contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';

              if (contentType.includes('text/html')) {
                  const htmlContent = await mediaRes.text();
                  const urlsInHtml = htmlContent.match(/https?:\/\/[^"'\s<>]+/g) || [];
                  let rawUrl = urlsInHtml.find(u => u !== mediaUrl && (u.toLowerCase().includes('.pdf') || u.includes('download') || u.includes('view-media') || u.includes('media_id')));

                  if (!rawUrl && mediaUrl.includes('view-mediaMeta')) rawUrl = mediaUrl.replace('view-mediaMeta', 'view-media');

                  if (rawUrl) {
                      if (rawUrl.includes(new URL(mediaUrl).hostname) && !rawUrl.includes('userid=')) {
                          const joinChar = rawUrl.includes('?') ? '&' : '?';
                          rawUrl = `${rawUrl}${joinChar}userid=${fonadaUser}&password=${fonadaPass}`;
                      }
                      mediaRes = await fetch(rawUrl, { headers: fetchHeaders });
                      contentType = mediaRes.headers.get('content-type') || '';
                  }
              }

              if (contentType.includes('text/html')) {
                  finalContentToSave = `📁 *Document Link Received:*\n${mediaUrl}`;
              } else {
                  const arrayBuffer = await mediaRes.arrayBuffer();
                  let ext = 'bin';
                  
                  const originalName = body.documentName || body.fileName || body?.message?.document?.filename || "";
                  if (originalName && originalName.includes('.')) ext = originalName.split('.').pop() || 'bin';
                  else if (mediaUrl.includes('.')) {
                      const urlMatch = mediaUrl.match(/\.([a-zA-Z0-9]+)(?:&|$)/);
                      if (urlMatch) ext = urlMatch[1];
                  }
                  
                  if (ext === 'bin' || ext.length > 4) {
                      const mime = contentType.toLowerCase();
                      if (mime.includes('pdf')) ext = 'pdf';
                      else if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
                      else if (mime.includes('png')) ext = 'png';
                      else ext = mime.split('/')[1]?.split(';')[0] || 'bin';
                  }
                  ext = ext.toLowerCase().replace(/[^a-z0-9]/g, '');

                  let finalUploadType = contentType;
                  if (ext === 'pdf') finalUploadType = 'application/pdf';
                  if (ext === 'jpg' || ext === 'jpeg') finalUploadType = 'image/jpeg';
                  if (ext === 'png') finalUploadType = 'image/png';

                  // 🔴 SECURE STORAGE PATH: organized by tenant_id
                  const fileName = `${tenantId}/${lead.id}/kyc_${Date.now()}.${ext}`;

                  const { error: uploadError } = await supabase.storage
                      .from('kyc_documents')
                      .upload(fileName, arrayBuffer, { contentType: finalUploadType, upsert: true });

                  if (uploadError) throw uploadError;

                  const publicUrlData = supabase.storage.from('kyc_documents').getPublicUrl(fileName);
                  finalContentToSave = `📁 *Document Uploaded:*\n${publicUrlData.data.publicUrl}`;
              }
          } catch (err: any) {
              console.error("❌ [STORAGE ERROR] Failed to process media:", err);
              finalContentToSave = `📁 *Document Link Received:*\n${mediaUrl}`;
          }
      }

      // 5. SAVE INCOMING MESSAGE
      if (lead) {
          await supabase.from("chat_messages").insert({
              tenant_id: tenantId, // 🔴 Force association to this company
              lead_id: lead.id,
              phone_number: customerPhone,
              direction: 'inbound',
              message_type: isMedia ? 'document' : 'text',
              content: finalContentToSave,
              fonada_message_id: body.msgId || null,
              status: 'received'
          });

          await supabase.from("leads").update({ 
                last_message_at: new Date().toISOString(),
                last_message_content: isMedia ? `📁 Document Received` : messageText.substring(0, 100),
                last_message_type: 'inbound' 
          }).eq("id", lead.id);

          await supabase.rpc('increment_unread_count', { row_id: lead.id });
      }

      // 6. SMART AUTO-REPLY LOGIC (Using Company specific credentials)
      if (!isMedia && lead) {
          const textLower = messageText.toLowerCase();

          // LIE-DETECTOR LOGIC
          if (textLower === "i am still interested" || textLower.includes("still interested")) {
              const rescueMsg = `Thank you for confirming! We apologize for the confusion. A senior executive has been notified and will contact you immediately.`;
              await sendFonadaMessage(customerPhone, rescueMsg, fonadaUser, fonadaPass, fonadaWaba, lead.id, tenantId);
              
              const currentNotes = lead.notes || "";
              await supabase.from("leads").update({
                  status: "new", assigned_to: null, 
                  notes: `${currentNotes}\n\n🚨 [SYSTEM ALERT] Customer clicked "I AM STILL INTERESTED". Lead stripped from agent.`,
                  last_contacted: new Date().toISOString() 
              }).eq("id", lead.id);
              return NextResponse.json({ status: "success", action: "lead_rescued" });
          }
        
          const isPersonalLoan = textLower.includes("personal loan") || textLower.includes("apply");
          const isSpeakToAgent = textLower.includes("speak with an agent") || textLower.includes("speak to an agent");
          const isHelp = textLower.includes("help") || textLower.includes("complete") || textLower.includes("interested");

          if (isPersonalLoan) {
            const plMessage = `Thank you for your interest. Please share the following documents:\n✅ *Aadhar Card*\n✅ *PAN Card*\n✅ *One month's payslip*\n\nYou can upload them here.`;
            await sendFonadaMessage(customerPhone, plMessage, fonadaUser, fonadaPass, fonadaWaba, lead.id, tenantId);
            return NextResponse.json({ status: "success", action: "pl_bot_reply" });
          }

          if (isSpeakToAgent || isHelp) {
            if (lead.assigned_to) {
              const { data: agent } = await supabase.from("users").select("full_name, phone").eq("id", lead.assigned_to).maybeSingle();
              if (agent && agent.phone) {
                const agentMsg = `Our representative *${agent.full_name}* has been assigned to your application.\n\nYou can reach them directly at: *${agent.phone}*`;
                await sendFonadaMessage(customerPhone, agentMsg, fonadaUser, fonadaPass, fonadaWaba, lead.id, tenantId);
                return NextResponse.json({ status: "success", action: "agent_reply_sent" });
              }
            }
            const fallbackMsg = `Our team has been notified and a representative will call you shortly.`;
            await sendFonadaMessage(customerPhone, fallbackMsg, fonadaUser, fonadaPass, fonadaWaba, lead.id, tenantId);
            return NextResponse.json({ status: "success", action: "fallback_sent" });
          }
      }
      return NextResponse.json({ status: "success" });
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
      return NextResponse.json({ status: "success" });
    }

    return NextResponse.json({ status: "error", message: "Unknown type" }, { status: 400 });

  } catch (error) {
    console.error("🔥 [CRITICAL ERROR] Webhook failed:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
  }
}

// =================================================================================
// HELPER: Send Message via Fonada & Save to DB
// =================================================================================
async function sendFonadaMessage(mobile: string, text: string, userId: string, pass: string, waba: string, leadId: string, tenantId: string) {
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

    if (data.status !== "error") {
        await supabase.from("chat_messages").insert({
            tenant_id: tenantId, // 🔴 Ensure outbound auto-replies belong to the tenant
            lead_id: leadId,
            phone_number: mobile,
            direction: 'outbound',
            message_type: 'text',
            content: text,
            fonada_message_id: data.msgId || null,
            status: 'sent'
        });
    }
  } catch (e) {
    console.error("❌ [FONADA ERROR] Failed to send reply:", e);
  }
}
