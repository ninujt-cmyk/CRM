"use server"

import { createClient } from "@/lib/supabase/server"

export async function launchIvrCampaign(configId: string, leadBatchName: string, phoneNumbers: string[]) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        // 1. CHECK VIRTUAL WALLET BALANCE
        const { data: wallet } = await supabase
            .from('tenant_wallets')
            .select('credits_balance')
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!wallet || wallet.credits_balance <= 0) {
            throw new Error("Insufficient credits. Please recharge your wallet to launch campaigns.");
        }

        // 2. FETCH PRE-CONFIGURED FONADA CAMPAIGN DETAILS
        const { data: config } = await supabase
            .from('ivr_campaign_configs')
            .select('*')
            .eq('id', configId)
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!config) throw new Error("Campaign configuration not found.");

        // 3. CREATE HISTORY RECORD
        const { data: batchRecord, error: batchError } = await supabase.from('ivr_campaign_history').insert({
            tenant_id: profile.tenant_id,
            campaign_name: config.campaign_name,
            lead_batch_name: leadBatchName,
            total_contacts: phoneNumbers.length,
            status: 'launched'
        }).select('id').single();

        if (batchError) {
            console.error("🚨 SUPABASE BATCH INSERT ERROR:", batchError);
            throw new Error(`Database Error: ${batchError.message}`);
        }

        // 4. FORMAT PHONES EXACTLY AS FONADA REQUIRES
        const cleanPhoneDetails = phoneNumbers.map(phone => ({
            phoneNumber: phone.replace(/\D/g, '').slice(-10) // Strictly 10 digits
        }));

        // 5. BUILD EXACT PAYLOAD (Matching your cURL)
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
            phoneNumberDetails: cleanPhoneDetails
        };

        console.log("🚀 Launching IVR Payload to Fonada...");

        // 6. SEND TO FONADA
        const res = await fetch("https://mltj.ivrobd.com/api/v1/astrixdispatcher/v6/lead?isDND=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();
        console.log("📡 Fonada Response:", responseText);
        
        if (!res.ok) {
            await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchRecord.id);
            throw new Error("Telecom provider rejected the campaign. Please contact support.");
        }

        try {
            const jsonRes = JSON.parse(responseText);
            if (jsonRes.status === "error" || jsonRes.status === false) {
                 await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchRecord.id);
                 throw new Error(jsonRes.message || "Fonada rejected the data payload.");
            }
        } catch (e: any) {
            if(e.message.includes("Fonada rejected")) throw e; 
        }

        return { success: true, message: `Successfully pushed ${phoneNumbers.length} contacts to the dialer!` };

    } catch (error: any) {
        console.error("IVR Launch Error:", error);
        return { success: false, error: error.message || "Internal Server Error" };
    }
}
