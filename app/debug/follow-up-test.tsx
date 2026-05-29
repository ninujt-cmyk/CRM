// app/debug/follow-up-test.tsx
"use client"

import { useState } from "react"
import { ScheduleFollowUpModal } from "@/components/schedule-follow-up-modal"
import { Button } from "@/components/ui/button"

export default function FollowUpTest() {
  const [showModal, setShowModal] = useState(false)

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Follow-up Test</h1>
      
      <div className="space-y-4">
        <p>This page tests the follow-up scheduling functionality.</p>
        
        <Button onClick={() => setShowModal(true)}>
          Open Schedule Follow-up Modal
        </Button>
        
        <ScheduleFollowUpModal 
          open={showModal}
          onOpenChange={setShowModal}
        />
      </div>
    </div>
  )
}