// ============================================================
// APP CONTEXT WITH SUPABASE
// ============================================================
// Пример обновленного AppContext.tsx для работы с Supabase
// Замените ваш текущий AppContext.tsx на этот файл
// ============================================================

import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, auth, db, storage, realtime, User as DBUser } from '../lib/supabase';
import type { User, Skill, UserSkill, Test, TestAttempt } from '../types';

interface AppState {
  currentUser: DBUser | null;
  users: DBUser[];
  skills: Skill[];
  userSkills: UserSkill[];
  tests: Test[];
  testAttempts: TestAttempt[];
  loading: boolean;
  error: string | null;
}

interface AppContextType {
  state: AppState;

  // Auth
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  // Users
  loadUsers: () => Promise<void>;
  updateUser: (userId: string, data: Partial<DBUser>) => Promise<void>;

  // Skills
  loadSkills: () => Promise<void>;
  loadUserSkills: (userId: string) => Promise<void>;
  updateUserSkillStatus: (userSkillId: string, status: string) => Promise<void>;
  confirmSkillPractice: (userSkillId: string, checkerId: string) => Promise<void>;

  // Tests
  loadTests: () => Promise<void>;
  submitTest: (testId: string, score: number, passed: boolean, answers?: any) => Promise<void>;

  // Storage
  uploadFile: (bucket: string, file: File) => Promise<string | null>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    users: [],
    skills: [],
    userSkills: [],
    tests: [],
    testAttempts: [],
    loading: true,
    error: null
  });

  // ============================================================
  // INITIALIZATION
  // ============================================================

  useEffect(() => {
    // Load initial session
    loadSession();

    // Listen to auth changes
    const { data: { subscription } } = auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);

      if (session?.user) {
        await loadUserProfile(session.user.id);
      } else {
        setState(prev => ({ ...prev, currentUser: null }));
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Load session on mount
  const loadSession = async () => {
    try {
      const { session } = await auth.getSession();

      if (session?.user) {
        await loadUserProfile(session.user.id);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  // Load user profile from database
  const loadUserProfile = async (userId: string) => {
    const { data, error } = await db.users.getById(userId);

    if (data) {
      setState(prev => ({ ...prev, currentUser: data }));

      // Load related data
      await loadSkills();
      await loadUserSkills(userId);
      await loadTests();
    } else if (error) {
      console.error('Error loading profile:', error);
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  // ============================================================
  // AUTHENTICATION
  // ============================================================

  const login = async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const { data, error } = await auth.signIn(email, password);

      if (error) throw error;

      if (data.user) {
        await loadUserProfile(data.user.id);
      }
    } catch (error: any) {
      console.error('Login error:', error);
      setState(prev => ({ ...prev, error: error.message }));
      throw error;
    } finally {
      setState(prev => ({ ...prev, loading: false }));
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
      setState({
        currentUser: null,
        users: [],
        skills: [],
        userSkills: [],
        tests: [],
        testAttempts: [],
        loading: false,
        error: null
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      setState(prev => ({ ...prev, error: error.message }));
    }
  };

  // ============================================================
  // USERS
  // ============================================================

  const loadUsers = async () => {
    try {
      const { data, error } = await db.users.getAll();

      if (data) {
        setState(prev => ({ ...prev, users: data }));
      } else if (error) {
        console.error('Error loading users:', error);
      }
    } catch (error: any) {
      console.error('Error loading users:', error);
    }
  };

  const updateUser = async (userId: string, updates: Partial<DBUser>) => {
    try {
      const { data, error } = await db.users.update(userId, updates);

      if (data) {
        setState(prev => ({
          ...prev,
          users: prev.users.map(u => u.id === userId ? data : u),
          currentUser: prev.currentUser?.id === userId ? data : prev.currentUser
        }));
      } else if (error) {
        console.error('Error updating user:', error);
      }
    } catch (error: any) {
      console.error('Error updating user:', error);
    }
  };

  // ============================================================
  // SKILLS
  // ============================================================

  const loadSkills = async () => {
    try {
      const { data, error } = await db.skills.getAll();

      if (data) {
        setState(prev => ({ ...prev, skills: data }));
      } else if (error) {
        console.error('Error loading skills:', error);
      }
    } catch (error: any) {
      console.error('Error loading skills:', error);
    }
  };

  const loadUserSkills = async (userId: string) => {
    try {
      const { data, error } = await db.userSkills.getByUserId(userId);

      if (data) {
        setState(prev => ({ ...prev, userSkills: data }));
      } else if (error) {
        console.error('Error loading user skills:', error);
      }
    } catch (error: any) {
      console.error('Error loading user skills:', error);
    }
  };

  const updateUserSkillStatus = async (userSkillId: string, status: string) => {
    try {
      const { data, error } = await db.userSkills.updateStatus(userSkillId, status as any);

      if (data) {
        setState(prev => ({
          ...prev,
          userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us)
        }));
      } else if (error) {
        console.error('Error updating skill status:', error);
      }
    } catch (error: any) {
      console.error('Error updating skill status:', error);
    }
  };

  const confirmSkillPractice = async (userSkillId: string, checkerId: string) => {
    try {
      const { data, error } = await db.userSkills.confirm(userSkillId, checkerId);

      if (data) {
        setState(prev => ({
          ...prev,
          userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us)
        }));
      } else if (error) {
        console.error('Error confirming skill:', error);
      }
    } catch (error: any) {
      console.error('Error confirming skill:', error);
    }
  };

  // ============================================================
  // TESTS
  // ============================================================

  const loadTests = async () => {
    try {
      const { data, error } = await db.tests.getAll();

      if (data) {
        setState(prev => ({ ...prev, tests: data }));
      } else if (error) {
        console.error('Error loading tests:', error);
      }
    } catch (error: any) {
      console.error('Error loading tests:', error);
    }
  };

  const submitTest = async (testId: string, score: number, passed: boolean, answers?: any) => {
    if (!state.currentUser) return;

    try {
      const { data, error } = await db.testAttempts.create({
        user_id: state.currentUser.id,
        test_id: testId,
        score,
        passed,
        answers
      });

      if (data) {
        setState(prev => ({
          ...prev,
          testAttempts: [...prev.testAttempts, data]
        }));

        // If passed, update user skill status
        if (passed) {
          // Find related skill and update
          const test = state.tests.find(t => t.id === testId);
          if (test?.skill_ids?.length) {
            for (const skillId of test.skill_ids) {
              // Check if user skill exists
              const existingSkill = state.userSkills.find(
                us => us.user_id === state.currentUser?.id && us.skill_id === skillId
              );

              if (existingSkill) {
                await updateUserSkillStatus(existingSkill.id, 'theory_passed');
              } else {
                // Create new user skill
                const { data: newSkill } = await db.userSkills.create({
                  user_id: state.currentUser!.id,
                  skill_id: skillId,
                  status: 'theory_passed',
                  theory_score: score
                });

                if (newSkill) {
                  setState(prev => ({
                    ...prev,
                    userSkills: [...prev.userSkills, newSkill]
                  }));
                }
              }
            }
          }
        }
      } else if (error) {
        console.error('Error submitting test:', error);
      }
    } catch (error: any) {
      console.error('Error submitting test:', error);
    }
  };

  // ============================================================
  // STORAGE
  // ============================================================

  const uploadFile = async (bucket: string, file: File): Promise<string | null> => {
    if (!state.currentUser) return null;

    try {
      // Generate unique file path
      const timestamp = Date.now();
      const extension = file.name.split('.').pop();
      const filePath = `${state.currentUser.id}/${timestamp}.${extension}`;

      // Upload file
      const { data, error } = await storage.upload(bucket, filePath, file);

      if (error) {
        console.error('Upload error:', error);
        return null;
      }

      // Get public URL
      const publicUrl = storage.getPublicUrl(bucket, filePath);
      return publicUrl;
    } catch (error: any) {
      console.error('Error uploading file:', error);
      return null;
    }
  };

  // ============================================================
  // REALTIME SUBSCRIPTIONS (OPTIONAL)
  // ============================================================

  useEffect(() => {
    if (!state.currentUser) return;

    // Subscribe to user skills changes
    const userSkillsChannel = realtime.subscribe('user_skills', (payload) => {
      console.log('User skills changed:', payload);

      if (payload.eventType === 'INSERT') {
        setState(prev => ({
          ...prev,
          userSkills: [...prev.userSkills, payload.new]
        }));
      } else if (payload.eventType === 'UPDATE') {
        setState(prev => ({
          ...prev,
          userSkills: prev.userSkills.map(us =>
            us.id === payload.new.id ? payload.new : us
          )
        }));
      } else if (payload.eventType === 'DELETE') {
        setState(prev => ({
          ...prev,
          userSkills: prev.userSkills.filter(us => us.id !== payload.old.id)
        }));
      }
    });

    // Subscribe to notifications
    const notificationsChannel = realtime.subscribe('notifications', (payload) => {
      if (payload.eventType === 'INSERT' && payload.new.user_id === state.currentUser?.id) {
        console.log('New notification:', payload.new);
        // You can show a toast or update notifications state
      }
    });

    // Cleanup
    return () => {
      realtime.unsubscribe(userSkillsChannel);
      realtime.unsubscribe(notificationsChannel);
    };
  }, [state.currentUser]);

  // ============================================================
  // CONTEXT PROVIDER
  // ============================================================

  const contextValue: AppContextType = {
    state,
    login,
    logout,
    loadUsers,
    updateUser,
    loadSkills,
    loadUserSkills,
    updateUserSkillStatus,
    confirmSkillPractice,
    loadTests,
    submitTest,
    uploadFile
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};

// ============================================================
// USAGE EXAMPLES
// ============================================================

/*

// In Login.tsx
const { login } = useAppContext();

const handleLogin = async (email: string, password: string) => {
  try {
    await login(email, password);
    navigate('/dashboard');
  } catch (error) {
    console.error('Login failed:', error);
  }
};

// In EmployeesPage.tsx
const { state, loadUsers, updateUser } = useAppContext();

useEffect(() => {
  loadUsers();
}, []);

const handleUpdateUser = async (userId: string, data: any) => {
  await updateUser(userId, data);
};

// In TestPage.tsx
const { submitTest } = useAppContext();

const handleSubmitTest = async (testId: string, answers: any) => {
  const score = calculateScore(answers);
  const passed = score >= 80;

  await submitTest(testId, score, passed, answers);
};

// In DocumentUpload.tsx
const { uploadFile } = useAppContext();

const handleFileUpload = async (file: File) => {
  const url = await uploadFile('documents', file);

  if (url) {
    console.log('File uploaded:', url);
    // Save URL to user_skills table
  }
};

*/
