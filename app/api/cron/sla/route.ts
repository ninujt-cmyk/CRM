// app/api/cron/sla/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Admin client required to see all tenants
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

  console.log("⏱️ [CRON] Running Multi-Tenant SLA & NR Auto-Reassignment check...");

  try {
    const SLA_MINUTES = 30;
    const NR_HOURS = 3;
    
    const slaTimeLimit = new Date(Date.now() - SLA_MINUTES * 60 * 1000).toISOString();
    const nrTimeLimit = new Date(Date.now() - NR_HOURS * 60 * 60 * 1000).toISOString();
    
    // Exact UTC timestamp for: 18th Feb 2026, 8:00 AM IST
    const NR_START_DATE_LIMIT = "2026-02-18T02:30:00.000Z";
    const startOfTodayISO = getStartOfTodayIST();
    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();

    // 🔴 2. FETCH TENANTS WITH SLA CRON ENABLED
    const { data: activeSettings, error: settingsError } = await supabaseAdmin
        .from('tenant_settings')
        .select('tenant_id')
        .eq('cron_sla', true);

    if (settingsError) throw settingsError;
    if (!activeSettings || activeSettings.length === 0) {
        console.log("⏭️ [CRON] No tenants have SLA auto-reassignment enabled. Skipping.");
        return NextResponse.json({ status: "success", message: "No tenants opted in." });
    }

    const enabledTenantIds = activeSettings.map(s => s.tenant_id);

    // Fetch organizations so we can log their names
    const { data: tenants, error: tenantError } = await supabaseAdmin
        .from('organizations')
        .select('id, name')
        .in('id', enabledTenantIds);

    if (tenantError) throw tenantError;
    if (!tenants || tenants.length === 0) return NextResponse.json({ status: "success", message: "No valid organizations found." });

    let totalSlaReassigned = 0;
    let totalNrRecycled = 0;
    let totalMovedToDead = 0;

    // 🔴 3. PROCESS EACH TENANT IN ISOLATION
    for (const tenant of tenants) {
        console.log(`\n🏢 Processing Tenant: ${tenant.name} (${tenant.id})`);

        // Fetch SLA and NR Leads strictly for this tenant
        const [slaResponse, nrResponse] = await Promise.all([
          // SLA LEADS (Stuck in 'new' for 30+ mins)
          supabaseAdmin
            .from("leads")
            .select("id, assigned_to, notes")
            .eq("tenant_id", tenant.id) // ISOLATION
            .eq("status", "new")
            .not("assigned_to", "is", null)
            .lt("created_at", slaTimeLimit),
            
          // NR LEADS (Stuck in 'nr' for 3+ hours)
          supabaseAdmin
            .from("leads")
            .select("id, assigned_to, notes, tags")
            .eq("tenant_id", tenant.id) // ISOLATION
            .eq("status", "nr")
            .not("assigned_to", "is", null)
            .gte("created_at", NR_START_DATE_LIMIT)
            .lt("last_contacted", nrTimeLimit) 
        ]);

        const expiredLeads = slaResponse.data || [];
        const nrLeads = nrResponse.data || [];

        if (expiredLeads.length === 0 && nrLeads.length === 0) {
          console.log(`   ✅ No SLA or NR breaches for ${tenant.name}.`);
          continue; // Move to next tenant
        }

        console.log(`   ⚠️ Found ${expiredLeads.length} SLA breaches and ${nrLeads.length} NR leads.`);

        // Fetch active telecallers strictly for this tenant
        const { data: attendanceData } = await supabaseAdmin
            .from("attendance")
            .select("user_id")
            .eq("tenant_id", tenant.id) // ISOLATION
            .gte("check_in", maxShiftStart) 
            .is("check_out", null);            

        const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
        
        const { data: allUsers } = await supabaseAdmin
            .from("users")
            .select("id, full_name, role")
            .eq("tenant_id", tenant.id); // ISOLATION

        const validRoles = ["telecaller", "agent", "user"];
        
        const activeTelecallers = allUsers?.filter(user => {
            if (!checkedInUserIds.includes(user.id)) return false;
            const userRole = (user.role || "").toLowerCase();
            return validRoles.includes(userRole);
        }) || [];

        if (activeTelecallers.length === 0) {
            console.log(`   ⏭️ No active agents found in ${tenant.name} to take reassignments. Skipping.`);
            continue; // Skip this tenant, nobody is online to take the leads
        }

        // Calculate fair distribution for this tenant's agents today
        const { data: todaysLeads } = await supabaseAdmin
            .from("leads")
            .select("assigned_to")
            .eq("tenant_id", tenant.id) // ISOLATION
            .gte("created_at", startOfTodayISO);

        const leadCounts: Record<string, number> = {};
        activeTelecallers.forEach(t => leadCounts[t.id] = 0);
        if (todaysLeads) {
            todaysLeads.forEach(l => {
                if (l.assigned_to && leadCounts[l.assigned_to] !== undefined) leadCounts[l.assigned_to]++;
            });
        }

        // --- PROCESS SLA BREACHES ---
        for (const lead of expiredLeads) {
            const eligibleAgents = activeTelecallers.filter(t => t.id !== lead.assigned_to);
            if (eligibleAgents.length === 0) continue; 

            const minLeads = Math.min(...eligibleAgents.map(a => leadCounts[a.id]));
            const tiedAgents = eligibleAgents.filter(a => leadCounts[a.id] === minLeads);
            const winner = tiedAgents[Math.floor(Math.random() * tiedAgents.length)];

            const breachNote = `🚨 [SYSTEM: SLA BREACH]\nLead was not contacted within ${SLA_MINUTES} mins. Automatically reassigned to ${winner.full_name}.`;
            const updatedNotes = lead.notes ? `${lead.notes}\n\n${breachNote}` : breachNote;

            await supabaseAdmin.from("leads").update({ 
                assigned_to: winner.id,
                notes: updatedNotes
            })
            .eq("id", lead.id)
            .eq("tenant_id", tenant.id); // 🔴 EXTRA ISOLATION SAFETY

            leadCounts[winner.id]++;
            totalSlaReassigned++;
        }

        // --- PROCESS NR RECYCLING ---
        for (const lead of nrLeads) {
            let tags: string[] = [];
            try { tags = Array.isArray(lead.tags) ? lead.tags : JSON.parse(lead.tags || '[]'); } catch(e) {}
            
            const nrStrikes = tags.filter(t => t.startsWith('NR_STRIKE_')).length;

            if (nrStrikes >= 3) { 
                const deadNote = `💀 [SYSTEM: DEAD BUCKET]\nLead reached maximum 4 'No Response' cycles. Moved to Dead Bucket.`;
                const updatedNotes = lead.notes ? `${lead.notes}\n\n${deadNote}` : deadNote;

                await supabaseAdmin.from("leads").update({
                    status: "dead_bucket",
                    assigned_to: null, 
                    notes: updatedNotes
                })
                .eq("id", lead.id)
                .eq("tenant_id", tenant.id); // 🔴 EXTRA ISOLATION SAFETY
                
                totalMovedToDead++;
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

            await supabaseAdmin.from("leads").update({
                assigned_to: winner.id,
                status: "new",           
                tags: tags,              
                notes: updatedNotes
            })
            .eq("id", lead.id)
            .eq("tenant_id", tenant.id); // 🔴 EXTRA ISOLATION SAFETY

            leadCounts[winner.id]++;
            totalNrRecycled++;
        }
    } // End of Tenant Loop

    console.log(`\n🏁 [GLOBAL CRON FINISHED] SLA Reassigned: ${totalSlaReassigned} | NR Recycled: ${totalNrRecycled} | Sent to Dead: ${totalMovedToDead}`);
    
    return NextResponse.json({ 
        status: "success", 
        sla_reassigned: totalSlaReassigned, 
        nr_recycled: totalNrRecycled, 
        moved_to_dead: totalMovedToDead 
    });

  } catch (error: any) {
    console.error("🔥 [CRON ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
