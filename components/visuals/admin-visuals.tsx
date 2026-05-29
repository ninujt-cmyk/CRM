"use client"

import React, { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Users, PhoneCall, CheckCircle, Clock, MapPin, ChevronRight, ChevronDown, Shield, User } from "lucide-react"

// --- Mock Data ---

const dashboardStats = [
    { title: "Total Leads", value: "1,248", change: "+12%", icon: Users, color: "text-blue-600" },
    { title: "Active Agents", value: "24", change: "2 Absent", icon: User, color: "text-green-600" },
    { title: "Today's Conversions", value: "18", change: "+4 from yesterday", icon: CheckCircle, color: "text-purple-600" },
    { title: "Attendance", value: "92%", change: "3 Late", icon: Clock, color: "text-orange-600" },
]

const revenueData = [
    { name: "Jan", revenue: 4000, target: 2400 },
    { name: "Feb", revenue: 3000, target: 1398 },
    { name: "Mar", revenue: 2000, target: 9800 },
    { name: "Apr", revenue: 2780, target: 3908 },
    { name: "May", revenue: 1890, target: 4800 },
    { name: "Jun", revenue: 2390, target: 3800 },
    { name: "Jul", revenue: 3490, target: 4300 },
]

const liveFeed = [
    { id: 1, user: "Sarah J.", action: "Logged in", time: "09:00 AM", location: "Office HQ", ip: "192.168.1.45" },
    { id: 2, user: "Mike T.", action: "Call Interested", time: "09:15 AM", details: "Lead #4592 - Hot Prospect" },
    { id: 3, user: "Emma W.", action: "Check-in Late", time: "09:45 AM", location: "Remote", ip: "10.0.0.12", isLate: true },
    { id: 4, user: "Sarah J.", action: "Deal Closed", time: "10:30 AM", details: "Revenue: $1,200" },
]

const hierarchyData = [
    {
        id: "admin",
        name: "Admin User",
        role: "Admin",
        children: [
            {
                id: "tl1",
                name: "Team Lead Alpha",
                role: "Team Lead",
                children: [
                    { id: "tc1", name: "Telecaller 1", role: "Telecaller" },
                    { id: "tc2", name: "Telecaller 2", role: "Telecaller" },
                ],
            },
            {
                id: "tl2",
                name: "Team Lead Beta",
                role: "Team Lead",
                children: [
                    { id: "tc3", name: "Telecaller 3", role: "Telecaller" },
                ],
            },
        ],
    },
]

const attendanceData = [
    { id: 1, name: "Sarah Jenkins", checkIn: "08:55 AM", checkOut: "--", location: "Office HQ", ip: "192.168.1.45", status: "Present" },
    { id: 2, name: "Mike Thompson", checkIn: "09:02 AM", checkOut: "--", location: "Remote", ip: "45.22.11.99", status: "Present" },
    { id: 3, name: "Emma Wilson", checkIn: "09:45 AM", checkOut: "--", location: "Remote", ip: "10.0.0.12", status: "Late" },
    { id: 4, name: "David Clark", checkIn: "--", checkOut: "--", location: "--", ip: "--", status: "Absent" },
]

// --- Components ---

export function AdminMasterDashboard() {
    return (
        <div className="space-y-6 p-6 bg-slate-50/50 min-h-screen">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {dashboardStats.map((stat, index) => (
                    <Card key={index}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                            <stat.icon className={`h-4 w-4 ${stat.color}`} />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{stat.value}</div>
                            <p className="text-xs text-muted-foreground">{stat.change}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Revenue vs Targets</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={revenueData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis stroke="#888888" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
                                    <Tooltip />
                                    <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Live Activity Feed</CardTitle>
                        <CardDescription>Real-time agent updates</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ScrollArea className="h-[300px] pr-4">
                            <div className="space-y-4">
                                {liveFeed.map((item) => (
                                    <div key={item.id} className="flex items-start gap-4 text-sm border-b pb-3 last:border-0">
                                        <Avatar className="h-8 w-8">
                                            <AvatarFallback>{item.user.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div className="grid gap-1">
                                            <div className="font-semibold flex items-center gap-2">
                                                {item.user}
                                                <span className="text-xs font-normal text-muted-foreground">{item.time}</span>
                                            </div>
                                            <div className="text-muted-foreground">
                                                <span className={item.isLate ? "text-red-500 font-medium" : ""}>{item.action}</span>
                                                {item.details && <span> - {item.details}</span>}
                                                {item.location && <span className="block text-xs mt-1 flex items-center gap-1"><MapPin className="h-3 w-3" /> {item.location} ({item.ip})</span>}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

export function HierarchyManager() {
    const [viewOwnTeam, setViewOwnTeam] = useState(false)

    const renderNode = (node: any, level = 0) => (
        <div key={node.id} className="ml-4 border-l pl-4 py-2">
            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 transition-colors border bg-white">
                {node.children ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <User className="h-4 w-4 text-muted-foreground" />}
                <div className="flex-1">
                    <div className="font-medium">{node.name}</div>
                    <div className="text-xs text-muted-foreground">{node.role}</div>
                </div>
                <Badge variant="outline">{node.role}</Badge>
            </div>
            {node.children && <div>{node.children.map((child: any) => renderNode(child, level + 1))}</div>}
        </div>
    )

    return (
        <Card className="w-full max-w-3xl mx-auto">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Team Hierarchy</CardTitle>
                    <CardDescription>Manage reporting structures</CardDescription>
                </div>
                <div className="flex items-center space-x-2">
                    <Switch id="view-mode" checked={viewOwnTeam} onCheckedChange={setViewOwnTeam} />
                    <Label htmlFor="view-mode">View Own Team Only</Label>
                </div>
            </CardHeader>
            <CardContent>
                <div className="p-4 bg-slate-50 rounded-lg border">
                    {hierarchyData.map((node) => renderNode(node))}
                </div>
            </CardContent>
        </Card>
    )
}

export function AttendanceMonitor() {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Attendance Monitor</CardTitle>
                <CardDescription>Daily check-in/out logs</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Agent</TableHead>
                            <TableHead>Check In</TableHead>
                            <TableHead>Check Out</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {attendanceData.map((record) => (
                            <TableRow key={record.id}>
                                <TableCell className="font-medium">{record.name}</TableCell>
                                <TableCell>{record.checkIn}</TableCell>
                                <TableCell>{record.checkOut}</TableCell>
                                <TableCell>
                                    {record.location !== "--" && (
                                        <div className="flex flex-col text-xs">
                                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {record.location}</span>
                                            <span className="text-muted-foreground">{record.ip}</span>
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={record.status === "Late" ? "destructive" : record.status === "Absent" ? "secondary" : "default"} className={record.status === "Present" ? "bg-green-600 hover:bg-green-700" : ""}>
                                        {record.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
