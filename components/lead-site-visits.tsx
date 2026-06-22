"use client"

import { useState, useEffect } from "react"
import { getSiteVisits, addSiteVisit, updateSiteVisitStatus } from "@/app/actions/site-visits"
import { getProperties } from "@/app/actions/properties"
import { useTenant } from "@/context/tenant-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Calendar, MapPin, CheckCircle, XCircle, Clock, Save, Plus } from "lucide-react"
import { toast } from "sonner"

export function LeadSiteVisits({ leadId, telecallerId }: { leadId: string, telecallerId?: string }) {
    const org = useTenant()
    const [visits, setVisits] = useState<any[]>([])
    const [properties, setProperties] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [isScheduling, setIsScheduling] = useState(false)
    
    const [newVisit, setNewVisit] = useState({
        property_id: "",
        scheduled_at: "",
        assigned_to: telecallerId || ""
    })

    useEffect(() => {
        if (org?.id) {
            fetchData()
        }
    }, [org?.id])

    const fetchData = async () => {
        setLoading(true)
        const [visitRes, propRes] = await Promise.all([
            getSiteVisits(),
            getProperties()
        ])
        
        if (visitRes.success) {
            // Filter only visits for this lead
            setVisits((visitRes.data || []).filter((v: any) => v.lead_id === leadId))
        }
        if (propRes.success) {
            setProperties(propRes.data || [])
        }
        setLoading(false)
    }

    const handleSchedule = async () => {
        if (!newVisit.property_id || !newVisit.scheduled_at) {
            toast.error("Please select a property and date/time")
            return
        }

        const res = await addSiteVisit({
            ...newVisit,
            lead_id: leadId
        })

        if (res.success) {
            toast.success("Site visit scheduled!")
            setIsScheduling(false)
            setNewVisit({ property_id: "", scheduled_at: "", assigned_to: telecallerId || "" })
            fetchData()
        } else {
            toast.error(res.error || "Failed to schedule visit")
        }
    }

    const handleUpdateStatus = async (id: string, status: string) => {
        const res = await updateSiteVisitStatus(id, status)
        if (res.success) {
            toast.success("Status updated")
            fetchData()
        } else {
            toast.error("Failed to update status")
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'scheduled': return 'bg-blue-100 text-blue-700'
            case 'conducted': return 'bg-green-100 text-green-700'
            case 'cancelled': return 'bg-red-100 text-red-700'
            case 'no_show': return 'bg-orange-100 text-orange-700'
            default: return 'bg-slate-100 text-slate-700'
        }
    }

    if (loading) return <div className="p-8 text-center"><div className="animate-spin h-6 w-6 border-b-2 border-indigo-600 rounded-full mx-auto"></div></div>

    return (
        <div className="space-y-4">
            {!isScheduling ? (
                <Button onClick={() => setIsScheduling(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" /> Schedule New Visit
                </Button>
            ) : (
                <Card className="border-indigo-200 bg-indigo-50 dark:bg-indigo-950/20">
                    <CardContent className="p-4 space-y-4">
                        <div className="font-semibold text-indigo-900 dark:text-indigo-200">Schedule Site Visit</div>
                        
                        <div>
                            <Label className="text-xs">Property</Label>
                            <Select value={newVisit.property_id} onValueChange={(val) => setNewVisit({...newVisit, property_id: val})}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="Select Property" /></SelectTrigger>
                                <SelectContent>
                                    {properties.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        <div>
                            <Label className="text-xs">Date & Time</Label>
                            <Input 
                                type="datetime-local" 
                                value={newVisit.scheduled_at} 
                                onChange={(e) => setNewVisit({...newVisit, scheduled_at: e.target.value})} 
                                className="bg-white"
                            />
                        </div>

                        <div className="flex gap-2 justify-end pt-2">
                            <Button variant="outline" onClick={() => setIsScheduling(false)}>Cancel</Button>
                            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSchedule}>Confirm</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-3 mt-4">
                {visits.length === 0 ? (
                    <div className="text-center p-8 text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed">
                        <MapPin className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                        <p>No site visits scheduled for this lead.</p>
                    </div>
                ) : (
                    visits.map(visit => (
                        <Card key={visit.id} className="overflow-hidden">
                            <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                <div className="space-y-1">
                                    <div className="font-bold flex items-center gap-2">
                                        <MapPin className="h-4 w-4 text-indigo-500" />
                                        {visit.property?.title || 'Unknown Property'}
                                    </div>
                                    <div className="text-sm text-slate-500 flex items-center gap-2">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(visit.scheduled_at).toLocaleString()}
                                    </div>
                                    <div className={`w-max px-2 py-0.5 mt-1 text-[10px] font-bold uppercase rounded ${getStatusColor(visit.status)}`}>
                                        {visit.status.replace('_', ' ')}
                                    </div>
                                </div>
                                
                                {visit.status === 'scheduled' && (
                                    <div className="flex gap-2">
                                        <Button size="sm" variant="outline" className="border-green-200 text-green-700 hover:bg-green-50" onClick={() => handleUpdateStatus(visit.id, 'conducted')}>
                                            <CheckCircle className="h-3 w-3 mr-1" /> Conducted
                                        </Button>
                                        <Button size="sm" variant="outline" className="border-orange-200 text-orange-700 hover:bg-orange-50" onClick={() => handleUpdateStatus(visit.id, 'no_show')}>
                                            <Clock className="h-3 w-3 mr-1" /> No Show
                                        </Button>
                                        <Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => handleUpdateStatus(visit.id, 'cancelled')}>
                                            <XCircle className="h-3 w-3 mr-1" /> Cancel
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    )
}
