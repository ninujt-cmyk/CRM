"use server"

import { createClient } from "@/lib/supabase/server";

export async function updateAgentStatus(userId: string, newStatus: string, reason: string | null = null) {
  try {
    const supabase = await createClient();

    // 1. Find the currently active state log and close it out
    const { data: currentLog } = await supabase
      .from('agent_state_logs')
      .select('id, started_at')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

    if (currentLog) {
      const endedAt = new Date();
      const startedAt = new Date(currentLog.started_at);
      const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      await supabase
        .from('agent_state_logs')
        .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
        .eq('id', currentLog.id);
    }

    // 2. Insert the new state log
    await supabase.from('agent_state_logs').insert({
      user_id: userId,
      status: newStatus,
      reason: reason
    });

    // 3. Update the user's real-time profile
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        current_status: newStatus, 
        status_reason: reason, 
        status_updated_at: new Date().toISOString() 
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    return { success: true };

  } catch (error: any) {
    console.error("❌ Failed to update agent status:", error);
    return { success: false, error: error.message };
  }
}
