"use server"

import { createClient } from "@/lib/supabase/server"

// 🔴 1. ADDED retryCount PARAMETER
export async function launchIvrCampaign(configId: string, leadBatchName: string, phoneNumbers: string[], retryCount: number = 3) {
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

        // =========================================================================
        // 🔴 2. THE PREDICTIVE BUFFER LOGIC (Anti-Negative Balance Protection)
        // =========================================================================
        // Since Fonada cannot stop mid-campaign, we predict the maximum cost.
        // Higher retries = Higher chance of answer = More credits consumed.
        
        let contactsPerCreditRatio = 3; // Default: 3 contacts consume 1 credit
        
        if (retryCount <= 1) contactsPerCreditRatio = 5; // 1 retry: ~20% connect rate (5 contacts = 1 credit)
        else if (retryCount === 2) contactsPerCreditRatio = 4; // 2 retries: ~25% connect rate (4 contacts = 1 credit)
        else if (retryCount >= 3) contactsPerCreditRatio = 3; // 3+ retries: ~35% connect rate (3 contacts = 1 credit)

        const estimatedCreditsNeeded = Math.ceil(phoneNumbers.length / contactsPerCreditRatio);
        const maxContactsAllowed = wallet.credits_balance * contactsPerCreditRatio;

        if (wallet.credits_balance < estimatedCreditsNeeded) {
            throw new Error(`Insufficient credits. You have ${wallet.credits_balance.toLocaleString()} credits, which allows a maximum of ${maxContactsAllowed.toLocaleString()} contacts for a ${retryCount}-retry campaign. You tried to upload ${phoneNumbers.length.toLocaleString()} contacts.`);
        }
        // =========================================================================

        const { data: config } = await supabase
            .from('ivr_campaign_configs')
            .select('*')
            .eq('id', configId)
            .eq('tenant_id', profile.tenant_id)
            .single();

        if (!config) throw new Error("Campaign configuration not found.");

        // 1. CREATE HISTORY RECORD 
        const { data: batchRecord, error: batchError } = await supabase.from('ivr_campaign_history').insert({
            tenant_id: profile.tenant_id,
            campaign_name: config.campaign_name,
            lead_batch_name: leadBatchName,
            total_contacts: phoneNumbers.length,
            status: 'launched'
        }).select('id').single();

        if (batchError || !batchRecord) {
            throw new Error(`Database Error: ${batchError?.message || "Failed to create batch"}`);
        }

        const batchId = batchRecord.id;

        // 2. CLEAN NUMBERS & provide multiple key aliases so IVROBD v6 parses row correctly
        const cleanPhoneDetails = phoneNumbers.map(phone => {
            const clean = phone.replace(/\D/g, '').slice(-10);
            return {
                Phone: clean,
                phoneNumber: clean,
                phone: clean,
                number: clean
            };
        });

        const payload = {
            leadName: leadBatchName,
            campaignId: Number(config.fonada_campaign_id) || config.fonada_campaign_id,
            userId: Number(config.fonada_user_id) || config.fonada_user_id,
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
                noOfRetry: retryCount // 🔴 INJECT DYNAMIC RETRY COUNT
            },
            phoneNumberDetails: cleanPhoneDetails
        };

        const res = await fetch("https://mltj.ivrobd.com/api/v1/astrixdispatcher/v6/lead?isDND=false", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const responseText = await res.text();
        console.log("📡 Hanva Response:", responseText);
        
        if (!res.ok) {
            await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchId);
            throw new Error("Telecom provider rejected the campaign.");
        }

        let fonadaLeadId = null;
        try {
            const jsonRes = JSON.parse(responseText);
            if (jsonRes.status === "error" || jsonRes.status === false) {
                 await supabase.from('ivr_campaign_history').update({ status: 'failed' }).eq('id', batchId);
                 throw new Error(jsonRes.message || "Hanva rejected the data payload.");
            }
            
            fonadaLeadId = jsonRes.leadId || jsonRes.leadid || jsonRes.lead_id || jsonRes.data?.leadId || null;
        } catch (e: any) {
            if(e.message.includes("Hanva rejected")) throw e; 
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
                console.error("🚨 CRITICAL DB ERROR: Failed to save fonada_lead_id!", updateErr);
            } else {
                console.log(`✅ Successfully mapped Fonada ID [${safeLeadId}] to Supabase Batch [${batchId}]`);
            }
        } else {
            console.error("🚨 CRITICAL EXTRACTION ERROR: Could not find any Lead ID in the Fonada response text!");
        }

        return { success: true, message: `Successfully pushed ${phoneNumbers.length.toLocaleString()} contacts to the dialer!` };

    } catch (error: any) {
        console.error("IVR Launch Error:", error);
        return { success: false, error: error.message || "Internal Server Error" };
    }
}

// ==========================================
// CRUD Actions for IVR Configurations
// ==========================================

export async function fetchIvrConfigs() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        const { data, error } = await supabase
            .from('ivr_campaign_configs')
            .select('*')
            .eq('tenant_id', profile.tenant_id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { success: true, data };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function createIvrConfig(payload: {
    campaign_name: string;
    fonada_campaign_id: string;
    fonada_user_id: string;
    fonada_ukey: string;
}) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        const { error } = await supabase
            .from('ivr_campaign_configs')
            .insert({
                tenant_id: profile.tenant_id,
                ...payload
            });

        if (error) throw error;
        return { success: true, message: "Configuration created successfully." };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function updateIvrConfig(id: string, payload: {
    campaign_name: string;
    fonada_campaign_id: string;
    fonada_user_id: string;
    fonada_ukey: string;
}) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        const { error } = await supabase
            .from('ivr_campaign_configs')
            .update(payload)
            .eq('id', id)
            .eq('tenant_id', profile.tenant_id);

        if (error) throw error;
        return { success: true, message: "Configuration updated successfully." };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function deleteIvrConfig(id: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found.");

        // Instead of hard delete, maybe just soft delete or actual delete
        // If history is tied to campaign_name (string), hard delete is okay. 
        // If tied to config_id, then soft delete is needed. 
        // Current code shows `ivr_campaign_history` stores `campaign_name` string, so hard delete is fine.
        const { error } = await supabase
            .from('ivr_campaign_configs')
            .delete()
            .eq('id', id)
            .eq('tenant_id', profile.tenant_id);

        if (error) throw error;
        return { success: true, message: "Configuration deleted successfully." };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

