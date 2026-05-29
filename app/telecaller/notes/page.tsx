import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MessageSquare, User, Calendar } from "lucide-react"
import { formatDistanceToNow, format } from "date-fns"
import Link from "next/link"
import { redirect } from "next/navigation"
import { GeneralAddNoteModal } from "@/components/general-add-note-modal"

export default async function NotesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Get all notes created by this telecaller
  const { data: notes } = await supabase
    .from("notes")
    .select(`
      *,
      leads (
        id,
        name,
        company,
        status
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Get all leads assigned to this telecaller to support standalone note creation
  const { data: leads } = await supabase
    .from("leads")
    .select("id, name, company")
    .eq("assigned_to", user.id)
    .order("name", { ascending: true })

  const getNoteTypeColor = (type: string) => {
    const colors = {
      general: "bg-gray-100 text-gray-800",
      call: "bg-blue-100 text-blue-800",
      meeting: "bg-green-100 text-green-800",
      follow_up: "bg-orange-100 text-orange-800",
      concern: "bg-red-100 text-red-800",
      opportunity: "bg-purple-100 text-purple-800",
    }
    return colors[type as keyof typeof colors] || "bg-gray-100 text-gray-800"
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Notes</h1>
          <p className="text-gray-600 mt-1">All notes and comments you've added to leads</p>
        </div>
        <GeneralAddNoteModal leads={leads || []} userId={user.id} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Notes</p>
                <p className="text-2xl font-bold text-gray-900">{notes?.length || 0}</p>
              </div>
              <MessageSquare className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-green-600">
                  {notes?.filter((note: any) => {
                    const noteDate = new Date(note.created_at)
                    const weekAgo = new Date()
                    weekAgo.setDate(weekAgo.getDate() - 7)
                    return noteDate >= weekAgo
                  }).length || 0}
                </p>
              </div>
              <Calendar className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Leads with Notes</p>
                <p className="text-2xl font-bold text-purple-600">
                  {new Set(notes?.map((note: any) => note.lead_id)).size || 0}
                </p>
              </div>
              <User className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Notes List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Recent Notes ({notes?.length || 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {notes && notes.length > 0 ? (
            <div className="space-y-4">
              {notes.map((note: any) => (
                <div key={note.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={getNoteTypeColor(note.note_type)}>
                        {note.note_type.replace("_", " ").toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {format(new Date(note.created_at), "MMM dd, yyyy 'at' h:mm a")}
                      </span>
                      <span className="text-sm text-gray-400">
                        ({formatDistanceToNow(new Date(note.created_at), { addSuffix: true })})
                      </span>
                    </div>
                    <Link href={`/telecaller/leads/${note.leads?.id}`}>
                      <Button size="sm" variant="outline">
                        <User className="h-4 w-4 mr-1" />
                        View Lead
                      </Button>
                    </Link>
                  </div>

                  <div className="mb-3">
                    <h3 className="font-semibold text-gray-900 mb-1">{note.leads?.name}</h3>
                    {note.leads?.company && <p className="text-sm text-gray-600">{note.leads.company}</p>}
                  </div>

                  <div className="bg-gray-50 rounded-md p-3">
                    <p className="text-gray-700 whitespace-pre-wrap">{note.note}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <MessageSquare className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No notes yet</h3>
              <p className="text-gray-600 mb-4">
                Start adding notes to your leads to track important information and conversations.
              </p>
              <Link href="/telecaller/leads">
                <Button>Go to My Leads</Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
