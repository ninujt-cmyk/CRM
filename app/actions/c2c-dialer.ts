"use server"

import { createClient } from "@/lib/supabase/server";

export async function initiateC2CCall(leadId: string, customerPhone: string) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate the User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Fetch the Agent's Phone Number & Status
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('phone, current_status')
      .eq('id', user.id)
      .single();

    if (agentError || !agent?.phone) {
      throw new Error("Agent phone number not found in profile.");
    }
    
    if (agent.current_status !== 'ready') {
      throw new Error("You must be 'Ready' to make automated calls. Please change your status.");
    }

    // 3. Prepare the Fonada C2C API Payload
    // ⚠️ WARNING: If deployed to the cloud, a 192.168.x.x IP will fail. 
    // You need a public IP or domain for Fonada if this is hosted remotely.
    const apiUrl = "http://192.168.1.16:7992/fonada_c2c_api.php"; 
    
    // NOTE: It is better to handle TLS at the system level, but if you must use this for local dev:
    if (process.env.NODE_ENV === 'development') {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    
    // Ensure 10-digit format for both legs
    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '');
    if (safeCustomerPhone.length > 10) safeCustomerPhone = safeCustomerPhone.slice(-10);
    
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '');
    if (safeAgentPhone.length > 10) safeAgentPhone = safeAgentPhone.slice(-10);

    formData.append("agent_number", safeAgentPhone); 
    formData.append("destination_number", safeCustomerPhone);

    // 4. Trigger the Call WITH A TIMEOUT (Prevents UI Freezing)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    let res;
    try {
      res = await fetch(apiUrl, { 
          method: "POST", 
          body: formData,
          signal: controller.signal // Attaches the timeout
      });
    } catch (fetchError: any) {
      if (fetchError.name === 'AbortError') {
          throw new Error("Call API timed out. The server took too long to respond.");
      }
      throw fetchError;
    } finally {
      clearTimeout(timeoutId); // Clean up the timer
    }
    
    const rawText = await res.text();
    console.log("📞 [C2C API Response]:", rawText);

    // 5. Log the call attempt in the CRM
    await supabase.from("leads").update({ 
        status: "Contacted",
        last_contacted: new Date().toISOString() 
    }).eq("id", leadId);

    // 6. Set agent state to 'on_call'
    await supabase.from("users").update({
        current_status: 'on_call',
        status_updated_at: new Date().toISOString()
    }).eq("id", user.id);

    return { success: true, message: "Call Initiated! Your phone is ringing..." };

  } catch (error: any) {
    console.error("🔥 C2C Error:", error);
    return { success: false, error: error.message };
  }
}
