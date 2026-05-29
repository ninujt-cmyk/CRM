// app/actions/whatsapp.ts
"use server"

import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

// Helper to fetch tenant settings securely
async function getTenantWaCredentials(tenantId: string | null) {
  let fonadaUser = process.env.FONADA_USERID || "bankscart";
  let fonadaPass = process.env.FONADA_PASSWORD || "zfsWTyKw";
  let fonadaWaba = process.env.FONADA_WABA_NUMBER || "918217354172";
  let whatsappApiKey = process.env.FONADA_WHATSAPP_BEARER_TOKEN || "fsk_fa674b9a167787e48b2b29f48939a4570fe02efc1a4ec012c9f60bacc76bc250";

  if (tenantId) {
    const supabaseAdmin = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: settings } = await supabaseAdmin
      .from('tenant_settings')
      .select('fonada_userid, fonada_password, fonada_waba_number, whatsapp_api_key')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    
    if (settings?.fonada_userid) fonadaUser = settings.fonada_userid;
    if (settings?.fonada_password) fonadaPass = settings.fonada_password;
    if (settings?.fonada_waba_number) fonadaWaba = settings.fonada_waba_number;
    if (settings?.whatsapp_api_key) whatsappApiKey = settings.whatsapp_api_key;
  }
  return { fonadaUser, fonadaPass, fonadaWaba, whatsappApiKey };
}

