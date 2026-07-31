import 'react-native-url-polyfill/auto'
import 'expo-sqlite/localStorage/install'
import { createClient, processLock } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

export const supabaseConfigError =
  !supabaseUrl || !supabaseAnonKey ? 'Missing Expo public Supabase environment variables.' : ''

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        lock: processLock,
      },
    })
