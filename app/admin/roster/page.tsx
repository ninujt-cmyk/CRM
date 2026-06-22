"use client"

import { useState, useEffect } from "react"
import { getAgentRoster, updateAgentShift } from "@/app/actions/roster"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { User, Clock, AlertCircle, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

export default function RosterPage() {
    const [agents, setAgents] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchRoster()
    }, [])

    const fetchRoster = async () => {
        setLoading(true)
        const res = await getAgentRoster()
        if (res.success) {
            setAgents(res.data || [])
        } else {
            toast.error(res.error || "Failed to load roster")
        }
        setLoading(false)
    }

    const toggleShift = async (agentId: string, checked: boolean) => {
        const original = [...agents]
        setAgents(agents.map(a => a.id === agentId ? { ...a, is_on_shift: checked } : a))
        
        const res = await updateAgentShift(agentId, checked)
        if (res.success) {
            toast.success("Shift updated")
        } else {
            toast.error("Failed to update shift")
            setAgents(original) // revert
        }
    }

    const activeCount = agents.filter(a => a.is_on_shift).length;

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Agent Roster</h1>
                    <p className="text-slate-500 mt-1">Manage shift statuses to control automated lead routing.</p>
                </div>
                <div className="flex gap-3 items-center">
                    <Badge variant="outline" className="px-3 py-1.5 text-sm bg-blue-50 text-blue-700 border-blue-200">
                        {activeCount} / {agents.length} On Shift
                    </Badge>
                    <Button variant="outline" size="sm" onClick={fetchRoster} disabled={loading}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {agents.map(agent => (
                        <Card key={agent.id} className={`overflow-hidden border-2 transition-all ${agent.is_on_shift ? 'border-green-500/30 bg-green-50/10' : 'border-slate-200'}`}>
                            <CardContent className="p-5 flex flex-col justify-between h-full">
                                <div>
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center border">
                                                <User className="h-5 w-5 text-slate-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{agent.full_name}</h3>
                                                <p className="text-xs text-slate-500 capitalize">{agent.role}</p>
                                            </div>
                                        </div>
                                        <Switch 
                                            checked={agent.is_on_shift || false} 
                                            onCheckedChange={(c) => toggleShift(agent.id, c)} 
                                            className="data-[state=checked]:bg-green-500"
                                        />
                                    </div>
                                    
                                    {!agent.is_active && (
                                        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 p-2 rounded mt-2">
                                            <AlertCircle className="h-3.5 w-3.5" /> Account Disabled
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="h-3.5 w-3.5" />
                                        {agent.last_shift_change 
                                            ? `Status changed ${formatDistanceToNow(new Date(agent.last_shift_change))} ago`
                                            : "Never clocked in"}
                                    </div>
                                    <div className={`font-semibold ${agent.is_on_shift ? 'text-green-600' : 'text-slate-400'}`}>
                                        {agent.is_on_shift ? 'ROUTING ON' : 'ROUTING OFF'}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    )
}
