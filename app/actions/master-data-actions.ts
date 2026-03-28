"use server"

import { createClient } from "@/lib/supabase/server";

// ==========================================
// 1. GLOBAL SEARCH ACTION (For the Telecaller)
// ==========================================
export async function searchMasterData(searchTerm: string, searchType: 'company' | 'pincode') {
    try {
        const supabase = await createClient();
        
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Unauthorized" };
        
        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user.id).single();
        if (!profile?.tenant_id) return { success: false, error: "Tenant not found" };

        const cleanTerm = searchTerm.trim();
        if (!cleanTerm) return { success: true, data: [] };

        let query = supabase
            .from('tenant_master_data')
            .select('company_name, pincode, source_file_name, additional_data')
            .eq('tenant_id', profile.tenant_id)
            .limit(50); // ALWAYS limit to 50 so the UI doesn't freeze

        // Apply the fast search targeting both standard columns AND the JSONB data
        if (searchType === 'pincode') {
            query = query.or(`pincode.eq.${cleanTerm},additional_data::text.ilike.%${cleanTerm}%`);
        } else {
            query = query.or(`company_name.ilike.%${cleanTerm}%,additional_data::text.ilike.%${cleanTerm}%`);
        }

        const { data, error } = await query;

        if (error) throw error;

        return { success: true, data };
    } catch (error: any) {
        console.error("Search Error:", error);
        return { success: false, error: error.message || "Failed to search data." };
    }
}

// ==========================================
// 2. Fetch Summary of Uploaded Files (For Admin)
// ==========================================
export async function getUploadedFilesSummary() {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user?.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found");

        const { data, error } = await supabase
            .from('tenant_master_data')
            .select('source_file_name, created_at')
            .eq('tenant_id', profile.tenant_id);

        if (error) throw error;

        // Group the raw rows by file name and count them
        const fileMap = new Map<string, { count: number, date: string }>();
        
        data.forEach(row => {
            const fileName = row.source_file_name;
            if (fileMap.has(fileName)) {
                fileMap.get(fileName)!.count += 1;
            } else {
                fileMap.set(fileName, { count: 1, date: row.created_at });
            }
        });

        const summary = Array.from(fileMap.entries()).map(([name, info]) => ({
            file_name: name,
            row_count: info.count,
            upload_date: info.date
        })).sort((a, b) => new Date(b.upload_date).getTime() - new Date(a.upload_date).getTime());

        return { success: true, files: summary };

    } catch (error: any) {
        console.error("Fetch Summary Error:", error);
        return { success: false, error: error.message || "Failed to fetch files." };
    }
}

// ==========================================
// 3. Delete All Rows Belonging to a File (For Admin)
// ==========================================
export async function deleteMasterFile(fileName: string) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        
        const { data: profile } = await supabase.from('users').select('tenant_id').eq('id', user?.id).single();
        if (!profile?.tenant_id) throw new Error("Tenant ID not found");

        console.log(`🗑️ Deleting all records for file: ${fileName} (Tenant: ${profile.tenant_id})`);

        const { error } = await supabase
            .from('tenant_master_data')
            .delete()
            .eq('tenant_id', profile.tenant_id)
            .eq('source_file_name', fileName);

        if (error) throw error;

        return { success: true, message: `Successfully deleted all records from ${fileName}` };

    } catch (error: any) {
        console.error("Delete File Error:", error);
        return { success: false, error: error.message || "Failed to delete file." };
    }
}
