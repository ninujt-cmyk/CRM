"use server"

import { createClient } from "@/lib/supabase/server";

export async function sendMissedCallTemplate(customerPhone: string) {
  try {
    const supabase = await createClient();
    
    // 1. Get the currently logged-in telecaller
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Fetch Telecaller's details for the {{1}} and {{2}} variables
    const { data: agent, error } = await supabase
      .from('users')
      .select('full_name, phone')
      .eq('id', user.id)
      .single();

    if (error || !agent) throw new Error("Could not fetch agent details");

    // 3. Construct the EXACT approved template message
    // Note: The text must match the approved template in Meta EXACTLY (including spaces and line breaks)
    const exactMessageText = `Hello! 👋\n\nOur expert *${agent.full_name}* just tried calling you but couldn't get through. \n\nWe want to ensure your application process is smooth. When is a good time for us to call you back? You can also reach directly at *${agent.phone}*.\nThank you.`;

    // 4. Send via Fonada
    const apiUrl = "https://waba.fonada.com/api/SendMsgOld";
    
    // Bypass Node.js strict SSL Verification for Fonada
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    formData.append("wabaNumber", process.env.FONADA_WABA_NUMBER || "918217354172");
    
    // Ensure phone number has country code but no '+'
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    
    // Pass the message, type, and importantly, the templateName
    formData.append("msg", exactMessageText);
    formData.append("msgType", "text");
    formData.append("templateName", "agent_callback_request"); // <-- Your template name
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    const res = await fetch(apiUrl, {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    console.log("Fonada Missed Call Response:", data);
    
    // Fonada usually returns success: true/false or a specific status string
    if (data.status === "error" || data.error) {
        throw new Error(data.message || "Fonada API Error");
    }

    return { success: true };

  } catch (error: any) {
    console.error("Missed Call WA Error:", error);
    return { success: false, error: error.message };
  }
}
