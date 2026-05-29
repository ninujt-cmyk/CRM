import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { WifiOff, Database, RefreshCw, Smartphone } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <WifiOff className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">You're Offline</h1>
          <p className="text-muted-foreground">Don't worry! You can still use the app with limited functionality.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Offline Features Available
            </CardTitle>
            <CardDescription>These features work without an internet connection</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-2 w-2 bg-green-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">Add New Leads</p>
                <p className="text-sm text-muted-foreground">Create leads that will sync when you're back online</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-2 w-2 bg-green-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">Add Notes & Call Logs</p>
                <p className="text-sm text-muted-foreground">Record interactions that will be saved locally</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-2 w-2 bg-green-500 rounded-full mt-2" />
              <div>
                <p className="font-medium">View Cached Data</p>
                <p className="text-sm text-muted-foreground">Access previously loaded leads and information</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Auto-Sync When Online
            </CardTitle>
            <CardDescription>Your data will automatically sync when connection is restored</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smartphone className="h-4 w-4" />
              <span>Check your internet connection and we'll sync everything automatically</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
