"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle({ isCollapsed }: { isCollapsed?: boolean }) {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  // Prevent hydration mismatch
  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="outline" size="icon" className="h-8 w-8 rounded-full border-slate-200 shrink-0">
        <span className="sr-only">Loading theme</span>
      </Button>
    )
  }

  // Direct toggle function (No Dropdown needed)
  const toggleTheme = () => {
    // We use resolvedTheme so it correctly handles "system" preference
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }

  return (
    <Button 
      variant="outline" 
      size="icon" 
      onClick={toggleTheme}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
      className="h-8 w-8 rounded-full border-slate-200 bg-white/50 backdrop-blur hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-950/50 dark:hover:bg-slate-800 dark:hover:text-slate-50 transition-all duration-300 shadow-sm relative overflow-hidden shrink-0 z-50 cursor-pointer"
    >
      {/* Sun icon shows in Light mode, hides in Dark mode */}
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-amber-500 absolute" />
      
      {/* Moon icon hides in Light mode, shows in Dark mode */}
      <Moon className="h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-indigo-400 absolute" />
      
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
}