// ============================================================================
// 1. SEND NORMAL TEXT MESSAGE (Used in your new Chat UI)
// ============================================================================
export async function sendWhatsAppText(leadId: string, customerPhone: string, text: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    const creds = await getTenantWaCredentials(profile?.tenant_id || null);

    const apiUrl = "https://waba.fonada.com/api/SendMsgOld";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", creds.fonadaUser);
    formData.append("password", creds.fonadaPass);
    formData.append("wabaNumber", creds.fonadaWaba);

    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    
    formData.append("msg", text);
    formData.append("msgType", "text");
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    const res = await fetch(apiUrl, { method: "POST", body: formData });
    const data = await res.json();

    if (data.status === "error" || data.error) throw new Error(data.message || data.error || "Fonada API Error");

    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone, direction: 'outbound',
        message_type: 'text', content: text, fonada_message_id: data.msgId || null, status: 'sent'
    });

    if (insertError) throw new Error(`Database Insert Failed: ${insertError.message}`);

    await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId);
    return { success: true };
  } catch (error: any) {
    console.error("WA Text Send Error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 2. SEND MISSED CALL TEMPLATE (With Interactive Buttons)
// ============================================================================
export async function sendMissedCallMessage(leadId: string, customerPhone: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: agent, error } = await supabase.from('users').select('full_name, phone, tenant_id').eq('id', user.id).single();
    if (error || !agent) throw new Error("Could not fetch agent details");

    const creds = await getTenantWaCredentials(agent.tenant_id);

    const textMessage = `Hello! 👋\n\nOur expert *${agent.full_name}* just tried calling you but couldn't get through. \n\nWe want to ensure your application process is smooth. When is a good time for us to call you back? You can also reach directly at *${agent.phone}*.\nThank you.`;

    const apiUrl = "https://app.fonada.ai/functions/v1/whatsapp_campaign_creator";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    let safePhone10 = customerPhone.replace(/^\+?91/, '').replace(/\D/g, '').slice(-10);

    const payload = {
      campaign_name: "agent_callback_request",
      template_name: "agent_callback_request",
      audience_rows: [
        {
          Phone: safePhone10,
          Body_1: agent.full_name,
          Body_2: agent.phone || ""
        }
      ]
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creds.whatsappApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || data.error || "Fonada API Error");

    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone10, direction: 'outbound',
        message_type: 'template', content: textMessage, fonada_message_id: data.campaignId || data.msgId || null, status: 'sent'
    });

    if (insertError) throw new Error(`Database Insert Failed: ${insertError.message}`);

    await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId);
    return { success: true };
  } catch (error: any) {
    console.error("Missed Call WA Error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 3. SEND AUTOMATED KYC DOCUMENT REQUEST (Handles Initial & 24h Reminder)
// ============================================================================
export async function sendKYCRequestTemplate(leadId: string, customerPhone: string, isReminder: boolean = false) {
  try {
    const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    
    // Fetch lead to know which tenant is sending this
    const { data: lead } = await supabase.from('leads').select('tenant_id').eq('id', leadId).single();
    const creds = await getTenantWaCredentials(lead?.tenant_id || null);

    const textMessage = `Hello,\n\nThis is an update regarding your loan application. Your application is currently pending.\n\nPlease share clear photos or PDFs of your Aadhar Card, PAN Card, and latest Bank Statement by replying directly to this chat.\n\nThank you.`;

    const apiUrl = "https://app.fonada.ai/functions/v1/whatsapp_campaign_creator";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    let safePhone10 = customerPhone.replace(/^\+?91/, '').replace(/\D/g, '').slice(-10);

    const payload = {
      campaign_name: "kyc_document_request",
      template_name: "kyc_document_request",
      audience_rows: [
        {
          Phone: safePhone10
        }
      ]
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creds.whatsappApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.message || data.error || "Fonada API Error");

    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone10, direction: 'outbound',
        message_type: 'template', content: textMessage, fonada_message_id: data.campaignId || data.msgId || null, status: 'sent'
    });

    if (insertError) throw new Error(`Database Insert Failed: ${insertError.message}`);

    const updatePayload: any = { last_message_at: new Date().toISOString(), last_message_content: isReminder ? "Sent 24h KYC Reminder" : "Sent Initial KYC Request", last_message_type: 'outbound' };
    if (isReminder) updatePayload.kyc_reminder_sent = true; 
    else { updatePayload.kyc_requested_at = new Date().toISOString(); updatePayload.kyc_reminder_sent = false; }

    await supabase.from("leads").update(updatePayload).eq("id", leadId);
    return { success: true };
  } catch (error: any) {
    console.error("KYC Request WA Error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 4. SEND "NOT INTERESTED" AUDIT (The Lie-Detector)
// ============================================================================
export async function sendNotInterestedAudit(leadId: string, customerPhone: string, customerName: string) {
  console.log(`🚀 [SERVER ACTION] Triggering QA Audit for Lead: ${leadId} | Phone: ${customerPhone}`);
  
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.error("❌ [QA AUDIT ERROR] No active user session.");
        throw new Error("Unauthorized");
    }

    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    const creds = await getTenantWaCredentials(profile?.tenant_id || null);

    const textMessage = `Hi ${customerName}, our agent noted that you are no longer interested in a loan at this time.\n\nTo help us improve our service, could you let us know why by tapping a button below?\n\n🔘 Rate is too high\n🔘 Got another loan\n🔘 I am still interested`;

    const apiUrl = "https://app.fonada.ai/functions/v1/whatsapp_campaign_creator";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    let safePhone10 = customerPhone.replace(/^\+?91/, '').replace(/\D/g, '').slice(-10);

    const payload = {
      campaign_name: "not_interested_audit",
      template_name: "not_interested_audit",
      audience_rows: [
        {
          Phone: safePhone10,
          Body_1: customerName
        }
      ]
    };

    console.log(`📡 [QA AUDIT] Sending payload to Fonada API...`);
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creds.whatsappApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log(`📤 [FONADA QA RESPONSE]:`, data);

    if (!res.ok || data.error) throw new Error(data.message || data.error || "Fonada API Rejected Template");

    await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone10, direction: 'outbound',
        message_type: 'template', content: textMessage, fonada_message_id: data.campaignId || data.msgId || null, status: 'sent'
    });

    await supabase.from("leads").update({ 
        last_message_at: new Date().toISOString(),
        last_message_content: "Sent QA Audit Template",
        last_message_type: 'outbound'
    }).eq("id", leadId);

    console.log(`✅ [QA AUDIT SUCCESS] Template sent!`);
    return { success: true };

  } catch (error: any) {
    console.error("❌ [QA Audit WA Error]:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 5. SEND CALLBACK REMINDER (Automated Pre-Call Alert)
// ============================================================================
export async function sendCallbackReminderTemplate(leadId: string, customerPhone: string, customerName: string, agentName: string, timeString: string) {
  try {
    const supabase = await createClient();
    
    // Fetch lead to know which tenant is sending this
    const { data: lead } = await supabase.from('leads').select('tenant_id').eq('id', leadId).single();
    const creds = await getTenantWaCredentials(lead?.tenant_id || null);

    const textMessage = `Hello ${customerName}, this is a reminder for your scheduled call with our loan advisor ${agentName} at ${timeString}. We will call you shortly. Thank you!`;

    const apiUrl = "https://app.fonada.ai/functions/v1/whatsapp_campaign_creator";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    let safePhone10 = customerPhone.replace(/^\+?91/, '').replace(/\D/g, '').slice(-10);

    const payload = {
      campaign_name: "callback_reminder",
      template_name: "callback_reminder",
      audience_rows: [
        {
          Phone: safePhone10,
          Body_1: customerName,
          Body_2: agentName,
          Body_3: timeString
        }
      ]
    };

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${creds.whatsappApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      // Fallback to sending standard WA text in case template is not pre-registered in Fonada
      await sendWhatsAppText(leadId, customerPhone, textMessage);
      return { success: true, method: "text_fallback" };
    }

    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone10, direction: 'outbound',
        message_type: 'template', content: textMessage, fonada_message_id: data.campaignId || data.msgId || null, status: 'sent'
    });

    if (insertError) throw new Error(`Database Insert Failed: ${insertError.message}`);

    await supabase.from("leads").update({ 
        last_message_at: new Date().toISOString(),
        last_message_content: `Sent Callback Reminder for ${timeString}`,
        last_message_type: 'outbound'
    }).eq("id", leadId);

    return { success: true, method: "template" };
  } catch (error: any) {
    console.error("Callback Reminder WA Error:", error);
    return { success: false, error: error.message };
  }
}

