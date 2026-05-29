"use client"

import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Search, X, Filter } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileSearchProps {
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onFilter?: () => void
  suggestions?: string[]
  className?: string
}

export function MobileSearch({
  placeholder = "Search...",
  value,
  onChange,
  onFilter,
  suggestions = [],
  className,
}: MobileSearchProps) {
  const [isFocused, setIsFocused] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const filteredSuggestions = suggestions
    .filter((suggestion) => suggestion.toLowerCase().includes(value.toLowerCase()) && suggestion !== value)
    .slice(0, 5)

  useEffect(() => {
    setShowSuggestions(isFocused && value.length > 0 && filteredSuggestions.length > 0)
  }, [isFocused, value, filteredSuggestions.length])

  const handleClear = () => {
    onChange("")
    inputRef.current?.focus()
  }

  const handleSuggestionClick = (suggestion: string) => {
    onChange(suggestion)
    setShowSuggestions(false)
    inputRef.current?.blur()
  }

  return (
    <div className={cn("relative", className)}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            // Delay hiding suggestions to allow clicks
            setTimeout(() => setIsFocused(false), 150)
          }}
          className="pl-10 pr-20 h-12 text-base" // Larger touch target
        />
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={handleClear} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          )}
          {onFilter && (
            <Button type="button" variant="ghost" size="sm" onClick={onFilter} className="h-8 w-8 p-0">
              <Filter className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Suggestions */}
      {showSuggestions && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full text-left px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-b-0"
            >
              <span className="text-sm">{suggestion}</span>
            </button>
          ))}
        </Card>
      )}
    </div>
  )
}
