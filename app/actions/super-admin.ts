"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function provisionNewTenant(formData: {
    orgName: string;
    plan: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
}) {
    try {
        const supabase = await createClient()
        
        // 1. SECURITY CHECK: Ensure caller is a Super Admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (caller?.role !== 'super_admin') {
            throw new Error("Forbidden: Only Super Admins can provision new tenants.")
        }

        // 2. Initialize Admin Bypass Client
        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 3. Create the Organization
        const { data: newOrg, error: orgError } = await supabaseAdmin
            .from('organizations')
            .insert({ name: formData.orgName, plan: formData.plan })
            .select('id').single()

        if (orgError || !newOrg) throw new Error("Failed to create organization: " + orgError?.message)

        // 4. Create the First Admin User in Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: formData.adminEmail,
            password: formData.adminPassword,
            email_confirm: true,
            user_metadata: { full_name: formData.adminName }
        })

        if (authError || !authData.user) {
            // Rollback Org if Auth fails
            await supabaseAdmin.from('organizations').delete().eq('id', newOrg.id);
            throw new Error("Failed to create admin auth user: " + authError?.message)
        }

        // 5. Create the User Profile linked to the new Tenant
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                email: formData.adminEmail,
                full_name: formData.adminName,
                role: 'admin', // They are the admin of THEIR workspace
                tenant_id: newOrg.id,
                current_status: 'offline'
            })

        if (profileError) throw new Error("Failed to create user profile: " + profileError.message)

        // 6. Initialize blank API settings for the new tenant
        await supabaseAdmin.from('tenant_settings').insert({ tenant_id: newOrg.id })

        return { success: true, message: `Successfully provisioned ${formData.orgName}!` }

    } catch (error: any) {
        console.error("Provisioning Error:", error)
        return { success: false, error: error.message || "Failed to provision workspace" }
    }
}
