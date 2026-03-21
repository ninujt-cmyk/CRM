"use server"

import { createClient } from "@/lib/supabase/server"

export async function launchIvrCampaign(configId: string, leadBatchName: string, phoneNumbers: string[]) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        // 1. CHECK WALLET BALANCE (Ensure they have > 0 credits to start)
        const { data: wallet } = await supabase
            .from('tenant_wallets')
            .select('credits_balance')
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!wallet || wallet.credits_balance <= 0) {
            throw new Error("Insufficient credits. Please recharge your wallet to launch campaigns.");
        }

        // 2. FETCH FONADA CREDENTIALS FOR THIS CAMPAIGN
        const { data: config } = await supabase
            .from('ivr_campaign_configs')
            .select('*')
            .eq('id', configId)
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!config) throw new Error("Campaign configuration not found.");

        // 3. BUILD THE EXACT FONADA PAYLOAD
        const payload = {
            leadName: leadBatchName,
            campaignId: config.fonada_campaign_id,
            userId: config.fonada_user_id,
            ukey: config.fonada_ukey,
            header: "Phone",
            retryInfo: {
                retryType: "R",
                retryOnFail: 1,
                retryTimeOnFail: 5,
                retryOnBusy: 1,
                retryTimeOnBusy: 5,
                retryOnAns: 0,
                retryTimeOnAns: 0,
                retryOnNoAns: 1,
                retryTimeOnNoAns: 5,
                noOfRetry: 1
            },
            // Format phone numbers into the array of objects Fonada requires
            phoneNumberDetails: phoneNumbers.map(phone => ({
                phoneNumber: phone.replace(/^\+?91/, '').slice(-10) // Ensure 10 digits
            }))
        };

        console.log("🚀 Launching IVR Payload to Fonada:", JSON.stringify(payload).substring(0, 200) + "...");

        // 4. SEND TO FONADA
        const res = await fetch("https://mltj.ivrobd.com/api/v1/astrixdispatcher/v6/lead?isDND=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();
        
        if (!res.ok) {
            console.error("Fonada Error Response:", responseText);
            throw new Error("Telecom provider rejected the campaign. Please contact support.");
        }

        // 5. LOG THE CAMPAIGN HISTORY
        // (Note: The actual credit deduction happens per-call in your Webhook!)
        await supabase.from('ivr_campaign_history').insert({
            tenant_id: profile.tenant_id,
            campaign_name: config.campaign_name,
            lead_batch_name: leadBatchName,
            total_contacts: phoneNumbers.length,
            status: 'launched'
        });

        return { success: true, message: `Successfully pushed ${phoneNumbers.length} contacts to the dialer!` };

    } catch (error: any) {
        console.error("IVR Launch Error:", error);
        return { success: false, error: error.message || "Internal Server Error" };
    }
}
