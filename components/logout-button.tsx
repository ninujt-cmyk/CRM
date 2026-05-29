"use client"

import { createClient } from "@/lib/supabase/client"
import { Button, buttonVariants } from "@/components/ui/button"
import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { type VariantProps } from "class-variance-authority"

interface LogoutButtonProps extends React.ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  showText?: boolean
}

export function LogoutButton({ showText = true, className, variant = "outline", size = "sm", ...props }: LogoutButtonProps) {
  const router = useRouter()
  const supabase = createClient()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleLogout} 
      className={cn("flex items-center gap-2 bg-transparent", className)}
      {...props}
    >
      <LogOut className="h-4 w-4 shrink-0" />
      {showText && <span>Logout</span>}
    </Button>
  )
}
