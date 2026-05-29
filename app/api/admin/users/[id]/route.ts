import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// Helper to get Admin Client (Bypasses RLS)
function getAdminClient() {
  const adminUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!adminUrl || !adminKey) {
    throw new Error("Missing Supabase Admin Keys");
  }

  return createClient(adminUrl, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// HANDLE UPDATE (PUT/PATCH)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Check Permissions
    const supabase = await createServerClient();
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if requester is an Admin
    const { data: adminCheck } = await supabase
      .from("users")
      .select("role, tenant_id")
      .eq("id", currentUser.id)
      .single();

    // Only Admins can edit other users
    const allowedRoles = ["super_admin", "tenant_admin", "owner"];
    if (!allowedRoles.includes(adminCheck?.role)) {
      return NextResponse.json({ error: "Forbidden: Admins only" }, { status: 403 });
    }

    // 2. Parse Data
    const body = await request.json();
    const { full_name, phone, role, manager_id } = body;
    const targetUserId = params.id;

    console.log(`👉 Updating User ${targetUserId} to Role: ${role}, Manager: ${manager_id}`);

    // 3. Update via Admin Client
    const supabaseAdmin = getAdminClient();

    const { error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        full_name,
        phone,
        role,
        manager_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      console.error("Update failed:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    // 4. Also update Auth Metadata (Important for syncing)
    await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      user_metadata: { full_name, role }
    });

    return NextResponse.json({ success: true }, { status: 200 });

  } catch (error: any) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
