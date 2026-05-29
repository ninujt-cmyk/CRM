"use server"

import { createClient } from "@/lib/supabase/server";

export async function initiateAIBulkCall(filters: { status: string, assigned_to?: string, limit: number }) {
  try {
    console.log(`\n🚀 [AI OBD START] Fetching leads for AI Bulk Calling...`, filters);
    
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    const { data: agent } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!agent?.tenant_id) throw new Error("Workspace not found.");

    const { createClient: createAdminClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!, 
        process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. CHECK WALLET CREDITS
    const { data: wallet } = await supabaseAdmin
        .from('tenant_wallets')
        .select('credits_balance')
        .eq('tenant_id', agent.tenant_id)
        .single();

    if (!wallet || wallet.credits_balance <= 0) {
        throw new Error("Insufficient credits for AI dialing. Please recharge your wallet.");
    }

    // 2. BUILD QUERY based on user filters
    let query = supabaseAdmin
        .from('leads')
        .select('id, phone, name')
        .eq('tenant_id', agent.tenant_id)
        .eq('status', filters.status)
        .limit(filters.limit);

    if (filters.assigned_to && filters.assigned_to !== 'all') {
        query = query.eq('assigned_to', filters.assigned_to);
    }

    const { data: leads, error: leadsError } = await query;
    if (leadsError || !leads || leads.length === 0) {
        throw new Error("No leads found matching these criteria.");
    }

    // 3. FORMAT NUMBERS FOR OBD
    const phoneNumbers = leads.map(l => l.phone.replace(/^\+?91/, '').slice(-10)).join(',');

    // 4. PUSH TO FONADA OBD API
    // Note: Replace the URL path '/api/push_campaign' with the exact push endpoint provided by Fonada
    const obdPayload = {
        Client_Id: "helpcallservice",
        UKey: "ZTIvWSuaS46CVoDY",
        Numbers: phoneNumbers,
        // CampaignId: "YOUR_AI_CAMPAIGN_ID_HERE" // You may need to specify which campaign to push to
    };

    const res = await fetch("https://bt.ivrobd.com/api/push_campaign", { // Update exact endpoint path if needed
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(obdPayload),
    });

    const rawText = await res.text();
    console.log("OBD API Response:", rawText);

    // 5. MARK LEADS AS DIALING IN CRM
    const leadIds = leads.map(l => l.id);
    await supabaseAdmin.from('leads')
        .update({ status: 'AI Dialing', last_contacted: new Date().toISOString() })
        .in('id', leadIds);

    return { 
        success: true, 
        message: `Successfully pushed ${leads.length} leads to the AI Bot.` 
    };

  } catch (error: any) {
    console.error("🔥 [AI OBD ERROR]:", error);
    return { success: false, error: error.message || "Internal server error" };
  }
}
