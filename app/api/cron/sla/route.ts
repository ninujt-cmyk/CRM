import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
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

  console.log("⏱️ [CRON] Running Multi-Tenant SLA & NR Auto-Reassignment...");

  try {
    // 🔴 1. FETCH ENABLED TENANTS
    const { data: activeSettings } = await supabaseAdmin.from('tenant_settings').select('tenant_id').eq('cron_sla', true);
    const enabledTenantIds = activeSettings?.map(s => s.tenant_id) || [];
    
    if (enabledTenantIds.length === 0) {
      console.log("⏸️ SLA Cron is paused for all tenants.");
      return NextResponse.json({ message: "Job paused for all tenants." });
    }

    const SLA_MINUTES = 30; const NR_HOURS = 3;
    const slaTimeLimit = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();
    const nrTimeLimit = new Date(Date.now() - NR_HOURS * 60 * 60 * 1000).toISOString();
    const NR_START_DATE_LIMIT = "2026-02-18T02:30:00.000Z";
    const startOfTodayISO = getStartOfTodayIST();
    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();

    const { data: tenants, error: tenantError } = await supabaseAdmin.from('organizations').select('id, name');
    if (tenantError || !tenants) return NextResponse.json({ status: "success", message: "No tenants found." });

    let totalSlaReassigned = 0; let totalNrRecycled = 0; let totalMovedToDead = 0;

    for (const tenant of tenants) {
        // 🔴 2. SKIP IF PAUSED FOR THIS TENANT
        if (!enabledTenantIds.includes(tenant.id)) {
            console.log(`⏸️ Skipping Tenant: ${tenant.name} (SLA Paused)`);
            continue;
        }

        console.log(`\n🏢 Processing Tenant: ${tenant.name} (${tenant.id})`);

        const [slaResponse, nrResponse] = await Promise.all([
          supabaseAdmin.from("leads").select("id, assigned_to, notes").eq("tenant_id", tenant.id).eq("status", "new").not("assigned_to", "is", null).lt("created_at", slaTimeLimit),
          supabaseAdmin.from("leads").select("id, assigned_to, notes, tags").eq("tenant_id", tenant.id).eq("status", "nr").not("assigned_to", "is", null).gte("created_at", NR_START_DATE_LIMIT).lt("last_contacted", nrTimeLimit) 
        ]);

        const expiredLeads = slaResponse.data || [];
        const nrLeads = nrResponse.data || [];

        if (expiredLeads.length === 0 && nrLeads.length === 0) continue; 

        const { data: attendanceData } = await supabaseAdmin.from("attendance").select("user_id").eq("tenant_id", tenant.id).gte("check_in", maxShiftStart).is("check_out", null);            
        const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
        const { data: allUsers } = await supabaseAdmin.from("users").select("id, full_name, role").eq("tenant_id", tenant.id);
        const activeTelecallers = allUsers?.filter(user => checkedInUserIds.includes(user.id) && ["telecaller", "agent", "user"].includes((user.role || "").toLowerCase())) || [];

        if (activeTelecallers.length === 0) continue; 

        const { data: todaysLeads } = await supabaseAdmin.from("leads").select("assigned_to").eq("tenant_id", tenant.id).gte("created_at", startOfTodayISO);
        const leadCounts: Record<string, number> = {};
        activeTelecallers.forEach(t => leadCounts[t.id] = 0);
        if (todaysLeads) todaysLeads.forEach(l => { if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) leadCounts[l.assigned_to]++; });

        for (const lead of expiredLeads) {
            const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
            if (eligibleAgents.length === 0) continue; 
            const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
            const winner = eligibleAgents.filter(a => leadCounts[a.id] === minLeads)[Math.floor(Math.random() * eligibleAgents.filter(a => leadCounts[a.id] === minLeads).length)];
            const breachNote = `🚨 [SYSTEM: SLA BREACH]\nLead was not contacted within ${SLA_MINUTES} mins. Automatically reassigned to ${winner.full_name}.`;
            await supabaseAdmin.from("leads").update({ assigned_to: winner.id, notes: lead.notes ? `${lead.notes}\n\n${breachNote}` : breachNote }).eq("id", lead.id);
            leadCounts[winner.id]++; totalSlaReassigned++;
        }

        for (const lead of nrLeads) {
            let tags: string[] = [];
            try { tags = Array.isArray(lead.tags) ? lead.tags : JSON.parse(lead.tags || '[]'); } catch(e) {}
            const nrStrikes = tags.filter(t => t.startsWith('NR_STRIKE_')).length;

            if (nrStrikes >= 3) { 
                const deadNote = `💀 [SYSTEM: DEAD BUCKET]\nLead reached maximum 4 'No Response' cycles. Moved to Dead Bucket.`;
                await supabaseAdmin.from("leads").update({ status: "dead_bucket", assigned_to: null, notes: lead.notes ? `${lead.notes}\n\n${deadNote}` : deadNote }).eq("id", lead.id);
                totalMovedToDead++; continue;
            }

            const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
            if (eligibleAgents.length === 0) continue;
            const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
            const winner = eligibleAgents.filter(a => leadCounts[a.id] === minLeads)[Math.floor(Math.random() * eligibleAgents.filter(a => leadCounts[a.id] === minLeads).length)];
            const currentStrike = nrStrikes + 1; tags.push(`NR_STRIKE_${currentStrike}`);
            const reassignmentNote = `🔄 [SYSTEM: NR RECYCLE]\nLead was 'NR' for ${NR_HOURS} hours. Reassigned to ${winner.full_name} (Strike ${currentStrike}/4).`;
            await supabaseAdmin.from("leads").update({ assigned_to: winner.id, status: "new", tags: tags, notes: lead.notes ? `${lead.notes}\n\n${reassignmentNote}` : reassignmentNote }).eq("id", lead.id);
            leadCounts[winner.id]++; totalNrRecycled++;
        }
    } 

    return NextResponse.json({ status: "success", sla_reassigned: totalSlaReassigned, nr_recycled: totalNrRecycled, moved_to_dead: totalMovedToDead });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
