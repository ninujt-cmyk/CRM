import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, Users, Clock, Target, Star, CheckCircle } from "lucide-react"

interface LeadStats {
  total: number
  new: number
  contacted: number
  qualified: number
  converted: number
  Interested: number
}

interface LeadStatsCardsProps {
  stats: LeadStats
}

const statConfigs = [
  {
    key: 'total' as const,
    title: 'Total Leads',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50'
  },
  {
    key: 'new' as const,
    title: 'New Leads',
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50'
  },
  {
    key: 'contacted' as const,
    title: 'Contacted',
    icon: Target,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50'
  },
  {
    key: 'Interested' as const,
    title: 'High Priority',
    icon: Star,
    color: 'text-red-600',
    bgColor: 'bg-red-50'
  },
  {
    key: 'qualified' as const,
    title: 'Qualified',
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-50'
  },
  {
    key: 'converted' as const,
    title: 'Converted',
    icon: CheckCircle,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50'
  }
]

export function LeadStatsCards({ stats }: LeadStatsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {statConfigs.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.key} className="shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {stats[stat.key]}
                  </p>
                </div>
                <div className={`p-2 rounded-full ${stat.bgColor}`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
