import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminLeaveDashboard } from "@/components/admin/admin-leave-dashboard";

// 🔴 CRITICAL FIX: Prevent Next.js from caching the page and leaking data between users
export const dynamic = 'force-dynamic';

export default async function AdminLeaveManagementPage() {
  const supabase = await createClient();
  
  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // 2. Fetch User's Role & Tenant for strict file-level filtering
  const { data: profile } = await supabase
    .from('users')
    .select('role, tenant_id')
    .eq('id', user.id)
    .single();

  const userRole = profile?.role || 'agent';
  const tenantId = profile?.tenant_id;

  // 3. Build the Base Query
  let query = supabase
    .from("leaves")
    .select(`
      *,
      user:users!leaves_user_id_fkey(full_name, email, role),
      approver:users!leaves_approved_by_fkey(full_name, email)
    `)
    .order("created_at", { ascending: false });

  // 🔴 4. STRICT FILE-LEVEL FILTERING (Matches the DB RLS exactly)
  if (userRole !== 'super_admin') {
      // Rule A: Lock everything to the current company (Tenant Isolation)
      query = query.eq('tenant_id', tenantId);
      
      // Rule B: Hierarchy Isolation
      if (userRole === 'manager' || userRole === 'team_leader') {
          // Find who reports to this manager
          const { data: team } = await supabase
            .from('users')
            .select('id')
            .eq('manager_id', user.id);
          
          const validIds = team?.map(t => t.id) || [];
          validIds.push(user.id); // Allow the manager to see their own leaves
          
          query = query.in('user_id', validIds);
      } 
      else if (userRole === 'telecaller' || userRole === 'agent') {
          // Agents only see their own leaves
          query = query.eq('user_id', user.id);
      }
  }

  // Execute the safe, strictly filtered query
  const { data: leaves, error } = await query;

  if (error) {
    console.error("Error fetching leaves:", error);
  }

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Leave Management</h1>
        <p className="text-slate-500">Overview of all employee leave requests and history.</p>
      </div>
      
      <AdminLeaveDashboard 
        leaves={leaves || []} 
        currentUserId={user.id} 
        tenantId={tenantId} // Pass down to secure the settings fetch
      />
    </div>
  );
}
