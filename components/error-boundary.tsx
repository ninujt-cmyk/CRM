"use client"

import { Component, ErrorInfo, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCcw, Home, Terminal, Copy, Mail, WifiOff, ChevronDown, ChevronRight } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner" // Assuming you use sonner, or replace with your toast lib

interface Props {
  children: ReactNode
  fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode)
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isExpanded: boolean // To toggle stack trace visibility
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    isExpanded: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, isExpanded: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
    this.setState({ errorInfo })
    // TODO: Log to Sentry/LogRocket here
  }

  public resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  private handleCopyError = () => {
    const text = `Error: ${this.state.error?.toString()}\n\nStack:\n${this.state.errorInfo?.componentStack || this.state.error?.stack}`
    navigator.clipboard.writeText(text)
    toast.success("Error details copied to clipboard")
  }

  private handleReportIssue = () => {
    const subject = encodeURIComponent(`Bug Report: ${this.state.error?.name || "Unknown Error"}`)
    const body = encodeURIComponent(`I encountered an error:\n${this.state.error?.message}\n\nSteps to reproduce:`)
    window.location.href = `mailto:support@yourcompany.com?subject=${subject}&body=${body}`
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        if (typeof this.props.fallback === "function") {
          return this.props.fallback(this.state.error!, this.resetErrorBoundary)
        }
        return this.props.fallback
      }

      const isDev = process.env.NODE_ENV === "development"
      const isOffline = typeof navigator !== "undefined" && !navigator.onLine

      return (
        <div className="min-h-[50vh] flex items-center justify-center p-6 bg-slate-50/50" role="alert">
          <Card className="w-full max-w-lg shadow-xl border-red-100 animate-in fade-in zoom-in-95 duration-300">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto bg-red-100 p-4 rounded-full w-fit mb-4 shadow-sm">
                {isOffline ? (
                    <WifiOff className="h-8 w-8 text-red-600" />
                ) : (
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold text-slate-900">
                {isOffline ? "No Internet Connection" : "Something went wrong"}
              </CardTitle>
              <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                {isOffline 
                  ? "Please check your network settings and try again." 
                  : "We encountered an unexpected error. Our team has been notified."}
              </p>
            </CardHeader>

            <CardContent className="space-y-4 pt-2">
              {/* Expandable Debug Info */}
              {(isDev || this.state.error) && (
                <div className="border rounded-md border-slate-200 overflow-hidden">
                    <button 
                        onClick={() => this.setState(s => ({ isExpanded: !s.isExpanded }))}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-600"
                    >
                        <span className="flex items-center gap-2">
                            <Terminal className="h-3.5 w-3.5" />
                            View Technical Details
                        </span>
                        {this.state.isExpanded ? <ChevronDown className="h-3.5 w-3.5"/> : <ChevronRight className="h-3.5 w-3.5"/>}
                    </button>
                    
                    {this.state.isExpanded && (
                        <div className="bg-slate-950 text-slate-50 p-4 text-xs font-mono text-left relative group">
                            <Button 
                                size="icon" 
                                variant="ghost" 
                                className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-white hover:bg-slate-800"
                                onClick={this.handleCopyError}
                                title="Copy Error"
                            >
                                <Copy className="h-3 w-3" />
                            </Button>
                            <ScrollArea className="h-[200px] w-full pr-4">
                                <p className="text-red-400 font-bold mb-2">{this.state.error?.toString()}</p>
                                <div className="opacity-70 whitespace-pre-wrap leading-relaxed">
                                {this.state.errorInfo?.componentStack || this.state.error?.stack}
                                </div>
                            </ScrollArea>
                        </div>
                    )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2">
              <Button 
                onClick={this.resetErrorBoundary} 
                className="w-full bg-red-600 hover:bg-red-700 text-white h-11 text-base shadow-red-100"
              >
                <RefreshCcw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="w-full"
                >
                  Reload Page
                </Button>
                
                {/* Dynamic Second Button: Report or Home */}
                {isDev ? (
                    <Button 
                      variant="outline" 
                      onClick={() => window.location.href = '/'}
                      className="w-full"
                    >
                      <Home className="h-4 w-4 mr-2" /> Go Home
                    </Button>
                ) : (
                    <Button 
                      variant="outline" 
                      onClick={this.handleReportIssue}
                      className="w-full"
                    >
                      <Mail className="h-4 w-4 mr-2" /> Report Issue
                    </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
