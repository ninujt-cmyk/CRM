"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export async function markAsCompleted(taskId: string) {
  const supabase = await createClient()

  await supabase
    .from("follow_ups")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", taskId)

  revalidatePath("/telecaller/tasks")
}
