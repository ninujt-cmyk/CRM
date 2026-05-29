// components/timeline-view.tsx
"use client"

import { MessageSquare, History, Calendar, Phone } from "lucide-react"

interface TimelineItem {
  type: string
  id: string
  title: string
  description: string
  user: string
  date: string
  icon: JSX.Element
}

interface TimelineViewProps {
  data: TimelineItem[]
}

export function TimelineView({ data }: TimelineViewProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "note":
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      case "status_change":
        return <History className="h-4 w-4 text-purple-500" />
      case "follow_up":
        return <Calendar className="h-4 w-4 text-green-500" />
      case "call":
        return <Phone className="h-4 w-4 text-orange-500" />
      default:
        return <div className="h-4 w-4 rounded-full bg-gray-300" />
    }
  }

  const getColor = (type: string) => {
    switch (type) {
      case "note":
        return "border-blue-200 bg-blue-50"
      case "status_change":
        return "border-purple-200 bg-purple-50"
      case "follow_up":
        return "border-green-200 bg-green-50"
      case "call":
        return "border-orange-200 bg-orange-50"
      default:
        return "border-gray-200 bg-gray-50"
    }
  }

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No activity recorded yet</p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 h-full w-0.5 bg-gray-200" />
      
      <div className="space-y-6">
        {data.map((item, index) => (
          <div key={item.id || index} className="relative flex gap-4">
            {/* Timeline dot */}
            <div className="relative z-10">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border-2 border-gray-300">
                {getIcon(item.type)}
              </div>
            </div>
            
            {/* Content */}
            <div className={`flex-1 rounded-lg border p-4 ${getColor(item.type)}`}>
              <div className="flex justify-between items-start">
                <h3 className="font-semibold">{item.title || "Untitled"}</h3>
                <span className="text-sm text-gray-500">
                  {item.date ? new Date(item.date).toLocaleString() : "No date"}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-700">{item.description || "No description"}</p>
              <p className="mt-2 text-xs text-gray-500">By {item.user || "Unknown"}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
