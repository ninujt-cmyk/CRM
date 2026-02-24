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
    // 2. DEFINE LIMITS & THRESHOLDS
    const SLA_MINUTES = 30;
    const NR_HOURS = 3;
    const INTERESTED_HOURS = 72;
    
    const slaTimeLimit = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();
    const nrTimeLimit = new Date(Date.now() - NR_HOURS * 60 * 60 * 1000).toISOString();
    const interestedTimeLimit = new Date(Date.now() - INTERESTED_HOURS * 60 * 60 * 1000).toISOString();
    
    // Exact UTC timestamp for: 18th Feb 2026, 8:00 AM IST
    const NR_START_DATE_LIMIT = "2026-02-18T02:30:00.000Z";

    // 3. FETCH BREACHING LEADS (SLA, NR & INTERESTED)
    const [slaResponse, nrResponse, interestedResponse] = await Promise.all([
      // A. SLA LEADS (Stuck in 'new' for 30+ mins)
      supabase
        .from("leads")
        .select("id, assigned_to, notes")
        .eq("status", "new")
        .not("assigned_to", "is", null)
        .lt("created_at", slaTimeLimit),
        
      // B. NR LEADS (Stuck in 'nr' for 3+ hours)
      supabase
        .from("leads")
        .select("id, assigned_to, notes, tags")
        .eq("status", "nr")
        .not("assigned_to", "is", null)
        .gte("created_at", NR_START_DATE_LIMIT)
        .lt("last_contacted", nrTimeLimit),
        
      // C. 🔴 INTERESTED LEADS (Stuck in 'interested' with no calls for 72+ hours)
      supabase
        .from("leads")
        .select("id, assigned_to, notes")
        .eq("status", "interested")
        .not("assigned_to", "is", null)
        .lt("last_contacted", interestedTimeLimit)
    ]);

    if (slaResponse.error) throw slaResponse.error;
    if (nrResponse.error) throw nrResponse.error;
    if (interestedResponse.error) throw interestedResponse.error;

    const expiredLeads = slaResponse.data || [];
    const nrLeads = nrResponse.data || [];
    const interestedLeads = interestedResponse.data || [];

    if (expiredLeads.length === 0 && nrLeads.length === 0 && interestedLeads.length === 0) {
      console.log("✅ [CRON] No SLA, NR, or Stale Interested breaches found.");
      return NextResponse.json({ status: "success", message: "No breaches" });
    }

    console.log(`⚠️ [CRON] Found: ${expiredLeads.length} SLA, ${nrLeads.length} NR, ${interestedLeads.length} Stale Interested.`);

    // ---------------------------------------------------------
    // 4. GET ACTIVE TELECALLERS (BULLETPROOF FIX)
    // ---------------------------------------------------------
    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();

    const { data: attendanceData, error: attError } = await supabase
        .from("attendance")
        .select("user_id")
        .gte("check_in", maxShiftStart) 
        .is("check_out", null);            

    if (attError) console.error("❌ Attendance Fetch Error:", attError);

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    
    // Fetch all users to check roles manually
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

    if (activeTelecallers.length <= 5) {
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
            notes: updatedNotes
        }).eq("id", lead.id);

        leadCounts[winner.id]++;
        reassignedSLA++;
    }

    // ---------------------------------------------------------
    // 6. PROCESS NR RECYCLING (Stuck in 'nr' > 3 Hours)
    // ---------------------------------------------------------
    for (const lead of nrLeads) {
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
            notes: updatedNotes
        }).eq("id", lead.id);

        leadCounts[winner.id]++;
        reassignedNR++;
    }

    // ---------------------------------------------------------
    // 7. 🔴 PROCESS STALE INTERESTED LEADS (> 72 Hours)
    // ---------------------------------------------------------
    for (const lead of interestedLeads) {
        const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
        if (eligibleAgents.length === 0) continue;

        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

        const staleNote = `🚨 [SYSTEM: STALE LEAD]\nLead was marked 'Interested' but had no calls logged for ${INTERESTED_HOURS} hours. Reassigned to ${winner.full_name} as 'New'.`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${staleNote}` : staleNote;

        await supabase.from("leads").update({
            assigned_to: winner.id,
            status: "new",          // Revert to new so the agent knows to act on it
            notes: updatedNotes
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
