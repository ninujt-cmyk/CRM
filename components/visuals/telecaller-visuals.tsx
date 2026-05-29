"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { Phone, MessageCircle, Calendar, Clock, MapPin, CheckCircle, AlertCircle, Search, User } from "lucide-react"

// --- Mock Data ---

const leads = [
    { id: 1, name: "John Doe", phone: "+91 98765 43210", status: "New", nextFollowUp: "Today, 10:00 AM", interest: "High" },
    { id: 2, name: "Jane Smith", phone: "+91 98765 12345", status: "Follow-up", nextFollowUp: "Today, 11:30 AM", interest: "Medium" },
    { id: 3, name: "Robert Johnson", phone: "+91 98765 67890", status: "Callback", nextFollowUp: "Today, 02:00 PM", interest: "Low" },
    { id: 4, name: "Emily Davis", phone: "+91 98765 11223", status: "New", nextFollowUp: "Tomorrow, 09:00 AM", interest: "Medium" },
    { id: 5, name: "Michael Wilson", phone: "+91 98765 44556", status: "Follow-up", nextFollowUp: "Tomorrow, 10:30 AM", interest: "High" },
]

const history = [
    { id: 1, date: "2023-10-25 10:00 AM", action: "Call", result: "No Answer", note: "Tried calling, no response." },
    { id: 2, date: "2023-10-24 02:30 PM", action: "WhatsApp", result: "Sent", note: "Sent brochure PDF." },
]

// --- Components ---

