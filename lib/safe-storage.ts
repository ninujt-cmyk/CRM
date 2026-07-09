// lib/safe-storage.ts
/**
 * A safe, error-resilient wrapper around localStorage and sessionStorage
 * that falls back to an in-memory Map when browser storage is blocked
 * (e.g. SecurityError in embedded WebViews, Incognito mode, or restricted iframes).
 */

class MemoryStorage implements Storage {
  private store = new Map<string, string>()

  get length(): number {
    return this.store.size
  }

  clear(): void {
    this.store.clear()
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null
  }

  key(index: number): string | null {
    const keys = Array.from(this.store.keys())
    return keys[index] ?? null
  }

  removeItem(key: string): void {
    this.store.delete(key)
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value))
  }
}

function createSafeStorage(type: "localStorage" | "sessionStorage"): Storage {
  const memoryFallback = new MemoryStorage()

  if (typeof window === "undefined") {
    return memoryFallback
  }

  try {
    const storage = window[type]
    const testKey = "__safe_storage_test__"
    storage.setItem(testKey, testKey)
    storage.removeItem(testKey)
    return storage
  } catch (e) {
    // SecurityError or QuotaExceededError - return memory storage
    return memoryFallback
  }
}

export const safeLocalStorage = createSafeStorage("localStorage")
export const safeSessionStorage = createSafeStorage("sessionStorage")

/**
 * Safely get an item from storage without throwing SecurityError
 */
export function safeGetItem(storage: "localStorage" | "sessionStorage", key: string, defaultValue: string | null = null): string | null {
  try {
    if (typeof window === "undefined") return defaultValue
    return (storage === "localStorage" ? safeLocalStorage : safeSessionStorage).getItem(key) ?? defaultValue
  } catch {
    return defaultValue
  }
}

/**
 * Safely set an item in storage without throwing SecurityError
 */
export function safeSetItem(storage: "localStorage" | "sessionStorage", key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false
    ;(storage === "localStorage" ? safeLocalStorage : safeSessionStorage).setItem(key, value)
    return true
  } catch {
    return false
  }
}

/**
 * Safely remove an item from storage without throwing SecurityError
 */
export function safeRemoveItem(storage: "localStorage" | "sessionStorage", key: string): boolean {
  try {
    if (typeof window === "undefined") return false
    ;(storage === "localStorage" ? safeLocalStorage : safeSessionStorage).removeItem(key)
    return true
  } catch {
    return false
  }
}
