"use client"

import dynamic from "next/dynamic"
import { Suspense } from "react"

const PWAComponents = dynamic(() => import("@/components/pwa-components"), {
  ssr: false,
})

export default function PWAWrapper() {
  return (
    <Suspense fallback={null}>
      <PWAComponents />
    </Suspense>
  )
}