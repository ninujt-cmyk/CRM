// app/actions/ivr-actions.ts
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

        // 🔴 STEP 1: CREATE HISTORY RECORD FIRST TO GET THE BATCH ID
        const { data: batchRecord, error: batchError } = await supabase.from('ivr_campaign_history').insert({
            tenant_id: profile.tenant_id,
            campaign_name: config.campaign_name,
            lead_batch_name: leadBatchName,
            total_contacts: phoneNumbers.length,
            status: 'launched'
        }).select('id').single();

        if (batchError || !batchRecord) {
            throw new Error("Failed to initialize campaign batch in database.");
        }

        const batchId = batchRecord.id;

        // 🔴 STEP 2: INJECT TENANT ID AND BATCH ID INTO THE DIALER LIST
        const cleanPhoneDetails = phoneNumbers.map(phone => {
            const cleanNumber = phone.replace(/\D/g, '').slice(-10);
            return {
                phoneNumber: cleanNumber, 
                Phone: cleanNumber,
                tenant_id: profile.tenant_id, // Inject for webhook tracking
                batch_id: batchId             // Inject for webhook tracking
            };
        });

        const payload = {
            leadName: leadBatchName,
            campaignId: config.fonada_campaign_id,
            userId: config.fonada_user_id,
            ukey: config.fonada_ukey,
            // 🔴 STEP 3: TELL FONADA ABOUT THE NEW COLUMNS
            header: "Phone,tenant_id,batch_id", 
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
        console.log("📡 Fonada Response:", responseText);
        
        if (!res.ok) {
            // Rollback status if network fails
            await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchId);
            throw new Error("Telecom provider rejected the campaign. Please contact support.");
        }

        try {
            const jsonRes = JSON.parse(responseText);
            if (jsonRes.status === "error" || jsonRes.status === false) {
                 await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchId);
                 throw new Error(jsonRes.message || "Fonada rejected the data payload.");
            }
        } catch (e: any) {
            if(e.message.includes("Fonada rejected")) throw e; // Pass through manual errors
        }

        return { success: true, message: `Successfully pushed ${phoneNumbers.length} contacts to the dialer!` };

    } catch (error: any) {
        console.error("IVR Launch Error:", error);
        return { success: false, error: error.message || "Internal Server Error" };
    }
}
