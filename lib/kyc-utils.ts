// NOTE: This file is designed ONLY to be used by Next.js API Routes and Server Components.
import { createClient } from "./supabase/server"; 

// Define a type for KYC team members (assuming your user table has these fields)
export interface KycTeamMember {
  id: string; 
  full_name: string; 
}

/**
 * Fetches a list of all users with the 'kyc_team' role.
 */
export async function getKycTeamMembers(): Promise<KycTeamMember[]> {
  const supabase = await createClient();

  // Assuming your user roles are stored in a 'users' table with a 'role' column.
  const { data, error } = await supabase
    .from("users") // Use 'profiles' or whatever table holds your user roles
    .select("id, full_name") // Adjust column names as necessary
    .eq("role", "kyc_team"); 

  if (error) {
    console.error("Error fetching KYC team members:", error);
    return [];
  }

  return data as KycTeamMember[];
}

/**
 * Server-side function to handle the lead transfer logic.
 */
export async function transferLeadToKyc({
  leadId,
  kycMemberId,
  telecallerId,
}: {
  leadId: string;
  kycMemberId: string;
  telecallerId: string;
}) {
  const supabase = await createClient();
  
  // 1. Update the lead status and assignment in the 'leads' table
  const { data: leadUpdate, error: leadError } = await supabase
    .from("leads")
    .update({
      status: "Awaiting KYC", 
      kyc_member_id: kycMemberId, 
    })
    .eq("id", leadId)
    .select()
    .single();

  if (leadError) {
    throw new Error("Failed to update lead for KYC transfer: " + leadError.message);
  }
  
  // 2. Log the transfer activity (Highly Recommended)
  const { error: logError } = await supabase.from("activity_logs").insert({
    lead_id: leadId,
    user_id: telecallerId,
    activity_type: "LEAD_TRANSFER_KYC",
    description: `Lead transferred to KYC member ${kycMemberId}.`,
  });

  if (logError) {
    console.warn("Failed to log KYC transfer activity:", logError.message);
  }

  return leadUpdate;
}
