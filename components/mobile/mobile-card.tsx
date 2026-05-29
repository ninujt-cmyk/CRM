"use client"

import type { ReactNode } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileCardProps {
  title: string
  subtitle?: string
  description?: string
  badge?: ReactNode
  actions?: ReactNode
  onClick?: () => void
  className?: string
  children?: ReactNode
}

export function MobileCard({
  title,
  subtitle,
  description,
  badge,
  actions,
  onClick,
  className,
  children,
}: MobileCardProps) {
  const isClickable = !!onClick

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isClickable && "cursor-pointer hover:shadow-md active:scale-[0.98]",
        className,
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base truncate">{title}</h3>
              {badge}
            </div>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-1">
            {actions}
            {isClickable && <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
          </div>
        </div>

        {description && <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>}
      </CardHeader>

      {children && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  )
}

interface MobileListItemProps {
  title: string
  subtitle?: string
  description?: string
  badge?: ReactNode
  avatar?: ReactNode
  actions?: ReactNode
  onClick?: () => void
  className?: string
}

export function MobileListItem({
  title,
  subtitle,
  description,
  badge,
  avatar,
  actions,
  onClick,
  className,
}: MobileListItemProps) {
  const isClickable = !!onClick

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-4 transition-colors",
        isClickable && "cursor-pointer hover:bg-accent active:bg-accent/80",
        className,
      )}
      onClick={onClick}
    >
      {avatar && <div className="flex-shrink-0">{avatar}</div>}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-medium text-sm truncate">{title}</h4>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-muted-foreground truncate">{subtitle}</p>}
        {description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{description}</p>}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {actions}
        {isClickable && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </div>
    </div>
  )
}
