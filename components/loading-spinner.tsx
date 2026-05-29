import { cn } from "@/lib/utils"

interface LoadingSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl"
  fullScreen?: boolean
  text?: string
}

export function LoadingSpinner({ 
  size = "md", 
  fullScreen = false, 
  text, 
  className,
  ...props 
}: LoadingSpinnerProps) {
  
  // Size configurations
  const sizeClasses = {
    sm: "h-4 w-4 border-2",
    md: "h-8 w-8 border-4",
    lg: "h-12 w-12 border-4",
    xl: "h-16 w-16 border-[5px]"
  }

  // The actual spinner markup
  const SpinnerContent = (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)} {...props}>
      <div 
        className={cn(
          "animate-spin rounded-full border-slate-200 border-t-blue-600", // Track color + Active color
          sizeClasses[size]
        )} 
        role="status"
        aria-label="loading"
      />
      {text && (
        <p className="text-sm font-medium text-slate-500 animate-pulse">
          {text}
        </p>
      )}
      <span className="sr-only">Loading...</span>
    </div>
  )

  // If fullscreen, wrap in a fixed overlay with backdrop blur
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
        {SpinnerContent}
      </div>
    )
  }

  // Default: Centered in container
  return (
    <div className="flex items-center justify-center py-6">
      {SpinnerContent}
    </div>
  )
}
