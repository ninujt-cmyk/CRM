// components/debug-render.tsx
"use client"

import { useEffect, useState } from 'react'

export function DebugRender({ children, name }: { children: React.ReactNode; name: string }) {
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    // This will help us identify which component is causing the error
    console.log(`Rendering component: ${name}`)
  }, [name])

  if (error) {
    console.error(`Error in component ${name}:`, error)
    return (
      <div style={{ border: '2px solid red', padding: '10px', margin: '10px' }}>
        <strong>ERROR in {name}:</strong> {error.message}
      </div>
    )
  }

  try {
    return <>{children}</>
  } catch (err) {
    setError(err as Error)
    return null
  }
}
