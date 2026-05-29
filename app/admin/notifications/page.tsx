"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Send, Megaphone, BellRing, Users } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"

export default function BroadcastPage() {
    const supabase = createClient()
    const { toast } = useToast()
    const [loading, setLoading] = useState(false)
    
    const [formData, setFormData] = useState({
        title: "",
        message: "",
        targetRole: "all" // Default to everyone
    })

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) throw new Error("Not authenticated")

            const res = await fetch('/api/admin/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, currentUserId: user.id })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || "Failed to send")

            toast({
                title: "Broadcast Sent! 🚀",
                description: `Successfully notified ${data.count} users.`,
                className: "bg-green-50 text-green-700 border-green-200"
            })
            
            setFormData({ title: "", message: "", targetRole: "all" }) // Reset form

        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive"
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-3xl font-bold flex items-center gap-2">
                    <Megaphone className="h-8 w-8 text-indigo-600" />
                    Broadcast Center
                </h1>
                <p className="text-gray-500">Send instant announcements to your team's devices and dashboards.</p>
            </div>

            <Card className="shadow-lg border-t-4 border-indigo-600">
                <CardHeader>
                    <CardTitle>Compose Message</CardTitle>
                    <CardDescription>This will appear in the notification center and as a push alert.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSend} className="space-y-6">
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label>Notification Title</Label>
                                <Input 
                                    placeholder="e.g., Pizza Party Alert! 🍕" 
                                    value={formData.title}
                                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Target Audience</Label>
                                <Select 
                                    value={formData.targetRole} 
                                    onValueChange={(val) => setFormData({...formData, targetRole: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Audience" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4" /> All Staff (Everyone)
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="telecaller">
                                            <div className="flex items-center gap-2">
                                                <BellRing className="h-4 w-4" /> Telecallers Only
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="kyc_team">KYC Team Only</SelectItem>
                                        <SelectItem value="team_leader">Team Leaders Only</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Message Content</Label>
                            <Textarea 
                                placeholder="Type your motivational message, update, or announcement here..." 
                                className="min-h-[120px] text-base"
                                value={formData.message}
                                onChange={(e) => setFormData({...formData, message: e.target.value})}
                                required
                            />
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button 
                                type="submit" 
                                size="lg" 
                                className="bg-indigo-600 hover:bg-indigo-700 min-w-[150px]"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" /> Send Broadcast
                                    </>
                                )}
                            </Button>
                        </div>

                    </form>
                </CardContent>
            </Card>
        </div>
    )
}
