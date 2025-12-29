// ============================================================
// SUPABASE CLIENT CONFIGURATION
// ============================================================

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

// ============================================================
// TYPE DEFINITIONS
// ============================================================

export type UserRole = 'admin' | 'hr' | 'brigadir' | 'employee' | 'candidate' | 'coordinator'
export type UserStatus = 'invited' | 'started' | 'tests_in_progress' | 'tests_completed' |
  'interested' | 'not_interested' | 'rejected' | 'offer_sent' | 'data_requested' |
  'data_submitted' | 'portal_blocked' | 'trial' | 'active' | 'inactive'

export type SkillStatus = 'locked' | 'pending' | 'theory_passed' | 'practice_pending' |
  'confirmed' | 'failed' | 'suspended'

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  role: UserRole
  status: UserStatus
  base_rate: number
  contract_type?: 'uop' | 'uz' | 'b2b'
  is_student?: boolean
  phone?: string
  hired_date?: string
  trial_end_date?: string
  assigned_brigadir_id?: string
  referred_by_id?: string
  created_at: string
  updated_at: string
}

export interface Skill {
  id: string
  name_pl: string
  category: string
  description_pl?: string
  verification_type: 'theory_only' | 'theory_practice' | 'document'
  hourly_bonus: number
  required_pass_rate: number
  is_active: boolean
  is_archived: boolean
}

export interface UserSkill {
  id: string
  user_id: string
  skill_id: string
  status: SkillStatus
  theory_score?: number
  practice_checked_by?: string
  confirmed_at?: string
  effective_from?: string
  created_at: string
  updated_at: string
}

export interface Test {
  id: string
  skill_ids: string[]
  title: string
  time_limit_minutes: number
  is_active: boolean
}

export interface TestAttempt {
  id: string
  user_id: string
  test_id: string
  score: number
  passed: boolean
  duration_seconds?: number
  completed_at: string
}

// ============================================================
// AUTHENTICATION HELPERS
// ============================================================

