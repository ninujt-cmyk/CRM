"use client"

export interface CallLog {
  id: string
  phoneNumber: string
  displayName?: string
  duration_seconds: number
  duration: number
  startTime: Date
  endTime: Date
  callType: "incoming" | "outgoing" | "missed"
}

export class CallLogsManager {
  /**
   * Check if call logs API is available
   * Note: This is a simplified implementation as the actual Call Log API
   * is not widely supported and requires special permissions
   */
  static isAvailable(): boolean {
    // Check if we're in a secure context (required for most device APIs)
    if (typeof window === "undefined" || !window.isSecureContext) {
      return false;
    }

    // For mobile devices, we'll return true to allow the permission request flow
    // This gives users a chance to grant permissions if they're available
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // On mobile devices, we'll allow the permission flow even if we know it might not work
    // This gives users a chance to see if their specific device/browser supports it
    if (isMobile) {
      return true;
    }
    
    // In a real implementation, this would check for specific API availability
    // For now, we'll return false to indicate that direct call log access
    // is not available in most browsers
    return false;
  }

  /**
   * Request permission to access call logs
   * Note: This is a simplified implementation as the actual Call Log API
   * is not widely supported and requires special permissions
   */
  static async requestPermission(): Promise<PermissionState> {
    try {
      // Check if we're in a secure context
      if (typeof window === "undefined" || !window.isSecureContext) {
        console.warn("Call logs API requires a secure context (HTTPS)")
        return "denied"
      }

      // For mobile devices, we'll show a more helpful message
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      if (isMobile) {
        // On mobile, we'll return "prompt" to indicate that the user should be prompted
        // In a real implementation with proper permissions, we would actually request permission here
        console.warn("Call logs API support varies by device and browser. Manual logging is recommended.");
        return "prompt";
      }

      // In a real implementation, we would use:
      // const permissionStatus = await navigator.permissions.query({ name: "call-log" })
      // return permissionStatus.state
      
      // For now, we'll simulate a permission request
      console.warn("Call logs API is not available in this browser")
      return "denied"
    } catch (error) {
      console.error("Error requesting call log permission:", error)
      return "denied"
    }
  }

  /**
   * Get recent call logs
   * Note: This is a placeholder implementation
   */
  static async getCallLogs(options?: {
    limit?: number
    startTime?: Date
    endTime?: Date
  }): Promise<CallLog[]> {
    // This is a placeholder implementation
    // In a real app with proper permissions, this would fetch actual call logs
    console.warn("Call logs API is not available - returning mock data")
    
    // Return mock data for demonstration
    return [
      {
        id: "1",
        phoneNumber: "+1234567890",
        displayName: "John Doe",
        duration: 120,
        duration_seconds: 120,
        startTime: new Date(Date.now() - 3600000),
        endTime: new Date(Date.now() - 3588000),
        callType: "outgoing"
      },
      {
        id: "2",
        phoneNumber: "+0987654321",
        displayName: "Jane Smith",
        duration: 0,
        duration_seconds: 0,
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() - 7200000),
        callType: "missed"
      }
    ]
  }

  /**
   * Format phone number for display
   */
  static formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, "")

    // Format based on length
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    } else if (cleaned.length === 11 && cleaned[0] === "1") {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }

    return phoneNumber // Return original if can't format
  }

  /**
   * Validate phone number
   */
  static isValidPhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/\D/g, "")
    return cleaned.length >= 10 && cleaned.length <= 15
  }
  
  // Instance methods that delegate to static methods
  isAvailable(): boolean {
    return CallLogsManager.isAvailable()
  }
  
  async requestPermission(): Promise<PermissionState> {
    return CallLogsManager.requestPermission()
  }
  
  async getCallLogs(options?: {
    limit?: number
    startTime?: Date
    endTime?: Date
  }): Promise<CallLog[]> {
    return CallLogsManager.getCallLogs(options)
  }
  
  formatPhoneNumber(phoneNumber: string): string {
    return CallLogsManager.formatPhoneNumber(phoneNumber)
  }
  
  isValidPhoneNumber(phoneNumber: string): boolean {
    return CallLogsManager.isValidPhoneNumber(phoneNumber)
  }
}

// Export a singleton instance
export const callLogsManager = new CallLogsManager()