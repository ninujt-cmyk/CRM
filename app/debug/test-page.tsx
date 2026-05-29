// app/debug/test-page.tsx
"use client"

import { useState, useEffect } from 'react'
import Link from 'next/link'
import FollowUpTest from './follow-up-test'
import NotificationTest from './notification-test'
import ReminderTest from './reminder-test'

export default function TestPage() {
  const [step, setStep] = useState(1)

  const components = [
    { name: 'Basic HTML', component: <div>Basic HTML</div> },
    { name: 'With undefined', component: <div>{undefined}</div> },
    { name: 'With null', component: <div>{null}</div> },
    { name: 'With true', component: <div>{true}</div> },
    { name: 'With false', component: <div>{false}</div> },
    { name: 'Follow-up Test', component: <FollowUpTest /> },
    { name: 'Notification Test', component: <NotificationTest /> },
    { name: 'Reminder Service Test', component: <ReminderTest /> },
  ]

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Debug Test Page</h1>
      
      <div className="mb-4 space-y-2">
        <Link href="/telecaller/follow-ups" className="text-blue-500 hover:underline block">
          Go to Follow-ups Page
        </Link>
        <Link href="/telecaller" className="text-blue-500 hover:underline block">
          Go to Telecaller Dashboard
        </Link>
        <Link href="/debug/follow-ups-test" className="text-blue-500 hover:underline block">
          Go to Follow-ups Test Page
        </Link>
      </div>
      
      <div className="space-y-4">
        {components.map((comp, index) => (
          <div key={index} className="border p-4">
            <h3 className="font-semibold mb-2">{comp.name}</h3>
            <button 
              onClick={() => setStep(index + 1)}
              className="px-3 py-1 bg-blue-500 text-white rounded"
            >
              Test {comp.name}
            </button>
            {step === index + 1 && (
              <div className="mt-2 p-2 bg-gray-100">
                {comp.component}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}