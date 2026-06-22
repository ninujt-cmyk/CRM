import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { TopHeader } from "@/components/top-header"
import { KycDocumentGrid } from "@/components/kyc-document-grid"
import { ShieldCheck, Search, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export const dynamic = "force-dynamic"

export default async function KycVaultPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      <TopHeader />
      <main className="flex-1 overflow-y-auto p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl">
                  <ShieldCheck className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                KYC & Document Vault
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 ml-14">
                Securely manage client identification and booking documents.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search by Lead Name or PAN..." 
                  className="pl-9 w-full md:w-[300px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                />
              </div>
              <Button variant="outline" className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <Filter className="h-4 w-4 mr-2" /> Filters
              </Button>
            </div>
          </div>

          {/* Grid View */}
          <Suspense fallback={<div className="h-96 flex items-center justify-center text-slate-500">Loading documents...</div>}>
            <KycDocumentGrid />
          </Suspense>

        </div>
      </main>
    </div>
  )
}
