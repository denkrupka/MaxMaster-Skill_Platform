
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, Role, Skill, UserSkill, Test, TestAttempt, LibraryResource, 
  CandidateHistoryEntry, AppNotification, NotificationSetting, SystemConfig, 
  UserStatus, SkillStatus, VerificationType, MonthlyBonus, ContractType, QualityIncident, EmployeeNote, NoteCategory, NoteSeverity, EmployeeBadge, BadgeType, ChecklistItemState, Position
} from '../types';
import { 
  TERMINATION_REASONS, BONUS_DOCUMENT_TYPES
} from '../constants';
import { supabase, authHelpers, db, uploadDocument as supabaseUpload } from '../lib/supabase';

// Interface for State
interface AppState {
  currentUser: User | null;
  users: User[];
  skills: Skill[];
  userSkills: UserSkill[];
  tests: Test[];
  testAttempts: TestAttempt[];
  libraryResources: LibraryResource[];
  candidateHistory: CandidateHistoryEntry[];
  appNotifications: AppNotification[];
  systemConfig: SystemConfig;
  positions: Position[];
  monthlyBonuses: Record<string, MonthlyBonus>;
  qualityIncidents: QualityIncident[];
  employeeNotes: EmployeeNote[];
  employeeBadges: EmployeeBadge[];
  toast: { title: string; message: string } | null;
  notificationSettings: NotificationSetting[];
  isLoading: boolean;
}

// Interface for Context
interface AppContextType {
  state: AppState;
  login: (email: string, password: string) => Promise<any>;
  loginAsRole: (role: Role) => void;
  loginAsUser: (user: User) => void;
  logout: () => void;
  getUsers: () => Promise<void>;
  addUser: (user: Partial<User>) => Promise<User>;
  updateUser: (userId: string, data: Partial<User>) => Promise<User>;
  deleteUser: (userId: string) => void;
  uploadDocument: (file: File, userId: string) => Promise<string | null>;
  addCandidate: (user: Partial<User>) => Promise<User>;
  logCandidateAction: (candidateId: string, action: string) => Promise<void>;
  startTest: (skillId: string) => void;
  getSkills: () => Promise<Skill[]>;
  submitTest: (testId: string, answers: any, score: number, passed: boolean) => Promise<TestAttempt>;
  resetTestAttempt: (attemptId: string) => void;
  addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
  updateSkill: (skillId: string, data: Partial<Skill>) => Promise<void>;
  deleteSkill: (skillId: string) => Promise<void>;
  addTest: (test: Omit<Test, 'id'>) => Promise<void>;
  updateTest: (testId: string, data: Partial<Test>) => Promise<void>;
  addLibraryResource: (resource: Omit<LibraryResource, 'id'>) => Promise<void>;
  updateLibraryResource: (resourceId: string, data: Partial<LibraryResource>) => Promise<void>;
  deleteLibraryResource: (resourceId: string) => Promise<void>;
  addCandidateDocument: (userId: string, doc: Partial<UserSkill>) => Promise<void>;
  updateCandidateDocumentDetails: (docId: string, data: Partial<UserSkill>) => Promise<void>;
  archiveCandidateDocument: (docId: string) => Promise<void>;
  restoreCandidateDocument: (docId: string) => Promise<void>;
  updateUserSkillStatus: (userSkillId: string, status: SkillStatus, rejectionReason?: string) => Promise<void>;
  moveCandidateToTrial: (candidateId: string, brigadirId: string, startDate: string, endDate: string, rate: number) => Promise<void>;
  hireCandidate: (candidateId: string, hiredDate?: string, contractEndDate?: string) => Promise<void>;
  assignBrigadir: (userId: string, brigadirId: string) => void;
  resetSkillProgress: (userId: string, skillId: string, mode: 'theory'|'practice'|'both') => void;
  
  // Positions
  addPosition: (pos: Omit<Position, 'id' | 'order'>) => void;
  updatePosition: (id: string, data: Partial<Position>) => void;
  deletePosition: (id: string) => void;
  reorderPositions: (newPositions: Position[]) => void;

