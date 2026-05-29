"use client"

import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

interface LoadingSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "dashboard" | "table" | "details" | "form" | "card"
  rows?: number
  cols?: number
}

export function LoadingSkeleton({
  variant = "table",
  rows = 5,
  cols = 4,
  className,
  ...props
}: LoadingSkeletonProps) {
  
  // Dashboard / Grid Skeleton
  if (variant === "dashboard") {
    return (
      <div className={cn("space-y-6 p-6 animate-fade-in", className)} {...props}>
        {/* Header Section */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-4 w-72 rounded" />
          </div>
          <Skeleton className="h-10 w-32 rounded-lg" />
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          ))}
        </div>

        {/* Dynamic content area */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-8 w-24" />
            </div>
            <Skeleton className="h-[240px] w-full rounded-lg" />
          </div>
          <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
            <Skeleton className="h-6 w-36" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="space-y-1.5 w-full">
                    <Skeleton className="h-4 w-[80%]" />
                    <Skeleton className="h-3 w-[50%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Table Skeleton
  if (variant === "table") {
    return (
      <div className={cn("space-y-4 p-6 animate-fade-in", className)} {...props}>
        {/* Filter / Actions Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-2">
          <Skeleton className="h-10 w-full sm:max-w-xs rounded-lg" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
          {/* Header Row */}
          <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex gap-4">
            {Array.from({ length: cols }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-24" />
            ))}
          </div>
          
          {/* Body Rows */}
          <div className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, r) => (
              <div key={r} className="px-6 py-4 flex items-center gap-4">
                {Array.from({ length: cols }).map((_, c) => {
                  // Make columns look realistic with different shapes
                  if (c === 0) {
                    return (
                      <div key={c} className="flex items-center gap-3 w-24 shrink-0">
                        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                        <Skeleton className="h-3.5 w-16" />
                      </div>
                    )
                  }
                  if (c === cols - 1) {
                    return <Skeleton key={c} className="h-6 w-16 rounded-full ml-auto" />
                  }
                  return <Skeleton key={c} className="h-3.5 w-24" />
                })}
              </div>
            ))}
          </div>
        </div>
        
        {/* Pagination Bar */}
        <div className="flex items-center justify-between pt-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex gap-1">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        </div>
      </div>
    )
  }

  // Details / View Skeleton
  if (variant === "details") {
    return (
      <div className={cn("space-y-6 p-6 animate-fade-in", className)} {...props}>
        {/* Breadcrumb and Header */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-1">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-10 w-24 rounded-lg" />
              <Skeleton className="h-10 w-32 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Detailed Grid layout */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
              <Skeleton className="h-6 w-32" />
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-5 w-[85%] rounded" />
                  </div>
                ))}
              </div>
            </div>

            {/* Activities / History */}
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
              <Skeleton className="h-6 w-40" />
              <div className="space-y-4 relative pl-4 border-l border-slate-100">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="space-y-2 relative">
                    <div className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-200" />
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3.5 w-20" />
                    </div>
                    <Skeleton className="h-12 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar Cards */}
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
              <Skeleton className="h-5 w-28" />
              <div className="space-y-2">
                <Skeleton className="h-10 w-full rounded-lg animate-pulse" />
                <Skeleton className="h-10 w-full rounded-lg animate-pulse" />
              </div>
            </div>
            
            <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3.5 w-12" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Form / Edit Skeleton
  if (variant === "form") {
    return (
      <div className={cn("max-w-3xl mx-auto p-6 space-y-6 animate-fade-in", className)} {...props}>
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        
        <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          ))}
          
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Skeleton className="h-10 w-20 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
        </div>
      </div>
    )
  }

  // Card Loading state
  return (
    <div className={cn("rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-3 animate-fade-in", className)} {...props}>
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-[60%]" />
    </div>
  )
}
