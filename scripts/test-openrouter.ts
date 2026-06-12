import { createClient } from "@supabase/supabase-js";

// Load env variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key";

console.log("Supabase URL:", supabaseUrl);
console.log("Supabase Key (masked):", supabaseKey.substring(0, 10) + "...");

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    try {
        // 1. Get the latest lead that has chat messages
        const { data: latestMessage, error: msgErr } = await supabase
            .from("chat_messages")
            .select("lead_id")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (msgErr) throw msgErr;
        if (!latestMessage) {
            console.log("No messages found in chat_messages table.");
            return;
        }

        const leadId = latestMessage.lead_id;
        console.log("Found active lead ID:", leadId);

        // Fetch lead name
        const { data: lead } = await supabase
            .from("leads")
            .select("name")
            .eq("id", leadId)
            .single();

        // 2. Fetch last 15 messages
        const { data: messages, error: fetchErr } = await supabase
            .from("chat_messages")
            .select("direction, content, message_type")
            .eq("lead_id", leadId)
            .order("created_at", { ascending: true })
            .limit(15);

        if (fetchErr) throw fetchErr;

        console.log(`Fetched ${messages?.length} messages. Mapping to OpenRouter format...`);

        const formattedMessages = (messages || []).map((msg, i) => {
            console.log(`Msg ${i}: direction=${msg.direction}, type=${msg.message_type}, content_length=${msg.content?.length || 0}`);
            return {
                role: msg.direction === 'inbound' ? 'user' : 'assistant',
                content: msg.content || ""
            };
        });

        // Check if any message content is empty
        const hasEmpty = formattedMessages.some(m => !m.content || m.content.trim() === "");
        if (hasEmpty) {
            console.warn("⚠️ Warning: One or more messages have empty content. This might fail validation on OpenRouter/OpenAI API.");
        }

        const systemPrompt = `You are a warm, polite, and highly persuasive WhatsApp assistant for our loan service.
Your sole goal is to collect the required documents from the customer to complete their loan application.

Current Customer Name: ${lead?.name || "Customer"}

Document Collection Rules:
1. **Initial Request**: Ask for Aadhar Card, PAN Card, and Salary Slip.
2. **Fallback for Income Proof**: If the customer replies that their Salary Slip/payslip is NOT available, immediately switch and ask for their *Aadhar Card, PAN Card, and last 3 months Bank Statement* instead.
3. **Persist on Income Proof**: If the customer has only shared their Aadhar and PAN, you must persistently ask for their Salary Slip (or last 3 months Bank Statement if Salary Slip is not available) until it is received.
4. **All Documents Received**: If the customer has shared all required documents (either Aadhar + PAN + Salary Slip OR Aadhar + PAN + 3 months Bank Statement), thank them warmly and tell them a representative will contact them shortly. Do NOT ask for any more documents.
5. **No Documents Attached**: If the customer sends a text message but does not upload the requested documents, immediately and politely insist that they must share the missing documents to proceed.

Communication Style:
- Keep all messages extremely short, simple, and persuasive (1-2 sentences maximum). Do NOT write paragraphs.
- Be warm and professional, but remain completely focused on collecting the documents.
- Any document uploaded by the customer will show up in the chat history as: "📁 Document Uploaded: [URL]" or "📁 Document Link Received: [URL]". Count these as successful uploads.`;

        const apiKey = process.env.OPENROUTER_API_KEY || Buffer.from("c2stb3ItdjEtZDNjYTJhN2U2OTVlNDhmOWVjMDhmZjMzNzFmODZmN2JhZThjYTQ0ZWRkN2JiYjdjMzJmM2VmNjgxM2M2M2YwZA==", "base64").toString("utf-8");

        const modelsToTry = [
            "google/gemma-4-31b-it:free",
            "nvidia/nemotron-nano-9b-v2:free",
            "liquid/lfm-2.5-1.2b-instruct:free"
        ];

        for (const model of modelsToTry) {
            console.log(`\nCalling OpenRouter completions using model: ${model}...`);
            try {
                const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                        "HTTP-Referer": "https://hanva-crm.vercel.app",
                        "X-Title": "Hanva CRM"
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            { role: "system", content: systemPrompt },
                            ...formattedMessages
                        ]
                    })
                });

                console.log(`Response Status: ${response.status} ${response.statusText}`);
                const resData = await response.json();
                
                if (response.ok && !resData.error) {
                    const reply = resData.choices?.[0]?.message?.content?.trim();
                    console.log(`🟢 SUCCESS with model ${model}!`);
                    console.log("AI Reply:", reply);
                    break;
                } else {
                    console.log(`🔴 FAILED with model ${model}:`, JSON.stringify(resData.error || resData));
                }
            } catch (err: any) {
                console.log(`❌ ERROR calling model ${model}:`, err.message || err);
            }
        }

    } catch (e: any) {
        console.error("Test execution failed:", e.message || e);
    }
}

test();
