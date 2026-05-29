import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AttendanceReportsPageClient from "./page-client"; // Import the client component directly

export default async function AdminAttendanceReportsPage() {
  const supabase = await createClient();
  
  // 1. Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // 2. Check Role
  const { data: userData, error: userError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  // FIX: Allow 'super_admin', 'tenant_admin', etc. instead of just 'admin'
  const allowedRoles = ["admin", "super_admin", "tenant_admin", "owner"];

  if (userError || !userData || !allowedRoles.includes(userData.role)) {
    // Redirect to unauthorized or home if role doesn't match
    redirect("/"); 
  }

  return (
    <div className="p-6">
      {/* 3. Render the Client Component */}
      <AttendanceReportsPageClient />
    </div>
  );
}
