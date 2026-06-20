import { google } from '@ai-sdk/google'
import { streamText } from 'ai'
import { sidebarGroups } from '@/config/sidebar-nav'

// Dynamic extraction of the current platform features and navigation
const navigationContext = sidebarGroups.map(group => ({
  group: group.label,
  items: group.items.map(item => ({
    name: item.name,
    path: item.href,
    requiredModule: item.module
  }))
}))

const systemPrompt = `You are the HANVA CRM AI Guide Assistant. Your job is to help CRM administrators find features, understand how to use the platform, and navigate the system efficiently.

RULES:
1. Be concise, professional, and friendly.
2. Keep responses brief and strictly actionable. Do not write essays.
3. If the user asks where a feature is, provide them the exact path or "name" of the feature based on the navigation map below.
4. If they ask something completely unrelated to business, CRM, sales, or the HANVA platform, politely decline and steer them back to CRM assistance.
5. If the user mentions missing a feature, remind them that their Super Admin can enable it under "Settings -> Feature Modules" (the Super Admin Dashboard).

Here is the current platform navigation structure, which you MUST use to guide the user:
${JSON.stringify(navigationContext, null, 2)}
`

export async function POST(req: Request) {
  try {
    const { messages } = await req.json()

    const result = streamText({
      model: google('gemini-1.5-flash'), // Extremely fast for basic routing/help queries
      system: systemPrompt,
      messages,
      maxTokens: 500,
      temperature: 0.3, // keep it factual and grounded
    })

    return result.toDataStreamResponse()
  } catch (error) {
    console.error("AI Assistant Error:", error)
    return new Response(JSON.stringify({ error: "Failed to process AI request" }), { status: 500 })
  }
}
