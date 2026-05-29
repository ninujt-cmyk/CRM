import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckSquare, Calendar, Clock, ArrowRight } from "lucide-react"
import { isToday, isTomorrow, isPast } from "date-fns"
import { redirect } from "next/navigation"
import { TaskCard } from "@/components/task-card"

export default async function TasksPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get follow-ups (tasks) for the telecaller
  const { data: followUps } = await supabase
    .from("follow_ups")
    .select(`
      *,
      leads (
        id,
        name,
        phone,
        email,
        company,
        status
      )
    `)
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: true })

  // Separate tasks by status and urgency
  const pendingTasks = followUps?.filter((task: any) => task.status === "pending") || []
  const overdueTasks = pendingTasks.filter((task: any) => isPast(new Date(task.scheduled_at)))
  const todayTasks = pendingTasks.filter((task: any) => isToday(new Date(task.scheduled_at)))
  const tomorrowTasks = pendingTasks.filter((task: any) => isTomorrow(new Date(task.scheduled_at)))
  const upcomingTasks = pendingTasks.filter((task: any) => {
    const taskDate = new Date(task.scheduled_at)
    return !isPast(taskDate) && !isToday(taskDate) && !isTomorrow(taskDate)
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Tasks</h1>
          <p className="text-gray-600 mt-1">Manage your follow-ups and scheduled activities</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className={overdueTasks.length > 0 ? "border-red-200" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{overdueTasks.length}</p>
              </div>
              <Clock className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today</p>
                <p className="text-2xl font-bold text-blue-600">{todayTasks.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Tomorrow</p>
                <p className="text-2xl font-bold text-green-600">{tomorrowTasks.length}</p>
              </div>
              <ArrowRight className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Upcoming</p>
                <p className="text-2xl font-bold text-purple-600">{upcomingTasks.length}</p>
              </div>
              <CheckSquare className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Overdue Tasks */}
      {overdueTasks.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Overdue Tasks ({overdueTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {overdueTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} isOverdue={true} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Today's Tasks */}
      {todayTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Today's Tasks ({todayTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tomorrow's Tasks */}
      {tomorrowTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Tomorrow's Tasks ({tomorrowTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tomorrowTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Upcoming Tasks */}
      {upcomingTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5" />
              Upcoming Tasks ({upcomingTasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingTasks.map((task: any) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </CardContent>
        </Card>
      )}

      {pendingTasks.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <CheckSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks scheduled</h3>
            <p className="text-gray-600">You're all caught up! Schedule follow-ups from your leads to see them here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
