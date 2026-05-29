// This component implements a reusable multi-select dropdown for tags.
// It uses mock implementations for Shadcn components for file independence.

"use client"

import * as React from "react"
import { Check, ChevronDown, X } from "lucide-react"

// --- Mock Imports (must match mock implementations in the main file) ---
const cn = (...args: any[]) => args.filter(Boolean).join(" "); // Mock cn function
const Badge = ({ children, className, onClick, variant = 'default' }: any) => <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${variant === 'secondary' ? 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700' : ''} ${className}`} onClick={onClick}>{children}</div>
const Button = ({ children, className, onClick, variant = 'default', role, 'aria-expanded': ariaExpanded, disabled }: any) => <button className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none h-10 px-4 py-2 ${variant === 'outline' ? 'border border-input bg-background hover:bg-accent hover:text-accent-foreground' : 'bg-blue-600 text-white hover:bg-blue-700'} ${className}`} onClick={onClick} role={role} aria-expanded={ariaExpanded} disabled={disabled}>{children}</button>
const Popover = ({ children, open, onOpenChange }: any) => <div data-open={open} onClick={(e) => e.stopPropagation()}>{children}</div> // Mock Popover container
const PopoverTrigger = ({ children, asChild }: any) => <>{children}</> // Mock PopoverTrigger
const PopoverContent = ({ children, className }: any) => <div className={`z-50 w-full rounded-md border bg-popover p-1 shadow-md outline-none animate-in data-[side=top]:slide-in-from-bottom-2 data-[side=right]:slide-in-from-left-2 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 ${className}`}>{children}</div>
const Command = ({ children }: any) => <div>{children}</div> // Mock Command
const CommandGroup = ({ children }: any) => <div className="p-1">{children}</div> // Mock CommandGroup
const CommandItem = ({ children, onSelect, className }: any) => <div className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none aria-selected:bg-accent aria-selected:text-accent-foreground data-[disabled]:opacity-50 hover:bg-gray-100 dark:hover:bg-gray-800 ${className}`} onClick={onSelect}>{children}</div> // Mock CommandItem
// ----------------------------------------------------------------------


// Define the shape for an item in the multi-select
interface SelectItem {
  value: string
  label: string
}

interface MultiSelectTagsProps {
  options: SelectItem[] // All available options
  selected: string[] // Currently selected values (string array of tags)
  onChange: (selectedValues: string[]) => void // Handler for when selection changes
  placeholder?: string
  className?: string
}

export function MultiSelectTags({
  options,
  selected,
  onChange,
  placeholder = "Select tags...",
  className,
}: MultiSelectTagsProps) {
  const [open, setOpen] = React.useState(false)

  // Remove a single value from the selection array
  const handleRemove = (value: string) => {
    onChange(selected.filter((v) => v !== value))
  }

  // Toggle selection status for a value
  const handleToggle = (value: string) => {
    if (selected.includes(value)) {
      handleRemove(value)
    } else {
      // Ensure we only add tags that are actually in the options list (safety check)
      if (options.some(o => o.value === value)) {
        onChange([...selected, value])
      }
    }
  }

  // Render the selected tags as badges inside the button trigger
  const renderBadges = () => {
    if (selected.length === 0) {
      return <span className="text-sm text-gray-500">{placeholder}</span>
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        {selected.map((value) => {
          const item = options.find((o) => o.value === value)
          if (!item) return null; // Should not happen if logic is correct
          
          return (
            <Badge
              key={value}
              variant="secondary"
              className="py-1 px-2 pr-1 rounded-full text-xs font-normal transition-colors cursor-default hover:bg-gray-200 dark:hover:bg-gray-700"
              onClick={(e: React.MouseEvent) => {
                e.stopPropagation() // Prevent the popover from opening/closing
                handleRemove(value)
              }}
            >
              {item.label}
              <X className="ml-1 h-3 w-3 cursor-pointer opacity-80" />
            </Badge>
          )
        })}
      </div>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between h-auto min-h-[40px] px-3 py-1 bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-700",
            className
          )}
        >
          <div className="flex-1 overflow-hidden text-left">{renderBadges()}</div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] max-h-72 overflow-y-auto z-50 p-0">
        <Command>
          <CommandGroup>
            {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                    <CommandItem
                        key={option.value}
                        onSelect={() => handleToggle(option.value)}
                        className="cursor-pointer flex items-center justify-between"
                    >
                        {option.label}
                        <Check
                          className={cn(
                            "ml-2 h-4 w-4",
                            isSelected ? "opacity-100 text-blue-600" : "opacity-0"
                          )}
                        />
                    </CommandItem>
                )
            })}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
