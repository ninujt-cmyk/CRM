"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  UserPlus, Search, Trash2, Ban, CheckCircle, Filter, Shield, Loader2, Edit, ExternalLink,
  Megaphone, Users // <-- Added new icons here
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { EmptyState } from "@/components/empty-state" 

// --- TYPES ---
interface UserProfile {
  id: string
  email: string
  full_name: string
  role: string
  phone: string | null
  is_active: boolean
  created_at: string
  manager_id: string | null
  manager_name?: string
}

const ITEMS_PER_PAGE = 10

export default function UsersPage() {
  const supabase = createClient()

  // State
  const [users, setUsers] = useState<UserProfile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState("telecaller")
  const [telecallerStatus, setTelecallerStatus] = useState<Record<string, boolean>>({})
   
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // --- DATA FETCHING ---
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase.from("users").select("role").eq("id", authUser.id).single()
        if (profile) setCurrentUserRole(profile.role)
      }

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false })
      
      if (userError) throw userError

      let enrichedUsers: UserProfile[] = userData || []
      const managerIds = Array.from(new Set(userData?.map(u => u.manager_id).filter(Boolean))) as string[]
      
      if (managerIds.length > 0) {
        const { data: managers } = await supabase
          .from("users")
          .select("id, full_name")
          .in("id", managerIds)
        
        const managerMap = (managers || []).reduce((acc: any, curr: any) => {
            acc[curr.id] = curr.full_name
            return acc
        }, {})

        enrichedUsers = userData!.map((u: any) => ({
            ...u,
            manager_name: u.manager_id ? managerMap[u.manager_id] : null
        }))
      }

      const today = new Date().toISOString().split('T')[0]
      const { data: attendance } = await supabase.from("attendance").select("user_id, check_in").eq("date", today)
      
      const statusMap: Record<string, boolean> = {}
      attendance?.forEach((r: any) => {
          if(r.check_in) statusMap[r.user_id] = true
      })
      setTelecallerStatus(statusMap)

      setUsers(enrichedUsers)

    } catch (err: any) {
      console.error(err)
      toast.error("Failed to load users")
    } finally {
      setIsLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- FILTER & PAGINATION ---
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = 
        (user.full_name?.toLowerCase() || "").includes(searchQuery.toLowerCase()) ||
        (user.email?.toLowerCase() || "").includes(searchQuery.toLowerCase())
      
      const matchesRole = roleFilter === "all" || user.role === roleFilter
      const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.is_active : !user.is_active)

      return matchesSearch && matchesRole && matchesStatus
    })
  }, [users, searchQuery, roleFilter, statusFilter])

  const paginatedUsers = useMemo(() => {
      const start = (currentPage - 1) * ITEMS_PER_PAGE
      return filteredUsers.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredUsers, currentPage])

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)

  // --- ACTIONS ---
  const handleBulkAction = async (action: 'delete' | 'deactivate') => {
    if (!confirm(`Are you sure you want to ${action} ${selectedUserIds.length} users?`)) return

    setIsProcessing(true)
    try {
      if (action === 'delete') {
        const { error } = await supabase.from("users").delete().in("id", selectedUserIds)
        if (error) throw error
        setUsers(prev => prev.filter(u => !selectedUserIds.includes(u.id)))
        toast.success("Users deleted permanently")
      } else {
        const { error } = await supabase.from("users").update({ is_active: false }).in("id", selectedUserIds)
        if (error) throw error
        setUsers(prev => prev.map(u => selectedUserIds.includes(u.id) ? { ...u, is_active: false } : u))
        toast.success("Users deactivated")
      }
      setSelectedUserIds([])
    } catch (err: any) {
      toast.error(`Action failed: ${err.message}`)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;
    
    try {
        const { error } = await supabase.from("users").delete().eq("id", userId);
        if (error) throw error;
        setUsers(prev => prev.filter(u => u.id !== userId));
        toast.success("User deleted successfully");
    } catch (err: any) {
        toast.error("Failed to delete user");
        console.error(err);
    }
  }

  const toggleSelection = (id: string) => {
    setSelectedUserIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    setSelectedUserIds(selectedUserIds.length === paginatedUsers.length ? [] : paginatedUsers.map(u => u.id))
  }

  const canManage = ['super_admin', 'admin', 'owner'].includes(currentUserRole)

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      admin: "bg-purple-100 text-purple-700 border-purple-200",
      super_admin: "bg-purple-100 text-purple-700 border-purple-200",
      manager: "bg-blue-100 text-blue-700 border-blue-200",
      telecaller: "bg-slate-100 text-slate-700 border-slate-200"
    }
    return (
        <Badge variant="outline" className={`capitalize font-medium border-0 ${styles[role] || styles.telecaller}`}>
            {role.replace('_', ' ')}
        </Badge>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto min-h-screen bg-slate-50/50">
      {/* 1. Custom CSS for Coin Flip Animation */}
      <style jsx global>{`
        @keyframes flip-in-hor-bottom {
          0% {
            transform: rotateX(0);
            opacity: 1;
          }
          50% {
             opacity: 0.8;
          }
          100% {
            transform: rotateX(360deg);
            opacity: 1;
          }
        }
        
        .hover-flip:hover {
          animation: flip-in-hor-bottom 0.6s cubic-bezier(0.250, 0.460, 0.450, 0.940) both;
          transform-style: preserve-3d;
          background-color: #f8fafc; /* slight highlight during flip */
        }
      `}</style>

      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage {users.length} members across your organization.</p>
        </div>
        
        {/* 🔴 NEW: Added Action Buttons Group Here */}
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/team">
            <Button variant="outline" className="shadow-sm border-slate-200 hover:bg-slate-50 text-slate-700">
              <Users className="h-4 w-4 mr-2" /> Team
            </Button>
          </Link>

          <Link href="/admin/notifications">
            <Button variant="outline" className="shadow-sm border-slate-200 hover:bg-slate-50 text-slate-700">
              <Megaphone className="h-4 w-4 mr-2" /> Broadcast
            </Button>
          </Link>

          {canManage && (
            <Link href="/admin/users/new">
              <Button className="shadow-sm bg-indigo-600 hover:bg-indigo-700 transition-all text-white">
                <UserPlus className="h-4 w-4 mr-2" /> Add Member
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white p-1 rounded-xl border shadow-sm">
        <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input 
                placeholder="Search team..." 
                className="pl-9 border-0 bg-transparent focus-visible:ring-0" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
            />
        </div>
        <div className="flex gap-2 w-full sm:w-auto p-1">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-50 border-slate-200">
                    <Filter className="h-3 w-3 mr-2" />
                    <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    <SelectItem value="telecaller">Telecaller</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs bg-slate-50 border-slate-200">
                    <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
            </Select>
        </div>
      </div>

      {/* BULK ACTIONS */}
      {selectedUserIds.length > 0 && canManage && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 px-4 flex items-center justify-between animate-in slide-in-from-top-2">
              <span className="text-sm text-indigo-700 font-medium">{selectedUserIds.length} users selected</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-100" onClick={() => handleBulkAction('deactivate')} disabled={isProcessing}>
                  <Ban className="h-4 w-4 mr-2" /> Deactivate
                </Button>
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleBulkAction('delete')} disabled={isProcessing}>
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin"/> : <Trash2 className="h-4 w-4 mr-2" />} Delete
                </Button>
              </div>
          </div>
      )}

      {/* TABLE */}
      <Card className="shadow-sm border-slate-200">
        <div className="overflow-x-auto min-h-[400px]">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40px] text-center">
                  <Checkbox 
                    checked={paginatedUsers.length > 0 && selectedUserIds.length === paginatedUsers.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[300px]">User Profile (Click to Edit)</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Manager</TableHead>
                <TableHead className="hidden md:table-cell">Joined</TableHead>
                <TableHead className="w-[80px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    <TableCell><div className="flex items-center gap-3"><Skeleton className="h-9 w-9 rounded-full" /><div className="space-y-1"><Skeleton className="h-4 w-24" /><Skeleton className="h-3 w-32" /></div></div></TableCell>
                    <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-12 rounded-full" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <EmptyState icon={Search} title="No users found" description="Try adjusting your search." variant="ghost" />
                  </TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  // --- APPLIED THE 3D COIN FLIP ANIMATION CLASS HERE ---
                  <TableRow 
                    key={user.id} 
                    className={`group transition-colors hover-flip ${selectedUserIds.includes(user.id) ? "bg-indigo-50/50" : "bg-white"}`}
                  >
                    <TableCell className="text-center">
                      <Checkbox checked={selectedUserIds.includes(user.id)} onCheckedChange={() => toggleSelection(user.id)} />
                    </TableCell>
                    
                    {/* --- CLICKABLE PROFILE --- */}
                    <TableCell>
                      <Link href={`/admin/users/${user.id}/edit`} className="block w-full">
                        <div className="flex items-center gap-3 cursor-pointer">
                            <div className="relative">
                            <Avatar className="h-9 w-9 border border-slate-200">
                                <AvatarImage src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.full_name}`} />
                                <AvatarFallback className="bg-indigo-100 text-indigo-700">{user.full_name?.[0]}</AvatarFallback>
                            </Avatar>
                            {user.role === 'telecaller' && (
                                <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-white ${telecallerStatus[user.id] ? "bg-green-500" : "bg-slate-300"}`} />
                            )}
                            </div>
                            <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                                    {user.full_name}
                                </span>
                                {/* Icon removed to keep layout stable during flip */}
                            </div>
                            <span className="text-xs text-slate-500 flex items-center gap-1">{user.email}</span>
                            </div>
                        </div>
                      </Link>
                    </TableCell>

                    <TableCell>{getRoleBadge(user.role)}</TableCell>
                    <TableCell>
                      {user.is_active ? (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full w-fit border border-emerald-100"><CheckCircle className="h-3 w-3" /> Active</div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full w-fit border border-slate-200"><Ban className="h-3 w-3" /> Inactive</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-600">
                      {user.manager_name ? <div className="flex items-center gap-1.5"><Shield className="h-3 w-3 text-slate-400" />{user.manager_name}</div> : <span className="text-slate-400 text-xs italic">Unassigned</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-slate-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </TableCell>
                    
                    {/* --- DIRECT DELETE ACTION --- */}
                    <TableCell className="text-center">
                      {canManage && (
                        <div className="flex items-center justify-center gap-2">
                            <Link href={`/admin/users/${user.id}/edit`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50">
                                    <Edit className="h-4 w-4" />
                                </Button>
                            </Link>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteUser(user.id)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* PAGINATION */}
        {filteredUsers.length > 0 && (
            <div className="border-t p-4 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs text-slate-500">
                    Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} entries
                </span>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>Previous</Button>
                    <Button variant="outline" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>Next</Button>
                </div>
            </div>
        )}
      </Card>
    </div>
  )
}
