"use server"

import { createClient } from "@/lib/supabase/server";

export async function sendMissedCallMessage(customerPhone: string) {
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

    // 3. Construct the Message
    const textMessage = `Hi, our representative *${agent.full_name}* tried calling you regarding your inquiry but couldn't reach you.\n\nPlease let us know a suitable time to call you back, or you can reach them directly at: ${agent.phone}`;

    // 4. Send via Fonada
    const apiUrl = "https://waba.fonada.com/api/SendMsgOld";
    
    // Bypass Node.js strict SSL Verification (same as our webhook fix)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    formData.append("wabaNumber", process.env.FONADA_WABA_NUMBER || "918217354172");
    
    // Ensure phone number has country code but no '+'
    let safePhone = customerPhone.replace(/^\+/, '');
    if (safePhone.length === 10) safePhone = `91${safePhone}`;
    formData.append("mobile", safePhone); 
    
    formData.append("msg", textMessage);
    formData.append("msgType", "text");
    formData.append("sendMethod", "quick");
    formData.append("output", "json");

    const res = await fetch(apiUrl, {
      method: "POST",
      body: formData
    });
    
    const data = await res.json();
    console.log("Fonada Missed Call Response:", data);
    
    if (data.status === "error") {
        throw new Error(data.message || "Fonada API Error");
    }

    return { success: true };

  } catch (error: any) {
    console.error("Missed Call WA Error:", error);
    return { success: false, error: error.message };
  }
}
