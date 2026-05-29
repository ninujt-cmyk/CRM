"use server"

import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function inviteTeamMember(formData: {
    email: string;
    fullName: string;
    role: string;
    password?: string;
    managerId?: string | null;
}) {
    try {
        const supabase = await createClient()
        
        // 1. Verify caller is an Admin or Super Admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        const { data: callerProfile } = await supabase
            .from('users')
            .select('role, tenant_id')
            .eq('id', user.id)
            .single()

        if (!['admin', 'super_admin'].includes(callerProfile?.role || '')) {
            throw new Error("Forbidden: Only Admins can invite team members.")
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        // 2. Create the user in Supabase Auth
        // Note: For a real SaaS, you might use 'inviteUserByEmail', but for direct CRM creation, we create with a temp password.
        const tempPassword = formData.password || "Welcome@123!";
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: formData.email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { full_name: formData.fullName }
        })

        if (authError || !authData.user) throw new Error("Auth creation failed: " + authError?.message)

        // 3. Create their CRM Profile linked to YOUR Tenant
        const { error: profileError } = await supabaseAdmin
            .from('users')
            .insert({
                id: authData.user.id,
                email: formData.email,
                full_name: formData.fullName,
                role: formData.role,
                manager_id: formData.managerId || null,
                tenant_id: callerProfile?.tenant_id, // Inherit caller's company!
                current_status: 'offline'
            })

        if (profileError) {
            // Rollback if profile creation fails
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
            throw new Error("Profile creation failed: " + profileError.message)
        }

        return { success: true, message: `Successfully added ${formData.fullName} to the team!` }

    } catch (error: any) {
        console.error("Invite Error:", error)
        return { success: false, error: error.message || "Failed to invite user" }
    }
}

export async function updateTeamMember(userId: string, updates: { role?: string, manager_id?: string | null }) {
     try {
        const supabase = await createClient()
        
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) throw new Error("Unauthorized")

        // RLS will automatically ensure you can only update users in YOUR tenant if you are an Admin
        const { error } = await supabase
            .from('users')
            .update({
                role: updates.role,
                manager_id: updates.manager_id
            })
            .eq('id', userId)

        if (error) throw error

        return { success: true, message: "Team member updated successfully." }
     } catch (error: any) {
        return { success: false, error: error.message || "Failed to update member" }
     }
}
