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

export async function updateTenantSettings(orgId: string, enabledStatuses: string[], workflowTriggers: any) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (caller?.role !== 'super_admin') {
            throw new Error("Forbidden: Only Super Admins can update tenant settings.")
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { error } = await supabaseAdmin
            .from('organizations')
            .update({ 
                enabled_statuses: enabledStatuses,
                workflow_triggers: workflowTriggers
            })
            .eq('id', orgId)

        if (error) throw new Error("Failed to update organization: " + error.message)

        return { success: true, message: "Tenant settings updated successfully!" }
    } catch (error: any) {
        console.error("Update Error:", error)
        return { success: false, error: error.message || "Failed to update tenant settings" }
    }
}

export async function fetchAllOrganizations() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (caller?.role !== 'super_admin') {
            throw new Error("Forbidden: Only Super Admins can view all tenants.")
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { data: orgs, error } = await supabaseAdmin
            .from('organizations')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw new Error("Failed to fetch organizations: " + error.message)

        // Fetch user counts manually to avoid schema cache issues if FK is missing
        const { data: userCounts } = await supabaseAdmin
            .from('users')
            .select('tenant_id');
        
        const countsMap: Record<string, number> = {};
        if (userCounts) {
            userCounts.forEach(u => {
                if (u.tenant_id) {
                    countsMap[u.tenant_id] = (countsMap[u.tenant_id] || 0) + 1;
                }
            });
        }

        const orgsWithCounts = orgs.map(org => ({
            ...org,
            users: [{ count: countsMap[org.id] || 0 }]
        }));

        return { success: true, data: orgsWithCounts }
    } catch (error: any) {
        console.error("Fetch Error:", error)
        return { success: false, error: error.message || "Failed to fetch organizations" }
    }
}

export async function fetchGlobalStatuses() {
    try {
        const supabase = await createClient()
        // No strict auth required for reading, but we can use standard client
        // since we enabled RLS for all authenticated users
        const { data: statuses, error } = await supabase
            .from('global_lead_statuses')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) throw new Error("Failed to fetch global statuses: " + error.message)

        return { success: true, data: statuses }
    } catch (error: any) {
        console.error("Fetch Global Statuses Error:", error)
        return { success: false, error: error.message || "Failed to fetch global statuses" }
    }
}

export async function addGlobalStatus(statusData: { value: string; label: string; color: string; btnColor: string; iconName: string }) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
        if (caller?.role !== 'super_admin') {
            throw new Error("Forbidden: Only Super Admins can add global statuses.")
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const { error } = await supabaseAdmin
            .from('global_lead_statuses')
            .insert({
                value: statusData.value,
                label: statusData.label,
                color: statusData.color,
                btn_color: statusData.btnColor,
                icon_name: statusData.iconName
            })

        if (error) throw new Error("Failed to insert global status: " + error.message)

        return { success: true, message: "Custom status added successfully!" }
    } catch (error: any) {
        console.error("Add Global Status Error:", error)
        return { success: false, error: error.message || "Failed to add global status" }
    }
}
