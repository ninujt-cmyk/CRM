"use client"

import type React from "react"

import type { ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface MobileFormFieldProps {
  label: string
  required?: boolean
  error?: string
  children: ReactNode
  className?: string
}

export function MobileFormField({ label, required, error, children, className }: MobileFormFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

interface MobileFormProps {
  title?: string
  description?: string
  children: ReactNode
  onSubmit?: (e: React.FormEvent) => void
  submitLabel?: string
  submitDisabled?: boolean
  submitLoading?: boolean
  cancelLabel?: string
  onCancel?: () => void
  className?: string
}

export function MobileForm({
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save",
  submitDisabled,
  submitLoading,
  cancelLabel = "Cancel",
  onCancel,
  className,
}: MobileFormProps) {
  return (
    <form onSubmit={onSubmit} className={cn("space-y-6", className)}>
      {(title || description) && (
        <div className="space-y-2">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {description && <p className="text-muted-foreground">{description}</p>}
        </div>
      )}

      <div className="space-y-4">{children}</div>

      <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
            {cancelLabel}
          </Button>
        )}
        <Button type="submit" disabled={submitDisabled || submitLoading} className="flex-1">
          {submitLoading ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  )
}

// Mobile-optimized input components
interface MobileInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
  required?: boolean
}

export function MobileInput({ label, error, required, className, ...props }: MobileInputProps) {
  return (
    <MobileFormField label={label} required={required} error={error}>
      <Input
        {...props}
        className={cn("h-12 text-base", className)} // Larger touch target
      />
    </MobileFormField>
  )
}

interface MobileTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string
  error?: string
  required?: boolean
}

export function MobileTextarea({ label, error, required, className, ...props }: MobileTextareaProps) {
  return (
    <MobileFormField label={label} required={required} error={error}>
      <Textarea
        {...props}
        className={cn("min-h-[100px] text-base resize-none", className)} // Larger touch target, no resize
      />
    </MobileFormField>
  )
}

interface MobileSelectProps {
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  error?: string
  required?: boolean
  children: ReactNode
}

export function MobileSelect({
  label,
  value,
  onValueChange,
  placeholder,
  error,
  required,
  children,
}: MobileSelectProps) {
  return (
    <MobileFormField label={label} required={required} error={error}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-12 text-base">
          {" "}
          {/* Larger touch target */}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>{children}</SelectContent>
      </Select>
    </MobileFormField>
  )
}
