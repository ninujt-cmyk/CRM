"use server"

import { createClient } from "@/lib/supabase/server"

const UNICORN_API_BASE = "https://voice.unicornaisolution.com/api/v1";

// Helper to get the tenant's Unicorn API Key
async function getUnicornApiKey() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', user.id)
    .single();

  if (!profile?.tenant_id) throw new Error("Tenant not found");

  const { data: settings } = await supabase
    .from('tenant_settings')
    .select('unicorn_api_key')
    .eq('tenant_id', profile.tenant_id)
    .single();

  if (!settings?.unicorn_api_key) {
    throw new Error("Unicorn API Key not configured. Please add it in Settings.");
  }

  return settings.unicorn_api_key;
}

export async function getUnicornBalance() {
  try {
    const apiKey = await getUnicornApiKey();
    const res = await fetch(`${UNICORN_API_BASE}/balance`, {
      headers: {
        "X-API-Key": apiKey
      }
    });
    
    if (!res.ok) {
        throw new Error("Failed to fetch balance");
    }
    const data = await res.json();
    return { success: true, balance: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getUnicornScripts() {
  try {
    const apiKey = await getUnicornApiKey();
    const res = await fetch(`${UNICORN_API_BASE}/scripts`, {
      headers: {
        "X-API-Key": apiKey
      }
    });
    
    if (!res.ok) {
        throw new Error("Failed to fetch scripts");
    }
    const data = await res.json();
    // Assuming data is an array or has a standard structure
    return { success: true, scripts: Array.isArray(data) ? data : data.scripts || [] };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createUnicornCallCampaign(scriptId: number | string, campaignName: string, selectedLeads: any[]) {
  try {
    const apiKey = await getUnicornApiKey();
    
    const orders = selectedLeads.map(lead => ({
      customerPhone: lead.phone,
      customerName: lead.name || "Customer",
      orderNumber: lead.id, // passing lead.id as orderNumber to track it later
      orderNotes: `Lead created on ${new Date(lead.created_at).toLocaleDateString()}`
    }));

    const payload = {
      scriptId: typeof scriptId === 'string' ? parseInt(scriptId, 10) : scriptId,
      campaignName,
      orders
    };

    const res = await fetch(`${UNICORN_API_BASE}/orders`, {
      method: 'POST',
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    
    if (!res.ok) {
        throw new Error(data.message || data.error || "Failed to create campaign");
    }

    // Update leads status in DB to "AI Dialing"
    const supabase = await createClient();
    await supabase
      .from('leads')
      .update({ status: 'AI Dialing' })
      .in('id', selectedLeads.map(l => l.id));

    return { success: true, data };
  } catch (error: any) {
    console.error("Unicorn Calling Error:", error);
    return { success: false, error: error.message };
  }
}

// -----------------------------------------
// SCRIPT CRUD OPERATIONS
// -----------------------------------------

export async function getUnicornScript(scriptId: string | number) {
  try {
    const apiKey = await getUnicornApiKey();
    const res = await fetch(`${UNICORN_API_BASE}/scripts/${scriptId}`, {
      headers: { "X-API-Key": apiKey }
    });
    if (!res.ok) throw new Error("Failed to fetch script details");
    const data = await res.json();
    return { success: true, script: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createUnicornScript(payload: any) {
  try {
    const apiKey = await getUnicornApiKey();
    const res = await fetch(`${UNICORN_API_BASE}/scripts`, {
      method: 'POST',
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to create script");
    return { success: true, script: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateUnicornScript(scriptId: string | number, payload: any) {
  try {
    const apiKey = await getUnicornApiKey();
    const res = await fetch(`${UNICORN_API_BASE}/scripts/${scriptId}`, {
      method: 'PUT',
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to update script");
    return { success: true, script: data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

