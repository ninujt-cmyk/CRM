import { cn } from "@/lib/utils"
import { LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon: LucideIcon
  title: string
  description?: string | React.ReactNode
  action?: {
    label: string
    onClick: () => void
    icon?: LucideIcon
  }
  variant?: "default" | "dashed" | "ghost"
  children?: React.ReactNode // Allows custom buttons/content below
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "default",
  children,
  className,
  ...props
}: EmptyStateProps) {
  
  // Variant Styles
  const variants = {
    default: "flex flex-col items-center justify-center text-center p-8 animate-in fade-in-50 zoom-in-95 duration-500",
    dashed: "flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors animate-in fade-in-50",
    ghost: "flex flex-col items-center justify-center text-center py-12"
  }

  return (
    <div className={cn(variants[variant], className)} {...props}>
      {/* Icon Wrapper with subtle shadow ring */}
      <div className="relative mb-6 group">
        <div className="absolute inset-0 bg-blue-100 rounded-full blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
        <div className="relative mx-auto w-16 h-16 bg-white border border-slate-100 shadow-sm rounded-full flex items-center justify-center">
          <Icon className="h-8 w-8 text-slate-400 group-hover:text-blue-500 transition-colors" />
        </div>
      </div>

      {/* Typography */}
      <h3 className="text-lg font-semibold text-slate-900 mb-2 tracking-tight">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto text-balance leading-relaxed">
          {description}
        </p>
      )}

      {/* Actions Area */}
      <div className="flex items-center gap-3">
        {action && (
          <Button onClick={action.onClick} className="gap-2 shadow-sm">
            {action.icon && <action.icon className="h-4 w-4" />}
            {action.label}
          </Button>
        )}
        {children}
      </div>
    </div>
  )
}
