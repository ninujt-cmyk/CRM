// app/debug/error-130-deep/page.tsx
"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Terminal, Search, Eye, EyeOff, Bug, RefreshCw, Code, FileText } from "lucide-react"

export default function DeepDebugError130Page() {
  const [componentsToCheck, setComponentsToCheck] = useState<string[]>([])
  const [problematicComponents, setProblematicComponents] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate checking common components that might have the error
    const commonProblematicComponents = [
      'Layout',
      'Footer', 
      'Header',
      'Navigation',
      'Sidebar',
      'ThemeProvider',
      'UserMenu',
      'NotificationBell',
      'SearchBar',
      'Pagination'
    ]
    
    setComponentsToCheck(commonProblematicComponents)
    
    // Simulate finding problematic components (this would be your actual check)
    setTimeout(() => {
      setProblematicComponents(['Layout', 'Footer', 'ThemeProvider'])
      setLoading(false)
    }, 1000)
  }, [])

  const testComponentRendering = (componentName: string) => {
    // This simulates what might be causing the error
    const testCases = [
      { value: undefined, description: 'Rendering undefined' },
      { value: null, description: 'Rendering null' },
      { value: true, description: 'Rendering boolean true' },
      { value: false, description: 'Rendering boolean false' }
    ]

    return (
      <div className="space-y-2">
        <h4 className="font-semibold">{componentName}</h4>
        {testCases.map((test, index) => (
          <div key={index} className="p-2 border rounded">
            <p className="text-sm font-medium">{test.description}:</p>
            <div className="bg-red-50 p-2 mt-1 rounded">
              {/* This will cause error #130 in production */}
              <span className="text-red-600">
                {test.value}
              </span>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-2">
        <Bug className="h-8 w-8 text-red-500" />
        <h1 className="text-3xl font-bold">Deep Debug: React Error #130</h1>
      </div>

      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Source Identification</AlertTitle>
        <AlertDescription>
          The issue is likely in layout/footer components. Multiple "undefined" values detected at page bottom.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suspected Components */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Suspected Problematic Components
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {problematicComponents.map((component, index) => (
                <div key={index} className="p-3 bg-red-50 border border-red-200 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-red-800">{component}</span>
                    <Badge variant="destructive">High Risk</Badge>
                  </div>
                  <p className="text-sm text-red-600 mt-1">
                    Likely contains direct rendering of undefined/null values
                  </p>
                </div>
              ))}
              
              {componentsToCheck.filter(comp => !problematicComponents.includes(comp)).map((component, index) => (
                <div key={index} className="p-3 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-green-800">{component}</span>
                    <Badge variant="secondary">Low Risk</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Component Testing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Component Rendering Test
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testComponentRendering('Layout Component')}
              
              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                <h4 className="font-semibold mb-2">Safe Alternatives:</h4>
                <div className="text-sm space-y-2">
                  <div>
                    <p className="font-medium">Instead of: <code>{`{undefinedValue}`}</code></p>
                    <p>Use: <code>{`{undefinedValue || "fallback"}`}</code></p>
                  </div>
                  <div>
                    <p className="font-medium">Instead of: <code>{`{user?.profile?.name}`}</code></p>
                    <p>Use: <code>{`{user?.profile?.name || "Guest"}`}</code></p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Fix Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Immediate Fixes Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded">
              <h4 className="font-semibold text-amber-800 mb-2">Check these files first:</h4>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><code>/components/layout.tsx</code> or <code>/components/Layout.tsx</code></li>
                <li><code>/components/footer.tsx</code> or <code>/components/Footer.tsx</code></li>
                <li><code>/components/header.tsx</code> or <code>/components/Header.tsx</code></li>
                <li><code>/app/layout.tsx</code></li>
                <li><code>/app/globals.css</code> (if it contains JSX somehow)</li>
              </ul>
            </div>

            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <h4 className="font-semibold text-green-800 mb-2">Search for these patterns:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Problematic patterns:</p>
                  <code className="block bg-red-50 p-2 rounded mt-1">{`{undefinedVariable}`}</code>
                  <code className="block bg-red-50 p-2 rounded mt-1">{`{nullValue}`}</code>
                  <code className="block bg-red-50 p-2 rounded mt-1">{`{booleanValue}`}</code>
                </div>
                <div>
                  <p className="font-medium">Safe patterns:</p>
                  <code className="block bg-green-50 p-2 rounded mt-1">{`{undefinedVariable || ''}`}</code>
                  <code className="block bg-green-50 p-2 rounded mt-1">{`{nullValue ?? 'default'}`}</code>
                  <code className="block bg-green-50 p-2 rounded mt-1">{`{String(booleanValue)}`}</code>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Fix Button */}
      <Card>
        <CardHeader>
          <CardTitle>Emergency Fix</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="destructive"
            className="w-full"
            onClick={() => {
              // This would scan and fix common patterns in your codebase
              alert('This would automatically fix common error #130 patterns in your code')
            }}
          >
            Auto-Fix Common Patterns
          </Button>
          
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <h4 className="font-semibold mb-2">Manual Fix Steps:</h4>
            <ol className="text-sm space-y-2 list-decimal list-inside">
              <li>Open your layout components</li>
              <li>Search for patterns like <code>{`{variable}`}</code> without fallbacks</li>
              <li>Add fallback values: <code>{`{variable || ''}`}</code></li>
              <li>Use optional chaining: <code>{`{object?.property}`}</code></li>
              <li>Test each fix by refreshing the page</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
