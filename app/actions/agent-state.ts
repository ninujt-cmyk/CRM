"use server"

// 🔴 CHANGED: Import the standard Supabase client to use the Service Role Key
import { createClient } from "@supabase/supabase-js"; 

export async function updateAgentStatus(userId: string, newStatus: string, reason: string | null = null) {
  try {
    // 🔴 CHANGED: Instantiate the Admin client to bypass RLS for system state logging
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 1. Find the currently active state log and close it out
    const { data: currentLog } = await supabaseAdmin
      .from('agent_state_logs')
      .select('id, started_at')
      .eq('user_id', userId)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (currentLog) {
      const endedAt = new Date();
      const startedAt = new Date(currentLog.started_at);
      const durationSeconds = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000);

      await supabaseAdmin
        .from('agent_state_logs')
        .update({ ended_at: endedAt.toISOString(), duration_seconds: durationSeconds })
        .eq('id', currentLog.id);
    }

    // 2. Insert the new state log (Added error checking!)
    const { error: insertError } = await supabaseAdmin.from('agent_state_logs').insert({
      user_id: userId,
      status: newStatus,
      reason: reason
    });
    
    if (insertError) throw insertError;

    // 3. Update the user's real-time profile
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ 
        current_status: newStatus, 
        status_reason: reason, 
        status_updated_at: new Date().toISOString() 
      })
      .eq('id', userId)
      .select(); // 🔴 Added .select() to force a return!

    if (updateError) throw updateError;
    
    // Catch the silent failure just in case!
    if (!updatedUser || updatedUser.length === 0) {
        throw new Error("Update failed: User ID not found in the database.");
    }

    return { success: true };

  } catch (error: any) {
    console.error("❌ Failed to update agent status:", error);
    return { success: false, error: error.message };
  }
}
