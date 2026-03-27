"use server"

import { createClient } from "@/lib/supabase/server";

export async function searchMasterData(searchTerm: string, searchType: 'company' | 'pincode') {
    const supabase = await createClient();
    
    // 1. Get current user's tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Unauthorized" };
    
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
    if (!profile?.tenant_id) return { success: false, error: "Tenant not found" };

    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) return { success: true, data: [] };

    // 2. Build the query
    let query = supabase
        .from('tenant_master_data')
        .select('company_name, pincode, source_file_name, additional_data')
        .eq('tenant_id', profile.tenant_id)
        .limit(50); // ALWAYS limit to 50 so the UI doesn't freeze

    // 3. Apply the flexible search (Searching standard columns OR inside the JSONB data)
    if (searchType === 'pincode') {
        // Look for exact match in pincode column OR search inside the JSONB payload for the number
        query = query.or(`pincode.eq.${cleanTerm},additional_data::text.ilike.%${cleanTerm}%`);
    } else {
        // Look for partial match in company_name column OR search inside the JSONB payload
        query = query.or(`company_name.ilike.%${cleanTerm}%,additional_data::text.ilike.%${cleanTerm}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Search Error:", error);
        return { success: false, error: "Failed to search data." };
    }

    return { success: true, data };
}
