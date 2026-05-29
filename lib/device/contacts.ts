"use client"

export interface ContactInfo {
  name?: string[]
  tel?: string[]
  email?: string[]
  address?: string[]
}

export class ContactManager {
  isAvailable(): boolean {
    return ContactManager.isAvailable()
  }

  formatPhoneNumber(phoneNumber: string): string {
    return ContactManager.formatPhoneNumber(phoneNumber)
  }

  isValidPhoneNumber(phoneNumber: string): boolean {
    return ContactManager.isValidPhoneNumber(phoneNumber)
  }

  isValidEmail(email: string): boolean {
    return ContactManager.isValidEmail(email)
  }

  async requestPermission(): Promise<boolean> {
    // Note: Contact Picker API doesn't require explicit permission request
    // Permission is granted when user interacts with the picker
    return this.isAvailable()
  }

  async pickContact(properties: string[] = ["name", "tel"]): Promise<ContactInfo[]> {
    if (!this.isAvailable()) {
      throw new Error("Contact Picker API is not supported")
    }

    try {
      // @ts-ignore - Contact Picker API is experimental
      const contacts = await navigator.contacts.select(properties, { multiple: false })
      return contacts
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Contact selection was cancelled")
      }
      throw new Error("Failed to access contacts")
    }
  }

  async pickMultipleContacts(properties: string[] = ["name", "tel"]): Promise<ContactInfo[]> {
    if (!this.isAvailable()) {
      throw new Error("Contact Picker API is not supported")
    }

    try {
      // @ts-ignore - Contact Picker API is experimental
      const contacts = await navigator.contacts.select(properties, { multiple: true })
      return contacts
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Contact selection was cancelled")
      }
      throw new Error("Failed to access contacts")
    }
  }

  // Format phone number for display
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

  // Validate phone number
  static isValidPhoneNumber(phoneNumber: string): boolean {
    const cleaned = phoneNumber.replace(/\D/g, "")
    return cleaned.length >= 10 && cleaned.length <= 15
  }

  // Validate email
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Check if Contact Picker API is available
  static isAvailable(): boolean {
    return "contacts" in navigator && "ContactsManager" in window
  }

  // Get supported properties
  static async getSupportedProperties(): Promise<string[]> {
    if (!this.isAvailable()) {
      return []
    }

    try {
      // @ts-ignore - Contact Picker API is experimental
      return await navigator.contacts.getProperties()
    } catch {
      return ["name", "tel", "email", "address"]
    }
  }
}

export const contactManager = new ContactManager()
