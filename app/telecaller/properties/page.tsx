"use client"

import { useState, useEffect } from "react"
import { getProperties } from "@/app/actions/properties"
import { Card, CardContent } from "@/components/ui/card"
import { Building, MapPin, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

export default function TelecallerPropertiesPage() {
  const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProperties()
  }, [])

  const fetchProperties = async () => {
    setLoading(true)
    const res = await getProperties()
    if (res.success) {
      setProperties(res.data || [])
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Available Inventory</h1>
          <p className="text-slate-500 mt-1">Browse properties to match with your clients.</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
        <Input placeholder="Search by location, bhk, or title..." className="pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full"></div></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.length === 0 ? (
            <div className="col-span-full text-center p-12 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed">
              <Building className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-4 text-lg font-semibold">No properties found</h3>
            </div>
          ) : (
            properties.map(prop => (
              <Card key={prop.id} className="overflow-hidden group">
                <div className="h-48 bg-slate-200 dark:bg-slate-800 relative flex items-center justify-center">
                  {prop.images && prop.images[0] ? (
                    <img src={prop.images[0]} alt={prop.title} className="object-cover w-full h-full" />
                  ) : (
                    <Building className="h-12 w-12 text-slate-400" />
                  )}
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-xs font-bold shadow">
                    {prop.listing_type?.toUpperCase()}
                  </div>
                </div>
                <CardContent className="p-5">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-bold text-lg truncate pr-2">{prop.title}</h3>
                    <span className="font-bold text-blue-600 shrink-0">₹{prop.price?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center text-slate-500 text-sm mb-4">
                    <MapPin className="h-3 w-3 mr-1" /> {prop.location}
                  </div>
                  <div className="flex justify-between text-sm border-t pt-4 border-slate-100 dark:border-slate-800">
                    <div><span className="font-semibold">{prop.bhk_config || '-'}</span></div>
                    <div><span className="font-semibold">{prop.area_sqft || '-'}</span> sqft</div>
                    <div>
                       <span className="capitalize px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{prop.status}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  )
}
