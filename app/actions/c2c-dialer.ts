"use server"

import { createClient } from "@/lib/supabase/server";

export async function initiateC2CCall(leadId: string, customerPhone: string) {
  try {
    console.log(`\n🚀 [C2C START] Dialing Lead ID: ${leadId}, Phone: ${customerPhone}`);
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('phone, current_status, full_name, tenant_id')
      .eq('id', user.id)
      .single();

    if (agentError || !agent?.phone) throw new Error("Agent phone number not found.");

    if (!['ready', 'active', 'wrap_up', 'offline', 'on_call'].includes(agent.current_status)) {
        throw new Error(`You must be 'Ready' to dial. Current status: ${agent.current_status}`);
    }

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) throw new Error("Server configuration error.");
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);

    // 🔴 1. THE PRE-FLIGHT CHECK: Ensure the company has credits!
    if (agent.tenant_id) {
        const { data: wallet } = await supabaseAdmin
            .from('tenant_wallets')
            .select('credits_balance')
            .eq('tenant_id', agent.tenant_id)
            .single();

        if (!wallet || wallet.credits_balance <= 0) {
            throw new Error("Insufficient credits. Please ask your administrator to recharge the workspace wallet.");
        }
    }

    const { data: tenantSettings } = await supabaseAdmin
      .from('tenant_settings')
      .select('tenant_id, fonada_client_id, fonada_secret')
      .eq('tenant_id', agent.tenant_id)
      .maybeSingle();

    const finalClientId = tenantSettings?.fonada_client_id || process.env.FONADA_C2C_CLIENT_ID;
    const finalSecretKey = tenantSettings?.fonada_secret || process.env.FONADA_C2C_SECRET;

    if (!finalClientId || !finalSecretKey) throw new Error("Dialer credentials missing.");

    const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).single();

    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '').slice(-10);

    const payload = {
        secretKey: finalSecretKey,       
        clientId: finalClientId,         
        agentNumber: safeAgentPhone,
        customerNumber: safeCustomerPhone,
        agentName: agent.full_name || "Agent",
        customerName: lead?.name || "Customer",
        calledId: "" // Intentionally blank, webhook uses Smart Lookup
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let res;
    try {
        res = await fetch("https://c2c.ivrobd.com/api/c2c/process", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "*/*" },
            body: JSON.stringify(payload),
            signal: controller.signal 
        });
    } catch (fetchErr: any) {
        if (fetchErr.name === 'AbortError') throw new Error("API timed out after 10 seconds.");
        throw fetchErr;
    } finally {
        clearTimeout(timeoutId); 
    }

    const rawText = await res.text();
    
    try {
        const jsonResponse = JSON.parse(rawText);
        if (jsonResponse.status === false || jsonResponse.status === "error") {
             return { success: false, error: jsonResponse.message || "Hanva rejected the call request." };
        }
    } catch (e) { /* ignore */ }

    await supabaseAdmin.from("leads").update({ status: "Contacted", last_contacted: new Date().toISOString() }).eq("id", leadId);
    await supabaseAdmin.from("users").update({ current_status: 'on_call', status_updated_at: new Date().toISOString() }).eq("id", user.id);

    return { success: true, message: "Call Initiated! Your phone is ringing..." };

  } catch (error: any) {
    console.error("🔥 [C2C CATCH ERROR]:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}
