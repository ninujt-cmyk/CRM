"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { TrendingUp, Award } from "lucide-react"

export function TelecallerTicker() {
  const [message, setMessage] = useState("Loading targets...")
  const [isTargetAchieved, setIsTargetAchieved] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 1. Get User Details (Name & Monthly Target)
      const { data: userData } = await supabase
        .from('users')
        .select('full_name, monthly_target')
        .eq('id', user.id)
        .single()

      if (!userData) return

      const target = userData.monthly_target || 2000000 // Default 20L if not set
      const name = userData.full_name?.split(' ')[0] || "Telecaller" // First name

      // 2. Calculate Achievement for THIS Month
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

      const { data: leads } = await supabase
        .from('leads')
        .select('disbursed_amount, loan_amount')
        .eq('assigned_to', user.id)
        .eq('status', 'DISBURSED')
        .gte('updated_at', startOfMonth)
        .lte('updated_at', endOfMonth)

      const achieved = leads?.reduce((sum, lead) => sum + (lead.disbursed_amount || lead.loan_amount || 0), 0) || 0
      const pending = target - achieved

      // 3. Set Message
      if (pending <= 0) {
        setIsTargetAchieved(true)
        setMessage(`Hey ${name}, Congratulations! 🎉 You have smashed your monthly target! Keep soaring high! 🚀`)
      } else {
        setIsTargetAchieved(false)
        const formattedPending = new Intl.NumberFormat('en-IN', {
          style: 'currency',
          currency: 'INR',
          maximumFractionDigits: 0
        }).format(pending)
        
        setMessage(`Hey ${name}! 🎯 ${formattedPending} more to go to hit your Hanva target. Keep the momentum going—you can do it! 💥`)
      }
    }

    fetchData()
  }, [])

  return (
    <div className="w-full overflow-hidden whitespace-nowrap py-3 bg-transparent flex items-center">
      <div className="inline-block animate-marquee w-full">
        <div className="flex items-center gap-4 text-gray-800 font-medium text-sm md:text-base">
          
          {/* Main Message */}
          <span className="flex items-center gap-2">
            {isTargetAchieved ? 
              <Award className="h-5 w-5 text-green-600" /> : 
              <TrendingUp className="h-5 w-5 text-blue-600" />
            }
            {message}
          </span>

          {/* Spacer */}
          <span className="mx-16 text-gray-300">|</span> 
          
          {/* Duplicate 1 */}
          <span className="flex items-center gap-2">
             {isTargetAchieved ? 
              <Award className="h-5 w-5 text-green-600" /> : 
              <TrendingUp className="h-5 w-5 text-blue-600" />
            }
             {message}
          </span>

          {/* Spacer */}
          <span className="mx-16 text-gray-300">|</span> 

          {/* Duplicate 2 */}
          <span className="flex items-center gap-2">
             {isTargetAchieved ? 
              <Award className="h-5 w-5 text-green-600" /> : 
              <TrendingUp className="h-5 w-5 text-blue-600" />
            }
             {message}
          </span>
        </div>
      </div>
      
      <style jsx>{`
        .animate-marquee {
          display: inline-block;
          /* Increased to 40s for slower speed */
          animation: marquee 50s linear infinite; 
        }
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
    </div>
  )
}
