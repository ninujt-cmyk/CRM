"use client"

import type { ReactNode } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface ActionSheetItem {
  label: string
  icon?: ReactNode
  onClick: () => void
  variant?: "default" | "destructive"
  disabled?: boolean
}

interface MobileActionSheetProps {
  trigger: ReactNode
  title?: string
  items: ActionSheetItem[]
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function MobileActionSheet({ trigger, title, items, open, onOpenChange }: MobileActionSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl">
        {title && (
          <SheetHeader className="pb-4">
            <SheetTitle className="text-center">{title}</SheetTitle>
          </SheetHeader>
        )}

        <div className="space-y-2 pb-4">
          {items.map((item, index) => (
            <div key={index}>
              <Button
                variant="ghost"
                onClick={() => {
                  item.onClick()
                  onOpenChange?.(false)
                }}
                disabled={item.disabled}
                className={cn(
                  "w-full justify-start h-12 text-base font-normal",
                  item.variant === "destructive" && "text-destructive hover:text-destructive",
                )}
              >
                {item.icon && <span className="mr-3">{item.icon}</span>}
                {item.label}
              </Button>
              {index < items.length - 1 && <Separator className="my-1" />}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// Quick action floating button
interface MobileFloatingActionProps {
  icon: ReactNode
  label?: string
  onClick: () => void
  className?: string
}

export function MobileFloatingAction({ icon, label, onClick, className }: MobileFloatingActionProps) {
  return (
    <Button
      onClick={onClick}
      size="lg"
      className={cn(
        "fixed bottom-24 right-4 z-40 h-14 w-14 rounded-full shadow-lg",
        "lg:hidden", // Only show on mobile
        label && "w-auto px-4 gap-2",
        className,
      )}
    >
      {icon}
      {label && <span className="font-medium">{label}</span>}
    </Button>
  )
}
