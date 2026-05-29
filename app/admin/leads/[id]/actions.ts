"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"

export async function updateLead(leadId: string, formData: FormData) {
  const supabase = await createClient()

  // Handle assigned_to field properly
  const assignedToValue = formData.get("assigned_to") as string
  const assignedTo = assignedToValue === "unassigned" ? null : assignedToValue || null

  const updates = {
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || null,
    phone: formData.get("phone") as string,
    company: (formData.get("company") as string) || null,
    status: formData.get("status") as string,
    priority: formData.get("priority") as string,
    assigned_to: assignedTo,
    source: (formData.get("source") as string) || null,
    notes: (formData.get("notes") as string) || null,
  }

  const { error } = await supabase.from("leads").update(updates).eq("id", leadId)

  if (error) {
    console.error("Error updating lead:", error)
    // In a real application, you might want to show an error message to the user
    // For now, we'll just redirect back to the leads page
  }
  
  redirect("/admin/leads")
}