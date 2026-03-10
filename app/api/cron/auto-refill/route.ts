import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// 🔴 KILL ALL CACHING DEAD
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: { persistSession: false },
    global: {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0' }
    }
  }
);

export async function GET(request: Request) {
  // 1. CRON SECURITY
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("\n=======================================================");
  console.log("⛽ [CRON START] Running Auto-Refill Engine...");
  console.log("=======================================================");

  try {
    // 1. Tenant Settings Pause Check
    const { data: settings } = await supabase.from("tenant_settings").select("cron_auto_refill").maybeSingle();
    if (settings && settings.cron_auto_refill === false) {
        console.log("⏸️ [REFILL] Auto-Refill is paused in workspace settings. Skipping.");
        return NextResponse.json({ status: "paused", message: "Cron disabled in settings" });
    }

    // 2. GET ALL CHECKED-IN AGENTS
    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
    const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id")
        .gte("check_in", maxShiftStart)
        .is("check_out", null);            

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    
    if (checkedInUserIds.length === 0) {
        console.log("⏭️ [REFILL] No agents checked in. Skipping.");
        return NextResponse.json({ status: "skipped", message: "No agents online" });
    }

    const { data: onlineUsers } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("id", checkedInUserIds);

    const activeTelecallers = onlineUsers?.filter(user => 
        ["telecaller", "agent", "user"].includes((user.role || "").toLowerCase())
    ) || [];

    // 3. CHECK WHO IS STARVED (0 New Leads)
    // 🔴 Increased limit to 10,000 to prevent Supabase hiding data
    const { data: currentNewLeads } = await supabase
        .from("leads")
        .select("id, assigned_to, created_at, status")
        .ilike("status", "new")
        .in("assigned_to", activeTelecallers.map(a => a.id))
        .limit(10000);

    const newLeadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => newLeadCounts[t.id] = 0);
    
    // Ghost Tracker arrays
    const sampleGhostLeads: any[] = [];

    if (currentNewLeads) {
        currentNewLeads.forEach(lead => {
            if (lead.assigned_to && newLeadCounts[lead.assigned_to] !== undefined) {
                newLeadCounts[lead.assigned_to]++;
                
                // Save a few ghost leads for debugging
                if (sampleGhostLeads.length < 5) {
                    sampleGhostLeads.push(lead);
                }
            }
        });
    }

    console.log("📊 [REFILL DEBUG] Current 'New' Lead Counts:");
    activeTelecallers.forEach(agent => {
        console.log(`   - ${agent.full_name}: ${newLeadCounts[agent.id]}`);
    });

    // 🔴 THE GHOST REVEALER: If the code says they have leads, but the dashboard says 0, look here!
    if (sampleGhostLeads.length > 0) {
        console.log("👻 [GHOST LEAD CHECK] Here are 3 leads the DB says are 'new':");
        sampleGhostLeads.slice(0, 3).forEach(lead => {
            console.log(`     -> ID: ${lead.id} | Created: ${lead.created_at} | Agent ID: ${lead.assigned_to}`);
        });
    }

    const starvedAgents = activeTelecallers.filter(agent => newLeadCounts[agent.id] === 0);

    console.log(`📊 [REFILL] Found ${activeTelecallers.length} online agents. ${starvedAgents.length} are starved (0 leads).`);

    let totalRefilled = 0;

    // 4. SEQUENTIALLY REFILL STARVED AGENTS
    for (const agent of starvedAgents) {
        console.log(`🔍 [REFILL] Searching pool for agent: ${agent.full_name}`);

        const { data: poolLeads, error: poolError } = await supabase
            .from("leads")
            .select("id, notes")
            .or("status.ilike.%not_interested%,status.ilike.%recycle_pool%") 
            .neq("assigned_to", agent.id) 
            .order("last_contacted", { ascending: true, nullsFirst: true }) 
            .limit(10);

        if (poolError) {
            console.error(`❌ [REFILL SQL ERROR]`, poolError.message);
            continue;
        }

        if (!poolLeads || poolLeads.length === 0) {
            console.log(`⚠️ [REFILL] Recycle pool is empty! Cannot refill ${agent.full_name}.`);
            continue; 
        }

        for (const lead of poolLeads) {
            const refillNote = `⛽ [SYSTEM: AUTO-REFILL]\nLead recycled from 'Not Interested/Pool'. Reassigned to ${agent.full_name} as a fresh lead.`;
            const updatedNotes = lead.notes ? `${lead.notes}\n\n${refillNote}` : refillNote;

            const { error: updateError } = await supabase
                .from("leads")
                .update({
                    assigned_to: agent.id,
                    status: "new",
                    notes: updatedNotes,
                    last_contacted: new Date().toISOString() 
                })
                .eq("id", lead.id);

            if (!updateError) {
                totalRefilled++;
            }
        }
        
        console.log(`✅ [REFILL] Gave ${poolLeads.length} leads to ${agent.full_name}`);
    }

    console.log(`✅ [CRON COMPLETE] Total leads recycled: ${totalRefilled}`);
    
    return NextResponse.json({ 
        status: "success", 
        agents_starved: starvedAgents.length,
        leads_recycled: totalRefilled 
    });

  } catch (error: any) {
    console.error("🔥 [REFILL FATAL ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
