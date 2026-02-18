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

  console.log("⏱️ [CRON] Running SLA & NR Auto-Reassignment check...");

  try {
    // 2. DEFINE LIMITS & THRESHOLDS
    const SLA_MINUTES = 30;
    const NR_HOURS = 3;
    
    const slaTimeLimit = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();
    const nrTimeLimit = new Date(Date.now() - NR_HOURS * 60 * 60 * 1000).toISOString();
    
    // Exact UTC timestamp for: 18th Feb 2026, 8:00 AM IST
    const NR_START_DATE_LIMIT = "2026-02-18T02:30:00.000Z";

    // 3. FETCH BREACHING LEADS (SLA & NR)
    const [slaResponse, nrResponse] = await Promise.all([
      // SLA LEADS (Stuck in 'new' for 30+ mins)
      supabase
        .from("leads")
        .select("id, assigned_to, notes")
        .eq("status", "new")
        .not("assigned_to", "is", null)
        .lt("created_at", slaTimeLimit),
        
      // NR LEADS (Stuck in 'nr' for 3+ hours, created after Feb 18 8AM)
      supabase
        .from("leads")
        .select("id, assigned_to, notes, tags")
        .eq("status", "nr")
        .not("assigned_to", "is", null)
        .gte("created_at", NR_START_DATE_LIMIT)
        .lt("last_contacted", nrTimeLimit) // Using last_contacted safely tracks exactly when they pressed "NR"
    ]);

    if (slaResponse.error) throw slaResponse.error;
    if (nrResponse.error) throw nrResponse.error;

    const expiredLeads = slaResponse.data || [];
    const nrLeads = nrResponse.data || [];

    if (expiredLeads.length === 0 && nrLeads.length === 0) {
      console.log("✅ [CRON] No SLA or NR breaches found.");
      return NextResponse.json({ status: "success", message: "No breaches" });
    }

    console.log(`⚠️ [CRON] Found ${expiredLeads.length} SLA breaches and ${nrLeads.length} NR leads to cycle.`);

    // 4. GET ACTIVE TELECALLERS & FAIR DISTRIBUTION DATA
    const startOfTodayISO = getStartOfTodayIST();

    const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id")
        .gte("check_in", startOfTodayISO) 
        .is("check_out", null);            

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    
    const { data: telecallers } = await supabase
        .from("users")
        .select("id, full_name")
        .in("role", ["telecaller", "agent", "user"]); 

    const activeTelecallers = telecallers?.filter(t => checkedInUserIds.includes(t.id)) || [];

    if (activeTelecallers.length <= 1) {
        console.log("⏭️ [CRON] Not enough other online agents to perform reassignments. Skipping.");
        return NextResponse.json({ status: "skipped", message: "Not enough agents" });
    }

    const { data: todaysLeads } = await supabase
        .from("leads")
        .select("assigned_to")
        .gte("created_at", startOfTodayISO);

    const leadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => leadCounts[t.id] = 0);
    if (todaysLeads) {
        todaysLeads.forEach(l => {
            if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) leadCounts[l.assigned_to]++;
        });
    }

    let reassignedSLA = 0;
    let reassignedNR = 0;
    let movedToDead = 0;

    // ---------------------------------------------------------
    // 5. PROCESS SLA BREACHES (Stuck in 'new')
    // ---------------------------------------------------------
    for (const lead of expiredLeads) {
        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        if (eligibleAgents.length === 0) continue; 

        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        const breachNote = `🚨 [SYSTEM: SLA BREACH]\nLead was not contacted within ${SLA_MINUTES} mins. Automatically reassigned to ${winner.full_name}.`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${breachNote}` : breachNote;

        await supabase.from("leads").update({ 
            assigned_to: winner.id,
            notes: updatedNotes,
            created_at: new Date().toISOString() // Restart SLA timer
        }).eq("id", lead.id);

        leadCounts[winner.id]++;
        reassignedSLA++;
    }

    // ---------------------------------------------------------
    // 6. PROCESS NR RECYCLING (Stuck in 'nr' > 3 Hours)
    // ---------------------------------------------------------
    for (const lead of nrLeads) {
        // Step A: Safely read the tags to check how many times it has been NR'd
        let tags: string[] = [];
        try { tags = Array.isArray(lead.tags) ? lead.tags : JSON.parse(lead.tags || '[]'); } catch(e) {}
        
        const nrStrikes = tags.filter(t => t.startsWith('NR_STRIKE_')).length;

        // Step B: The 4-Strike Dead Bucket Rule
        if (nrStrikes >= 3) { // 3 previous strikes + this current NR = 4 total
            const deadNote = `💀 [SYSTEM: DEAD BUCKET]\nLead reached maximum 4 'No Response' cycles. Moved to Dead Bucket.`;
            const updatedNotes = lead.notes ? `${lead.notes}\n\n${deadNote}` : deadNote;

            await supabase.from("leads").update({
                status: "dead_bucket",
                assigned_to: null, // Unassign from telecaller view
                notes: updatedNotes
            }).eq("id", lead.id);
            
            movedToDead++;
            continue;
        }

        // Step C: Reassign to new Agent
        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        if (eligibleAgents.length === 0) continue;

        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        const currentStrike = nrStrikes + 1;
        tags.push(`NR_STRIKE_${currentStrike}`);

        const reassignmentNote = `🔄 [SYSTEM: NR RECYCLE]\nLead was 'NR' for ${NR_HOURS} hours. Reassigned to ${winner.full_name} (Strike ${currentStrike}/4).`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${reassignmentNote}` : reassignmentNote;

        await supabase.from("leads").update({
            assigned_to: winner.id,
            status: "new",           // Move it back to 'new' for the next caller
            tags: tags,              // Save the new strike count
            notes: updatedNotes,
            created_at: new Date().toISOString() // Restart SLA timer for the new agent!
        }).eq("id", lead.id);

        leadCounts[winner.id]++;
        reassignedNR++;
    }

    console.log(`🔄 [CRON RESULTS] SLA Reassigned: ${reassignedSLA} | NR Recycled: ${reassignedNR} | Sent to Dead: ${movedToDead}`);
    return NextResponse.json({ 
        status: "success", 
        sla_reassigned: reassignedSLA, 
        nr_recycled: reassignedNR, 
        moved_to_dead: movedToDead 
    });

  } catch (error: any) {
    console.error("🔥 [CRON ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
