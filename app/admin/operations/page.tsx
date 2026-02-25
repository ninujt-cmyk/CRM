"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/ui/use-toast"
import { 
  Activity, Award, FileText, Star, Settings, Loader2, Save 
} from "lucide-react"

// Import the components we built previously!
import { ConversionFunnel } from "@/components/admin/ConversionFunnel"
import { LiveLeaderboard } from "@/components/telecaller/LiveLeaderboard"

// --- TYPES ---
interface QARecord {
  id: string
  created_at: string
  total_score: number
  comments: string
  agent: { full_name: string }
  evaluator: { full_name: string }
}

interface ScriptRecord {
  id: string
  trigger_status: string
  script_text: string
}

export default function OperationsDashboard() {
  const supabase = createClient()
  const { toast } = useToast()
  
  const [qaScores, setQaScores] = useState<QARecord[]>([])
  const [scripts, setScripts] = useState<ScriptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [savingScript, setSavingScript] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const fetchDashboardData = async () => {
    setLoading(true)
    
    // 1. Fetch QA Scores
    const { data: qaData } = await supabase
      .from('call_qa_scores')
      .select('id, created_at, total_score, comments, agent:users!agent_id(full_name), evaluator:users!evaluator_id(full_name)')
      .order('created_at', { ascending: false })
      .limit(20)
      
    if (qaData) setQaScores(qaData as any)

    // 2. Fetch Live Scripts
    const { data: scriptData } = await supabase
      .from('call_scripts')
      .select('*')
      .order('trigger_status', { ascending: true })
      
    if (scriptData) setScripts(scriptData)

    setLoading(false)
  }

  // Handle Script Edits
  const handleScriptChange = (id: string, newText: string) => {
    setScripts(prev => prev.map(s => s.id === id ? { ...s, script_text: newText } : s))
  }

  const saveScript = async (script: ScriptRecord) => {
    setSavingScript(script.id)
    const { error } = await supabase
      .from('call_scripts')
      .update({ script_text: script.script_text, updated_at: new Date().toISOString() })
      .eq('id', script.id)

    setSavingScript(null)
    if (error) {
      toast({ title: "Failed to save script", description: error.message, variant: "destructive" })
    } else {
      toast({ title: "Script Updated", description: `The ${script.trigger_status} script is now live for all telecallers.`, className: "bg-indigo-600 text-white" })
    }
  }

  if (loading) return <div className="flex h-[80vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;

  return (
    <div className="space-y-6 pb-10 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Settings className="h-8 w-8 text-indigo-600" />
          Operations Command Center
        </h1>
        <p className="text-slate-500 mt-1">Manage analytics, quality assurance, and automated scripts.</p>
      </div>

      <Tabs defaultValue="analytics" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-lg h-12">
          <TabsTrigger value="analytics" className="text-base"><Activity className="h-4 w-4 mr-2" /> Performance & Analytics</TabsTrigger>
          <TabsTrigger value="qa" className="text-base"><Star className="h-4 w-4 mr-2" /> QA & Call Reviews</TabsTrigger>
          <TabsTrigger value="scripts" className="text-base"><FileText className="h-4 w-4 mr-2" /> Live Call Scripts</TabsTrigger>
        </TabsList>

        {/* --- TAB 1: ANALYTICS & GAMIFICATION --- */}
        <TabsContent value="analytics" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ConversionFunnel />
            </div>
            <div className="lg:col-span-1">
              <LiveLeaderboard />
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 2: QUALITY ASSURANCE --- */}
        <TabsContent value="qa" className="mt-6">
          <Card className="shadow-sm">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-indigo-800">Recent Call Evaluations</CardTitle>
              <CardDescription>Review the latest scores given to telecallers by managers.</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 bg-slate-100 uppercase font-semibold">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Telecaller</th>
                    <th className="py-3 px-4">Evaluator</th>
                    <th className="py-3 px-4">Total Score</th>
                    <th className="py-3 px-4">Manager Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {qaScores.length === 0 ? (
                    <tr><td colSpan={5} className="text-center p-8 text-slate-500">No QA scores recorded yet.</td></tr>
                  ) : (
                    qaScores.map(qa => (
                      <tr key={qa.id} className="border-b hover:bg-slate-50">
                        <td className="py-3 px-4 text-slate-500">{new Date(qa.created_at).toLocaleDateString()}</td>
                        <td className="py-3 px-4 font-semibold text-slate-700">{qa.agent?.full_name || "Unknown"}</td>
                        <td className="py-3 px-4 text-slate-500">{qa.evaluator?.full_name || "System"}</td>
                        <td className="py-3 px-4">
                          <Badge variant={qa.total_score >= 12 ? "default" : qa.total_score >= 8 ? "secondary" : "destructive"}>
                            {qa.total_score} / 15
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-600 truncate max-w-xs" title={qa.comments}>{qa.comments || "No comments"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* --- TAB 3: SCRIPT MANAGEMENT --- */}
        <TabsContent value="scripts" className="mt-6">
          <Card className="shadow-sm border-indigo-100">
            <CardHeader className="bg-indigo-50/50 border-b">
              <CardTitle className="text-indigo-800 flex items-center gap-2"><FileText className="h-5 w-5" /> Dynamic Script Manager</CardTitle>
              <CardDescription>
                Updates here are instantly reflected on all telecaller screens. Use <strong>{"{name}"}</strong>, <strong>{"{agent}"}</strong>, and <strong>{"{loan_type}"}</strong> as dynamic variables.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {scripts.map(script => (
                <div key={script.id} className="bg-white border rounded-lg p-4 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className="bg-slate-700 text-sm">{script.trigger_status} Status</Badge>
                    <Button 
                      onClick={() => saveScript(script)} 
                      disabled={savingScript === script.id}
                      size="sm" 
                      className="bg-indigo-600 hover:bg-indigo-700"
                    >
                      {savingScript === script.id ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />} Save Update
                    </Button>
                  </div>
                  <Textarea 
                    value={script.script_text} 
                    onChange={(e) => handleScriptChange(script.id, e.target.value)}
                    className="min-h-[100px] text-base font-medium text-slate-700 bg-slate-50"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  )
}
