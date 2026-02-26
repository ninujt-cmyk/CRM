"use server"

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function initiateC2CCall(leadId: string, customerPhone: string) {
  try {
    console.log(`\n🚀 [C2C START] Dialing Lead ID: ${leadId}, Phone: ${customerPhone}`);
    
    // Standard client for fetching the user
    const supabase = await createClient();
    
    // 💡 THE FIX: Admin client to forcefully bypass Row Level Security (RLS) updates!
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
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

    // Allow both 'ready' and 'active' just in case
    if (agent.current_status !== 'ready' && agent.current_status !== 'active') {
        throw new Error("You must be 'Active' to dial.");
    }

    // Fetch Lead Name
    const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).single();

    // 3. Clean Phone Numbers (Exactly 10 digits)
    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '').slice(-10);

    // 4. Exact Payload
    const payload = {
        secretKey: process.env.FONADA_C2C_SECRET || "FLgbnDWAFI06EO0a",
        clientId: process.env.FONADA_C2C_CLIENT_ID || "Help_call_services",
        agentNumber: safeAgentPhone,
        customerNumber: safeCustomerPhone,
        agentName: agent.full_name || "BanksCart Agent",
        customerName: lead?.name || "Customer",
        calledId: "" 
    };

    console.log("📤 [C2C PAYLOAD]:", JSON.stringify(payload));

    // 5. The Fetch Request (10-SECOND TIMEOUT)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let res;
    try {
        res = await fetch("https://c2c.ivrobd.com/api/c2c/process", {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
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
            throw new Error("Fonada API timed out after 10 seconds.");
        }
        throw fetchErr;
    } finally {
        clearTimeout(timeoutId); 
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

    // 6. 🚀 FORCE UPDATE DATABASE (Using Admin Client to bypass RLS)
    console.log("💾 [C2C DB UPDATE] Forcing Admin Update for Lead and Agent Status...");
    
    const { error: leadErr } = await supabaseAdmin.from("leads")
        .update({ status: "Contacted", last_contacted: new Date().toISOString() })
        .eq("id", leadId);
    
    if (leadErr) console.error("❌ Lead Update Failed:", leadErr);

    const { error: userErr } = await supabaseAdmin.from("users")
        .update({ current_status: 'on_call', status_updated_at: new Date().toISOString() })
        .eq("id", user.id);
        
    if (userErr) console.error("❌ User Update Failed:", userErr);

    return { success: true, message: "Call Initiated! Your phone is ringing..." };

  } catch (error: any) {
    console.error("🔥 [C2C CATCH ERROR]:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}
