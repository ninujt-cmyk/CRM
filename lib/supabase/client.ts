import { createBrowserClient } from "@supabase/ssr"
import { safeLocalStorage } from "@/lib/safe-storage"

const makeMockQuery = () => {
  const query: any = {
    then: (resolve: any) => resolve({ data: null, error: null }),
  };
  const proxy: any = new Proxy(() => {}, {
    get: (target, prop) => {
      if (prop === "then") return query.then;
      return () => proxy;
    },
    apply: () => proxy,
  });
  return proxy;
};

let clientInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn("Supabase environment variables are not set. Returning mock client.")
    // Return a mock client for development
    return {
      auth: {
        getUser: () => Promise.resolve({ data: { user: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
        signOut: () => Promise.resolve({ error: null }),
      },
      from: () => makeMockQuery(),
    } as any
  }

  const clientOptions = {
    auth: {
      storage: safeLocalStorage,
    },
  }

  // Only use the singleton client on the client-side (browser)
  if (typeof window === "undefined") {
    return createBrowserClient(supabaseUrl, supabaseAnonKey, clientOptions)
  }

  if (!clientInstance) {
    clientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, clientOptions)
  }

  return clientInstance
}