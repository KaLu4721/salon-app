import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://btzlsqftqcoqagrimbnl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0emxzcWZ0cWNvcWFncmltYm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTk0MTAsImV4cCI6MjEwMDI5NTQxMH0.QDmlakSW9OX22Yr2NjSu65Cqpo2UoyMb6bretSoglys'

// On web, Expo Router server-renders pages in Node before hydration, where
// `window`/`localStorage` don't exist yet. AsyncStorage's web implementation
// relies on them, so it would crash the server render. Fall back to a no-op
// storage outside the browser; the real AsyncStorage takes over on hydration.
const isServer = typeof window === 'undefined'
const noopStorage = {
  getItem: async () => null,
  setItem: async () => {},
  removeItem: async () => {},
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: isServer ? noopStorage : AsyncStorage,
    autoRefreshToken: !isServer,
    persistSession: !isServer,
    detectSessionInUrl: false,
  },
})