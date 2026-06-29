"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, Save, Play, Bot, Copy, History, TestTube,
  FileText, Mic, Settings2, SlidersHorizontal
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { getUnicornScript, createUnicornScript, updateUnicornScript } from "@/app/actions/unicorn-ai";
import Link from "next/link";

export default function UnicornAgentBuilder({ params }: { params: { id: string } }) {
  const router = useRouter();
  const isNew = params.id === "new";

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState({
    name: "New AI Agent",
    content: "You are a confident, friendly, and persuasive sales executive...",
    ttsProvider: "UNICORN AI TTS",
    voiceId: "",
    // Mock settings that won't go to the API for now, but complete the UI
    interruptionsEnabled: true,
    introMessage: "",
    llmProvider: "GPT-4o",
    temperature: 0.7
  });

  useEffect(() => {
    if (!isNew) {
      const fetchScript = async () => {
        const res = await getUnicornScript(params.id);
        if (res.success && res.script) {
          setFormData(prev => ({
            ...prev,
            name: res.script.name || "Untitled Script",
            content: res.script.content || res.script.scriptContentVisible || "",
            ttsProvider: res.script.ttsProvider || "UNICORN AI TTS",
            voiceId: res.script.voiceId || ""
          }));
        } else {
          toast.error("Failed to load script");
        }
        setLoading(false);
      };
      fetchScript();
    }
  }, [params.id, isNew]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        name: formData.name,
        content: formData.content,
        ttsProvider: formData.ttsProvider,
        voiceId: formData.voiceId
      };

      let res;
      if (isNew) {
        res = await createUnicornScript(payload);
      } else {
        res = await updateUnicornScript(params.id, payload);
      }

      if (res.success) {
        toast.success("Agent Script Saved!");
        if (isNew && res.script?.id) {
          router.replace(`/unicorn-calling/scripts/${res.script.id}`);
        }
      } else {
        toast.error(res.error || "Failed to save script");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading Agent Builder...</div>;
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-slate-50">
      {/* HEADER */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/unicorn-calling">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-600" />
            <Input 
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="font-semibold text-lg border-transparent hover:border-slate-200 focus-visible:ring-0 px-2 h-8 w-64 bg-transparent"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="text-slate-600">
            <TestTube className="h-4 w-4 mr-2" />
            Test Agent
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Agent"}
          </Button>
        </div>
      </header>

      {/* MAIN WORKSPACE */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT / CENTER PANE: TABS */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          <Tabs defaultValue="script" className="flex-1 flex flex-col">
            <div className="px-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
              <TabsList className="bg-transparent h-12 gap-6 p-0">
                <TabsTrigger value="script" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-2">
                  <FileText className="h-4 w-4 mr-2" /> Script
                </TabsTrigger>
                <TabsTrigger value="voice" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-2">
                  <Mic className="h-4 w-4 mr-2" /> Choose Voice
                </TabsTrigger>
                <TabsTrigger value="variables" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-indigo-600 rounded-none h-12 px-2">
                  <Settings2 className="h-4 w-4 mr-2" /> Variables
                </TabsTrigger>
              </TabsList>
            </div>

            {/* SCRIPT TAB */}
            <TabsContent value="script" className="flex-1 p-0 m-0 h-full border-none data-[state=active]:flex flex-col">
              <Textarea 
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                className="flex-1 w-full resize-none border-0 p-6 font-mono text-sm leading-relaxed focus-visible:ring-0 rounded-none bg-white shadow-none"
                placeholder="1. PERSONALITY & IDENTITY..."
              />
            </TabsContent>

            {/* CHOOSE VOICE TAB */}
            <TabsContent value="voice" className="flex-1 p-6 overflow-y-auto m-0 border-none">
              <div className="max-w-4xl space-y-8">
                
                {/* Voice Categories */}
                <div className="flex items-center gap-2 mb-6">
                  <Button variant="outline" className="text-indigo-600 border-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md">V3 Flagship</Button>
                  <Button variant="outline" className="text-slate-600 rounded-md">All</Button>
                  <Button variant="outline" className="text-slate-600 rounded-md">Male</Button>
                  <Button variant="outline" className="text-slate-600 rounded-md">Female</Button>
                  <Button variant="outline" className="text-slate-600 rounded-md">Language <span className="ml-2 text-xs">▼</span></Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { id: 'Vinay', name: 'Vinay', tone: 'Energetic' },
                    { id: 'Kashish', name: 'Kashish', tone: 'Energetic' },
                    { id: 'Askar', name: 'Askar', tone: 'Warm & Friendly' },
                    { id: 'Rohit Simple', name: 'Rohit Simple', tone: 'Energetic' },
                    { id: 'Maya', name: 'Maya', tone: 'Warm & Friendly' },
                    { id: 'Neha', name: 'Neha', tone: 'Confident' },
                    { id: 'Nikita', name: 'Nikita', tone: 'Confident' },
                    { id: 'Fatima', name: 'Fatima', tone: 'Calm' },
                  ].map((voice) => (
                    <Card 
                      key={voice.id} 
                      className={`cursor-pointer transition-all hover:shadow-md ${formData.voiceId === voice.id ? 'border-indigo-600 ring-1 ring-indigo-600' : 'border-slate-200'}`}
                      onClick={() => setFormData(prev => ({ ...prev, voiceId: voice.id, ttsProvider: 'UNICORN AI TTS' }))}
                    >
                      <CardContent className="p-5 flex flex-col items-center text-center">
                        <div className="h-16 w-16 rounded-full bg-gradient-to-br from-green-400 to-black mb-3 shadow-inner flex items-center justify-center overflow-hidden">
                          {/* Placeholder abstract gradient for avatar */}
                          <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-green-300 via-green-600 to-black opacity-80"></div>
                        </div>
                        <h4 className="font-bold text-slate-900">{voice.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">{voice.tone}</p>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">A</span>
                          <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-[10px] font-bold">अ</span>
                          <span className="text-[10px] text-slate-500 italic ml-1">Hindi + 1</span>
                        </div>
                        <div className="flex gap-2 mt-4 w-full">
                          <Button variant="secondary" className="flex-1 text-[10px] h-8 bg-slate-100 hover:bg-slate-200 text-slate-700" onClick={(e) => e.stopPropagation()}>English<br/>Play</Button>
                          <Button variant="secondary" className="flex-1 text-[10px] h-8 bg-slate-100 hover:bg-slate-200 text-slate-700" onClick={(e) => e.stopPropagation()}>Hinglish<br/>Play</Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="pt-6 border-t border-slate-200 mt-8 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800">Custom Voice UUID</h3>
                  <p className="text-sm text-slate-500">If the UUID isn't in the list, it will still be saved and used for TTS.</p>
                  <div className="flex gap-2 max-w-md">
                    <Input 
                      placeholder="e.g. 09c595da-6d0e-4789-b339-5a6a56a79d72" 
                      value={formData.voiceId}
                      onChange={(e) => setFormData(prev => ({ ...prev, voiceId: e.target.value }))}
                      className="font-mono text-sm flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-lg font-semibold text-slate-800">TTS Provider</h3>
                  <RadioGroup 
                    value={formData.ttsProvider} 
                    onValueChange={(val) => setFormData(prev => ({ ...prev, ttsProvider: val }))}
                    className="flex flex-wrap gap-4"
                  >
                    {[
                      { id: "UNICORN AI TTS", label: "UNICORN AI" },
                      { id: "sarvam", label: "Sarvam" },
                      { id: "cartesia", label: "Cartesia" },
                      { id: "elevenlabs", label: "ElevenLabs" }
                    ].map((provider) => (
                      <div key={provider.id}>
                        <RadioGroupItem value={provider.id} id={provider.id} className="peer sr-only" />
                        <Label
                          htmlFor={provider.id}
                          className="flex items-center justify-center rounded-md border border-slate-200 bg-white px-6 py-2 text-sm font-medium hover:bg-slate-50 hover:text-slate-900 peer-data-[state=checked]:border-indigo-600 peer-data-[state=checked]:text-indigo-600 peer-data-[state=checked]:bg-indigo-50 cursor-pointer min-w-[120px]"
                        >
                          {provider.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                
                {/* Voice Cloning Promo Banner */}
                <Card className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 border-0 text-white overflow-hidden relative mt-8">
                  <CardContent className="p-8">
                    <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="bg-white/20 p-4 rounded-full backdrop-blur-sm">
                        <Mic className="h-8 w-8" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold mb-2">Voice Cloning</h4>
                        <p className="text-white/80 text-sm max-w-md">Instantly mirror your voice in seconds, give a branded voice to your store.</p>
                      </div>
                      <Button variant="secondary" className="ml-auto whitespace-nowrap bg-white text-indigo-600 hover:bg-slate-50 font-semibold rounded-full px-6">
                        Start Recording
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="variables" className="p-6">
              <h3 className="text-lg font-semibold text-slate-800 mb-4">Supported Variables</h3>
              <p className="text-sm text-slate-600 mb-4">You can use these tags in your script. They will be dynamically replaced when launching a campaign.</p>
              <div className="bg-slate-100 p-4 rounded-lg font-mono text-sm space-y-2 inline-block">
                <div>{`{{customer_name}}`}</div>
                <div>{`{{customer_phone}}`}</div>
                <div>{`{{customer_address}}`}</div>
                <div>{`{{order_notes}}`}</div>
              </div>
            </TabsContent>

          </Tabs>
        </div>

        {/* RIGHT PANE: SETTINGS SIDEBAR */}
        <div className="w-80 border-l border-slate-200 bg-white overflow-y-auto flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 font-semibold text-slate-800 flex items-center">
            <SlidersHorizontal className="h-4 w-4 mr-2 text-slate-500" />
            Settings
          </div>
          
          <div className="p-4 space-y-4 border-b border-slate-200 bg-slate-50/50">
            <Label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Note Taker</Label>
            <Textarea 
              placeholder="Track changes to your script. Use + to add notes, - to remove..."
              className="text-xs resize-none h-32 bg-white"
            />
          </div>

          <Accordion type="multiple" defaultValue={["voice", "llm"]} className="w-full">
            <AccordionItem value="voice" className="border-b border-slate-200">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-slate-50 text-sm font-semibold text-slate-700">
                Voice & Interruptions
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-600">Allow Interruptions</Label>
                  <Switch 
                    checked={formData.interruptionsEnabled}
                    onCheckedChange={(c) => setFormData(p => ({...p, interruptionsEnabled: c}))}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="llm" className="border-b border-slate-200">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-slate-50 text-sm font-semibold text-slate-700">
                LLM Settings
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Provider</Label>
                  <Input value={formData.llmProvider} onChange={(e) => setFormData(p => ({...p, llmProvider: e.target.value}))} className="h-8 text-sm" />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="intro" className="border-b border-slate-200">
              <AccordionTrigger className="px-4 hover:no-underline hover:bg-slate-50 text-sm font-semibold text-slate-700">
                Intro Message
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <Textarea 
                  placeholder="First thing the agent says..."
                  value={formData.introMessage}
                  onChange={(e) => setFormData(p => ({...p, introMessage: e.target.value}))}
                  className="text-sm min-h-[80px]"
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
