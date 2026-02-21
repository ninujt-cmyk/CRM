"use server"

import { createClient } from "@/lib/supabase/server";

// ============================================================================
// 1. SEND NORMAL TEXT MESSAGE (Used in your new Chat UI)
// ============================================================================
export async function sendWhatsAppText(leadId: string, customerPhone: string, text: string) {
  try {
    const supabase = await createClient();
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const apiUrl = "https://waba.fonada.com/api/SendMsgOld";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    formData.append("wabaNumber", process.env.FONADA_WABA_NUMBER || "918217354172");

    // Clean phone number format
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    
    formData.append("msg", text);
    formData.append("msgType", "text");
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    const res = await fetch(apiUrl, { method: "POST", body: formData });
    const data = await res.json();

    if (data.status === "error" || data.error) {
        throw new Error(data.message || data.error || "Fonada API Error");
    }

    // Save outbound message to DB History
    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId,
        phone_number: safePhone, 
        direction: 'outbound',
        message_type: 'text',
        content: text,
        fonada_message_id: data.msgId || null, 
        status: 'sent'
    });

    // 🔴 UPDATED: Throw error if DB insert fails so UI knows about it
    if (insertError) {
        console.error("❌ [DB ERROR] Saving text:", insertError);
        throw new Error(`Database Insert Failed: ${insertError.message}`);
    }

    // Bump lead to top of list
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
    
    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Fetch Telecaller's details for the template variables
    const { data: agent, error } = await supabase
      .from('users')
      .select('full_name, phone')
      .eq('id', user.id)
      .single();

    if (error || !agent) throw new Error("Could not fetch agent details");

    // Construct the EXACT Template Message
    const textMessage = `Hello! 👋\n\nOur expert *${agent.full_name}* just tried calling you but couldn't get through. \n\nWe want to ensure your application process is smooth. When is a good time for us to call you back? You can also reach directly at *${agent.phone}*.\nThank you. 3`;

    const apiUrl = "https://waba.fonada.com/api/SendMsgOld";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    formData.append("wabaNumber", process.env.FONADA_WABA_NUMBER || "918217354172");
    
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    
    formData.append("msg", textMessage);
    formData.append("msgType", "text");
    formData.append("templateName", "agent_callback_request"); 
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    // Add Required Buttons Payload for Template
    const buttonsPayload = JSON.stringify({
      button1: "Call in 1 Hour",
      button2: "Call in 2 Hours",
      button3: "Call me after 5 PM"
    });
    formData.append("buttonsPayload", buttonsPayload);

    const res = await fetch(apiUrl, { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.status === "error" || data.error) {
        throw new Error(data.message || data.error || "Fonada API Error");
    }

    // Save outbound template to DB History
    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId,
        phone_number: safePhone, 
        direction: 'outbound',
        message_type: 'template',
        content: textMessage,
        fonada_message_id: data.msgId || null, 
        status: 'sent'
    });

    // 🔴 UPDATED: Throw error if DB insert fails so UI knows about it
    if (insertError) {
        console.error("❌ [DB ERROR] Saving template:", insertError);
        throw new Error(`Database Insert Failed: ${insertError.message}`);
    }

    // Bump lead to top of list
    await supabase.from("leads").update({ last_message_at: new Date().toISOString() }).eq("id", leadId);

    return { success: true };

  } catch (error: any) {
    console.error("Missed Call WA Error:", error);
    return { success: false, error: error.message };
  }
}


// ============================================================================
// 3. SEND AUTOMATED KYC DOCUMENT REQUEST (Utility Template)
// ============================================================================
export async function sendKYCRequestTemplate(leadId: string, customerPhone: string) {
  try {
    const supabase = await createClient();
    
    // Construct the exact Utility Template you get approved by Meta
    const textMessage = `Hello,\n\nThis is an update regarding your loan application. Your application is currently pending.\n\nPlease share clear photos or PDFs of your Aadhar Card, PAN Card, and latest Bank Statement by replying directly to this chat.\n\nThank you.`;

    const apiUrl = "https://waba.fonada.com/api/SendMsgOld";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    formData.append("wabaNumber", process.env.FONADA_WABA_NUMBER || "918217354172");
    
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    
    formData.append("msg", textMessage);
    formData.append("msgType", "text");
    formData.append("templateName", "kyc_document_request"); // MUST MATCH META EXACTLY
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    const res = await fetch(apiUrl, { method: "POST", body: formData });
    const data = await res.json();
    
    if (data.status === "error" || data.error) {
        throw new Error(data.message || data.error || "Fonada API Error");
    }

    // Save outbound template to DB History
    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId,
        phone_number: safePhone, 
        direction: 'outbound',
        message_type: 'template',
        content: textMessage,
        fonada_message_id: data.msgId || null, 
        status: 'sent'
    });

    if (insertError) throw new Error(`Database Insert Failed: ${insertError.message}`);

    // Update Sidebar Snippet
    await supabase.from("leads").update({ 
        last_message_at: new Date().toISOString(),
        last_message_content: "Sent KYC Request",
        last_message_type: 'outbound'
    }).eq("id", leadId);

    return { success: true };

  } catch (error: any) {
    console.error("KYC Request WA Error:", error);
    return { success: false, error: error.message };
  }
}
