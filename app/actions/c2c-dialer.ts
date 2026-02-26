"use server"

import { createClient } from "@/lib/supabase/server";

export async function initiateC2CCall(leadId: string, customerPhone: string) {
  try {
    const supabase = await createClient();
    
    // 1. Authenticate the User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Fetch the Agent's Details & Status
    // Added 'full_name' to pass to the new Fonada API
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('full_name, phone, current_status')
      .eq('id', user.id)
      .single();

    if (agentError || !agent?.phone) {
      throw new Error("Agent phone number not found in profile.");
    }
    
    if (agent.current_status !== 'ready') {
      throw new Error("You must be 'Ready' to make automated calls. Please change your status.");
    }

    // Fetch Lead Name for the API
    const { data: lead } = await supabase
      .from('leads')
      .select('name')
      .eq('id', leadId)
      .single();

    // 3. Prepare the New Fonada C2C JSON Payload
    const apiUrl = "https://c2c.ivrobd.com/api/c2c/process"; 
    
    // Ensure 10-digit format for both legs
    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '');
    if (safeCustomerPhone.length > 10) safeCustomerPhone = safeCustomerPhone.slice(-10);
    
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '');
    if (safeAgentPhone.length > 10) safeAgentPhone = safeAgentPhone.slice(-10);

    // Build the exact JSON structure Fonada requested
    // We are matching your successful Postman test perfectly!
    const payload = {
        secretKey: process.env.FONADA_C2C_SECRET || "FLgbnDWAFI06EO0a",
        clientId: process.env.FONADA_C2C_CLIENT_ID || "Help_call_services",
        agentNumber: safeAgentPhone,
        customerNumber: safeCustomerPhone,
        agentName: "", // Keeping this empty like Postman
        customerName: "", // Keeping this empty like Postman
        calledId: "" // 💡 Forcing this empty because the long UUID might be breaking Fonada
    };

    console.log("📤 [C2C PAYLOAD SENDING]:", payload); // Added this so you can verify in the terminal!

    // 4. Trigger the Call WITH A TIMEOUT (Prevents UI Freezing)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10-second timeout

    let res;
    try {
      res = await fetch(apiUrl, { 
          method: "POST", 
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
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

    // Parse response if it's JSON to check for Fonada-specific errors
    try {
        const jsonResponse = JSON.parse(rawText);
        if (jsonResponse.status === false || jsonResponse.status === "error") {
             throw new Error(jsonResponse.message || "Fonada rejected the call request.");
        }
    } catch (e) {
        // If it's not JSON, we just continue
    }

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
