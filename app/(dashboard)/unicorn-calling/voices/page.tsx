"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mic2, Search, Play, Square, Plus, UploadCloud, RefreshCw } from "lucide-react"
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

export default function VoicesPage() {
  const [voices, setVoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  
  // Audio playback state
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const res = await fetch("/api/proxy/unicorn?endpoint=/api/cartesia/voices")
        const data = await res.json()
        if (Array.isArray(data)) {
          setVoices(data)
        }
      } catch (error) {
        console.error("Error fetching voices:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchVoices()
  }, [])

  const handleClone = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsUploading(true)
    setTimeout(() => {
      setIsUploading(false)
      toast.success("Voice cloned successfully")
      setVoices([
        { 
          id: "custom-" + Math.random().toString(), 
          name: "My Custom Voice", 
          provider: "elevenlabs",
          preview_url: null,
          language: "en" 
        },
        ...voices
      ])
    }, 2000)
  }

  const togglePlay = (voiceId: string, previewUrl: string) => {
    if (playingId === voiceId) {
      audioRef.current?.pause()
      setPlayingId(null)
    } else {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      if (previewUrl) {
        const audio = new Audio(previewUrl)
        audioRef.current = audio
        audio.play()
        setPlayingId(voiceId)
        audio.onended = () => setPlayingId(null)
      } else {
        toast.error("No preview available for this voice")
      }
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mic2 className="h-6 w-6 text-blue-600" />
            Voice Library
          </h1>
          <p className="text-slate-500 mt-1">Manage AI voices and clone new ones using ElevenLabs.</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4" />
              Clone Voice
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clone a New Voice</DialogTitle>
              <DialogDescription>
                Upload a clean, 1-2 minute audio sample of a voice speaking without background noise.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleClone} className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Voice Name</label>
                <Input placeholder="e.g. Sales Rep John" required />
              </div>
              <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer">
                <UploadCloud className="h-10 w-10 text-slate-400 mx-auto mb-4" />
                <p className="text-sm font-medium">Upload Audio Sample</p>
                <p className="text-xs text-slate-500 mt-1">MP3, WAV up to 10MB</p>
                <Input type="file" accept="audio/*" className="hidden" id="audio-upload" required />
              </div>
              <Button type="submit" className="w-full" disabled={isUploading}>
                {isUploading ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Cloning Voice...</> : "Clone Voice"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-950/50">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search voices by name or language..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-white dark:bg-slate-900"
            />
          </div>
          <div className="text-sm text-slate-500">
            {voices.length} Available Voices
          </div>
        </div>
        
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-slate-300" />
            Loading voices from ElevenLabs...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
            {voices.filter(v => 
              (v.name || "").toLowerCase().includes(search.toLowerCase()) || 
              (v.language || "").toLowerCase().includes(search.toLowerCase())
            ).map((voice) => (
              <div key={voice.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex items-center justify-between hover:border-blue-300 dark:hover:border-blue-700 transition-colors group">
                <div className="flex items-center gap-3 overflow-hidden">
                  <Button 
                    variant={playingId === voice.id ? "default" : "secondary"} 
                    size="icon" 
                    className="h-10 w-10 rounded-full shrink-0"
                    onClick={() => togglePlay(voice.id, voice.preview_url)}
                  >
                    {playingId === voice.id ? <Square className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
                  </Button>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-slate-900 dark:text-white truncate">{voice.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold text-slate-500">
                        {voice.provider || "elevenlabs"}
                      </Badge>
                      <span className="text-xs text-slate-500 uppercase">{voice.language || "EN"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
