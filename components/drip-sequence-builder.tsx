"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Plus, Trash2, ArrowDown, Save, Send, MessageSquare, PhoneCall, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"

type ActionType = "whatsapp" | "email" | "sms" | "task" | "status_change"

interface SequenceStep {
  id: string
  delayDays: number
  actionType: ActionType
  content: string
}

export function DripSequenceBuilder() {
  const [name, setName] = useState("New Lead Welcome Sequence")
  const [trigger, setTrigger] = useState("lead_created")
  const [steps, setSteps] = useState<SequenceStep[]>([
    { id: "1", delayDays: 0, actionType: "whatsapp", content: "Hi {{name}}, thanks for reaching out. A quick question about your property requirements..." }
  ])

  const addStep = () => {
    const lastDelay = steps.length > 0 ? steps[steps.length - 1].delayDays : 0
    setSteps([
      ...steps,
      { id: Date.now().toString(), delayDays: lastDelay + 2, actionType: "task", content: "Follow up call" }
    ])
  }

  const updateStep = (id: string, field: keyof SequenceStep, value: any) => {
    setSteps(steps.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const removeStep = (id: string) => {
    setSteps(steps.filter(s => s.id !== id))
  }

  const getActionIcon = (type: ActionType) => {
    switch (type) {
      case "whatsapp": return <MessageSquare className="h-4 w-4 text-green-500" />
      case "email": return <Mail className="h-4 w-4 text-blue-500" />
      case "sms": return <Send className="h-4 w-4 text-indigo-500" />
      case "task": return <PhoneCall className="h-4 w-4 text-orange-500" />
      case "status_change": return <Plus className="h-4 w-4 text-slate-500" />
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader>
          <CardTitle>Sequence Details</CardTitle>
          <CardDescription>Define when this sequence should automatically start.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">Sequence Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">Trigger Event</label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger>
                <SelectValue placeholder="Select trigger..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lead_created">When a Lead is Created</SelectItem>
                <SelectItem value="status_nr">When Status changes to Not Reachable</SelectItem>
                <SelectItem value="site_visit_scheduled">When Site Visit is Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-0">
        {steps.map((step, index) => (
          <div key={step.id} className="relative">
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm relative z-10 hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 sm:items-start">
                <div className="shrink-0 pt-1">
                  <div className="flex flex-col items-center">
                    <Badge variant="outline" className="w-16 h-16 rounded-full flex flex-col justify-center items-center bg-slate-50 dark:bg-slate-900 border-2">
                      <span className="text-xl font-bold">{step.delayDays}</span>
                      <span className="text-[10px] uppercase text-slate-500">Days</span>
                    </Badge>
                  </div>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="flex items-center gap-2">
                       <span className="font-semibold text-slate-700 dark:text-slate-300">Wait</span>
                       <Input 
                         type="number" 
                         min="0"
                         className="w-20 h-8 text-center" 
                         value={step.delayDays} 
                         onChange={(e) => updateStep(step.id, "delayDays", parseInt(e.target.value) || 0)}
                       />
                       <span className="font-semibold text-slate-700 dark:text-slate-300">days, then:</span>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeStep(step.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="w-full sm:w-1/3">
                      <Select value={step.actionType} onValueChange={(v) => updateStep(step.id, "actionType", v)}>
                        <SelectTrigger className="w-full h-10">
                          <div className="flex items-center gap-2">
                            {getActionIcon(step.actionType)}
                            <SelectValue />
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="whatsapp">Send WhatsApp</SelectItem>
                          <SelectItem value="email">Send Email</SelectItem>
                          <SelectItem value="sms">Send SMS</SelectItem>
                          <SelectItem value="task">Create Task</SelectItem>
                          <SelectItem value="status_change">Change Status</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="w-full sm:w-2/3 relative">
                      <Textarea 
                        value={step.content}
                        onChange={(e) => updateStep(step.id, "content", e.target.value)}
                        className="resize-none h-20"
                        placeholder="Enter message template or task description. Use {{name}} for dynamic values."
                      />
                      <div className="absolute bottom-2 right-2 flex gap-1">
                        <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => updateStep(step.id, "content", step.content + " {{name}}")}>{{name}}</Badge>
                        <Badge variant="secondary" className="text-[10px] cursor-pointer" onClick={() => updateStep(step.id, "content", step.content + " {{company}}")}>{{company}}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {index < steps.length - 1 && (
              <div className="flex justify-center -my-2 relative z-0">
                <div className="h-12 w-0.5 bg-slate-200 dark:bg-slate-800" />
                <ArrowDown className="h-4 w-4 absolute top-4 text-slate-300 dark:text-slate-700 bg-slate-50 dark:bg-slate-950 rounded-full" />
              </div>
            )}
          </div>
        ))}

        <div className="flex justify-center pt-8 relative z-0">
          <div className="absolute top-0 h-8 w-0.5 bg-slate-200 dark:bg-slate-800" />
          <Button onClick={addStep} variant="outline" className="rounded-full shadow-sm bg-white dark:bg-slate-900 border-dashed border-2 relative z-10">
            <Plus className="h-4 w-4 mr-2" /> Add Next Step
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-6 border-t border-slate-200 dark:border-slate-800">
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-8">
          <Save className="h-4 w-4 mr-2" /> Save Sequence
        </Button>
      </div>
    </div>
  )
}
