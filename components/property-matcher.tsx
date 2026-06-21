"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, MapPin, Sparkles } from "lucide-react"

export function PropertyMatcher({ leadId }: { leadId: string }) {
  const [matches, setMatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [preferences, setPreferences] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchMatches()
  }, [leadId])

  const fetchMatches = async () => {
    setLoading(true)
    try {
      // 1. Fetch Lead Preferences
      const { data: customFields } = await supabase
        .from('lead_custom_fields')
        .select('field_key, field_value')
        .eq('lead_id', leadId)

      if (!customFields || customFields.length === 0) {
        setLoading(false)
        return
      }

      const prefs: any = {}
      customFields.forEach(f => { prefs[f.field_key] = f.field_value })
      setPreferences(prefs)

      // 2. Fetch Matching Properties
      let query = supabase.from('properties').select('*').eq('status', 'available')
      
      if (prefs.budget) {
        query = query.lte('price', Number(prefs.budget))
      }
      if (prefs.bhk_preference) {
        query = query.eq('bhk_config', prefs.bhk_preference)
      }
      if (prefs.preferred_location) {
        // Simple case-insensitive text match for location
        query = query.ilike('location', `%${prefs.preferred_location}%`)
      }

      const { data: matchedProps } = await query.limit(3)
      if (matchedProps) {
        setMatches(matchedProps)
      }

    } catch (error) {
      console.error("Error matching properties:", error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-4 text-center text-sm text-slate-500 animate-pulse">Running AI Matcher...</div>
  }

  if (!preferences) return null // Hide if no preferences

  return (
    <Card className="border-indigo-100 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm mt-4">
      <CardHeader className="py-3 px-4 flex flex-row items-center justify-between space-y-0 border-b border-indigo-100 dark:border-indigo-900/50">
        <CardTitle className="text-sm font-bold flex items-center text-indigo-700 dark:text-indigo-400">
          <Sparkles className="h-4 w-4 mr-2" />
          Suggested Properties (Matched to requirements)
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {matches.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-2">No active inventory matches their exact criteria right now.</p>
        ) : (
          <div className="space-y-3">
            {matches.map(prop => (
              <div key={prop.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center shrink-0">
                    <Building className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="overflow-hidden">
                    <h4 className="font-semibold text-sm truncate">{prop.title}</h4>
                    <div className="flex items-center text-[10px] text-slate-500 mt-0.5">
                      <MapPin className="h-3 w-3 mr-1" /> {prop.location} • {prop.bhk_config}
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-sm text-blue-600">₹{(prop.price / 100000).toFixed(2)}L</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
