"use server"

import { createClient } from "@/lib/supabase/server";

export async function assignLeadsBulk(
    leadIds: string[], 
    agentId: string, 
    options: { 
        resetStatus: boolean; 
        priority: string;
        campaignNote?: string;
    } = { resetStatus: true, priority: "none" }
) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Build the dynamic update payload
    const updatePayload: any = { 
        assigned_to: agentId, 
        updated_at: new Date().toISOString() 
    };

    if (options.resetStatus) {
        updatePayload.status = 'New Lead';
    }
    
    if (options.priority !== "none") {
        updatePayload.priority = options.priority;
    }

    // If a campaign note is provided, we use an RPC function or a clever update 
    // to append it to the lead notes (or you can overwrite a specific 'campaign' column if you have one).
    // For safety with PostgREST bulk updates, we will update the 'source' or a tracking field, 
    // but a standard implementation updates the standard fields:
    
    const { error } = await supabase
      .from('leads')
      .update(updatePayload)
      .in('id', leadIds);

    if (error) throw error;

    return { success: true, count: leadIds.length };

  } catch (error: any) {
    console.error("🔥 Bulk Assignment Error:", error);
    return { success: false, error: error.message };
  }
}

export async function unassignLeadsBulk(leadIds: string[]) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Unauthorized");
  
      // Pull leads out of queues
      const { error } = await supabase
        .from('leads')
        .update({ 
            assigned_to: null, 
            updated_at: new Date().toISOString() 
        })
        .in('id', leadIds);
  
      if (error) throw error;
      return { success: true, count: leadIds.length };
  
    } catch (error: any) {
      console.error("🔥 Bulk Unassign Error:", error);
      return { success: false, error: error.message };
    }
}
