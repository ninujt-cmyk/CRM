// app/actions/ivr-actions.ts
"use server"

import { createClient } from "@/lib/supabase/server"

export async function launchIvrCampaign(configId: string, leadBatchName: string, phoneNumbers: string[], retryCount: number = 1) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        // 1. FETCH WALLET BALANCE
        const { data: wallet } = await supabase
            .from('tenant_wallets')
            .select('credits_balance')
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!wallet || wallet.credits_balance <= 0) {
            throw new Error("Insufficient credits. Please recharge your wallet to launch campaigns.");
        }

        // 🔴 THE FIX: THE 3-TO-1 PRE-FLIGHT BUDGET RULE
        // Logic: You need 1 credit for every 3 contacts uploaded. 
        // We multiply by the retry count, because retries cost money too!
        const totalContacts = phoneNumbers.length;
        const totalAttempts = totalContacts * retryCount;
        
        // Calculate required credits (rounded up just to be safe)
        const requiredCredits = Math.ceil(totalAttempts / 3); 
        
        if (wallet.credits_balance < requiredCredits) {
            throw new Error(`Insufficient credits. You are attempting to dial ${totalContacts} contacts with ${retryCount} retries. You need at least ${requiredCredits} credits available in your wallet to safely buffer this campaign. Current balance: ${wallet.credits_balance}`);
        }

        const { data: config } = await supabase
            .from('ivr_campaign_configs')
            .select('*')
            .eq('id', configId)
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!config) throw new Error("Campaign configuration not found.");

        // 2. CREATE HISTORY RECORD 
        const { data: batchRecord, error: batchError } = await supabase.from('ivr_campaign_history').insert({
            tenant_id: profile.tenant_id,
            campaign_name: config.campaign_name,
            lead_batch_name: leadBatchName,
            total_contacts: totalContacts,
            status: 'launched'
        }).select('id').single();

        if (batchError || !batchRecord) {
            throw new Error(`Database Error: ${batchError?.message || "Failed to create batch"}`);
        }

        const batchId = batchRecord.id;

        // 3. CLEAN NUMBERS
        const cleanPhoneDetails = phoneNumbers.map(phone => {
            return { phoneNumber: phone.replace(/\D/g, '').slice(-10) };
        });

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
                noOfRetry: retryCount 
            },
            phoneNumberDetails: cleanPhoneDetails
        };

        const res = await fetch("https://mltj.ivrobd.com/api/v1/astrixdispatcher/v6/lead?isDND=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();
        console.log("📡 Fonada Response:", responseText);
        
        if (!res.ok) {
            await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchId);
            throw new Error("Telecom provider rejected the campaign.");
        }

        let fonadaLeadId = null;
        try {
            const jsonRes = JSON.parse(responseText);
            if (jsonRes.status === "error" || jsonRes.status === false) {
                 await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchId);
                 throw new Error(jsonRes.message || "Fonada rejected the data payload.");
            }
            
            fonadaLeadId = jsonRes.leadId || jsonRes.leadid || jsonRes.lead_id || jsonRes.data?.leadId || null;
        } catch (e: any) {
            if(e.message.includes("Fonada rejected")) throw e; 
        }

        if (!fonadaLeadId) {
            const match = responseText.match(/\b\d{5,8}\b/);
            if (match) fonadaLeadId = match[0];
        }

        if (fonadaLeadId) {
            const safeLeadId = String(fonadaLeadId).trim();
            const { error: updateErr } = await supabase.from('ivr_campaign_history').update({
                fonada_lead_id: safeLeadId
            }).eq('id', batchId);

            if (updateErr) {
                console.error("🚨 CRITICAL DB ERROR: Failed to save fonada_lead_id! Did you run the SQL migration?", updateErr);
            } else {
                console.log(`✅ Successfully mapped Fonada ID [${safeLeadId}] to Supabase Batch [${batchId}]`);
            }
        } else {
            console.error("🚨 CRITICAL EXTRACTION ERROR: Could not find any Lead ID in the Fonada response text!");
        }

        return { success: true, message: `Successfully pushed ${phoneNumbers.length} contacts to the dialer!` };

    } catch (error: any) {
        console.error("IVR Launch Error:", error);
        return { success: false, error: error.message || "Internal Server Error" };
    }
}
