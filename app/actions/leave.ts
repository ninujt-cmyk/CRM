"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function approveLeave(leaveId: string, approverId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leaves")
    .update({
      status: "approved",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
    })
    .eq("id", leaveId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/leave-management");
  revalidatePath("/telecaller/leave");
}

export async function rejectLeave(leaveId: string, approverId: string, reason: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("leaves")
    .update({
      status: "rejected",
      approved_by: approverId,
      approved_at: new Date().toISOString(),
      rejection_reason: reason,
    })
    .eq("id", leaveId);

  if (error) throw new Error(error.message);
  revalidatePath("/admin/leave-management");
  revalidatePath("/telecaller/leave");
}

export async function createLeaveRequest(
  userId: string,
  data: { type: string; start: string; end: string; reason: string }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("leaves").insert({
    user_id: userId,
    leave_type: data.type,
    start_date: data.start,
    end_date: data.end,
    reason: data.reason,
    status: "pending",
  });

  if (error) throw new Error(error.message);
  revalidatePath("/telecaller/leave");
  revalidatePath("/admin/leave-management");
}
