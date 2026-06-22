"use client"

import { useState, useEffect } from "react"
import { getSmartMatchesForLead } from "@/app/actions/matchmaker"
import { useTenant } from "@/context/tenant-provider"
import { Building, MapPin, Check, Send, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export function SmartMatches({ leadId }: { leadId: string }) {
    const org = useTenant()
    const [matches, setMatches] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [message, setMessage] = useState<string | null>(null)

    useEffect(() => {
        if (org?.id) {
            fetchMatches()
        }
    }, [org?.id])

    const fetchMatches = async () => {
        setLoading(true)
        const res = await getSmartMatchesForLead(org!.id, leadId)
        if (res.success) {
            setMatches(res.matches || [])
            setMessage(res.message || null)
        }
        setLoading(false)
    }

    const shareViaWhatsApp = (property: any) => {
        const text = `Hi, I found a property that matches your requirements!%0A%0A*${property.title}*%0A📍 ${property.location}%0A💰 ₹${property.price}%0A🛏️ ${property.bhk_config || 'N/A'}%0A%0ALet me know if you'd like to schedule a site visit.`;
        window.open(`https://wa.me/?text=${text}`, '_blank');
    }

    if (loading) {
        return <div className="p-8 text-center"><div className="animate-spin h-6 w-6 border-b-2 border-blue-600 rounded-full mx-auto"></div></div>
    }

    if (message) {
        return (
            <div className="text-center p-8 text-slate-500">
                <Sparkles className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                <p>{message}</p>
                <p className="text-sm mt-2">Update the lead's requirements to see AI matches.</p>
            </div>
        )
    }

    if (matches.length === 0) {
        return (
            <div className="text-center p-8 text-slate-500">
                <Building className="h-8 w-8 mx-auto mb-3 text-slate-300" />
                <p>No matching properties found in your inventory for this lead's criteria.</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {matches.map(prop => (
                <Card key={prop.id} className="overflow-hidden group hover:border-blue-200 transition-colors">
                    <div className="flex flex-col sm:flex-row">
                        <div className="w-full sm:w-48 h-32 bg-slate-100 flex items-center justify-center shrink-0">
                            {prop.images && prop.images[0] ? (
                                <img src={prop.images[0]} alt={prop.title} className="w-full h-full object-cover" />
                            ) : (
                                <Building className="h-8 w-8 text-slate-300" />
                            )}
                        </div>
                        <CardContent className="p-4 flex-1 flex flex-col justify-center">
                            <div className="flex justify-between items-start mb-1">
                                <h4 className="font-bold text-slate-900 dark:text-white line-clamp-1">{prop.title}</h4>
                                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 whitespace-nowrap ml-2">98% Match</Badge>
                            </div>
                            <div className="text-sm text-slate-500 flex items-center gap-1 mb-2">
                                <MapPin className="h-3 w-3" /> {prop.location}
                            </div>
                            <div className="flex gap-3 text-sm font-medium mb-3">
                                <span>₹{prop.price?.toLocaleString()}</span>
                                <span className="text-slate-300">|</span>
                                <span>{prop.bhk_config || '-'}</span>
                                <span className="text-slate-300">|</span>
                                <span>{prop.area_sqft ? `${prop.area_sqft} sqft` : '-'}</span>
                            </div>
                            <div className="flex gap-2 mt-auto">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8" onClick={() => shareViaWhatsApp(prop)}>
                                    <Send className="h-3 w-3 mr-2" /> WhatsApp Brochure
                                </Button>
                            </div>
                        </CardContent>
                    </div>
                </Card>
            ))}
        </div>
    )
}
