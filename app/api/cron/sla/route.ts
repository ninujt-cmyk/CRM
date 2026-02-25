import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getStartOfTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; 
  const nowIST = new Date(now.getTime() + istOffset);
  nowIST.setUTCHours(0, 0, 0, 0); 
  const midnightUTC = new Date(nowIST.getTime() - istOffset);
  return midnightUTC.toISOString();
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("⏱️ [CRON] Running SLA, NR & Interested Auto-Reassignment check...");

  try {
    const SLA_MINUTES = 30;
    const NR_HOURS = 3;
    const INTERESTED_HOURS = 72;
    
    const nrTimeLimit = new Date(Date.now() - NR_HOURS * 60 * 60 * 1000).toISOString();
    const interestedTimeLimit = new Date(Date.now() - INTERESTED_HOURS * 60 * 60 * 1000).toISOString();
    
    // Exact UTC timestamp for: 18th Feb 2026, 8:00 AM IST
    const START_DATE_LIMIT = "2026-02-18T02:30:00.000Z";

    // 1. FETCH BREACHING LEADS
    const [newLeadsResponse, nrResponse, interestedResponse] = await Promise.all([
      // A. SLA LEADS (🔴 FIX: Added Date Limit to prevent sweeping ancient leads)
      supabase
        .from("leads")
        .select("id, assigned_to, notes, created_at, last_contacted")
        .eq("status", "new")
        .not("assigned_to", "is", null)
        .gte("created_at", START_DATE_LIMIT),
        
      // B. NR LEADS
      supabase
        .from("leads")
        .select("id, assigned_to, notes, tags")
        .eq("status", "nr")
        .not("assigned_to", "is", null)
        .gte("created_at", START_DATE_LIMIT)
        .lt("last_contacted", nrTimeLimit),
        
      // C. INTERESTED LEADS
      supabase
        .from("leads")
        .select("id, assigned_to, notes")
        .eq("status", "interested")
        .not("assigned_to", "is", null)
        .gte("created_at", START_DATE_LIMIT)
        .lt("last_contacted", interestedTimeLimit)
    ]);

    if (newLeadsResponse.error) throw newLeadsResponse.error;
    if (nrResponse.error) throw nrResponse.error;
    if (interestedResponse.error) throw interestedResponse.error;

    // SMART SLA FILTERING
    const allNewLeads = newLeadsResponse.data || [];
    const slaLimitTimestamp = Date.now() - (SLA_MINUTES * 60 * 1000);
    
    const expiredLeads = allNewLeads.filter(lead => {
        const timerStart = lead.last_contacted ? new Date(lead.last_contacted).getTime() : new Date(lead.created_at).getTime();
        return timerStart < slaLimitTimestamp;
    });

    const nrLeads = nrResponse.data || [];
    const interestedLeads = interestedResponse.data || [];

    if (expiredLeads.length === 0 && nrLeads.length === 0 && interestedLeads.length === 0) {
      console.log("✅ [CRON] No SLA, NR, or Stale Interested breaches found.");
      return NextResponse.json({ status: "success", message: "No breaches" });
    }

    console.log(`⚠️ [CRON] Found: ${expiredLeads.length} SLA, ${nrLeads.length} NR, ${interestedLeads.length} Stale Interested.`);

    // 2. GET ACTIVE TELECALLERS
    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
    const { data: attendanceData } = await supabase.from("attendance").select("user_id").gte("check_in", maxShiftStart).is("check_out", null);            
    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    
    const { data: allUsers } = await supabase.from("users").select("id, full_name, role"); 
    const validRoles = ["telecaller", "agent", "user"];
    const activeTelecallers = allUsers?.filter(user => checkedInUserIds.includes(user.id) && validRoles.includes((user.role || "").toLowerCase())) || [];

    if (activeTelecallers.length <= 1) {
        console.log("⏭️ [CRON] Not enough other online agents to perform reassignments. Skipping.");
        return NextResponse.json({ status: "skipped", message: "Not enough agents" });
    }

    // Fair Distribution Count
    const startOfTodayISO = getStartOfTodayIST();
    const { data: todaysLeads } = await supabase.from("leads").select("assigned_to").gte("created_at", startOfTodayISO);

    const leadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => leadCounts[t.id] = 0);
    if (todaysLeads) {
        todaysLeads.forEach(l => {
            if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) leadCounts[l.assigned_to]++;
        });
    }

    let reassignedSLA = 0; let reassignedNR = 0; let reassignedInterested = 0; let movedToDead = 0;
    
    // 🔴 FIX: COLLECT ALL DATABASE UPDATES IN AN ARRAY FOR PARALLEL EXECUTION
    const dbUpdatePromises: Promise<any>[] = [];

    // 3. PROCESS SLA BREACHES
    for (const lead of expiredLeads) {
        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        if (eligibleAgents.length === 0) continue; 

        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        const breachNote = `🚨 [SYSTEM: SLA BREACH]\nLead was not contacted within ${SLA_MINUTES} mins. Automatically reassigned to ${winner.full_name}.`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${breachNote}` : breachNote;

        dbUpdatePromises.push(
            supabase.from("leads").update({ 
                assigned_to: winner.id,
                notes: updatedNotes,
                last_contacted: new Date().toISOString() 
            }).eq("id", lead.id)
        );

        leadCounts[winner.id]++;
        reassignedSLA++;
    }

    // 4. PROCESS NR RECYCLING
    for (const lead of nrLeads) {
        let tags: string[] = [];
        try { tags = Array.isArray(lead.tags) ? lead.tags : JSON.parse(lead.tags || '[]'); } catch(e) {}
        const nrStrikes = tags.filter(t => t.startsWith('NR_STRIKE_')).length;

        if (nrStrikes >= 3) { 
            const deadNote = `💀 [SYSTEM: DEAD BUCKET]\nLead reached maximum 4 'No Response' cycles. Moved to Dead Bucket.`;
            const updatedNotes = lead.notes ? `${lead.notes}\n\n${deadNote}` : deadNote;

            dbUpdatePromises.push(
                supabase.from("leads").update({
                    status: "dead_bucket", assigned_to: null, notes: updatedNotes
                }).eq("id", lead.id)
            );
            movedToDead++;
            continue;
        }

        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        if (eligibleAgents.length === 0) continue;

        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        const currentStrike = nrStrikes + 1;
        tags.push(`NR_STRIKE_${currentStrike}`);

        const reassignmentNote = `🔄 [SYSTEM: NR RECYCLE]\nLead was 'NR' for ${NR_HOURS} hours. Reassigned to ${winner.full_name} (Strike ${currentStrike}/4).`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${reassignmentNote}` : reassignmentNote;

        dbUpdatePromises.push(
            supabase.from("leads").update({
                assigned_to: winner.id, status: "new", tags: tags, notes: updatedNotes,
                last_contacted: new Date().toISOString()
            }).eq("id", lead.id)
        );

        leadCounts[winner.id]++;
        reassignedNR++;
    }

    // 5. PROCESS STALE INTERESTED LEADS
    for (const lead of interestedLeads) {
        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        if (eligibleAgents.length === 0) continue;

        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        const staleNote = `🚨 [SYSTEM: STALE LEAD]\nLead was marked 'Interested' but had no calls logged for ${INTERESTED_HOURS} hours. Reassigned to ${winner.full_name} as 'New'.`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${staleNote}` : staleNote;

        dbUpdatePromises.push(
            supabase.from("leads").update({
                assigned_to: winner.id, status: "new", notes: updatedNotes,
                last_contacted: new Date().toISOString()
            }).eq("id", lead.id)
        );

        leadCounts[winner.id]++;
        reassignedInterested++;
    }

    // 🔴 FIX: FIRE ALL DATABASE UPDATES AT ONCE IN PARALLEL
    await Promise.all(dbUpdatePromises);

    console.log(`🔄 [CRON RESULTS] SLA Reassigned: ${reassignedSLA} | NR Recycled: ${reassignedNR} | Interested Recycled: ${reassignedInterested} | Sent to Dead: ${movedToDead}`);
    
    return NextResponse.json({ 
        status: "success", 
        sla_reassigned: reassignedSLA, 
        nr_recycled: reassignedNR, 
        interested_recycled: reassignedInterested,
        moved_to_dead: movedToDead 
    });

  } catch (error: any) {
    console.error("🔥 [CRON ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
