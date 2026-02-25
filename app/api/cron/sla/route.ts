import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// --- HELPER: IST TIMEZONE ---
function getStartOfTodayIST() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; 
  const nowIST = new Date(now.getTime() + istOffset);
  nowIST.setUTCHours(0, 0, 0, 0); 
  const midnightUTC = new Date(nowIST.getTime() - istOffset);
  return midnightUTC.toISOString();
}

// --- HELPER: SAFE DATE PARSER (Protects against corrupt CSV dates) ---
function getSafeTime(primaryDate: any, fallbackDate: any) {
    let time = new Date(primaryDate).getTime();
    if (isNaN(time)) time = new Date(fallbackDate).getTime();
    return isNaN(time) ? 0 : time;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("\n=======================================================");
  console.log("⏱️ [CRON START] Running SLA, NR & Interested Check...");
  console.log("=======================================================");

  try {
    const SLA_MINUTES = 30;
    const NR_HOURS = 3;
    const INTERESTED_HOURS = 72;
    
    const slaLimitTimestamp = Date.now() - (SLA_MINUTES * 60 * 1000);
    const nrLimitTimestamp = Date.now() - (NR_HOURS * 60 * 60 * 1000);
    const interestedLimitTimestamp = Date.now() - (INTERESTED_HOURS * 60 * 60 * 1000);

    console.log("📡 [DEBUG] Fetching leads from database (Limit 5000)...");

    // 1. FETCH ALL POTENTIAL LEADS (Increased limit to 5000, removed Feb 18 limit!)
    const [newLeadsRes, nrRes, interestedRes] = await Promise.all([
      supabase.from("leads").select("id, assigned_to, notes, created_at, last_contacted").ilike("status", "new").not("assigned_to", "is", null).limit(5000),
      supabase.from("leads").select("id, assigned_to, notes, tags, created_at, last_contacted").ilike("status", "nr").not("assigned_to", "is", null).limit(5000),
      supabase.from("leads").select("id, assigned_to, notes, created_at, last_contacted").ilike("status", "interested").not("assigned_to", "is", null).limit(5000)
    ]);

    if (newLeadsRes.error) console.error("❌ DB Fetch Error (New):", newLeadsRes.error);
    if (nrRes.error) console.error("❌ DB Fetch Error (NR):", nrRes.error);
    if (interestedRes.error) console.error("❌ DB Fetch Error (Interested):", interestedRes.error);

    const allNewLeads = newLeadsRes.data || [];
    const allNrLeads = nrRes.data || [];
    const allInterestedLeads = interestedRes.data || [];

    console.log(`📊 [DEBUG] Raw DB Counts -> New: ${allNewLeads.length} | NR: ${allNrLeads.length} | Interested: ${allInterestedLeads.length}`);

    // 2. FILTER IN JAVASCRIPT (Bulletproof Time Checks)
    const expiredSlaLeads = allNewLeads.filter(lead => {
        const timerStart = getSafeTime(lead.last_contacted, lead.created_at);
        return timerStart > 0 && timerStart < slaLimitTimestamp;
    });

    const expiredNrLeads = allNrLeads.filter(lead => {
        const timerStart = getSafeTime(lead.last_contacted, lead.created_at);
        return timerStart > 0 && timerStart < nrLimitTimestamp;
    });

    const expiredInterestedLeads = allInterestedLeads.filter(lead => {
        const timerStart = getSafeTime(lead.last_contacted, lead.created_at);
        return timerStart > 0 && timerStart < interestedLimitTimestamp;
    });

    console.log(`⚠️ [CRON Target] SLA Breaches: ${expiredSlaLeads.length} | NR to Cycle: ${expiredNrLeads.length} | Stale Interested: ${expiredInterestedLeads.length}`);

    // EXTREME DEBUGGING FOR NR LEADS
    if (expiredNrLeads.length === 0 && allNrLeads.length > 0) {
        const sample = allNrLeads[0];
        const ageHours = ((Date.now() - getSafeTime(sample.last_contacted, sample.created_at)) / (1000 * 60 * 60)).toFixed(2);
        console.log(`🔍 [DEBUG] Why 0 NR? Sample NR lead (${sample.id}) is only ${ageHours} hours old. Needs to be > 3 hours.`);
    }

    if (expiredSlaLeads.length === 0 && expiredNrLeads.length === 0 && expiredInterestedLeads.length === 0) {
      return NextResponse.json({ status: "success", message: "No breaches found." });
    }

    // 3. GET ACTIVE TELECALLERS
    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
    const { data: attendanceData } = await supabase.from("attendance").select("user_id").gte("check_in", maxShiftStart).is("check_out", null);            
    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    
    const { data: allUsers } = await supabase.from("users").select("id, full_name, role"); 
    const validRoles = ["telecaller", "agent", "user"];
    const activeTelecallers = allUsers?.filter(user => checkedInUserIds.includes(user.id) && validRoles.includes((user.role || "").toLowerCase())) || [];

    console.log(`👥 [DEBUG] Online Agents Found: ${activeTelecallers.length}`);

    if (activeTelecallers.length <= 1) {
        console.log("⏭️ [CRON] Not enough online agents to reassign. Skipping logic.");
        return NextResponse.json({ status: "skipped", message: "Not enough agents" });
    }

    // Lead Counts for Fair Distribution
    const startOfTodayISO = getStartOfTodayIST();
    const { data: todaysLeads } = await supabase.from("leads").select("assigned_to").gte("created_at", startOfTodayISO);
    const leadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => leadCounts[t.id] = 0);
    if (todaysLeads) {
        todaysLeads.forEach(l => {
            if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) leadCounts[l.assigned_to]++;
        });
    }

    let reassignedSLA = 0, reassignedNR = 0, reassignedInterested = 0, movedToDead = 0;
    let updateFailures = 0;

    // --- HELPER FUNCTION: FIND WINNER ---
    const getWinner = (currentAgentId: string) => {
        const eligibleAgents = activeTelecallers.filter(t => t.id !== currentAgentId);
        if (eligibleAgents.length === 0) return null;
        const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
        const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
        return tiedAgents[Math.floor(Math.random() * tiedAgents.length)];
    };

    // ---------------------------------------------------------
    // 5. PROCESS SLA BREACHES
    // ---------------------------------------------------------
    for (const lead of expiredSlaLeads) {
        const winner = getWinner(lead.assigned_to);
        if (!winner) continue;

        const breachNote = `🚨 [SYSTEM: SLA BREACH]\nLead was not contacted within ${SLA_MINUTES} mins. Automatically reassigned to ${winner.full_name}.`;
        const updatedNotes = lead.notes ? `${lead.notes}\n\n${breachNote}` : breachNote;

        const { error: updateError } = await supabase.from("leads").update({ 
            assigned_to: winner.id,
            notes: updatedNotes,
            last_contacted: new Date().toISOString() 
        }).eq("id", lead.id);

        if (updateError) { console.error(`❌ [SLA FAIL] ${lead.id}:`, updateError.message); updateFailures++; } 
        else { leadCounts[winner.id]++; reassignedSLA++; }
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
            const { error: deadError } = await supabase.from("leads").update({
                status: "dead_bucket", assigned_to: null, notes: lead.notes ? `${lead.notes}\n\n${deadNote}` : deadNote
            }).eq("id", lead.id);
            
            if (deadError) { console.error(`❌ [DEAD FAIL] ${lead.id}:`, deadError.message); updateFailures++; }
            else movedToDead++;
            continue;
        }

        const winner = getWinner(lead.assigned_to);
        if (!winner) continue;

        const currentStrike = nrStrikes + 1;
        tags.push(`NR_STRIKE_${currentStrike}`);
        const reassignmentNote = `🔄 [SYSTEM: NR RECYCLE]\nLead was 'NR' for ${NR_HOURS} hours. Reassigned to ${winner.full_name} (Strike ${currentStrike}/4).`;
        
        const { error: updateError } = await supabase.from("leads").update({
            assigned_to: winner.id,
            status: "new",           
            tags: tags,              
            notes: lead.notes ? `${lead.notes}\n\n${reassignmentNote}` : reassignmentNote,
            last_contacted: new Date().toISOString()
        }).eq("id", lead.id);

        if (updateError) { console.error(`❌ [NR FAIL] ${lead.id}:`, updateError.message); updateFailures++; } 
        else { leadCounts[winner.id]++; reassignedNR++; }
    }

    // ---------------------------------------------------------
    // 7. PROCESS STALE INTERESTED LEADS
    // ---------------------------------------------------------
    for (const lead of expiredInterestedLeads) {
        const winner = getWinner(lead.assigned_to);
        if (!winner) continue;

        const staleNote = `🚨 [SYSTEM: STALE LEAD]\nLead was marked 'Interested' but had no calls logged for ${INTERESTED_HOURS} hours. Reassigned to ${winner.full_name} as 'New'.`;
        
        const { error: updateError } = await supabase.from("leads").update({
            assigned_to: winner.id,
            status: "new",          
            notes: lead.notes ? `${lead.notes}\n\n${staleNote}` : staleNote,
            last_contacted: new Date().toISOString() 
        }).eq("id", lead.id);

        if (updateError) { console.error(`❌ [INTERESTED FAIL] ${lead.id}:`, updateError.message); updateFailures++; } 
        else { leadCounts[winner.id]++; reassignedInterested++; }
    }

    console.log(`✅ [CRON COMPLETE] SLA: ${reassignedSLA} | NR: ${reassignedNR} | Interested: ${reassignedInterested} | Dead: ${movedToDead} | Failures: ${updateFailures}`);
    
    return NextResponse.json({ 
        status: "success", 
        sla_reassigned: reassignedSLA, 
        nr_recycled: reassignedNR, 
        interested_recycled: reassignedInterested,
        moved_to_dead: movedToDead,
        database_failures: updateFailures
    });

  } catch (error: any) {
    console.error("🔥 [CRON FATAL ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
