import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- IST TIMEZONE CALCULATOR (Used for Lead Distribution count) ---
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

  console.log("⏱️ [CRON] Running SLA, NR & Interested Auto-Reassignment check...");

  try {
    // 2. DEFINE LIMITS & THRESHOLDS (in milliseconds)
    const SLA_MINUTES = 30;
    const NR_HOURS = 3;
    const INTERESTED_HOURS = 72;
    
    const nowMs = Date.now();
    const slaLimitMs = nowMs - (SLA_MINUTES * 60 * 1000);
    const nrLimitMs = nowMs - (NR_HOURS * 60 * 60 * 1000);
    const interestedLimitMs = nowMs - (INTERESTED_HOURS * 60 * 60 * 1000);
    
    // Exact UTC timestamp for: 18th Feb 2026, 8:00 AM IST
    const NR_START_DATE_LIMIT = "2026-02-18T02:30:00.000Z";

    // 3. FETCH LEADS (🔴 FIX: Using .ilike() for case-insensitivity & pulling all timers into JS)
    const [newLeadsResponse, nrResponse, interestedResponse] = await Promise.all([
      // A. SLA LEADS
      supabase
        .from("leads")
        .select("id, assigned_to, notes, created_at, last_contacted")
        .ilike("status", "new")
        .not("assigned_to", "is", null),
        
      // B. NR LEADS
      supabase
        .from("leads")
        .select("id, assigned_to, notes, tags, created_at, last_contacted")
        .ilike("status", "nr")
        .not("assigned_to", "is", null)
        .gte("created_at", NR_START_DATE_LIMIT),
        
      // C. INTERESTED LEADS
      supabase
        .from("leads")
        .select("id, assigned_to, notes, created_at, last_contacted")
        .ilike("status", "interested")
        .not("assigned_to", "is", null)
    ]);

    if (newLeadsResponse.error) throw newLeadsResponse.error;
    if (nrResponse.error) throw nrResponse.error;
    if (interestedResponse.error) throw interestedResponse.error;

    // 🔴 SMART FILTERING: Check last_contacted first, fallback to created_at
    const expiredSlaLeads = (newLeadsResponse.data || []).filter(lead => {
        const timerStart = lead.last_contacted ? new Date(lead.last_contacted).getTime() : new Date(lead.created_at).getTime();
        return timerStart < slaLimitMs;
    });

    const expiredNrLeads = (nrResponse.data || []).filter(lead => {
        const timerStart = lead.last_contacted ? new Date(lead.last_contacted).getTime() : new Date(lead.created_at).getTime();
        return timerStart < nrLimitMs;
    });

    const expiredInterestedLeads = (interestedResponse.data || []).filter(lead => {
        const timerStart = lead.last_contacted ? new Date(lead.last_contacted).getTime() : new Date(lead.created_at).getTime();
        return timerStart < interestedLimitMs;
    });

    if (expiredSlaLeads.length === 0 && expiredNrLeads.length === 0 && expiredInterestedLeads.length === 0) {
      console.log("✅ [CRON] No SLA, NR, or Stale Interested breaches found.");
      return NextResponse.json({ status: "success", message: "No breaches" });
    }

    console.log(`⚠️ [CRON] Found: ${expiredSlaLeads.length} SLA, ${expiredNrLeads.length} NR, ${expiredInterestedLeads.length} Stale Interested.`);

    // ---------------------------------------------------------
    // 4. GET ACTIVE TELECALLERS
    // ---------------------------------------------------------
    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();

    const { data: attendanceData, error: attError } = await supabase
        .from("attendance")
        .select("user_id")
        .gte("check_in", maxShiftStart) 
        .is("check_out", null);            

    if (attError) console.error("❌ Attendance Fetch Error:", attError);

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    
    const { data: allUsers, error: userError } = await supabase
        .from("users")
        .select("id, full_name, role"); 

    if (userError) console.error("❌ User Fetch Error:", userError);

    const validRoles = ["telecaller", "agent", "user"];
    
    const activeTelecallers = allUsers?.filter(user => {
        if (!checkedInUserIds.includes(user.id)) return false;
        const userRole = (user.role || "").toLowerCase();
        return validRoles.includes(userRole);
    }) || [];

    if (activeTelecallers.length <= 1) {
        console.log("⏭️ [CRON] Not enough other online agents to perform reassignments. Skipping.");
        return NextResponse.json({ status: "skipped", message: "Not enough agents" });
    }

    // Fair Distribution Count
    const startOfTodayISO = getStartOfTodayIST();
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
    let reassignedInterested = 0;
    let movedToDead = 0;

    const currentISOTime = new Date().toISOString(); // Master time for resets

    // ---------------------------------------------------------
    // 5. PROCESS SLA BREACHES
    // ---------------------------------------------------------
    for (const lead of expiredSlaLeads) {
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
            last_contacted: currentISOTime // 🔴 Reset timer
        }).eq("id", lead.id);

        leadCounts[winner.id]++;
        reassignedSLA++;
    }

    // ---------------------------------------------------------
    // 6. PROCESS NR RECYCLING
    // ---------------------------------------------------------
    for (const lead of expiredNrLeads) {
        let tags: string[] = [];
        try { tags = Array.isArray(lead.tags) ? lead.tags : JSON.parse(lead.tags || '[]'); } catch(e) {}
        
        const nrStrikes = tags.filter(t => t.startsWith('NR_STRIKE_')).length;

        if (nrStrikes >= 3) { 
            const deadNote = `💀 [SYSTEM: DEAD BUCKET]\nLead reached maximum 4 'No Response' cycles. Moved to Dead Bucket.`;
            const updatedNotes = lead.notes ? `${lead.notes}\n\n${deadNote}` : deadNote;

            await supabase.from("leads").update({
                status: "dead_bucket",
                assigned_to: null, 
                notes: updatedNotes
            }).eq("id", lead.id);
            
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

        await supabase.from("leads").update({
            assigned_to: winner.id,
            status: "new",           
            tags: tags,              
            notes: updatedNotes,
            last_contacted: currentISOTime // 🔴 Reset timer
        }).eq("id", lead.id);

        leadCounts[winner.id]++;
        reassignedNR++;
    }

    // ---------------------------------------------------------
    // 7. PROCESS STALE INTERESTED LEADS
    // ---------------------------------------------------------
    for (const lead of expiredInterestedLeads) {
        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        if (eligibleAgents.length === 0) continue;

        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        const staleNote = `🚨 [SYSTEM: STALE LEAD]\nLead was marked 'Interested' but had no calls logged for ${INTERESTED_HOURS} hours. Reassigned to ${winner.full_name} as 'New'.`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${staleNote}` : staleNote;

        await supabase.from("leads").update({
            assigned_to: winner.id,
            status: "new",          
            notes: updatedNotes,
            last_contacted: currentISOTime // 🔴 Reset timer
        }).eq("id", lead.id);

        leadCounts[winner.id]++;
        reassignedInterested++;
    }

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
