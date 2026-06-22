"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { fetchDeals, updateDealStage } from "@/app/actions/deals"
import { toast } from "sonner"
import { Loader2, DollarSign, User, Building2, FileText } from "lucide-react"
import { DealDocumentGenerator } from "./deal-document-generator"
import { Button } from "./ui/button"

const STAGES = [
    { id: 'pre_approval', label: 'Pre-Approval', color: 'bg-slate-100 border-slate-300' },
    { id: 'negotiation', label: 'Negotiation', color: 'bg-blue-50 border-blue-200' },
    { id: 'contract_signed', label: 'Contract Signed', color: 'bg-purple-50 border-purple-200' },
    { id: 'registration', label: 'Registration', color: 'bg-amber-50 border-amber-200' },
    { id: 'closed_won', label: 'Closed Won', color: 'bg-emerald-50 border-emerald-200' },
    { id: 'closed_lost', label: 'Closed Lost', color: 'bg-red-50 border-red-200' }
]

export function DealsKanban() {
    const [deals, setDeals] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [draggingId, setDraggingId] = useState<string | null>(null)
    const [generatingDeal, setGeneratingDeal] = useState<any | null>(null)

    useEffect(() => {
        loadDeals()
    }, [])

    const loadDeals = async () => {
        setLoading(true)
        const res = await fetchDeals()
        if (res.success) {
            setDeals(res.data)
        } else {
            toast.error(res.error || "Failed to load deals")
        }
        setLoading(false)
    }

    const handleDragStart = (e: React.DragEvent, dealId: string) => {
        setDraggingId(dealId)
        e.dataTransfer.setData("dealId", dealId)
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault() // Necessary to allow dropping
    }

    const handleDrop = async (e: React.DragEvent, stageId: string) => {
        e.preventDefault()
        const dealId = e.dataTransfer.getData("dealId")
        if (!dealId) return

        // Optimistic update
        const previousDeals = [...deals]
        setDeals(deals.map(d => d.id === dealId ? { ...d, stage: stageId } : d))
        setDraggingId(null)

        const res = await updateDealStage(dealId, stageId)
        if (!res.success) {
            toast.error("Failed to move deal")
            setDeals(previousDeals) // Revert
        } else {
            toast.success("Deal moved successfully")
        }
    }

    if (loading) {
        return <div className="flex items-center justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
    }

    return (
        <div className="flex overflow-x-auto gap-4 pb-8 min-h-[70vh]">
            {STAGES.map((stage) => {
                const stageDeals = deals.filter(d => d.stage === stage.id)
                const totalAmount = stageDeals.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)

                return (
                    <div 
                        key={stage.id}
                        className={`flex-shrink-0 w-80 rounded-xl border ${stage.color} p-4 flex flex-col`}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, stage.id)}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-slate-700">{stage.label}</h3>
                            <Badge variant="secondary">{stageDeals.length}</Badge>
                        </div>
                        
                        <div className="text-sm font-medium text-slate-500 mb-4 flex items-center">
                            <DollarSign className="w-4 h-4 mr-1" />
                            {totalAmount.toLocaleString()}
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3">
                            {stageDeals.map(deal => (
                                <Card 
                                    key={deal.id}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, deal.id)}
                                    className={`cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${draggingId === deal.id ? 'opacity-50' : ''}`}
                                >
                                    <CardContent className="p-4 space-y-3">
                                        <div className="font-semibold text-slate-800">{deal.title}</div>
                                        
                                        {deal.amount && (
                                            <div className="text-emerald-600 font-medium flex items-center text-sm">
                                                <DollarSign className="w-4 h-4 mr-1" />
                                                {Number(deal.amount).toLocaleString()}
                                                
                                                {deal.expected_commission && (
                                                    <Badge variant="outline" className="ml-auto text-xs border-emerald-200 text-emerald-700 bg-emerald-50">
                                                        Comm: ₹{Number(deal.expected_commission).toLocaleString()}
                                                    </Badge>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-1 text-xs text-slate-500">
                                            {deal.lead?.name && (
                                                <div className="flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    <span className="truncate">{deal.lead.name}</span>
                                                </div>
                                            )}
                                            {deal.property?.title && (
                                                <div className="flex items-center gap-1">
                                                    <Building2 className="w-3 h-3" />
                                                    <span className="truncate">{deal.property.title}</span>
                                                </div>
                                            )}
                                        </div>

                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="w-full text-xs h-7 mt-2"
                                            onClick={() => setGeneratingDeal(deal)}
                                        >
                                            <FileText className="w-3 h-3 mr-1" />
                                            Generate Doc
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                )
            })}

            <DealDocumentGenerator 
                isOpen={!!generatingDeal} 
                onClose={() => setGeneratingDeal(null)} 
                deal={generatingDeal} 
            />
        </div>
    )
}
