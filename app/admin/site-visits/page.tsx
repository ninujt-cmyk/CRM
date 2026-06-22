"use client"

import { useState, useEffect } from "react"
import { getSiteVisits, updateSiteVisitStatus } from "@/app/actions/site-visits"
import { Card, CardContent } from "@/components/ui/card"
import { MapPin, Calendar, User, Phone, CheckCircle, XCircle, Clock } from "lucide-react"

export default function SiteVisitsPage() {
  const [visits, setVisits] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchVisits()
  }, [])

  const fetchVisits = async () => {
    setLoading(true)
    const res = await getSiteVisits()
    if (res.success) {
      setVisits(res.data || [])
    }
    setLoading(false)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-700'
      case 'conducted': return 'bg-green-100 text-green-700'
      case 'cancelled': return 'bg-red-100 text-red-700'
      case 'no_show': return 'bg-orange-100 text-orange-700'
      default: return 'bg-slate-100 text-slate-700'
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Site Visits Calendar</h1>
        <p className="text-slate-500 mt-1">Track physical property visits with your leads.</p>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div></div>
      ) : (
        <div className="space-y-4">
          {visits.length === 0 ? (
            <div className="text-center p-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed">
              <Calendar className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No site visits scheduled</h3>
            </div>
          ) : (
            visits.map(visit => (
              <Card key={visit.id} className="overflow-hidden">
                <CardContent className="p-0 flex flex-col md:flex-row">
                  <div className="p-6 md:w-1/3 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="h-4 w-4 text-slate-500" />
                      <span className="font-semibold">{new Date(visit.scheduled_at).toLocaleDateString()}</span>
                      <span className="text-slate-500 text-sm">{new Date(visit.scheduled_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div className={`w-max px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${getStatusColor(visit.status)}`}>
                      {visit.status.replace('_', ' ')}
                    </div>
                  </div>
                  
                  <div className="p-6 md:w-1/3 border-r border-slate-100 dark:border-slate-800 flex flex-col justify-center space-y-3">
                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{visit.lead?.name || 'Unknown Lead'}</p>
                        <p className="text-sm text-slate-500">{visit.lead?.phone}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:w-1/3 flex flex-col justify-center space-y-3">
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">{visit.property?.title || 'Unknown Property'}</p>
                        <p className="text-sm text-slate-500">{visit.property?.location}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:w-1/4 border-l border-slate-100 dark:border-slate-800 flex flex-col justify-center items-end gap-2 bg-slate-50/30 dark:bg-slate-900/30">
                     {visit.status === 'scheduled' ? (
                       <div className="flex flex-col gap-2 w-full max-w-[150px]">
                           <button 
                             onClick={async () => {
                               await updateSiteVisitStatus(visit.id, 'conducted');
                               fetchVisits();
                             }}
                             className="px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-md text-xs font-semibold w-full flex items-center justify-center gap-1 transition-colors"
                           >
                             <CheckCircle className="h-3.5 w-3.5" /> Conducted
                           </button>
                           <button 
                             onClick={async () => {
                               await updateSiteVisitStatus(visit.id, 'no_show');
                               fetchVisits();
                             }}
                             className="px-3 py-1.5 bg-orange-50 text-orange-700 hover:bg-orange-100 border border-orange-200 rounded-md text-xs font-semibold w-full flex items-center justify-center gap-1 transition-colors"
                           >
                             <Clock className="h-3.5 w-3.5" /> No Show
                           </button>
                           <button 
                             onClick={async () => {
                               await updateSiteVisitStatus(visit.id, 'cancelled');
                               fetchVisits();
                             }}
                             className="px-3 py-1.5 bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 rounded-md text-xs font-semibold w-full flex items-center justify-center gap-1 transition-colors"
                           >
                             <XCircle className="h-3.5 w-3.5" /> Cancelled
                           </button>
                       </div>
                     ) : (
                       <div className="text-sm text-slate-400 font-medium">No actions available</div>
                     )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
