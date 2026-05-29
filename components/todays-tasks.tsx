"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"
import { 
  Phone, 
  CheckCircle2, 
  MoreVertical, 
  Mail, 
  Users, 
  ArrowRight,
  Clock,
  CalendarDays,
  Sun,
  Coffee,
  AlertCircle
} from "lucide-react"
import { formatDistanceToNow, isPast, isToday, addHours, addDays } from "date-fns"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"

interface Task {
  id: string
  title: string
  follow_up_type: 'call' | 'email' | 'meeting' | 'whatsapp'
  scheduled_at: string
  status: string
  priority: string
  lead: {
    id: string
    name: string
    phone: string
    company: string | null
  }
}

export function TodaysTasks({ userId }: { userId: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()

  // Fetch Logic
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const now = new Date()
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString()

        const { data, error } = await supabase
          .from("follow_ups")
          .select(`
            id, title, follow_up_type, scheduled_at, status, priority,
            lead:leads!follow_ups_lead_id_fkey(id, name, phone, company)
          `)
          .eq("user_id", userId)
          .neq("status", "completed")
          .lte("scheduled_at", endOfDay) 
          .order("scheduled_at", { ascending: true })

        if (error) throw error
        setTasks(data || [])
      } catch (error) {
        console.error("Error fetching tasks:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchTasks()
  }, [userId, supabase])

  // --- ACTIONS ---

  const completeTask = async (taskId: string) => {
    const previousTasks = [...tasks]
    setTasks((prev) => prev.filter((task) => task.id !== taskId)) // Optimistic UI

    try {
      const { error } = await supabase.from("follow_ups").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", taskId)
      if (error) throw error
      toast.success("Task completed")
    } catch (error) {
      setTasks(previousTasks)
      toast.error("Failed to complete task")
    }
  }

  const snoozeTask = async (taskId: string, hours: number) => {
    const previousTasks = [...tasks]
    setTasks((prev) => prev.filter((task) => task.id !== taskId)) // Hide temporarily

    try {
      const currentTask = tasks.find(t => t.id === taskId)
      if(!currentTask) return

      const newDate = addHours(new Date(), hours) // Reschedule from NOW
      
      const { error } = await supabase.from("follow_ups").update({ scheduled_at: newDate.toISOString() }).eq("id", taskId)
      if (error) throw error
      
      toast.success(`Snoozed for ${hours} hours`)
    } catch (error) {
      setTasks(previousTasks)
      toast.error("Failed to snooze")
    }
  }

  const makeCall = (phone: string) => {
    if (!phone) return toast.error("No phone number")
    window.open(`tel:${phone}`, "_self")
  }

  // --- RENDER HELPERS ---

  const getTaskIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4 text-blue-500" />
      case 'meeting': return <Users className="h-4 w-4 text-purple-500" />
      default: return <Phone className="h-4 w-4 text-green-500" />
    }
  }

  // Group tasks
  const overdueTasks = tasks.filter(t => isPast(new Date(t.scheduled_at)) && !isToday(new Date(t.scheduled_at)))
  const todayTasks = tasks.filter(t => !overdueTasks.includes(t))

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-lg border border-slate-200" />)}
      </div>
    )
  }

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center border rounded-xl bg-slate-50/50 border-dashed">
        <div className="bg-white p-4 rounded-full shadow-sm mb-3 ring-1 ring-slate-100">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">All caught up!</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[200px]">You have no pending follow-ups for today.</p>
        <Link href="/telecaller/leads">
            <Button variant="outline" size="sm" className="mt-4 bg-white">Find New Leads</Button>
        </Link>
      </div>
    )
  }

  const TaskCard = ({ task, isOverdue = false }: { task: Task, isOverdue?: boolean }) => (
    <Card className={cn("group hover:shadow-md transition-all duration-200 border-l-4", isOverdue ? "border-l-red-500 bg-red-50/30 border-y-red-100 border-r-red-100" : "border-l-blue-500")}>
      <CardContent className="p-3">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn("mt-1 h-9 w-9 rounded-full border flex items-center justify-center shrink-0 bg-white shadow-sm", isOverdue ? "border-red-100" : "border-slate-100")}>
            {getTaskIcon(task.follow_up_type)}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className={cn("font-semibold text-sm truncate pr-2", isOverdue ? "text-red-900" : "text-slate-900")}>{task.title}</h4>
              <Badge variant="outline" className={cn("text-[10px] h-5 border-0 px-1.5 font-medium", task.priority === 'high' ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600")}>
                {task.priority}
              </Badge>
            </div>
            
            <div className="flex items-center gap-1.5 text-xs text-slate-600 mb-2">
              <span className="font-medium truncate">{task.lead?.name}</span>
              {task.lead?.company && <span className="text-slate-400 truncate">• {task.lead.company}</span>}
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className={cn("flex items-center gap-1 font-medium", isOverdue ? "text-red-600" : "text-blue-600")}>
                <Clock className="h-3 w-3" />
                {isOverdue ? "Overdue " : "Due "}{formatDistanceToNow(new Date(task.scheduled_at), { addSuffix: true })}
              </span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-col gap-1">
            <Button 
              size="icon" variant="ghost" 
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100 rounded-full"
              onClick={() => completeTask(task.id)}
              title="Done"
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-blue-600 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel className="text-xs">Reschedule</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => snoozeTask(task.id, 1)}>
                    <Coffee className="h-3.5 w-3.5 mr-2" /> +1 Hour
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => snoozeTask(task.id, 3)}>
                    <Sun className="h-3.5 w-3.5 mr-2" /> +3 Hours
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => snoozeTask(task.id, 24)}>
                    <CalendarDays className="h-3.5 w-3.5 mr-2" /> Tomorrow
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                    <Link href={`/admin/leads/${task.lead?.id}`} className="flex items-center w-full">
                        <ArrowRight className="h-3.5 w-3.5 mr-2" /> View Lead
                    </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-200">
      {/* Overdue Section */}
      {overdueTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-1">
            <AlertCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Overdue ({overdueTasks.length})</span>
          </div>
          {overdueTasks.map(task => <TaskCard key={task.id} task={task} isOverdue={true} />)}
        </div>
      )}

      {/* Today Section */}
      <div className="space-y-2">
        {overdueTasks.length > 0 && <div className="h-px bg-slate-100 my-2" />}
        <div className="flex items-center gap-2 px-1">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Today's Schedule ({todayTasks.length})</span>
        </div>
        {todayTasks.map(task => <TaskCard key={task.id} task={task} />)}
      </div>
    </div>
  )
}
