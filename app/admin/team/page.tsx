"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { Users, UserPlus, Shield, Loader2, Save, UserCog } from "lucide-react"

import { inviteTeamMember, updateTeamMember } from "@/app/actions/team-management"

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
  manager_id: string | null
  current_status: string
}

export default function TeamManagementPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  
  // Dialog States
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Edit State
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [editData, setEditData] = useState<{role: string, manager_id: string | null}>({ role: '', manager_id: null })

  // Invite Form State
  const [inviteForm, setInviteForm] = useState({
    email: '', fullName: '', role: 'telecaller', password: '', managerId: 'none'
  })

  const fetchTeam = async () => {
    setLoading(true)
    // Thanks to RLS, this automatically only fetches users in YOUR company!
    const { data, error } = await supabase
      .from('users')
      .select('id, full_name, email, role, manager_id, current_status')
      .order('created_at', { ascending: true })

    if (data) setMembers(data as TeamMember[])
    setLoading(false)
  }

  useEffect(() => {
    fetchTeam()
  }, [supabase])

  // Get only people who can be managers
  const potentialManagers = members.filter(m => ['manager', 'team_leader', 'admin'].includes(m.role))

  const handleInviteSubmit = async () => {
    if (!inviteForm.email || !inviteForm.fullName || !inviteForm.password) {
        return toast.error("Please fill all required fields")
    }

    setIsSubmitting(true)
    const res = await inviteTeamMember({
        email: inviteForm.email,
        fullName: inviteForm.fullName,
        role: inviteForm.role,
        password: inviteForm.password,
        managerId: inviteForm.managerId === 'none' ? null : inviteForm.managerId
    })

    if (res.success) {
        toast.success(res.message)
        setShowInviteModal(false)
        setInviteForm({ email: '', fullName: '', role: 'telecaller', password: '', managerId: 'none' })
        fetchTeam()
    } else {
        toast.error(res.error)
    }
    setIsSubmitting(false)
  }

  const saveEdit = async (userId: string) => {
      const res = await updateTeamMember(userId, {
          role: editData.role,
          manager_id: editData.manager_id === 'none' ? null : editData.manager_id
      })

      if (res.success) {
          toast.success("Updated successfully")
          setEditingUserId(null)
          fetchTeam()
      } else {
          toast.error(res.error)
      }
  }

  const startEdit = (user: TeamMember) => {
      setEditingUserId(user.id)
      setEditData({ role: user.role || 'telecaller', manager_id: user.manager_id || 'none' })
  }

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Users className="h-8 w-8 text-indigo-600" />
            Team Directory & Hierarchy
          </h1>
          <p className="text-slate-500 mt-1">Manage roles and reporting structures for your workspace.</p>
        </div>
        <Button onClick={() => setShowInviteModal(true)} className="bg-indigo-600 hover:bg-indigo-700">
            <UserPlus className="h-4 w-4 mr-2" /> Invite Member
        </Button>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>User Details</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Reports To (Manager)</TableHead>
                <TableHead>Current Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map(user => {
                const isEditing = editingUserId === user.id
                const manager = members.find(m => m.id === user.manager_id)

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="font-semibold text-slate-800">{user.full_name}</div>
                      <div className="text-xs text-slate-500">{user.email}</div>
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Select value={editData.role} onValueChange={v => setEditData({...editData, role: v})}>
                          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="team_leader">Team Leader</SelectItem>
                              <SelectItem value="telecaller">Telecaller</SelectItem>
                              <SelectItem value="kyc_team">KYC Team</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className="uppercase text-[10px] tracking-wider bg-slate-50">
                          {user.role?.replace('_', ' ')}
                        </Badge>
                      )}
                    </TableCell>

                    <TableCell>
                      {isEditing ? (
                        <Select value={editData.manager_id || 'none'} onValueChange={v => setEditData({...editData, manager_id: v})}>
                          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="none" className="text-slate-400 italic">No Manager (Top Level)</SelectItem>
                              {potentialManagers.filter(m => m.id !== user.id).map(pm => (
                                  <SelectItem key={pm.id} value={pm.id}>{pm.full_name} ({pm.role.replace('_',' ')})</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-sm font-medium text-slate-600">
                          {manager ? manager.full_name : <span className="text-slate-400 italic">Unassigned</span>}
                        </span>
                      )}
                    </TableCell>

                    <TableCell>
                       <div className="flex items-center gap-2">
                           <div className={`h-2 w-2 rounded-full ${user.current_status === 'offline' ? 'bg-slate-300' : 'bg-emerald-500'}`} />
                           <span className="text-xs uppercase text-slate-500">{user.current_status || 'offline'}</span>
                       </div>
                    </TableCell>

                    <TableCell className="text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setEditingUserId(null)}>Cancel</Button>
                            <Button size="sm" onClick={() => saveEdit(user.id)} className="bg-green-600 hover:bg-green-700 h-8">
                                <Save className="h-3 w-3 mr-1" /> Save
                            </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => startEdit(user)} className="h-8 text-xs">
                          <UserCog className="h-3 w-3 mr-2" /> Edit Hierarchy
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Invite Modal */}
      <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-indigo-600" /> Invite New Member</DialogTitle>
            <DialogDescription>Create a new account for your workspace.</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Full Name</Label>
                    <Input placeholder="John Doe" value={inviteForm.fullName} onChange={e => setInviteForm({...inviteForm, fullName: e.target.value})} />
                </div>
                <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" placeholder="john@company.com" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={inviteForm.role} onValueChange={v => setInviteForm({...inviteForm, role: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                            <SelectItem value="team_leader">Team Leader</SelectItem>
                            <SelectItem value="telecaller">Telecaller</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Assign Manager</Label>
                    <Select value={inviteForm.managerId} onValueChange={v => setInviteForm({...inviteForm, managerId: v})}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">None (Direct Report)</SelectItem>
                            {potentialManagers.map(pm => (
                                <SelectItem key={pm.id} value={pm.id}>{pm.full_name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>Temporary Password</Label>
                <Input type="password" placeholder="Will be used for first login..." value={inviteForm.password} onChange={e => setInviteForm({...inviteForm, password: e.target.value})} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowInviteModal(false)}>Cancel</Button>
            <Button onClick={handleInviteSubmit} disabled={isSubmitting} className="bg-indigo-600">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}
