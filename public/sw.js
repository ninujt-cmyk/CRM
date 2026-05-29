const CACHE_NAME = "bankscart-crm-v2"
const STATIC_CACHE_NAME = "bankscart-crm-static-v2"
const DYNAMIC_CACHE_NAME = "bankscart-crm-dynamic-v2"

// Assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/auth/login",
  "/telecaller",
  "/admin",
  "/manifest.json",
  "/icons/icon-192x192.jpg",
  "/icons/icon-512x512.jpg",
  "/offline" // Make sure you have an offline page
]

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing service worker v2...")

  event.waitUntil(
    caches
      .open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log("[SW] Caching static assets")
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => {
        console.log("[SW] Static assets cached successfully")
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error("[SW] Failed to cache static assets:", error)
      }),
  )
})

// Activate event - clean up old caches and handle IndexedDB issues
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating service worker v2...")

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Delete all old caches
            if (!cacheName.includes('-v2')) {
              console.log("[SW] Deleting old cache:", cacheName)
              return caches.delete(cacheName)
            }
          }),
        )
      })
      .then(() => {
        console.log("[SW] Service worker activated")
        // Clear potentially corrupted IndexedDB data
        return clearCorruptedIndexedDB()
      })
      .then(() => {
        return self.clients.claim()
      })
      .catch((error) => {
        console.error("[SW] Activation failed:", error)
      }),
  )
})

// Fetch event - improved strategy to prevent stale data
self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== "GET") {
    return
  }

  // Skip external requests
  if (url.origin !== location.origin) {
    return
  }

  // Handle API requests with network-first strategy
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful API responses
          if (response.ok) {
            const responseClone = response.clone()
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone).catch((error) => {
                console.warn("[SW] Failed to cache API response:", error)
              })
            })
          }
          return response
        })
        .catch(() => {
          // Fallback to cache for offline
          return caches.match(request)
        }),
    )
    return
  }

  // Handle navigation requests (HTML pages) with network-first strategy
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response.ok) {
            return response
          }

          const responseClone = response.clone()
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch((error) => {
              console.warn("[SW] Failed to cache page:", error)
            })
          })
          return response
        })
        .catch(() => {
          // Network failed, try cache
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse
            }
            // Show offline page if nothing in cache
            return caches.match("/offline").then((offlineResponse) => {
              return offlineResponse || new Response(
                "<html><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>",
                { headers: { "Content-Type": "text/html" } },
              )
            })
          })
        }),
    )
    return
  }

  // Handle static assets with cache-first strategy (safe for versioned assets)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached response but update cache in background
        fetchAndUpdateCache(request)
        return cachedResponse
      }

      // Not in cache, fetch from network
      return fetch(request)
        .then((response) => {
          // Don't cache non-successful responses
          if (!response.ok) {
            return response
          }

          const responseClone = response.clone()
          caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
            cache.put(request, responseClone).catch((error) => {
              console.warn("[SW] Failed to cache asset:", error)
            })
          })
          return response
        })
        .catch(() => {
          // For non-navigation requests, just fail silently
          return new Response("Network error", { status: 408 })
        })
    }),
  )
})

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("[SW] Background sync triggered:", event.tag)

  if (event.tag === "sync-leads") {
    event.waitUntil(syncLeads())
  }
})

// Push notification handler
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received")

  const options = {
    body: "You have new updates in your CRM",
    icon: "/icons/icon-192x192.jpg",
    badge: "/icons/icon-72x72.jpg",
    vibrate: [200, 100, 200],
    data: {
      url: "/",
    },
    actions: [
      {
        action: "open",
        title: "Open App",
      },
      {
        action: "close",
        title: "Close",
      },
    ],
  }

  if (event.data) {
    try {
      const data = event.data.json()
      options.body = data.body || options.body
      options.data.url = data.url || options.data.url
    } catch (error) {
      console.warn("[SW] Failed to parse push data:", error)
    }
  }

  event.waitUntil(
    self.registration.showNotification("Bankscart CRM", options).catch((error) => {
      console.error("[SW] Failed to show notification:", error)
    })
  )
})

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked")

  event.notification.close()

  if (event.action === "close") {
    return
  }

  const url = event.notification.data?.url || "/"

  event.waitUntil(
    clients.matchAll({ type: "window" }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) {
          return client.focus()
        }
      }

      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    }),
  )
})

// Helper function to fetch and update cache in background
function fetchAndUpdateCache(request) {
  fetch(request)
    .then((response) => {
      if (response.ok) {
        const responseClone = response.clone()
        caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
          cache.put(request, responseClone).catch((error) => {
            console.warn("[SW] Background cache update failed:", error)
          })
        })
      }
    })
    .catch((error) => {
      console.warn("[SW] Background fetch failed:", error)
    })
}

// Helper function to sync leads when back online
async function syncLeads() {
  try {
    console.log("[SW] Starting lead sync...")
    
    // Get pending leads from IndexedDB
    const pendingLeads = await getPendingLeads()
    console.log(`[SW] Found ${pendingLeads.length} leads to sync`)

    for (const lead of pendingLeads) {
      try {
        const response = await fetch("/api/leads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(lead.data),
        })

        if (response.ok) {
          // Remove from pending queue
          await removePendingLead(lead.id)
          console.log("[SW] Lead synced successfully:", lead.id)
        } else {
          console.warn("[SW] Lead sync failed with status:", response.status)
        }
      } catch (error) {
        console.error("[SW] Failed to sync lead:", error)
      }
    }
  } catch (error) {
    console.error("[SW] Background sync failed:", error)
  }
}

// Clear potentially corrupted IndexedDB data
async function clearCorruptedIndexedDB() {
  try {
    if (indexedDB.databases) {
      const databases = await indexedDB.databases()
      for (const db of databases) {
        if (db.name.includes('bankscart') || db.name.includes('workbox')) {
          console.log("[SW] Deleting potentially corrupted database:", db.name)
          await indexedDB.deleteDatabase(db.name)
        }
      }
    }
  } catch (error) {
    console.warn("[SW] Could not clear IndexedDB:", error)
  }
}

// IndexedDB helpers with better error handling
async function getPendingLeads() {
  try {
    // Implementation would use IndexedDB to get pending leads
    // Add proper error handling for IndexedDB operations
    return []
  } catch (error) {
    console.error("[SW] Failed to get pending leads:", error)
    // Clear corrupted data and return empty array
    await clearCorruptedIndexedDB()
    return []
  }
}

async function removePendingLead(id) {
  try {
    // Implementation would remove lead from IndexedDB
    console.log("[SW] Removing pending lead:", id)
  } catch (error) {
    console.error("[SW] Failed to remove pending lead:", error)
    await clearCorruptedIndexedDB()
  }
}

// Handle service worker errors
self.addEventListener("error", (event) => {
  console.error("[SW] Error:", event.error)
})

self.addEventListener("unhandledrejection", (event) => {
  console.error("[SW] Unhandled rejection:", event.reason)
})
