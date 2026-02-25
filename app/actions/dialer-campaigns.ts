"use server"

import { createClient } from "@/lib/supabase/server";

export async function assignLeadsBulk(
    leadIds: string[], 
    agentId: string, 
    options: { resetStatus: boolean; priority: string } = { resetStatus: true, priority: "none" }
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