export function TelecallerMyDay() {
    const [isCheckedIn, setIsCheckedIn] = useState(false)

    return (
        <div className="space-y-6">
            {/* Header & Attendance Widget */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-lg border shadow-sm">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Good Morning, Alex</h1>
                    <p className="text-muted-foreground">Ready to crush your targets today?</p>
                </div>

                <Card className="w-full md:w-auto min-w-[300px]">
                    <CardContent className="p-4 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full ${isCheckedIn ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-500'}`}>
                                <MapPin className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="font-semibold">{isCheckedIn ? "Checked In" : "Not Checked In"}</div>
                                <div className="text-xs text-muted-foreground">{isCheckedIn ? "09:00 AM @ Office HQ" : "Mark your attendance"}</div>
                            </div>
                        </div>
                        <Button
                            variant={isCheckedIn ? "destructive" : "default"}
                            onClick={() => setIsCheckedIn(!isCheckedIn)}
                        >
                            {isCheckedIn ? "Check Out" : "Check In"}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                            <Phone className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">45</div>
                            <div className="text-sm text-muted-foreground">Calls Made Today</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-orange-100 text-orange-600 rounded-full">
                            <Clock className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">12</div>
                            <div className="text-sm text-muted-foreground">Pending Follow-ups</div>
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="p-3 bg-green-100 text-green-600 rounded-full">
                            <CheckCircle className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="text-2xl font-bold">75%</div>
                            <div className="text-sm text-muted-foreground">Daily Target Achieved</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export function LeadExecutionScreen() {
    const [selectedLead, setSelectedLead] = useState(leads[0])

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-200px)] min-h-[600px]">
            {/* Left Panel: Lead List */}
            <Card className="lg:col-span-3 flex flex-col h-full">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">My Leads</CardTitle>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search leads..." className="pl-8" />
                    </div>
                </CardHeader>
                <CardContent className="flex-1 p-0 overflow-hidden">
                    <ScrollArea className="h-full">
                        <div className="divide-y">
                            {leads.map((lead) => (
                                <div
                                    key={lead.id}
                                    className={`p-4 cursor-pointer hover:bg-slate-50 transition-colors ${selectedLead.id === lead.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
                                    onClick={() => setSelectedLead(lead)}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="font-medium">{lead.name}</div>
                                        <Badge variant={lead.interest === "High" ? "default" : "secondary"} className="text-[10px]">
                                            {lead.interest}
                                        </Badge>
                                    </div>
                                    <div className="text-xs text-muted-foreground mb-2">{lead.phone}</div>
                                    <div className="flex items-center gap-1 text-xs text-orange-600">
                                        <Clock className="h-3 w-3" />
                                        {lead.nextFollowUp}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>

            {/* Center Panel: Lead Details */}
            <Card className="lg:col-span-6 flex flex-col h-full">
                <CardHeader className="border-b pb-4">
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-slate-200 flex items-center justify-center text-xl font-bold text-slate-600">
                                {selectedLead.name.charAt(0)}
                            </div>
                            <div>
                                <CardTitle>{selectedLead.name}</CardTitle>
                                <div className="text-sm text-muted-foreground flex items-center gap-2">
                                    <Phone className="h-3 w-3" /> {selectedLead.phone}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                <Phone className="h-4 w-4 mr-2" /> Call Now
                            </Button>
                            <Button size="sm" variant="outline" className="text-green-600 border-green-600 hover:bg-green-50">
                                <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto p-6">
                    <Tabs defaultValue="details">
                        <TabsList className="w-full justify-start mb-4">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="history">History</TabsTrigger>
                            <TabsTrigger value="notes">Notes</TabsTrigger>
                        </TabsList>

                        <TabsContent value="details" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label className="text-xs text-muted-foreground">Email</Label>
                                    <div className="text-sm font-medium">john.doe@example.com</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Location</Label>
                                    <div className="text-sm font-medium">New York, USA</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Source</Label>
                                    <div className="text-sm font-medium">Facebook Ad</div>
                                </div>
                                <div>
                                    <Label className="text-xs text-muted-foreground">Assigned Date</Label>
                                    <div className="text-sm font-medium">Oct 20, 2023</div>
                                </div>
                            </div>

                            <div className="mt-6">
                                <Label className="text-xs text-muted-foreground">Requirements</Label>
                                <p className="text-sm mt-1 p-3 bg-slate-50 rounded-md border">
                                    Looking for a 3BHK apartment in downtown area. Budget around $500k. Ready to move in by next month.
                                </p>
                            </div>
                        </TabsContent>

                        <TabsContent value="history">
                            <div className="space-y-4">
                                {history.map((item) => (
                                    <div key={item.id} className="flex gap-3 text-sm">
                                        <div className="mt-1">
                                            <div className="h-2 w-2 rounded-full bg-slate-300 ring-4 ring-white" />
                                        </div>
                                        <div className="flex-1 pb-4 border-l pl-4 -ml-2">
                                            <div className="font-medium">{item.action} - {item.result}</div>
                                            <div className="text-xs text-muted-foreground mb-1">{item.date}</div>
                                            <p className="text-slate-600">{item.note}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>

            {/* Right Panel: Disposition */}
            <Card className="lg:col-span-3 flex flex-col h-full bg-slate-50/50">
                <CardHeader>
                    <CardTitle className="text-base">Update Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Call Outcome</Label>
                        <Select>
                            <SelectTrigger>
                                <SelectValue placeholder="Select outcome" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="connected">Connected</SelectItem>
                                <SelectItem value="no-answer">No Answer</SelectItem>
                                <SelectItem value="busy">Busy</SelectItem>
                                <SelectItem value="wrong-number">Wrong Number</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Lead Status</Label>
                        <Select>
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="interested">Interested</SelectItem>
                                <SelectItem value="not-interested">Not Interested</SelectItem>
                                <SelectItem value="follow-up">Follow Up</SelectItem>
                                <SelectItem value="closed">Closed Won</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Next Follow-up</Label>
                        <div className="relative">
                            <Calendar className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input type="datetime-local" className="pl-8" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Note</Label>
                        <Textarea placeholder="Add a note..." className="min-h-[100px]" />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full">Save Update</Button>
                </CardFooter>
            </Card>
        </div>
    )
}
