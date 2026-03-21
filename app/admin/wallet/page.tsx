"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Coins, ArrowDownRight, ArrowUpRight, Loader2, Receipt, PhoneCall, Megaphone } from "lucide-react"

export default function TenantWalletPage() {
  const [balance, setBalance] = useState<number>(0)
  const [ledger, setLedger] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    const fetchWallet = async () => {
      // Fetch Wallet Balance
      const { data: wallet } = await supabase.from('tenant_wallets').select('credits_balance').maybeSingle()
      if (wallet) setBalance(wallet.credits_balance)

      // Fetch Transaction History
      const { data: history } = await supabase.from('wallet_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      if (history) setLedger(history)
      
      setLoading(false)
    }
    fetchWallet()
  }, [supabase])

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Coins className="h-8 w-8 text-amber-500" /> Virtual Wallet
          </h1>
          <p className="text-slate-500 mt-1">Manage your communication credits and billing history.</p>
        </div>
      </div>

      {/* BALANCE CARD */}
      <Card className="bg-gradient-to-br from-slate-900 to-indigo-900 text-white shadow-xl">
        <CardContent className="p-8 flex items-center justify-between">
          <div>
            <p className="text-indigo-200 font-semibold uppercase tracking-wider text-sm mb-2">Available Credits</p>
            <h2 className="text-5xl font-black flex items-center gap-2">
              <Coins className="h-10 w-10 text-amber-400" />
              {balance.toLocaleString()}
            </h2>
            <p className="text-indigo-200 text-xs mt-3">Used for Click-to-Call and IVR Campaigns.</p>
          </div>
          <div className="text-right space-y-3">
             <div className="bg-white/10 backdrop-blur-sm px-4 py-3 rounded-lg border border-white/20">
                <p className="text-xs text-indigo-100 font-medium">To recharge your account,</p>
                <p className="text-sm font-bold text-white mt-1">Please contact your Account Manager.</p>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* TRANSACTION HISTORY */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="bg-slate-50 border-b pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt className="h-5 w-5 text-slate-600" /> Ledger History
          </CardTitle>
          <CardDescription>Recent credit deductions and recharges.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Transaction Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Credits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ledger.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs text-slate-500">
                    {new Date(tx.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                  </TableCell>
                  <TableCell>
                    {tx.transaction_type === 'RECHARGE' && <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0"><ArrowUpRight className="w-3 h-3 mr-1"/> Recharge</Badge>}
                    {tx.transaction_type === 'C2C_CALL' && <Badge variant="outline" className="text-blue-700"><PhoneCall className="w-3 h-3 mr-1"/> C2C Call</Badge>}
                    {tx.transaction_type === 'IVR_CAMPAIGN' && <Badge variant="outline" className="text-purple-700"><Megaphone className="w-3 h-3 mr-1"/> IVR Campaign</Badge>}
                  </TableCell>
                  <TableCell className="text-sm font-medium text-slate-700">{tx.description}</TableCell>
                  <TableCell className={`text-right font-bold ${tx.credits > 0 ? 'text-emerald-600' : 'text-slate-800'}`}>
                    {tx.credits > 0 ? '+' : ''}{tx.credits}
                  </TableCell>
                </TableRow>
              ))}
              {ledger.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-10 text-slate-400">No transactions found.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
