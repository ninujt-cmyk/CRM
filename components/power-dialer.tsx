"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PhoneCall, PhoneForwarded, PhoneMissed, PhoneOff, Check, ChevronRight, X, User } from "lucide-react"

interface PowerDialerProps {
  isOpen: boolean
  onClose: () => void
  leads: any[]
}

export function PowerDialer({ isOpen, onClose, leads }: PowerDialerProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isCalling, setIsCalling] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  const currentLead = leads[currentIndex]

  // Timer for active call
  useEffect(() => {
    let interval: any;
    if (isCalling) {
      interval = setInterval(() => setCallDuration(d => d + 1), 1000)
    } else {
      setCallDuration(0)
    }
    return () => clearInterval(interval)
  }, [isCalling])

  if (!isOpen || !currentLead) return null

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  const handleNext = () => {
    setIsCalling(false)
    if (currentIndex < leads.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onClose()
      setCurrentIndex(0)
    }
  }

  const handleCall = () => {
    setIsCalling(true)
    // Actually trigger C2C API here if integrated
  }

  const handleEndCall = () => {
    setIsCalling(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden bg-slate-900 border-slate-800 text-slate-100 h-[80vh] flex flex-col sm:rounded-3xl shadow-2xl">
        
        {/* Header (Progress) */}
        <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <PhoneCall className="h-5 w-5 text-indigo-500" />
              <span className="font-bold text-lg tracking-tight">Power Dialer</span>
            </div>
            <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/30">
              Lead {currentIndex + 1} of {leads.length}
            </Badge>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-slate-400 hover:text-white hover:bg-slate-800 rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Main Content Split */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Column: Lead Info & Dialer Controls */}
          <div className="w-full md:w-1/2 p-8 flex flex-col justify-between border-r border-slate-800 overflow-y-auto">
            <div>
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner">
                <User className="h-10 w-10 text-slate-500" />
              </div>
              
              <h2 className="text-4xl font-black text-white tracking-tight mb-2">
                {currentLead.name || "Unknown Lead"}
              </h2>
              <p className="text-2xl font-medium text-slate-400 font-mono mb-8">
                {currentLead.phone || "No Phone"}
              </p>

              <div className="space-y-4 mb-8">
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Company</p>
                  <p className="text-slate-300 font-medium">{currentLead.company || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Email</p>
                  <p className="text-slate-300 font-medium">{currentLead.email || "Not provided"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Current Status</p>
                  <Badge className="bg-slate-800 text-slate-300 border-slate-700 capitalize">{currentLead.status || "New"}</Badge>
                </div>
              </div>
            </div>

            {/* Dialer Controls Bottom */}
            <div className="mt-8">
              {isCalling ? (
                <div className="flex flex-col items-center">
                  <div className="text-3xl font-mono text-emerald-400 mb-6 font-bold">{formatTime(callDuration)}</div>
                  <Button 
                    onClick={handleEndCall}
                    className="w-full h-16 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-lg shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all active:scale-95"
                  >
                    <PhoneOff className="mr-3 h-6 w-6" /> End Call
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Button 
                    onClick={handleCall}
                    className="w-full h-16 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-[0_0_20px_rgba(5,150,105,0.3)] transition-all active:scale-95"
                  >
                    <PhoneCall className="mr-3 h-6 w-6" /> Start Call
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={handleNext}
                    className="w-full h-12 rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white transition-all"
                  >
                    Skip to Next Lead <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Script & Notes */}
          <div className="w-full md:w-1/2 bg-slate-900/50 p-8 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">1</span>
              Calling Script
            </h3>
            
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 mb-8">
              <p className="text-slate-300 leading-relaxed text-sm">
                "Hi, is this <strong>{currentLead.name || "there"}</strong>? This is [Your Name] from the Real Estate team. 
                I noticed you were interested in some properties recently. Do you have a quick 2 minutes to discuss your requirements so I can send you some tailored options?"
              </p>
            </div>

            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span>
              Call Disposition
            </h3>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button onClick={handleNext} variant="outline" className="h-12 border-slate-700 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/50 justify-start px-4">
                <Check className="mr-2 h-4 w-4" /> Interested
              </Button>
              <Button onClick={handleNext} variant="outline" className="h-12 border-slate-700 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/50 justify-start px-4">
                <PhoneOff className="mr-2 h-4 w-4" /> Not Interested
              </Button>
              <Button onClick={handleNext} variant="outline" className="h-12 border-slate-700 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/50 justify-start px-4">
                <PhoneForwarded className="mr-2 h-4 w-4" /> Call Back Later
              </Button>
              <Button onClick={handleNext} variant="outline" className="h-12 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-300 justify-start px-4">
                <PhoneMissed className="mr-2 h-4 w-4" /> No Answer
              </Button>
            </div>

            <div className="flex-1 flex flex-col">
              <label className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Quick Notes</label>
              <textarea 
                className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
                placeholder="Type any notes from the call here..."
              ></textarea>
            </div>
            
          </div>
        </div>

      </DialogContent>
    </Dialog>
  )
}
