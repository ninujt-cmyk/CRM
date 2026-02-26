"use server"

import { createClient } from "@/lib/supabase/server";

export async function initiateC2CCall(leadId: string, customerPhone: string) {
  try {
    console.log(`\n🚀 [C2C START] Initiating call to ${customerPhone}`);
    
    const supabase = await createClient();
    
    // 1. Authenticate
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Fetch Agent
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('phone, current_status')
      .eq('id', user.id)
      .single();

    if (agentError || !agent?.phone) throw new Error("Agent phone number not found.");
    if (agent.current_status !== 'ready') throw new Error("You must be 'Ready' to dial.");

    // 3. Clean Phone Numbers (Exactly 10 digits like Postman)
    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '').slice(-10);

    // 4. Exact Postman Payload
    const payload = {
        secretKey: process.env.FONADA_C2C_SECRET || "FLgbnDWAFI06EO0a",
        clientId: process.env.FONADA_C2C_CLIENT_ID || "Help_call_services",
        agentNumber: safeAgentPhone,
        customerNumber: safeCustomerPhone,
        agentName: "",
        customerName: "",
        calledId: "" 
    };

    console.log("📤 [C2C PAYLOAD]:", JSON.stringify(payload));

    // 5. The Fetch Request (Removed timeout to prevent Next.js hanging bugs)
    const res = await fetch("https://c2c.ivrobd.com/api/c2c/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        cache: 'no-store' // Forces Next.js not to cache this API call
    });

    const rawText = await res.text();
    console.log("📞 [C2C RESPONSE]:", rawText);

    // Parse response
    try {
        const jsonResponse = JSON.parse(rawText);
        // If Fonada returns an error JSON, catch it
        if (jsonResponse.status === false || jsonResponse.status === "error") {
             return { success: false, error: jsonResponse.message || "Fonada rejected the call request." };
        }
    } catch (e) {
        // Not JSON, ignore
    }

    // 6. Update Database
    console.log("💾 [C2C DB UPDATE] Updating Lead and Agent Status...");
    await supabase.from("leads").update({ status: "Contacted", last_contacted: new Date().toISOString() }).eq("id", leadId);
    await supabase.from("users").update({ current_status: 'on_call', status_updated_at: new Date().toISOString() }).eq("id", user.id);

    console.log("✅ [C2C SUCCESS] Call initiated successfully.\n");
    return { success: true, message: "Call Initiated! Your phone is ringing..." };

  } catch (error: any) {
    console.error("🔥 [C2C CATCH ERROR]:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}
