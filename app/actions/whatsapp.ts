"use server"

import { createClient } from "@/lib/supabase/server";

// ⚠️ NOTICE: We added 'leadId' as the first parameter!
export async function sendMissedCallMessage(leadId: string, customerPhone: string) {
  try {
    const supabase = await createClient();
    
    // 1. Get the currently logged-in telecaller
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Fetch Telecaller's details to include in the message
    const { data: agent, error } = await supabase
      .from('users')
      .select('full_name, phone')
      .eq('id', user.id)
      .single();

    if (error || !agent) throw new Error("Could not fetch agent details");

    // 3. Construct the EXACT Template Message
    const textMessage = `Hello! 👋\n\nOur expert *${agent.full_name}* just tried calling you but couldn't get through. \n\nWe want to ensure your application process is smooth. When is a good time for us to call you back? You can also reach directly at *${agent.phone}*.\nThank you. 3`;

    // 4. Send via Fonada
    const apiUrl = "https://waba.fonada.com/api/SendMsgOld";
    
    // Bypass Node.js strict SSL Verification
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    formData.append("wabaNumber", process.env.FONADA_WABA_NUMBER || "918217354172");
    
    // Ensure phone number has country code but no '+'
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    
    // Core Message Details
    formData.append("msg", textMessage);
    formData.append("msgType", "text");
    formData.append("templateName", "agent_callback_request"); 
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    // Buttons Payload for this specific template
    const buttonsPayload = JSON.stringify({
      button1: "Call in 1 Hour",
      button2: "Call in 2 Hours",
      button3: "Call me after 5 PM"
    });
    formData.append("buttonsPayload", buttonsPayload);

    const res = await fetch(apiUrl, {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    console.log("Fonada Template Message Response:", data);
    
    // Throw error if Fonada rejects it
    if (data.status === "error" || data.error) {
        throw new Error(data.message || data.error || "Fonada API Error");
    }

    // --- 5. SAVE TO DATABASE (Merged from File 2) ---
    
    const { error: insertError } = await supabase.from("chat_messages").insert({
        lead_id: leadId,
        phone_number: safePhone, 
        direction: 'outbound',
        message_type: 'template', // Tagged as template for analytics
        content: textMessage,
        fonada_message_id: data.msgId || null, 
        status: 'sent'
    });

    if (insertError) {
        console.error("❌ [DB ERROR] Failed to log outbound message:", insertError);
        // Note: We don't throw an error here because the WA message successfully sent to the customer!
    }

    // --- 6. UPDATE LEAD TIMESTAMP (Merged from File 2) ---
    await supabase
        .from("leads")
        .update({ last_message_at: new Date().toISOString() })
        .eq("id", leadId);

    return { success: true };

  } catch (error: any) {
    console.error("Missed Call WA Error:", error);
    return { success: false, error: error.message };
  }
}
