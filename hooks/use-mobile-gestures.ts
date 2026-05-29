"use client"

import { useEffect, useRef, useState } from "react"

interface SwipeGesture {
  direction: "left" | "right" | "up" | "down"
  distance: number
  duration: number
}

interface UseMobileGesturesOptions {
  onSwipe?: (gesture: SwipeGesture) => void
  onPullToRefresh?: () => void
  minSwipeDistance?: number
  maxSwipeTime?: number
  pullToRefreshThreshold?: number
}

export function useMobileGestures({
  onSwipe,
  onPullToRefresh,
  minSwipeDistance = 50,
  maxSwipeTime = 300,
  pullToRefreshThreshold = 100,
}: UseMobileGesturesOptions = {}) {
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const elementRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    let startY = 0
    let currentY = 0
    let isPulling = false

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      }

      // Check if we're at the top of the page for pull-to-refresh
      if (window.scrollY === 0 && onPullToRefresh) {
        startY = touch.clientY
        isPulling = true
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current) return

      const touch = e.touches[0]
      currentY = touch.clientY

      // Handle pull-to-refresh
      if (isPulling && onPullToRefresh && window.scrollY === 0) {
        const pullDistance = currentY - startY

        if (pullDistance > 0) {
          e.preventDefault() // Prevent default scroll behavior

          // Visual feedback could be added here
          if (pullDistance > pullToRefreshThreshold && !isRefreshing) {
            // Trigger refresh
            setIsRefreshing(true)
            onPullToRefresh()

            // Reset after a delay (you might want to handle this externally)
            setTimeout(() => {
              setIsRefreshing(false)
              isPulling = false
            }, 2000)
          }
        }
      }
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (!touchStartRef.current) return

      const touch = e.changedTouches[0]
      const endTime = Date.now()
      const duration = endTime - touchStartRef.current.time

      if (duration <= maxSwipeTime && onSwipe) {
        const deltaX = touch.clientX - touchStartRef.current.x
        const deltaY = touch.clientY - touchStartRef.current.y
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)

        if (distance >= minSwipeDistance) {
          let direction: SwipeGesture["direction"]

          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            direction = deltaX > 0 ? "right" : "left"
          } else {
            direction = deltaY > 0 ? "down" : "up"
          }

          onSwipe({
            direction,
            distance,
            duration,
          })
        }
      }

      touchStartRef.current = null
      isPulling = false
    }

    element.addEventListener("touchstart", handleTouchStart, { passive: false })
    element.addEventListener("touchmove", handleTouchMove, { passive: false })
    element.addEventListener("touchend", handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener("touchstart", handleTouchStart)
      element.removeEventListener("touchmove", handleTouchMove)
      element.removeEventListener("touchend", handleTouchEnd)
    }
  }, [onSwipe, onPullToRefresh, minSwipeDistance, maxSwipeTime, pullToRefreshThreshold, isRefreshing])

  return {
    elementRef,
    isRefreshing,
  }
}

// Hook for detecting mobile device
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    checkIsMobile()
    window.addEventListener("resize", checkIsMobile)

    return () => window.removeEventListener("resize", checkIsMobile)
  }, [])

  return isMobile
}

// Hook for safe area insets (for devices with notches)
export function useSafeAreaInsets() {
  const [insets, setInsets] = useState({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  })

  useEffect(() => {
    const updateInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement)

      setInsets({
        top: Number.parseInt(computedStyle.getPropertyValue("--safe-area-inset-top") || "0"),
        bottom: Number.parseInt(computedStyle.getPropertyValue("--safe-area-inset-bottom") || "0"),
        left: Number.parseInt(computedStyle.getPropertyValue("--safe-area-inset-left") || "0"),
        right: Number.parseInt(computedStyle.getPropertyValue("--safe-area-inset-right") || "0"),
      })
    }

    updateInsets()
    window.addEventListener("resize", updateInsets)
    window.addEventListener("orientationchange", updateInsets)

    return () => {
      window.removeEventListener("resize", updateInsets)
      window.removeEventListener("orientationchange", updateInsets)
    }
  }, [])

  return insets
}
