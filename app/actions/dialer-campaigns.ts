"use server"

import { createClient } from "@/lib/supabase/server";

export async function assignLeadsBulk(leadIds: string[], agentId: string) {
  try {
    const supabase = await createClient();

    // 1. Authenticate Admin (Optional but recommended)
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // 2. Perform the Bulk Update
    // We update the assignee AND forcefully set the status back to 'New Lead' 
    // so the Auto-Dialer instantly recognizes them as fresh numbers to call.
    const { error } = await supabase
      .from('leads')
      .update({ 
          assigned_to: agentId, 
          status: 'New Lead', 
          updated_at: new Date().toISOString() 
      })
      .in('id', leadIds);

    if (error) throw error;

    return { success: true, count: leadIds.length };

  } catch (error: any) {
    console.error("🔥 Bulk Assignment Error:", error);
    return { success: false, error: error.message };
  }
}
