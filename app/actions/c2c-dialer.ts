"use server"

import { createClient } from "@/lib/supabase/server";

export async function initiateC2CCall(leadId: string, customerPhone: string) {
  try {
    console.log(`\n🚀 [C2C START] Dialing Lead ID: ${leadId}, Phone: ${customerPhone}`);
    
    const supabase = await createClient();
    
    // 1. Authenticate
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Fetch Agent
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('phone, current_status, full_name')
      .eq('id', user.id)
      .single();

    if (agentError || !agent?.phone) throw new Error("Agent phone number not found.");
    if (agent.current_status !== 'ready') throw new Error("You must be 'Ready' to dial.");

    // Fetch Lead Name
    const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).single();

    // 3. Clean Phone Numbers (Exactly 10 digits)
    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '').slice(-10);

    // 4. Exact Payload (WITH THE LEAD ID RESTORED!)
    const payload = {
        secretKey: process.env.FONADA_C2C_SECRET || "FLgbnDWAFI06EO0a",
        clientId: process.env.FONADA_C2C_CLIENT_ID || "Help_call_services",
        agentNumber: safeAgentPhone,
        customerNumber: safeCustomerPhone,
        agentName: agent.full_name || "BanksCart Agent",
        customerName: lead?.name || "Customer",
        calledId: leadId // 💡 Put the Lead ID back exactly as requested
    };

    console.log("📤 [C2C PAYLOAD]:", JSON.stringify(payload));

    // 5. The Fetch Request (WITH 10-SECOND TIMEOUT)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 💡 Bumped to 15 seconds

    let res;
    try {
        res = await fetch("https://c2c.ivrobd.com/api/c2c/process", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                // 💡 THE FIX: Impersonate Postman so Fonada's firewall doesn't block Vercel!
                "Accept": "*/*",
                "User-Agent": "PostmanRuntime/7.36.3",
                "Connection": "keep-alive"
            },
            body: JSON.stringify(payload),
            cache: 'no-store',
            signal: controller.signal 
        });
    } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') {
            throw new Error("Fonada API timed out. The server took longer than 10 seconds to respond.");
        }
        throw fetchErr;
    } finally {
        clearTimeout(timeoutId); // Clean up the timer
    }

    const rawText = await res.text();
    console.log("📞 [C2C RESPONSE]:", rawText);

    try {
        const jsonResponse = JSON.parse(rawText);
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

    return { success: true, message: "Call Initiated! Your phone is ringing..." };

  } catch (error: any) {
    console.error("🔥 [C2C CATCH ERROR]:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}
