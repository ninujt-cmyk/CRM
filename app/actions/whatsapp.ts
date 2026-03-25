"use server"

import { createClient } from "@/lib/supabase/server";

// ============================================================================
// 🟢 HELPER: FETCH DYNAMIC TENANT WA CREDENTIALS
// ============================================================================
async function getWaCredentials() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from('users').select('tenant_id, full_name, phone').eq('id', user.id).single();
    if (!profile?.tenant_id) throw new Error("Tenant ID not found");

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: settings } = await supabaseAdmin.from('tenant_settings')
        .select('wa_userid, wa_password, wa_waba_number')
        .eq('tenant_id', profile.tenant_id).single();

    if (!settings?.wa_userid || !settings?.wa_password || !settings?.wa_waba_number) {
        throw new Error("WhatsApp credentials not configured for this workspace.");
    }

    return { 
        supabase, supabaseAdmin, agent: profile, tenantId: profile.tenant_id,
        waUser: settings.wa_userid, waPass: settings.wa_password, waNum: settings.wa_waba_number 
    };
}

// ============================================================================
// 1. SEND NORMAL TEXT MESSAGE
// ============================================================================
export async function sendWhatsAppText(leadId: string, customerPhone: string, text: string) {
  try {
    const { supabase, waUser, waPass, waNum } = await getWaCredentials();

    const formData = new FormData();
    formData.append("userid", waUser);
    formData.append("password", waPass);
    formData.append("wabaNumber", waNum);
    
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    formData.append("msg", text);
    formData.append("msgType", "text");
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch("https://waba.fonada.com/api/SendMsgOld", { method: "POST", body: formData });
    const data = await res.json();

    if (data.status === "error" || data.error) throw new Error(data.message || data.error || "Fonada API Error");

    await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone, direction: 'outbound',
        message_type: 'text', content: text, fonada_message_id: data.msgId || null, status: 'sent'
    });

    await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId);
    return { success: true };
  } catch (error: any) {
    console.error("WA Text Send Error:", error);
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 2. SEND MISSED CALL TEMPLATE
// ============================================================================
export async function sendMissedCallMessage(leadId: string, customerPhone: string) {
  try {
    const { supabase, agent, waUser, waPass, waNum } = await getWaCredentials();

    const textMessage = `Hello! 👋\n\nOur expert *${agent.full_name}* just tried calling you but couldn't get through. \n\nWe want to ensure your application process is smooth. When is a good time for us to call you back? You can also reach directly at *${agent.phone}*.\nThank you. 3`;

    const formData = new FormData();
    formData.append("userid", waUser);
    formData.append("password", waPass);
    formData.append("wabaNumber", waNum);
    
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    formData.append("msg", textMessage);
    formData.append("msgType", "text");
    formData.append("templateName", "agent_callback_request"); 
    formData.append("sendMethod", "quick");
    formData.append("output", "json");
    formData.append("buttonsPayload", JSON.stringify({ button1: "Call in 1 Hour", button2: "Call in 2 Hours", button3: "Call me after 5 PM" }));

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch("https://waba.fonada.com/api/SendMsgOld", { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.status === "error" || data.error) throw new Error(data.message || data.error || "Fonada API Error");

    await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone, direction: 'outbound',
        message_type: 'template', content: textMessage, fonada_message_id: data.msgId || null, status: 'sent'
    });

    await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 3. SEND AUTOMATED KYC DOCUMENT REQUEST
// ============================================================================
export async function sendKYCRequestTemplate(leadId: string, customerPhone: string, isReminder: boolean = false) {
  try {
    const { supabaseAdmin, waUser, waPass, waNum } = await getWaCredentials();
    const textMessage = `Hello,\n\nThis is an update regarding your loan application. Your application is currently pending.\n\nPlease share clear photos or PDFs of your Aadhar Card, PAN Card, and latest Bank Statement by replying directly to this chat.\n\nThank you.`;

    const formData = new FormData();
    formData.append("userid", waUser);
    formData.append("password", waPass);
    formData.append("wabaNumber", waNum);
    
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    formData.append("msg", textMessage);
    formData.append("msgType", "text");
    formData.append("templateName", "kyc_document_request"); 
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch("https://waba.fonada.com/api/SendMsgOld", { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.status === "error" || data.error) throw new Error(data.message || data.error || "Fonada API Error");

    await supabaseAdmin.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone, direction: 'outbound',
        message_type: 'template', content: textMessage, fonada_message_id: data.msgId || null, status: 'sent'
    });

    const updatePayload: any = { last_message_at: new Date().toISOString(), last_message_content: isReminder ? "Sent 24h KYC Reminder" : "Sent Initial KYC Request", last_message_type: 'outbound' };
    if (isReminder) updatePayload.kyc_reminder_sent = true; 
    else { updatePayload.kyc_requested_at = new Date().toISOString(); updatePayload.kyc_reminder_sent = false; }

    await supabaseAdmin.from("leads").update(updatePayload).eq("id", leadId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============================================================================
// 4. SEND "NOT INTERESTED" AUDIT 
// ============================================================================
export async function sendNotInterestedAudit(leadId: string, customerPhone: string, customerName: string) {
  try {
    const { supabase, waUser, waPass, waNum } = await getWaCredentials();

    const textMessage = `Hi ${customerName}, our agent noted that you are no longer interested in a loan at this time.\n\nTo help us improve our service, could you let us know why by tapping a button below?\n\n🔘 Rate is too high\n🔘 Got another loan\n🔘 I am still interested`;

    const formData = new FormData();
    formData.append("userid", waUser);
    formData.append("password", waPass);
    formData.append("wabaNumber", waNum);
    
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    formData.append("msg", textMessage);
    formData.append("msgType", "text");
    formData.append("templateName", "not_interested_audit"); 
    formData.append("sendMethod", "quick");
    formData.append("output", "json");
    formData.append("buttonsPayload", JSON.stringify({ button1: "Rate is too high", button2: "Got another loan", button3: "I am still interested" }));

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    const res = await fetch("https://waba.fonada.com/api/SendMsgOld", { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.status === "error" || data.error) throw new Error(data.message || data.error || "Fonada API Rejected Template");

    await supabase.from("chat_messages").insert({
        lead_id: leadId, phone_number: safePhone, direction: 'outbound',
        message_type: 'template', content: textMessage, fonada_message_id: data.msgId || null, status: 'sent'
    });

    await supabase.from("leads").update({ 
        last_message_at: new Date().toISOString(), last_message_content: "Sent QA Audit Template", last_message_type: 'outbound'
    }).eq("id", leadId);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
