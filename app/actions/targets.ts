"use server"

import { createClient } from "@/lib/supabase/server";

export async function getLeaderboardData() {
  const supabase = await createClient();

  // 1. Get all active telecallers
  const { data: users } = await supabase
    .from("users")
    .select("id, full_name, role")
    .in("role", ["telecaller", "agent", "user"]);

  if (!users) return [];

  const today = new Date().toISOString().split('T')[0];

  const leaderboard = await Promise.all(users.map(async (user) => {
    // 2. Find their active target for today
    const { data: targetData } = await supabase
      .from("user_targets")
      .select("*")
      .eq("user_id", user.id)
      .lte("start_date", today)
      .gte("end_date", today)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // If no active target, skip them or return 0
    if (!targetData) {
        return {
            id: user.id,
            name: user.full_name,
            target: 0,
            achieved: 0,
            remaining: 0,
            progress: 0,
            dailyRequired: 0,
            daysLeft: 0,
            hasTarget: false
        };
    }

    // 3. Sum up their Disbursed loans within the target date range
    // Note: We check 'updated_at' to see when it was marked Disbursed
    const { data: disbursedLeads } = await supabase
      .from("leads")
      .select("loan_amount")
      .eq("assigned_to", user.id)
      .eq("status", "Disbursed")
      .gte("updated_at", `${targetData.start_date}T00:00:00.000Z`)
      .lte("updated_at", `${targetData.end_date}T23:59:59.999Z`);

    const achieved = disbursedLeads?.reduce((sum, lead) => sum + (Number(lead.loan_amount) || 0), 0) || 0;
    const target = Number(targetData.target_amount);
    const remaining = Math.max(0, target - achieved);
    const progress = target > 0 ? Math.min(100, Math.round((achieved / target) * 100)) : 0;

    // 4. Calculate Days Left & Daily Required
    const end = new Date(targetData.end_date);
    const now = new Date(today);
    const timeDiff = end.getTime() - now.getTime();
    const daysLeft = Math.max(1, Math.ceil(timeDiff / (1000 * 3600 * 24))); // Minimum 1 day to prevent dividing by zero
    
    const dailyRequired = remaining > 0 ? Math.round(remaining / daysLeft) : 0;

    return {
        id: user.id,
        name: user.full_name,
        target,
        achieved,
        remaining,
        progress,
        dailyRequired,
        daysLeft,
        hasTarget: true
    };
  }));

  // Sort by progress percentage (Highest first)
  return leaderboard
    .filter(agent => agent.hasTarget)
    .sort((a, b) => b.progress - a.progress);
}
