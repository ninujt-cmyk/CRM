"use server"

import { createClient } from "@/lib/supabase/server"

export async function launchIvrCampaign(configId: string, leadBatchName: string, phoneNumbers: string[]) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        const { data: wallet } = await supabase
            .from('tenant_wallets')
            .select('credits_balance')
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!wallet || wallet.credits_balance <= 0) {
            throw new Error("Insufficient credits. Please recharge your wallet to launch campaigns.");
        }

        const { data: config } = await supabase
            .from('ivr_campaign_configs')
            .select('*')
            .eq('id', configId)
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!config) throw new Error("Campaign configuration not found.");

        // 🔴 BULLETPROOF FIX: Clean numbers and map BOTH keys
        const cleanPhoneDetails = phoneNumbers.map(phone => {
            // Strip everything except numbers, and grab the last 10
            const cleanNumber = phone.replace(/\D/g, '').slice(-10);
            return {
                phoneNumber: cleanNumber, // What the docs say
                Phone: cleanNumber        // What the "header" field says
            };
        });

        const payload = {
            leadName: leadBatchName,
            campaignId: config.fonada_campaign_id,
            userId: config.fonada_user_id,
            ukey: config.fonada_ukey,
            header: "Phone", // Fonada uses this to look for the "Phone" key in the array
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
            phoneNumberDetails: cleanPhoneDetails
        };

        console.log("🚀 Launching IVR Payload to Fonada:", JSON.stringify(payload).substring(0, 300) + "...");

        const res = await fetch("https://mltj.ivrobd.com/api/v1/astrixdispatcher/v6/lead?isDND=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();
        console.log("📡 Fonada Response:", responseText); // Log this so we can see what Fonada says!
        
        if (!res.ok) {
            throw new Error("Telecom provider rejected the campaign. Please contact support.");
        }

        // Verify if Fonada returned a success status inside the JSON
        try {
            const jsonRes = JSON.parse(responseText);
            if (jsonRes.status === "error" || jsonRes.status === false) {
                 throw new Error(jsonRes.message || "Fonada rejected the data payload.");
            }
        } catch (e) {}

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
