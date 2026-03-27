"use server"

import { createClient } from "@/lib/supabase/server";

export async function searchMasterData(searchTerm: string, searchType: 'company' | 'pincode') {
    const supabase = await createClient();
    
    // 1. Get current user's tenant
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user?.id).single();
    
    if (!profile?.tenant_id) return { success: false, data: [] };

    let query = supabase
        .from('tenant_master_data')
        .select('company_name, pincode, source_file_name, additional_data')
        .eq('tenant_id', profile.tenant_id)
        .limit(50); // ALWAYS limit to 50 so the UI doesn't freeze

    // 2. Apply the fast search
    if (searchType === 'pincode') {
        // Exact match for pincodes is fastest
        query = query.eq('pincode', searchTerm.trim());
    } else {
        // ilike uses the GIN index for partial text matches (e.g. typing "Tata" matches "Tata Motors")
        query = query.ilike('company_name', `%${searchTerm.trim()}%`);
    }

    const { data, error } = await query;

    if (error) {
        console.error("Search Error:", error);
        return { success: false, error: "Failed to search data." };
    }

    return { success: true, data };
}