export const auth = {
  // Sign up new user
  signUp: async (email: string, password: string, userData: {
    first_name: string
    last_name: string
    role?: UserRole
  }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { data, error }
  },

  // Sign in
  signIn: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  // Sign out
  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  // Get current session
  getSession: async () => {
    const { data: { session }, error } = await supabase.auth.getSession()
    return { session, error }
  },

  // Get current user
  getUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // Listen to auth changes
  onAuthStateChange: (callback: (event: string, session: any) => void) => {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// ============================================================
// DATABASE HELPERS
// ============================================================

export const db = {
  // ==================== USERS ====================

  users: {
    // Get all users (with optional filters)
    getAll: async (filters?: { role?: UserRole; status?: UserStatus; search?: string }) => {
      let query = supabase
        .from('users')
        .select('*')
        .order('last_name')

      if (filters?.role) {
        query = query.eq('role', filters.role)
      }
      if (filters?.status) {
        query = query.eq('status', filters.status)
      }
      if (filters?.search) {
        query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`)
      }

      const { data, error } = await query
      return { data, error }
    },

    // Get user by ID
    getById: async (id: string) => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .single()
      return { data, error }
    },

    // Get current user profile
    getCurrentProfile: async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return { data: null, error: new Error('Not authenticated') }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
      return { data, error }
    },

    // Update user
    update: async (id: string, updates: Partial<User>) => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    // Create user (requires auth admin)
    create: async (userData: Partial<User>) => {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single()
      return { data, error }
    }
  },

  // ==================== SKILLS ====================

  skills: {
    // Get all active skills
    getAll: async () => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('is_archived', false)
        .eq('is_active', true)
        .order('category')
      return { data, error }
    },

    // Get skill by ID
    getById: async (id: string) => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('id', id)
        .single()
      return { data, error }
    },

    // Get skills by category
    getByCategory: async (category: string) => {
      const { data, error } = await supabase
        .from('skills')
        .select('*')
        .eq('category', category)
        .eq('is_archived', false)
        .order('name_pl')
      return { data, error }
    },

    // Create skill (HR/Admin only)
    create: async (skillData: Omit<Skill, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('skills')
        .insert([skillData])
        .select()
        .single()
      return { data, error }
    },

    // Update skill
    update: async (id: string, updates: Partial<Skill>) => {
      const { data, error } = await supabase
        .from('skills')
        .update(updates)
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    }
  },

  // ==================== USER SKILLS ====================

  userSkills: {
    // Get user's skills
    getByUserId: async (userId: string) => {
      const { data, error } = await supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills(*)
        `)
        .eq('user_id', userId)
        .eq('is_archived', false)
        .order('created_at', { ascending: false })
      return { data, error }
    },

    // Get specific user skill
    getById: async (id: string) => {
      const { data, error } = await supabase
        .from('user_skills')
        .select(`
          *,
          skill:skills(*),
          user:users(first_name, last_name, email)
        `)
        .eq('id', id)
        .single()
      return { data, error }
    },

    // Create user skill
    create: async (userSkillData: Omit<UserSkill, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('user_skills')
        .insert([userSkillData])
        .select()
        .single()
      return { data, error }
    },

    // Update user skill status
    updateStatus: async (id: string, status: SkillStatus, additionalData?: Partial<UserSkill>) => {
      const { data, error } = await supabase
        .from('user_skills')
        .update({ status, ...additionalData })
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    // Update checklist progress
    updateChecklistProgress: async (id: string, progress: any) => {
      const { data, error } = await supabase
        .from('user_skills')
        .update({ checklist_progress: progress })
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    },

    // Confirm skill (by brigadir)
    confirm: async (id: string, checkerId: string) => {
      const { data, error } = await supabase
        .from('user_skills')
        .update({
          status: 'confirmed',
          practice_checked_by: checkerId,
          practice_date: new Date().toISOString(),
          confirmed_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    }
  },

  // ==================== TESTS ====================

  tests: {
    // Get all active tests
    getAll: async () => {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .eq('is_active', true)
        .eq('is_archived', false)
        .order('title')
      return { data, error }
    },

    // Get test with questions
    getWithQuestions: async (testId: string) => {
      const { data, error } = await supabase
        .from('tests')
        .select(`
          *,
          questions(*)
        `)
        .eq('id', testId)
        .single()

      // Sort questions by order
      if (data?.questions) {
        data.questions.sort((a: any, b: any) => a.question_order - b.question_order)
      }

      return { data, error }
    },

    // Get tests for skill
    getBySkillId: async (skillId: string) => {
      const { data, error } = await supabase
        .from('tests')
        .select('*')
        .contains('skill_ids', [skillId])
        .eq('is_active', true)
      return { data, error }
    }
  },

  // ==================== TEST ATTEMPTS ====================

  testAttempts: {
    // Get user's test attempts
    getByUserId: async (userId: string) => {
      const { data, error } = await supabase
        .from('test_attempts')
        .select(`
          *,
          test:tests(*)
        `)
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
      return { data, error }
    },

    // Create test attempt
    create: async (attemptData: {
      user_id: string
      test_id: string
      score: number
      passed: boolean
      duration_seconds?: number
      answers?: any
    }) => {
      const { data, error } = await supabase
        .from('test_attempts')
        .insert([{
          ...attemptData,
          completed_at: new Date().toISOString()
        }])
        .select()
        .single()
      return { data, error }
    },

    // Get test attempt by ID
    getById: async (id: string) => {
      const { data, error } = await supabase
        .from('test_attempts')
        .select(`
          *,
          test:tests(*),
          user:users(first_name, last_name)
        `)
        .eq('id', id)
        .single()
      return { data, error }
    }
  },

  // ==================== LIBRARY ====================

  library: {
    // Get all resources
    getAll: async (filters?: { type?: string; category?: string }) => {
      let query = supabase
        .from('library_resources')
        .select('*')
        .eq('is_archived', false)
        .order('title')

      if (filters?.type) {
        query = query.eq('type', filters.type)
      }
      if (filters?.category) {
        query = query.contains('categories', [filters.category])
      }

      const { data, error } = await query
      return { data, error }
    },

    // Get resources for skill
    getBySkillId: async (skillId: string) => {
      const { data, error } = await supabase
        .from('library_resources')
        .select('*')
        .contains('skill_ids', [skillId])
        .eq('is_archived', false)
      return { data, error }
    }
  },

  // ==================== NOTIFICATIONS ====================

  notifications: {
    // Get user's notifications
    getByUserId: async (userId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
      return { data, error }
    },

    // Get unread count
    getUnreadCount: async (userId: string) => {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      return { count, error }
    },

    // Mark as read
    markAsRead: async (id: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
      return { data, error }
    },

    // Mark all as read
    markAllAsRead: async (userId: string) => {
      const { data, error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false)
      return { data, error }
    }
  },

  // ==================== QUALITY INCIDENTS ====================

  qualityIncidents: {
    // Get incidents for user/skill
    getByUserId: async (userId: string) => {
      const { data, error } = await supabase
        .from('quality_incidents')
        .select(`
          *,
          skill:skills(name_pl)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      return { data, error }
    },

    // Create incident
    create: async (incidentData: {
      user_id: string
      skill_id: string
      incident_number: number
      description: string
      reported_by: string
      image_url?: string
    }) => {
      const { data, error } = await supabase
        .from('quality_incidents')
        .insert([incidentData])
        .select()
        .single()
      return { data, error }
    }
  }
}

// ============================================================
// STORAGE HELPERS
// ============================================================

export const storage = {
  // Upload file
  upload: async (bucket: string, path: string, file: File) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })
    return { data, error }
  },

  // Get public URL
  getPublicUrl: (bucket: string, path: string) => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    return data.publicUrl
  },

  // Download file
  download: async (bucket: string, path: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path)
    return { data, error }
  },

  // Delete file
  remove: async (bucket: string, paths: string[]) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths)
    return { data, error }
  },

  // List files
  list: async (bucket: string, folder?: string) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder)
    return { data, error }
  }
}

// ============================================================
// REALTIME HELPERS
// ============================================================

export const realtime = {
  // Subscribe to table changes
  subscribe: (table: string, callback: (payload: any) => void) => {
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        callback
      )
      .subscribe()

    return channel
  },

  // Unsubscribe
  unsubscribe: (channel: any) => {
    supabase.removeChannel(channel)
  }
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

export const utils = {
  // Generate file path for storage
  generateFilePath: (userId: string, fileName: string) => {
    const timestamp = Date.now()
    const extension = fileName.split('.').pop()
    return `${userId}/${timestamp}.${extension}`
  },

  // Check if user has role
  hasRole: (user: User | null, roles: UserRole[]) => {
    if (!user) return false
    return roles.includes(user.role)
  },

  // Format date
  formatDate: (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL')
  }
}
