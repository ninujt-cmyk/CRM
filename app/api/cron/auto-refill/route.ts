import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV !== 'development' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log("\n=======================================================");
  console.log("⛽ [CRON START] Running Auto-Refill Engine...");

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // 🔴 1. CHECK TENANT SETTINGS
    const { data: activeSettings } = await supabase.from('tenant_settings').select('tenant_id').eq('cron_auto_refill', true);
    const enabledTenantIds = activeSettings?.map(s => s.tenant_id) || [];
    
    if (enabledTenantIds.length === 0) {
      console.log("⏸️ Auto-Refill is paused for all tenants.");
      return NextResponse.json({ message: "Job paused for all tenants." });
    }

    const maxShiftStart = new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString();
    
    // Fetch attendance strictly for enabled tenants
    const { data: attendanceData } = await supabase
        .from("attendance")
        .select("user_id")
        .in('tenant_id', enabledTenantIds)
        .gte("check_in", maxShiftStart)
        .is("check_out", null);            

    const checkedInUserIds = attendanceData?.map(a => a.user_id) || [];
    if (checkedInUserIds.length === 0) return NextResponse.json({ status: "skipped", message: "No agents online" });

    const { data: onlineUsers } = await supabase.from("users").select("id, full_name, role").in("id", checkedInUserIds);
    const activeTelecallers = onlineUsers?.filter(user => ["telecaller", "agent", "user"].includes((user.role || "").toLowerCase())) || [];

    const { data: currentNewLeads } = await supabase.from("leads").select("assigned_to").ilike("status", "new").in("assigned_to", activeTelecallers.map(a => a.id));

    const newLeadCounts: Record<string, number> = {};
    activeTelecallers.forEach(t => newLeadCounts[t.id] = 0);
    if (currentNewLeads) currentNewLeads.forEach(lead => { if (lead.assigned_to) newLeadCounts[lead.assigned_to]++; });

    const starvedAgents = activeTelecallers.filter(agent => newLeadCounts[agent.id] === 0);
    let totalRefilled = 0;

    for (const agent of starvedAgents) {
        const { data: poolLeads, error: poolError } = await supabase
            .from("leads")
            .select("id, notes")
            .or("status.ilike.not_interested,status.ilike.recycle_pool") 
            .neq("assigned_to", agent.id)
            .order("last_contacted", { ascending: true, nullsFirst: true }) 
            .limit(10);

        if (poolError || !poolLeads || poolLeads.length === 0) continue;

        for (const lead of poolLeads) {
            const refillNote = `⛽ [SYSTEM: AUTO-REFILL]\nLead recycled from pool. Reassigned to ${agent.full_name}.`;
            const updatedNotes = lead.notes ? `${lead.notes}\n\n${refillNote}` : refillNote;

            const { error: updateError } = await supabase.from("leads").update({
                assigned_to: agent.id, status: "new", notes: updatedNotes, last_contacted: new Date().toISOString() 
            }).eq("id", lead.id);

            if (!updateError) totalRefilled++;
        }
    }

    return NextResponse.json({ status: "success", agents_starved: starvedAgents.length, leads_recycled: totalRefilled });

  } catch (error: any) {
    console.error("🔥 [REFILL FATAL ERROR]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