  // Verification / Practice
  confirmSkillPractice: (userSkillId: string, checkerId: string) => void;
  saveSkillChecklistProgress: (userSkillId: string, progress: Record<number, ChecklistItemState>) => void;
  updateVerificationDetails: (userSkillId: string, data: Partial<UserSkill>) => void;
  
  addQualityIncident: (incident: Omit<QualityIncident, 'id'>) => Promise<void>;

  // Employee Notes
  addEmployeeNote: (note: Omit<EmployeeNote, 'id' | 'created_at'>) => Promise<void>;
  deleteEmployeeNote: (id: string) => Promise<void>;

  // Employee Badges
  addEmployeeBadge: (badge: Omit<EmployeeBadge, 'id' | 'created_at'>) => Promise<void>;
  deleteEmployeeBadge: (id: string) => Promise<void>;

  // Referral System
  inviteFriend: (firstName: string, lastName: string, phone: string, targetPosition: string) => void;
  payReferralBonus: (referralUserId: string) => void;

  updateSystemConfig: (config: SystemConfig) => void;
  updateNotificationSettings: (settings: NotificationSetting[]) => void;
  triggerNotification: (type: string, title: string, message: string, link?: string) => void;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearToast: () => void;
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
    libraryResources: [],
    candidateHistory: [],
    appNotifications: [],
    systemConfig: {
      baseRate: 24.0,
      contractBonuses: { [ContractType.UOP]: 0, [ContractType.UZ]: 1, [ContractType.B2B]: 7 },
      studentBonus: 3.0,
      bonusDocumentTypes: BONUS_DOCUMENT_TYPES,
      bonusPermissionTypes: [
          { id: 'sep_e', label: 'SEP E z pomiarami', bonus: 0.5 },
          { id: 'sep_d', label: 'SEP D z pomiarami', bonus: 0.5 },
          { id: 'udt_pod', label: 'UDT - Podnośniki (IP)', bonus: 1.0 },
      ],
      terminationReasons: TERMINATION_REASONS,
      positions: ['Pomocnik', 'Elektromonter', 'Elektryk', 'Brygadzista', 'Kierownik Robót']
    },
    positions: [],
    monthlyBonuses: {},
    qualityIncidents: [],
    employeeNotes: [],
    employeeBadges: [],
    toast: null,
    notificationSettings: [
      { id: 'status_change', label: 'Zmiana statusu', system: true, email: true, sms: false },
      { id: 'test_passed', label: 'Zaliczony test', system: true, email: false, sms: false },
      { id: 'doc_uploaded', label: 'Nowy dokument', system: true, email: true, sms: false },
      { id: 'candidate_link', label: 'Wysłanie linku', system: false, email: true, sms: true },
      { id: 'trial_ending', label: 'Koniec okresu próbnego', system: true, email: true, sms: false },
      { id: 'termination', label: 'Zwolnienie pracownika', system: true, email: true, sms: false }
    ],
    isLoading: true
  });

  const fetchInitialData = async () => {
    try {
      const [
        { data: users },
        { data: skills },
        { data: userSkills },
        { data: tests },
        { data: testAttempts },
        { data: resources },
        { data: history },
        { data: incidents },
        { data: notes },
        { data: badges },
        { data: positions }
      ] = await Promise.all([
        supabase.from('users').select('*'),
        supabase.from('skills').select('*').eq('is_archived', false),
        supabase.from('user_skills').select('*').eq('is_archived', false),
        supabase.from('tests').select('*').eq('is_archived', false),
        supabase.from('test_attempts').select('*'),
        supabase.from('library_resources').select('*').eq('is_archived', false),
        supabase.from('candidate_history').select('*').order('created_at', { ascending: false }),
        supabase.from('quality_incidents').select('*'),
        supabase.from('employee_notes').select('*'),
        supabase.from('employee_badges').select('*'),
        supabase.from('positions').select('*')
      ]);

      setState(prev => ({
        ...prev,
        users: users || [],
        skills: skills || [],
        userSkills: userSkills || [],
        tests: tests || [],
        testAttempts: testAttempts || [],
        libraryResources: resources || [],
        candidateHistory: history || [],
        qualityIncidents: incidents || [],
        employeeNotes: notes || [],
        employeeBadges: badges || [],
        positions: positions || [],
        isLoading: false
      }));
    } catch (error) {
      console.error('Error fetching initial data:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadUserProfile(session.user.id).then(() => fetchInitialData());
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadUserProfile(session.user.id).then(() => fetchInitialData());
      } else {
        setState(prev => ({ ...prev, currentUser: null, isLoading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const tables = ['users', 'user_skills', 'quality_incidents', 'employee_notes', 'employee_badges', 'test_attempts', 'candidate_history'];
    const channels = tables.map(table => {
      return supabase
        .channel(`public:${table}`)
        .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
          setState(prev => {
            const stateKey = table === 'library_resources' ? 'libraryResources' : 
                             table === 'candidate_history' ? 'candidateHistory' : 
                             table === 'test_attempts' ? 'testAttempts' :
                             table === 'quality_incidents' ? 'qualityIncidents' :
                             table === 'employee_notes' ? 'employeeNotes' :
                             table === 'employee_badges' ? 'employeeBadges' :
                             table === 'user_skills' ? 'userSkills' : table;
            
            let list = [...(prev[stateKey as keyof AppState] as any[])];
            
            if (payload.eventType === 'INSERT') {
              if (!list.find(i => i.id === payload.new.id)) {
                  list = [payload.new, ...list];
              }
            } else if (payload.eventType === 'UPDATE') {
              list = list.map(item => item.id === payload.new.id ? payload.new : item);
            } else if (payload.eventType === 'DELETE') {
              list = list.filter(item => item.id !== payload.old.id);
            }

            const updatedState = { ...prev, [stateKey]: list };
            if (table === 'users' && prev.currentUser?.id === payload.new?.id) {
              updatedState.currentUser = { ...prev.currentUser, ...payload.new };
            }
            return updatedState;
          });
        })
        .subscribe();
    });

    return () => {
      channels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);

  const loadUserProfile = async (userId: string) => {
    const { data } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
    if (data) setState(prev => ({ ...prev, currentUser: data }));
  };

  const triggerNotification = (type: string, title: string, message: string, link?: string) => {
      const setting = state.notificationSettings.find(s => s.id === type);
      if (setting?.system) {
          const newNotif: AppNotification = { id: `notif_${Date.now()}`, title, message, isRead: false, createdAt: new Date().toISOString(), link };
          setState(prev => ({ ...prev, appNotifications: [newNotif, ...prev.appNotifications], toast: { title, message } }));
      }
  };

  const loginAsRole = (role: Role) => {
      const user = state.users.find(u => u.role === role);
      if (user) setState(prev => ({ ...prev, currentUser: user }));
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) await loadUserProfile(data.user.id);
    return data;
  };

  const loginAsUser = (user: User) => setState(prev => ({ ...prev, currentUser: user }));
  
  const logout = async () => {
    await supabase.auth.signOut();
    setState(prev => ({ ...prev, currentUser: null }));
  };

  const getUsers = async () => {
    const { data } = await supabase.from('users').select('*').order('last_name');
    if (data) setState(prev => ({ ...prev, users: data }));
  };

  const addUser = async (userData: Partial<User>) => {
    const { data, error } = await supabase.from('users').insert([{ ...userData, id: crypto.randomUUID() }]).select().single();
    if (error) throw error;
    if (data) setState(prev => ({ ...prev, users: [data, ...prev.users] }));
    return data;
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    const { data, error } = await supabase.from('users').update(updates).eq('id', userId).select().single();
    if (error) throw error;
    if (data) {
        setState(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === userId ? data : u),
            currentUser: prev.currentUser?.id === userId ? data : prev.currentUser
        }));
    }
    return data;
  };

  const deleteUser = async (userId: string) => {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (!error) setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId) }));
  };

  const uploadDocument = async (file: File, userId: string) => {
    return await supabaseUpload(file, userId);
  };

  const addCandidate = async (userData: Partial<User>): Promise<User> => {
      const { data, error } = await supabase.from('users').insert([{ 
          ...userData, 
          id: crypto.randomUUID(),
          role: Role.CANDIDATE, 
          status: UserStatus.STARTED, 
          hired_date: new Date().toISOString() 
      }]).select().single();
      
      if (error) throw error;
      if (data) setState(prev => ({ ...prev, users: [data, ...prev.users] }));
      await logCandidateAction(data.id, 'Dodano kandydata');
      return data;
  };

  const logCandidateAction = async (candidateId: string, action: string) => {
      const performedBy = state.currentUser ? `${state.currentUser.first_name} ${state.currentUser.last_name}` : 'System';
      const newEntry = {
          id: crypto.randomUUID(),
          candidate_id: candidateId,
          created_at: new Date().toISOString(),
          action,
          performed_by: performedBy
      };
      
      const { data, error } = await supabase.from('candidate_history').insert([newEntry]).select().single();
      if (error) {
          console.error("History Log Error:", error);
      } else if (data) {
          setState(prev => ({ ...prev, candidateHistory: [data, ...prev.candidateHistory] }));
      }
  };

  const startTest = (skillId: string) => { 
    if (!state.currentUser) return; 
    logCandidateAction(state.currentUser.id, `Rozpoczęto test dla umiejętności ID: ${skillId}`); 
  };

  const getSkills = async () => {
    const { data } = await supabase.from('skills').select('*').eq('is_archived', false).order('category');
    return data || [];
  };

  const submitTest = async (testId: string, answers: any, score: number, passed: boolean) => {
    if (!state.currentUser) throw new Error("No current user");
    
    const { data, error } = await supabase.from('test_attempts').insert([{
        id: crypto.randomUUID(),
        user_id: state.currentUser.id,
        test_id: testId,
        score,
        passed,
        answers,
        completed_at: new Date().toISOString()
    }]).select().single();

    if (error) throw error;

    if (data) setState(prev => ({ ...prev, testAttempts: [data, ...prev.testAttempts] }));
    
    const test = state.tests.find(t => t.id === testId);
    if (test) {
        for (const sid of test.skill_ids) {
            const skill = state.skills.find(s => s.id === sid);
            const status = passed ? (skill?.verification_type === VerificationType.THEORY_ONLY ? SkillStatus.CONFIRMED : SkillStatus.THEORY_PASSED) : SkillStatus.FAILED;
            
            const existing = state.userSkills.find(us => us.user_id === state.currentUser?.id && us.skill_id === sid);
            if (existing) {
                const { data: updatedUs } = await supabase.from('user_skills').update({ status, theory_score: score }).eq('id', existing.id).select().single();
                if (updatedUs) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === updatedUs.id ? updatedUs : us) }));
            } else {
                const { data: newUs } = await supabase.from('user_skills').insert([{ id: crypto.randomUUID(), user_id: state.currentUser.id, skill_id: sid, status, theory_score: score }]).select().single();
                if (newUs) setState(prev => ({ ...prev, userSkills: [newUs, ...prev.userSkills] }));
            }
        }
    }

    await logCandidateAction(state.currentUser.id, `Zakończono test: ${test?.title} - Wynik: ${score}% (${passed ? 'Zaliczony' : 'Niezaliczony'})`);
    return data;
  };

  const resetTestAttempt = async (attemptId: string) => {
    await supabase.from('test_attempts').delete().eq('id', attemptId);
    setState(prev => ({ ...prev, testAttempts: prev.testAttempts.filter(ta => ta.id !== attemptId) }));
  };

  const addSkill = async (skill: Omit<Skill, 'id'>) => {
    const { data } = await supabase.from('skills').insert([{ ...skill, id: crypto.randomUUID() }]).select().single();
    if (data) setState(prev => ({ ...prev, skills: [data, ...prev.skills] }));
  };
  
  const updateSkill = async (skillId: string, data: Partial<Skill>) => {
    const { data: updated } = await supabase.from('skills').update(data).eq('id', skillId).select().single();
    if (updated) setState(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skillId ? updated : s) }));
  };
  
  const deleteSkill = async (skillId: string) => {
    await supabase.from('skills').update({ is_archived: true }).eq('id', skillId);
    setState(prev => ({ ...prev, skills: prev.skills.filter(s => s.id !== skillId) }));
  };

  const addTest = async (test: Omit<Test, 'id'>) => {
    const { data } = await supabase.from('tests').insert([{ ...test, id: crypto.randomUUID() }]).select().single();
    if (data) setState(prev => ({ ...prev, tests: [data, ...prev.tests] }));
  };
  
  const updateTest = async (testId: string, data: Partial<Test>) => {
    const { data: updated } = await supabase.from('tests').update(data).eq('id', testId).select().single();
    if (updated) setState(prev => ({ ...prev, tests: prev.tests.map(t => t.id === testId ? updated : t) }));
  };

  const addLibraryResource = async (resource: Omit<LibraryResource, 'id'>) => {
    const { data } = await supabase.from('library_resources').insert([{ ...resource, id: crypto.randomUUID() }]).select().single();
    if (data) setState(prev => ({ ...prev, libraryResources: [data, ...prev.libraryResources] }));
  };
  
  const updateLibraryResource = async (resourceId: string, data: Partial<LibraryResource>) => {
    const { data: updated } = await supabase.from('library_resources').update(data).eq('id', resourceId).select().single();
    if (updated) setState(prev => ({ ...prev, libraryResources: prev.libraryResources.map(r => r.id === resourceId ? updated : r) }));
  };
  
  const deleteLibraryResource = async (resourceId: string) => {
    await supabase.from('library_resources').update({ is_archived: true }).eq('id', resourceId);
    setState(prev => ({ ...prev, libraryResources: prev.libraryResources.filter(r => r.id !== resourceId) }));
  };

  const addCandidateDocument = async (userId: string, doc: Partial<UserSkill>) => {
      const newDoc = {
          ...doc,
          id: crypto.randomUUID(),
          user_id: userId,
          status: SkillStatus.PENDING,
          created_at: new Date().toISOString()
      };
      
      const { data, error } = await supabase.from('user_skills').insert([newDoc]).select().single();
      if (error) {
          console.error("Error adding document:", error);
          throw error;
      }
      
      if (data) {
          setState(prev => ({ ...prev, userSkills: [data, ...prev.userSkills] }));
      }
      
      await logCandidateAction(userId, `Dodano dokument: ${doc.custom_name}`);
  };

  const updateCandidateDocumentDetails = async (docId: string, data: Partial<UserSkill>) => {
    const { data: updated } = await supabase.from('user_skills').update(data).eq('id', docId).select().single();
    if (updated) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === docId ? updated : us) }));
  };
  
  const archiveCandidateDocument = async (docId: string) => {
    await supabase.from('user_skills').update({ is_archived: true }).eq('id', docId);
    setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === docId ? { ...us, is_archived: true } : us) }));
  };
  
  const restoreCandidateDocument = async (docId: string) => {
    await supabase.from('user_skills').update({ is_archived: false }).eq('id', docId);
    setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === docId ? { ...us, is_archived: false } : us) }));
  };

  const updateUserSkillStatus = async (userSkillId: string, status: SkillStatus, rejectionReason?: string) => {
      const { data, error } = await supabase.from('user_skills').update({ 
          status, 
          rejection_reason: rejectionReason,
          confirmed_at: status === SkillStatus.CONFIRMED ? new Date().toISOString() : null 
      }).eq('id', userSkillId).select().single();
      
      if (error) throw error;
      
      if (data) {
          setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us) }));
          const isDoc = data.skill_id.startsWith('doc_');
          const skillName = data.custom_name || data.skill_id;
          await logCandidateAction(data.user_id, status === SkillStatus.FAILED ? `Odrzucono ${isDoc ? 'dokument' : 'praktykę'}: ${skillName}` : `Zatwierdzono ${isDoc ? 'dokument' : 'praktykę'}: ${skillName}`);
      }
  };

  const moveCandidateToTrial = async (candidateId: string, brigadirId: string, startDate: string, endDate: string, rate: number) => {
      await updateUser(candidateId, { status: UserStatus.TRIAL, role: Role.EMPLOYEE, assigned_brigadir_id: brigadirId, hired_date: startDate, trial_end_date: endDate, base_rate: rate });
      await logCandidateAction(candidateId, `Rozpoczęcie okresu próbnego. Brygadzista: ${brigadirId}`);
  };

  const hireCandidate = async (candidateId: string, hiredDate?: string, contractEndDate?: string) => {
      await updateUser(candidateId, { status: UserStatus.ACTIVE, role: Role.EMPLOYEE, hired_date: hiredDate || new Date().toISOString(), contract_end_date: contractEndDate, trial_end_date: null });
      await logCandidateAction(candidateId, 'Zatrudnienie na stałe');
  };

  const assignBrigadir = async (userId: string, brigadirId: string) => {
    await updateUser(userId, { assigned_brigadir_id: brigadirId });
  };

  const resetSkillProgress = async (userId: string, skillId: string, mode: 'theory'|'practice'|'both') => {
      if (mode === 'both' || mode === 'practice') {
          await supabase.from('user_skills').delete().eq('user_id', userId).eq('skill_id', skillId);
          setState(prev => ({ ...prev, userSkills: prev.userSkills.filter(us => !(us.user_id === userId && us.skill_id === skillId)) }));
      }
      if (mode === 'theory' || mode === 'both') {
          const test = state.tests.find(t => t.skill_ids.includes(skillId));
          if (test) {
              await supabase.from('test_attempts').delete().eq('user_id', userId).eq('test_id', test.id);
              setState(prev => ({ ...prev, testAttempts: prev.testAttempts.filter(ta => !(ta.user_id === userId && ta.test_id === test.id)) }));
          }
      }
      await logCandidateAction(userId, `Reset postępu: ${skillId} (${mode})`);
  };

  const addPosition = async (posData: Omit<Position, 'id' | 'order'>) => {
    const { data } = await supabase.from('positions').insert([{ ...posData, id: crypto.randomUUID(), order: state.positions.length + 1 }]).select().single();
    if (data) setState(prev => ({ ...prev, positions: [...prev.positions, data] }));
  };
  
  const updatePosition = async (id: string, data: Partial<Position>) => {
    const { data: updated } = await supabase.from('positions').update(data).eq('id', id).select().single();
    if (updated) setState(prev => ({ ...prev, positions: prev.positions.map(p => p.id === id ? updated : p) }));
  };
  
  const deletePosition = async (id: string) => {
    await supabase.from('positions').delete().eq('id', id);
    setState(prev => ({ ...prev, positions: prev.positions.filter(p => p.id !== id) }));
  };
  
  const reorderPositions = async (newPositions: Position[]) => {
    for (let i = 0; i < newPositions.length; i++) {
        await supabase.from('positions').update({ order: i + 1 }).eq('id', newPositions[i].id);
    }
    setState(prev => ({ ...prev, positions: newPositions }));
  };

  const confirmSkillPractice = async (userSkillId: string, checkerId: string) => {
      const nowStr = new Date().toISOString();
      const { data } = await supabase.from('user_skills').update({ 
          status: SkillStatus.CONFIRMED, 
          practice_checked_by: checkerId, 
          practice_date: nowStr, 
          confirmed_at: nowStr 
      }).eq('id', userSkillId).select().single();
      if (data) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us) }));
  };

  const saveSkillChecklistProgress = async (userSkillId: string, progress: Record<number, ChecklistItemState>) => {
    const { data } = await supabase.from('user_skills').update({ checklist_progress: progress }).eq('id', userSkillId).select().single();
    if (data) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us) }));
  };
  
  const updateVerificationDetails = async (userSkillId: string, data: Partial<UserSkill>) => {
    const { data: updated } = await supabase.from('user_skills').update(data).eq('id', userSkillId).select().single();
    if (updated) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? updated : us) }));
  };
  
  const addQualityIncident = async (incident: Omit<QualityIncident, 'id'>) => {
    const { data, error } = await supabase.from('quality_incidents').insert([{ ...incident, id: crypto.randomUUID() }]).select().single();
    if (!error && data) {
        setState(prev => ({ ...prev, qualityIncidents: [data, ...prev.qualityIncidents] }));
    }
  };

  const addEmployeeNote = async (note: Omit<EmployeeNote, 'id' | 'created_at'>) => {
    const newNote = {
        ...note,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('employee_notes').insert([newNote]).select().single();
    if (error) {
        console.error("Error adding note:", error);
    } else if (data) {
        setState(prev => ({ ...prev, employeeNotes: [data, ...prev.employeeNotes] }));
    }
  };
  
  const deleteEmployeeNote = async (id: string) => {
    await supabase.from('employee_notes').delete().eq('id', id);
    setState(prev => ({ ...prev, employeeNotes: prev.employeeNotes.filter(n => n.id !== id) }));
  };

  const addEmployeeBadge = async (badge: Omit<EmployeeBadge, 'id' | 'created_at'>) => {
      const { data } = await supabase.from('employee_badges').insert([{ ...badge, id: crypto.randomUUID(), created_at: new Date().toISOString() }]).select().single();
      if (data) setState(prev => ({ ...prev, employeeBadges: [data, ...prev.employeeBadges] }));
  };

  const deleteEmployeeBadge = async (id: string) => {
    await supabase.from('employee_badges').delete().eq('id', id);
    setState(prev => ({ ...prev, employeeBadges: prev.employeeBadges.filter(b => b.id !== id) }));
  };

  const inviteFriend = (firstName: string, lastName: string, phone: string, targetPosition: string) => {
    if (!state.currentUser) return;
    addCandidate({
        first_name: firstName,
        last_name: lastName,
        phone,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@referral.pl`,
        referred_by_id: state.currentUser.id,
        target_position: targetPosition,
        source: `Polecenie: ${state.currentUser.first_name} ${state.currentUser.last_name}`
    });
    triggerNotification('candidate_link', 'Wysłano Zaproszenie', `Polecenie dla ${firstName} ${lastName} zostało zapisane.`);
  };

  const payReferralBonus = async (referralUserId: string) => {
    const { data } = await supabase.from('users').update({ 
        referral_bonus_paid: true, 
        referral_bonus_paid_date: new Date().toISOString() 
    }).eq('id', referralUserId).select().single();
    if (data) setState(prev => ({ ...prev, users: prev.users.map(u => u.id === referralUserId ? data : u) }));
  };

  const updateSystemConfig = (config: SystemConfig) => setState(prev => ({ ...prev, systemConfig: config }));
  const updateNotificationSettings = (settings: NotificationSetting[]) => setState(prev => ({ ...prev, notificationSettings: settings }));
  const markNotificationAsRead = (id: string) => setState(prev => ({ ...prev, appNotifications: prev.appNotifications.map(n => n.id === id ? { ...n, isRead: true } : n) }));
  const markAllNotificationsAsRead = () => setState(prev => ({ ...prev, appNotifications: prev.appNotifications.map(n => ({ ...n, isRead: true })) }));
  const clearToast = () => setState(prev => ({ ...prev, toast: null }));

  return (
    <AppContext.Provider value={{
      state, login, loginAsRole, loginAsUser, logout, getUsers, addUser, updateUser, deleteUser, uploadDocument, addCandidate, logCandidateAction, startTest, getSkills, submitTest, resetTestAttempt, addSkill, updateSkill, deleteSkill, addTest, updateTest, addLibraryResource, updateLibraryResource, deleteLibraryResource, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus, moveCandidateToTrial, hireCandidate, assignBrigadir, resetSkillProgress, addPosition, updatePosition, deletePosition, reorderPositions, confirmSkillPractice, saveSkillChecklistProgress, updateVerificationDetails, addQualityIncident, addEmployeeNote, deleteEmployeeNote, addEmployeeBadge, deleteEmployeeBadge, inviteFriend, payReferralBonus, updateSystemConfig, updateNotificationSettings, triggerNotification, markNotificationAsRead, markAllNotificationsAsRead, clearToast
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) throw new Error('useAppContext must be used within an AppProvider');
  return context;
};
