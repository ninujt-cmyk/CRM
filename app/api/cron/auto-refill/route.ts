import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
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
    // 1. GET ALL CHECKED-IN AGENTS
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

    // Get user details
    const { data: onlineUsers } = await supabase
        .from("users")
        .select("id, full_name, role")
        .in("id", checkedInUserIds);

    const activeTelecallers = onlineUsers?.filter(user => 
        ["telecaller", "agent", "user"].includes((user.role || "").toLowerCase())
    ) || [];

    // 2. CHECK WHO IS STARVED (< 1 New Lead)
    // Fetch all current 'new' leads assigned to these agents
    const { data: currentNewLeads } = await supabase
        .from("leads")
        .select("assigned_to")
        .ilike("status", "new")
        .in("assigned_to", activeTelecallers.map(a => a.id));

    // Count them up
    const newLeadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => newLeadCounts[t.id] = 0);
    
    if (currentNewLeads) {
        currentNewLeads.forEach(lead => {
            if (lead.assigned_to) newLeadCounts[lead.assigned_to]++;
        });
    }

    // Filter agents who have exactly 0 new leads
    const starvedAgents = activeTelecallers.filter(agent => newLeadCounts[agent.id] === 0);

    console.log(`📊 [REFILL] Found ${activeTelecallers.length} online agents. ${starvedAgents.length} are starved (0 leads).`);

    let totalRefilled = 0;

    // 3. SEQUENTIALLY REFILL STARVED AGENTS
    // We use a regular 'for...of' loop so they don't steal from each other
    for (const agent of starvedAgents) {
        console.log(`🔍 [REFILL] Searching pool for agent: ${agent.full_name}`);

        // Fetch 10 oldest leads from the pool that do NOT belong to this agent
        const { data: poolLeads, error: poolError } = await supabase
            .from("leads")
            .select("id, notes")
            .or("status.ilike.not_interested,status.ilike.recycle_pool") // Case-insensitive match for both statuses
            .neq("assigned_to", agent.id) // Must NOT be their old lead
            .order("last_contacted", { ascending: true, nullsFirst: true }) // Oldest first
            .limit(10);

        if (poolError) {
            console.error(`❌ [REFILL SQL ERROR]`, poolError.message);
            continue;
        }

        if (!poolLeads || poolLeads.length === 0) {
            console.log(`⚠️ [REFILL] Recycle pool is empty! Cannot refill ${agent.full_name}.`);
            continue; // Move to the next agent (though if it's empty, no one gets leads)
        }

        // Process these 10 leads individually to append notes properly
        for (const lead of poolLeads) {
            const refillNote = `⛽ [SYSTEM: AUTO-REFILL]\nLead recycled from 'Not Interested/Pool'. Reassigned to ${agent.full_name} as a fresh lead.`;
            const updatedNotes = lead.notes ? `${lead.notes}\n\n${refillNote}` : refillNote;

            const { error: updateError } = await supabase
                .from("leads")
                .update({
                    assigned_to: agent.id,
                    status: "new",
                    notes: updatedNotes,
                    last_contacted: new Date().toISOString() // Critical: Give them a fresh 30-min SLA timer!
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
