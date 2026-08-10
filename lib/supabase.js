import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://btzlsqftqcoqagrimbnl.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0emxzcWZ0cWNvcWFncmltYm5sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3MTk0MTAsImV4cCI6MjEwMDI5NTQxMH0.QDmlakSW9OX22Yr2NjSu65Cqpo2UoyMb6bretSoglys'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})