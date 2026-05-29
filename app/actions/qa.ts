"use server"
import { createClient } from "@/lib/supabase/server";

export async function submitCallQAScore(data: {
    callLogId: string; agentId: string; greeting: number; product: number; objection: number; comments: string;
}) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase.from('call_qa_scores').insert({
        call_log_id: data.callLogId,
        agent_id: data.agentId,
        evaluator_id: user?.id,
        greeting_score: data.greeting,
        product_knowledge_score: data.product,
        objection_handling_score: data.objection,
        comments: data.comments
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
}
