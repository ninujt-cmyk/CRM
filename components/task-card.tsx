"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CheckSquare, Calendar, Phone, Clock, User } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import Link from "next/link"
import { markAsCompleted } from "@/app/telecaller/tasks/actions"

interface TaskCardProps {
  task: any
  isOverdue?: boolean
}

export function TaskCard({ task, isOverdue = false }: TaskCardProps) {
  return (
    <div
      className={`border rounded-lg p-4 ${isOverdue ? "border-red-200 bg-red-50" : "border-gray-200 bg-white"} hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={isOverdue ? "destructive" : "secondary"}>
              {task.follow_up_type.replace("_", " ").toUpperCase()}
            </Badge>
            {isOverdue && <Badge variant="destructive">OVERDUE</Badge>}
          </div>

          <h3 className="font-semibold text-gray-900 mb-1">{task.leads?.name}</h3>
          {task.leads?.company && <p className="text-sm text-gray-600 mb-2">{task.leads.company}</p>}

          <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {format(new Date(task.scheduled_at), "MMM dd, yyyy 'at' h:mm a")}
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDistanceToNow(new Date(task.scheduled_at), { addSuffix: true })}
            </div>
          </div>

          {task.notes && <p className="text-sm text-gray-700 mb-3 italic">"{task.notes}"</p>}

          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/telecaller/leads/${task.leads?.id}`}>
                <User className="h-4 w-4 mr-1" />
                View Lead
              </Link>
            </Button>

            {task.follow_up_type === "call" && (
              <Button size="sm" variant="outline" onClick={() => window.open(`tel:${task.leads?.phone}`, "_self")}>
                <Phone className="h-4 w-4 mr-1" />
                Call Now
              </Button>
            )}

            <form action={markAsCompleted.bind(null, task.id)}>
              <Button size="sm" type="submit">
                <CheckSquare className="h-4 w-4 mr-1" />
                Mark Done
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
