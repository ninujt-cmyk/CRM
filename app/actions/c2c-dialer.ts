"use server"

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function initiateC2CCall(leadId: string, customerPhone: string) {
  try {
    console.log(`\n🚀 [C2C START] Dialing Lead ID: ${leadId}, Phone: ${customerPhone}`);
    
    // 1. Standard Client (Uses cookies to know WHO clicked the button)
    const supabase = await createClient();
    
    // 2. Authenticate the user clicking the button
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 3. Fetch Agent's details (including their tenant_id)
    const { data: agent, error: agentError } = await supabase
      .from('users')
      .select('phone, current_status, full_name, tenant_id')
      .eq('id', user.id)
      .single();

    if (agentError || !agent?.phone) throw new Error("Agent phone number not found.");

    if (!['ready', 'active', 'wrap_up'].includes(agent.current_status)) {
        throw new Error(`You must be 'Ready' to dial. Current status: ${agent.current_status}`);
    }

    // 🔴 BUG FIX: Ensure we have the environment variables before initializing the Admin Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
        console.error("Missing critical Supabase environment variables on the server.");
        throw new Error("Server configuration error. Contact support.");
    }

    // Admin client to safely bypass RLS for internal credential checks
    const supabaseAdmin = createAdminClient(supabaseUrl, supabaseServiceKey);

    // 4. Use supabaseAdmin to fetch the secret keys so RLS doesn't block the Telecaller
    const { data: tenantSettings } = await supabaseAdmin
      .from('tenant_settings')
      .select('tenant_id, fonada_client_id, fonada_secret')
      .eq('tenant_id', agent.tenant_id)
      .maybeSingle();

    // Use DB credentials if they exist, otherwise fallback to the global .env keys
    const finalClientId = tenantSettings?.fonada_client_id || process.env.FONADA_C2C_CLIENT_ID;
    const finalSecretKey = tenantSettings?.fonada_secret || process.env.FONADA_C2C_SECRET;

    if (!finalClientId || !finalSecretKey) {
        throw new Error("Dialer credentials missing. Please configure your workspace settings.");
    }

    // Fetch Lead Name (Standard client is fine here, RLS allows agents to see their leads)
    const { data: lead } = await supabase.from('leads').select('name').eq('id', leadId).single();

    // 5. Clean Phone Numbers (Exactly 10 digits)
    let safeCustomerPhone = customerPhone.replace(/^\+?91/, '').slice(-10);
    let safeAgentPhone = agent.phone.replace(/^\+?91/, '').slice(-10);

    // 6. Exact Payload with Tenant Isolation
    const payload = {
        secretKey: finalSecretKey,       
        clientId: finalClientId,         
        agentNumber: safeAgentPhone,
        customerNumber: safeCustomerPhone,
        agentName: agent.full_name || "BanksCart Agent",
        customerName: lead?.name || "Customer",
        calledId: tenantSettings?.tenant_id || "" // TENANT ID INJECTED HERE
    };

    console.log("📤 [C2C PAYLOAD]:", JSON.stringify(payload));

    // 7. The Fetch Request (10-SECOND TIMEOUT)
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

    // 8. FORCE UPDATE DATABASE
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
