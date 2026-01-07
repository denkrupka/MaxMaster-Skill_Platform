import { createClient } from '@supabase/supabase-js'

// Hardcoded for compatibility as requested
const supabaseUrl = 'https://diytvuczpciikzdhldny.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpeXR2dWN6cGNpaWt6ZGhsZG55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcwMTcwOTMsImV4cCI6MjA4MjU5MzA5M30.8dd75VEY_6VbHWmpbDv4nyzlpyMU0XGAtq6cxBfSbQY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ============================================================
// AUTH HELPERS
// ============================================================

export const authHelpers = {
  // Login with Email/Password
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) throw error
    
    // Fetch profile
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .maybeSingle()
    
    return { user: data.user, profile }
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  // Get current session profile
  async getCurrentUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()
    
    return profile
  },

  onAuthStateChange(callback: (user: any) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null)
    })
  }
}

// ============================================================
// DATABASE HELPERS
// ============================================================

export const db = {
  users: {
    async getAll() {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data || []
    },
    async getById(id: string) {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle()
      if (error) throw error
      return data
    },
    async update(id: string, updates: any) {
      const { data, error } = await supabase.from('users').update(updates).eq('id', id).select().maybeSingle()
      if (error) throw error
      return data
    },
    async insert(userData: any) {
      const { data, error } = await supabase.from('users').insert([userData]).select().maybeSingle()
      if (error) throw error
      return data
    }
  }
}

// ============================================================
// STORAGE HELPERS
// ============================================================

export const uploadDocument = async (file: File, userId: string) => {
  const fileExt = file.name.split('.').pop()
  const fileName = `${userId}/${Date.now()}.${fileExt}`

  const { data, error } = await supabase.storage
    .from('documents')
    .upload(fileName, file)

  if (error) {
    console.error('Upload error:', error)
    return null
  }

  const { data: { publicUrl } } = supabase.storage
    .from('documents')
    .getPublicUrl(fileName)

  return publicUrl
}
