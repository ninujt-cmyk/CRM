"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Clock } from "lucide-react"

export function ClockInToggle({ userId }: { userId: string }) {
    const supabase = createClient()
    const [isOnShift, setIsOnShift] = useState(false)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (userId) {
            fetchStatus()
        }
    }, [userId])

    const fetchStatus = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('users')
            .select('is_on_shift')
            .eq('id', userId)
            .single()
        
        if (data) {
            setIsOnShift(data.is_on_shift || false)
        }
        setLoading(false)
    }

    const toggleShift = async (checked: boolean) => {
        setIsOnShift(checked)
        const { error } = await supabase
            .from('users')
            .update({ 
                is_on_shift: checked,
                last_shift_change: new Date().toISOString()
            })
            .eq('id', userId)

        if (error) {
            toast.error("Failed to update shift status")
            setIsOnShift(!checked) // revert
        } else {
            toast.success(checked ? "You are now Clocked In" : "You are now Clocked Out")
        }
    }

    if (loading) return <div className="h-8 w-24 bg-slate-100 rounded-full animate-pulse"></div>

    return (
        <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full">
            <Clock className={`h-4 w-4 ${isOnShift ? 'text-green-500' : 'text-slate-400'}`} />
            <Switch 
                id="shift-mode" 
                checked={isOnShift}
                onCheckedChange={toggleShift}
                className="data-[state=checked]:bg-green-500"
            />
            <Label htmlFor="shift-mode" className="text-xs font-semibold cursor-pointer">
                {isOnShift ? 'On Shift' : 'Off Shift'}
            </Label>
        </div>
    )
}
