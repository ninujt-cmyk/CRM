"use server"

import { createClient } from "@/lib/supabase/server"

export async function updateWorkspaceSettings(formData: {
    fonada_client_id: string;
    fonada_secret: string;
    whatsapp_api_key: string;
}) {
    try {
        const supabase = await createClient()
        
        // 1. Ensure user is authenticated
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        // 2. Fetch the user's tenant_id securely (RLS protects this automatically)
        const { data: settingsRow } = await supabase
            .from('tenant_settings')
            .select('tenant_id')
            .maybeSingle()

        if (!settingsRow?.tenant_id) {
            throw new Error("Workspace configuration not found. Please contact support.")
        }

        // 3. Update the keys
        const { error } = await supabase
            .from('tenant_settings')
            .update({
                fonada_client_id: formData.fonada_client_id,
                fonada_secret: formData.fonada_secret,
                whatsapp_api_key: formData.whatsapp_api_key,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', settingsRow.tenant_id)

        if (error) throw error

        return { success: true, message: "Workspace settings updated successfully!" }

    } catch (error: any) {
        console.error("Settings Update Error:", error)
        return { success: false, error: error.message || "Failed to update settings" }
    }
}
