"use client"

import { Building2, IndianRupee, MapPin, Calendar, Clock, User2, Phone, Mail } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function InboxDetails({ threadId }: { threadId: string }) {
  // Mock Lead Details based on thread
  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950">
      {/* Header Profile */}
      <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center text-center bg-slate-50/50 dark:bg-slate-900/20">
        <div className="h-20 w-20 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-md mb-4">
          RS
        </div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Rohan Sharma</h2>
        <p className="text-sm text-slate-500 mb-3">rohan.s@example.com</p>
        <div className="flex gap-2">
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0">Hot Lead</Badge>
            <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 border-0">Site Visit Scheduled</Badge>
        </div>
      </div>

      <div className="p-6 space-y-8 flex-1 overflow-y-auto">
        
        {/* Deal Info */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Deal Information</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"><Building2 className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Skyline Apartments</p>
                <p className="text-xs text-slate-500">3BHK • 1850 sq.ft</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"><IndianRupee className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">₹1.45 Cr Budget</p>
                <p className="text-xs text-slate-500">Negotiable up to 1.5Cr</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500"><MapPin className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Wakad, Pune</p>
                <p className="text-xs text-slate-500">Preferred Location</p>
              </div>
            </div>
          </div>
        </div>

        {/* Next Action */}
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800/50">
          <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-400 mb-3 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Upcoming Action
          </h3>
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">Site Visit</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium">
            <Clock className="h-3.5 w-3.5" /> Tomorrow, 11:00 AM
          </div>
        </div>

        {/* Contact Details */}
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Contact</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500 flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> Phone</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">+91 98765 43210</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800/50">
                <span className="text-slate-500 flex items-center gap-2"><User2 className="h-3.5 w-3.5" /> Source</span>
                <span className="font-medium text-slate-800 dark:text-slate-200">MagicBricks</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
