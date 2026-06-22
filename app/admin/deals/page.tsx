import { DealsKanban } from "@/components/deals-kanban"
import { TopHeader } from "@/components/top-header"

export default function AdminDealsPage() {
    return (
        <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
            <TopHeader />
            <main className="p-6">
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800">Transaction Pipeline</h1>
                        <p className="text-slate-500">Drag and drop deals across stages to track your revenue funnel.</p>
                    </div>
                </div>
                <DealsKanban />
            </main>
        </div>
    )
}
