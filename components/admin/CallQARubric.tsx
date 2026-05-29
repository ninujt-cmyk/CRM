"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Star, Loader2, CheckCircle } from "lucide-react"
import { submitCallQAScore } from "@/app/actions/qa"

export function CallQARubric({ callLogId, agentId }: { callLogId: string, agentId: string }) {
    const [scores, setScores] = useState({ greeting: 0, product: 0, objection: 0 })
    const [comments, setComments] = useState("")
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const renderStars = (category: keyof typeof scores) => (
        <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map(star => (
                <Star 
                    key={star} 
                    className={`h-6 w-6 cursor-pointer transition-colors ${scores[category] >= star ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300'}`}
                    onClick={() => setScores(prev => ({ ...prev, [category]: star }))}
                />
            ))}
        </div>
    )

    const handleSubmit = async () => {
        if (!scores.greeting || !scores.product || !scores.objection) return alert("Please score all 3 categories.");
        setLoading(true);
        const res = await submitCallQAScore({ callLogId, agentId, ...scores, comments });
        if (res.success) setSubmitted(true);
        setLoading(false);
    }

    if (submitted) return (
        <Card className="bg-emerald-50 border-emerald-200"><CardContent className="p-6 text-center text-emerald-700 flex flex-col items-center gap-2"><CheckCircle className="h-8 w-8" /> QA Score Saved Successfully.</CardContent></Card>
    );

    return (
        <Card className="shadow-md border-indigo-100">
            <CardHeader className="bg-indigo-50/50 pb-3">
                <CardTitle className="text-indigo-800 text-lg">Call QA Evaluation</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
                <div className="flex justify-between items-center"><span className="font-semibold text-slate-700">Greeting & Intro</span>{renderStars('greeting')}</div>
                <div className="flex justify-between items-center"><span className="font-semibold text-slate-700">Product Knowledge</span>{renderStars('product')}</div>
                <div className="flex justify-between items-center"><span className="font-semibold text-slate-700">Objection Handling</span>{renderStars('objection')}</div>
                
                <Textarea placeholder="Manager notes and coaching feedback..." value={comments} onChange={(e) => setComments(e.target.value)} className="mt-4" />
                
                <Button onClick={handleSubmit} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700">
                    {loading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : "Save QA Score"}
                </Button>
            </CardContent>
        </Card>
    )
}
