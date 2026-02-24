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
    // ⚠️ NOTE: Replace 'apiUrl' with your exact Fonada OBD/C2C API endpoint
    const apiUrl = "http://192.168.1.16:7992/fonada_c2c_api.php"; 
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const formData = new FormData();
    formData.append("userid", process.env.FONADA_USERID || "bankscart");
    formData.append("password", process.env.FONADA_PASSWORD || "zfsWTyKw");
    
    // Ensure 10-digit format for both legs
    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '');
    if (safeCustomerPhone.length > 10) safeCustomerPhone = safeCustomerPhone.slice(-10);
    
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '');
    if (safeAgentPhone.length > 10) safeAgentPhone = safeAgentPhone.slice(-10);

    // Fonada C2C Parameters (Agent Leg & Customer Leg)
    formData.append("agent_number", safeAgentPhone); 
    formData.append("destination_number", safeCustomerPhone);
    // formData.append("caller_id", "YOUR_OBD_CLI_NUMBER"); // Uncomment if Fonada requires a specific CLI

    // 4. Trigger the Call
    const res = await fetch(apiUrl, { method: "POST", body: formData });
    
    // NOTE: Depending on Fonada's C2C response, you might need to parse as text instead of JSON if they return a raw string.
    const rawText = await res.text();
    console.log("📞 [C2C API Response]:", rawText);

    // 5. Log the call attempt in the CRM
    await supabase.from("leads").update({ 
        status: "Contacted", // Auto-move from New to Contacted
        last_contacted: new Date().toISOString() 
    }).eq("id", leadId);

    // We also set the agent's state to 'on_call' automatically!
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
