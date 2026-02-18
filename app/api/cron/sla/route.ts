import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- IST TIMEZONE CALCULATOR ---
function getStartOfTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; 
  const nowIST = new Date(now.getTime() + istOffset);
  nowIST.setUTCHours(0, 0, 0, 0); 
  const midnightUTC = new Date(nowIST.getTime() - istOffset);
  return midnightUTC.toISOString();
}
// --------------------------------

export async function GET(request: Request) {
  // 1. CRON SECURITY
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("⏱️ [CRON] Running SLA Auto-Reassignment check...");

  try {
    // 2. Define SLA Limit (30 minutes)
    const SLA_MINUTES = 30;
    const timeLimit = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();

    // 3. Find leads breaching SLA
    const { data: expiredLeads, error: leadsError } = await supabase
      .from("leads")
      .select("id, assigned_to, notes")
      .eq("status", "new")
      .not("assigned_to", "is", null)
      .lt("created_at", timeLimit);

    if (leadsError) throw leadsError;

    if (!expiredLeads || expiredLeads.length === 0) {
      console.log("✅ [CRON] No SLA breaches found.");
      return NextResponse.json({ status: "success", message: "No breaches" });
    }

    console.log(`⚠️ [CRON] Found ${expiredLeads.length} leads breaching the ${SLA_MINUTES}m SLA.`);

    // 4. Get active / checked-in telecallers (USING IST FIX & CORRECT COLUMNS)
    const startOfTodayISO = getStartOfTodayIST();

    const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id")
        .gte("check_in", startOfTodayISO) // Fixed column name
        .is("check_out", null);           // Fixed column name

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    console.log(`👥 [CRON] Found ${checkedInUserIds.length} agents currently online.`);

    const { data: telecallers } = await supabase
        .from("users")
        .select("id, full_name")
        .in("role", ["telecaller", "agent", "user"]); 

    const activeTelecallers = telecallers?.filter(t => checkedInUserIds.includes(t.id)) || [];

    // If 1 or 0 agents are online, we can't reassign to "someone else"
    if (activeTelecallers.length <= 1) {
        console.log("⏭️ [CRON] Not enough other online agents to reassign to. Skipping.");
        return NextResponse.json({ status: "skipped", message: "Not enough agents" });
    }

    // 5. Fetch today's assignments for Fair Distribution math
    const { data: todaysLeads } = await supabase
        .from("leads")
        .select("assigned_to")
        .gte("created_at", startOfTodayISO);

    // Count current leads per active telecaller
    const leadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => leadCounts[t.id] = 0);
    if (todaysLeads) {
        todaysLeads.forEach(l => {
            if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) {
                leadCounts[l.assigned_to]++;
            }
        });
    }

    // 6. REASSIGNMENT LOOP
    let reassignedCount = 0;

    for (const lead of expiredLeads) {
        // Remove the agent who breached the SLA from the candidate pool for THIS lead
        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        
        if (eligibleAgents.length === 0) continue; 

        // Find the minimum leads among ELIGIBLE agents
        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        
        // Pick winner
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        // Create the System Note
        const breachNote = `🚨 [SYSTEM: SLA BREACH]\nLead was not contacted within ${SLA_MINUTES} mins. Automatically reassigned to ${winner.full_name}.`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${breachNote}` : breachNote;

        // Update the Lead in Supabase
        await supabase
            .from("leads")
            .update({ 
                assigned_to: winner.id,
                notes: updatedNotes,
                // Reset 'created_at' so the new agent gets a fresh 30 minutes!
                created_at: new Date().toISOString() 
            })
            .eq("id", lead.id);

        // Update our local count so the next lead in the loop goes to someone else
        leadCounts[winner.id]++;
        reassignedCount++;
    }

    console.log(`🔄 [CRON] Successfully reassigned ${reassignedCount} leads.`);
    return NextResponse.json({ status: "success", reassigned: reassignedCount });

  } catch (error: any) {
    console.error("🔥 [CRON ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
