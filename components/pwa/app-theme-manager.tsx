"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Sun, Moon, Monitor } from "lucide-react"

type Theme = "light" | "dark" | "system"

export function AppThemeManager() {
  const [theme, setTheme] = useState<Theme>("system")

  useEffect(() => {
    // Get saved theme or default to system
    const savedTheme = (localStorage.getItem("theme") as Theme) || "system"
    setTheme(savedTheme)
    applyTheme(savedTheme)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (theme === "system") {
        applyTheme("system")
      }
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [theme])

  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement

    if (newTheme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
      root.classList.toggle("dark", systemTheme === "dark")
    } else {
      root.classList.toggle("dark", newTheme === "dark")
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      const isDark = root.classList.contains("dark")
      metaThemeColor.setAttribute("content", isDark ? "#0a0a0a" : "#ffffff")
    }
  }

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme)
    localStorage.setItem("theme", newTheme)
    applyTheme(newTheme)
  }

  const getThemeIcon = () => {
    switch (theme) {
      case "light":
        return <Sun className="h-4 w-4" />
      case "dark":
        return <Moon className="h-4 w-4" />
      default:
        return <Monitor className="h-4 w-4" />
    }
  }

  const cycleTheme = () => {
    const themes: Theme[] = ["light", "dark", "system"]
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    changeTheme(themes[nextIndex])
  }

  return (
    <Button variant="ghost" size="sm" onClick={cycleTheme} className="p-2" title={`Current theme: ${theme}`}>
      {getThemeIcon()}
    </Button>
  )
}

// Hook for theme management
export function useTheme() {
  const [theme, setTheme] = useState<Theme>("system")
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    const savedTheme = (localStorage.getItem("theme") as Theme) || "system"
    setTheme(savedTheme)

    const updateIsDark = () => {
      setIsDark(document.documentElement.classList.contains("dark"))
    }

    updateIsDark()

    // Watch for theme changes
    const observer = new MutationObserver(updateIsDark)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [])

  return { theme, isDark }
}
