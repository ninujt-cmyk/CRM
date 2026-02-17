import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  // 1. CRON SECURITY: Ensure only Vercel can trigger this route
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("⏱️ [CRON] Running SLA Auto-Reassignment check...");

  try {
    // 2. Define SLA Limit (e.g., 30 minutes)
    const SLA_MINUTES = 30;
    const timeLimit = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();

    // 3. Find leads that are "new", assigned to someone, and older than 30 mins
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

    // 4. Get active / checked-in telecallers
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id")
        .gte("created_at", startOfDay.toISOString())
        .is("check_out_time", null);

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];

    const { data: telecallers } = await supabase
        .from("users")
        .select("id, full_name")
        .in("role", ["telecaller", "agent", "user"]); 

    const activeTelecallers = telecallers?.filter(t => checkedInUserIds.includes(t.id)) || [];

    if (activeTelecallers.length <= 1) {
        console.log("⏭️ [CRON] Not enough other online agents to reassign to. Skipping.");
        return NextResponse.json({ status: "skipped", message: "Not enough agents" });
    }

    // 5. Fetch today's assignments for Fair Distribution math
    const { data: todaysLeads } = await supabase
        .from("leads")
        .select("assigned_to")
        .gte("created_at", startOfDay.toISOString());

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
        
        if (eligibleAgents.length === 0) continue; // Skip if no one else is online

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
                // Optional: Update 'created_at' to right now, so the NEW agent gets 30 minutes on their clock!
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
