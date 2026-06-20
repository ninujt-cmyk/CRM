"use server"

import { createClient } from "@/lib/supabase/server"

// 1. Get or generate the Webhook Secret
export async function getWebhookSecret(tenantId: string) {
  try {
    const supabase = await createClient()

    const { data: settings, error } = await supabase
      .from('tenant_settings')
      .select('webhook_secret')
      .eq('tenant_id', tenantId)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error("Error fetching webhook secret:", error)
      return { success: false, secret: null }
    }

    if (settings?.webhook_secret) {
      return { success: true, secret: settings.webhook_secret }
    }

    // If no secret exists (e.g. old tenant), generate one using postgres gen_random_uuid()
    const newSecret = crypto.randomUUID()
    
    // We update the record or insert if missing
    const { error: upsertError } = await supabase
        .from('tenant_settings')
        .upsert({ 
            tenant_id: tenantId, 
            webhook_secret: newSecret,
            updated_at: new Date().toISOString()
        }, { onConflict: 'tenant_id' })

    if (upsertError) {
        console.error("Failed to generate new secret:", upsertError)
        return { success: false, secret: null }
    }

    return { success: true, secret: newSecret }

  } catch (error) {
    console.error("Critical error in getWebhookSecret:", error)
    return { success: false, secret: null }
  }
}

// 2. Regenerate Webhook Secret
export async function regenerateWebhookSecret(tenantId: string) {
    try {
        const supabase = await createClient()
        const newSecret = crypto.randomUUID()
        
        const { error: updateError } = await supabase
            .from('tenant_settings')
            .update({ 
                webhook_secret: newSecret,
                updated_at: new Date().toISOString()
            })
            .eq('tenant_id', tenantId)
    
        if (updateError) {
            console.error("Failed to regenerate secret:", updateError)
            return { success: false, secret: null, message: "Failed to regenerate key." }
        }
    
        return { success: true, secret: newSecret, message: "Webhook key regenerated successfully. Previous key is now invalid." }
    
      } catch (error) {
        console.error("Critical error in regenerateWebhookSecret:", error)
        return { success: false, secret: null, message: "Internal server error." }
      }
}
