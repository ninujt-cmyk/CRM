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

    // 2. Call the highly optimized Postgres RPC function
    const { data, error } = await supabase.rpc('search_tenant_master_data', {
        p_tenant_id: profile.tenant_id,
        p_search_term: cleanTerm,
        p_search_type: searchType
    });

    if (error) {
        console.error("Search Error Details:", error);
        return { success: false, error: "Database search failed. Please check the logs." };
    }

    return { success: true, data };
}
