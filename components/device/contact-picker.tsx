"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Phone, Mail, MapPin, AlertCircle } from "lucide-react"
import { contactManager, type ContactInfo } from "@/lib/device/contacts"
import { toast } from "sonner"

interface ContactPickerProps {
  onContactSelect: (contact: ContactInfo) => void
  allowMultiple?: boolean
  properties?: string[]
}

export function ContactPicker({
  onContactSelect,
  allowMultiple = false,
  properties = ["name", "tel", "email"],
}: ContactPickerProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState<ContactInfo[]>([])

  const isAvailable = contactManager.isAvailable()

  const handlePickContact = async () => {
    if (!isAvailable) {
      toast.error("Contact picker is not supported on this device")
      return
    }

    setIsLoading(true)
    try {
      const contacts = allowMultiple
        ? await contactManager.pickMultipleContacts(properties)
        : await contactManager.pickContact(properties)

      if (contacts.length > 0) {
        setSelectedContacts(contacts)
        if (!allowMultiple) {
          onContactSelect(contacts[0])
        }
        toast.success(`Selected ${contacts.length} contact${contacts.length > 1 ? "s" : ""}`)
      }
    } catch (error) {
      console.error("Failed to pick contact:", error)
      toast.error(error instanceof Error ? error.message : "Failed to access contacts")
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmSelection = () => {
    if (selectedContacts.length === 0) {
      toast.error("Please select at least one contact")
      return
    }

    // For multiple selection, you might want to handle this differently
    // For now, we'll just return the first contact
    onContactSelect(selectedContacts[0])
  }

  const formatContactName = (names?: string[]): string => {
    if (!names || names.length === 0) return "Unknown Contact"
    return names.join(" ")
  }

  const formatPhoneNumber = (phones?: string[]): string => {
    if (!phones || phones.length === 0) return ""
    return contactManager.formatPhoneNumber(phones[0])
  }

  if (!isAvailable) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Contact Picker Unavailable
          </CardTitle>
          <CardDescription>
            Contact picker is not supported on this device or browser. Please enter contact information manually.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Select Contact
          </CardTitle>
          <CardDescription>
            {allowMultiple ? "Choose one or more contacts" : "Choose a contact"} from your device
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={handlePickContact} disabled={isLoading} className="w-full">
            {isLoading ? "Opening Contacts..." : "Pick from Contacts"}
          </Button>

          {/* Selected Contacts Display */}
          {selectedContacts.length > 0 && (
            <div className="space-y-3">
              <h4 className="font-medium">Selected Contacts:</h4>
              {selectedContacts.map((contact, index) => (
                <Card key={index} className="p-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-primary" />
                      <span className="font-medium">{formatContactName(contact.name)}</span>
                    </div>

                    <div className="space-y-1 text-sm text-muted-foreground">
                      {contact.tel && contact.tel.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          <span>{formatPhoneNumber(contact.tel)}</span>
                        </div>
                      )}

                      {contact.email && contact.email.length > 0 && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3 w-3" />
                          <span>{contact.email[0]}</span>
                        </div>
                      )}

                      {contact.address && contact.address.length > 0 && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3" />
                          <span className="line-clamp-1">{contact.address[0]}</span>
                        </div>
                      )}
                    </div>

                    {/* Available Properties */}
                    <div className="flex flex-wrap gap-1">
                      {properties.map((prop) => (
                        <Badge key={prop} variant="secondary" className="text-xs">
                          {prop}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}

              {allowMultiple && (
                <Button onClick={handleConfirmSelection} className="w-full">
                  Confirm Selection ({selectedContacts.length})
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
