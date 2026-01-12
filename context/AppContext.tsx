
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  User, UserSkill, Skill, Test, TestAttempt, SystemConfig, 
  AppNotification, NotificationSetting, Position, CandidateHistoryEntry, 
  QualityIncident, EmployeeNote, EmployeeBadge, MonthlyBonus, LibraryResource,
  Role, UserStatus, SkillStatus, ContractType
} from '../types';

interface AppState {
  currentUser: User | null;
  users: User[];
  userSkills: UserSkill[];
  skills: Skill[];
  tests: Test[];
  testAttempts: TestAttempt[];
  candidateHistory: CandidateHistoryEntry[];
  appNotifications: AppNotification[];
  systemConfig: SystemConfig;
  notificationSettings: NotificationSetting[];
  positions: Position[];
  monthlyBonuses: Record<string, MonthlyBonus>;
  qualityIncidents: QualityIncident[];
  employeeNotes: EmployeeNote[];
  employeeBadges: EmployeeBadge[];
  toast: { title: string, message: string } | null;
  libraryResources: LibraryResource[];
}

interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loginAsUser: (user: User) => void;
  addUser: (userData: any) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  updateUser: (id: string, updates: any) => Promise<void>;
  addCandidate: (userData: Partial<User>) => Promise<User>;
  moveCandidateToTrial: (id: string, config: any) => Promise<void>;
  logCandidateAction: (candidateId: string, action: string) => Promise<void>;
  resetTestAttempt: (testId: string, userId: string) => Promise<void>;
  addCandidateDocument: (userId: string, docData: any) => Promise<void>;
  updateCandidateDocumentDetails: (docId: string, updates: any) => Promise<void>;
  updateUserSkillStatus: (userSkillId: string, status: SkillStatus, reason?: string) => Promise<void>;
  archiveCandidateDocument: (docId: string) => Promise<void>;
  restoreCandidateDocument: (docId: string) => Promise<void>;
  hireCandidate: (userId: string, hiredDate: string, contractEndDate?: string) => Promise<void>;
  triggerNotification: (type: string, title: string, message: string, link?: string) => void;
  assignBrigadir: (userId: string, brigadirId: string) => Promise<void>;
  resetSkillProgress: (userId: string, skillId: string, mode: 'theory' | 'practice' | 'both') => Promise<void>;
  addEmployeeNote: (note: any) => Promise<void>;
  deleteEmployeeNote: (id: string) => Promise<void>;
  payReferralBonus: (userId: string) => Promise<void>;
  addSkill: (skill: Omit<Skill, 'id'>) => Promise<void>;
  updateSkill: (id: string, skill: Partial<Skill>) => Promise<void>;
  deleteSkill: (id: string) => Promise<void>;
  addLibraryResource: (res: LibraryResource) => Promise<void>;
  updateLibraryResource: (id: string, res: Partial<LibraryResource>) => Promise<void>;
  deleteLibraryResource: (id: string) => Promise<void>;
  addTest: (test: Omit<Test, 'id'>) => Promise<void>;
  updateTest: (id: string, test: Partial<Test>) => Promise<void>;
  startTest: (skillId: string) => void;
  submitTest: (testId: string, answers: number[][], score: number, passed: boolean) => Promise<void>;
  updateSystemConfig: (config: SystemConfig) => Promise<void>;
  updateNotificationSettings: (settings: NotificationSetting[]) => Promise<void>;
  addPosition: (pos: Omit<Position, 'id'>) => Promise<void>;
  updatePosition: (id: string, pos: Partial<Position>) => Promise<void>;
  deletePosition: (id: string) => Promise<void>;
  reorderPositions: (positions: Position[]) => Promise<void>;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  clearToast: () => void;
  inviteFriend: (firstName: string, lastName: string, phone: string, targetPosition: string) => void;
  confirmSkillPractice: (userSkillId: string, brigadirId: string) => Promise<void>;
  saveSkillChecklistProgress: (userSkillId: string, progress: any) => Promise<void>;
  addEmployeeBadge: (badge: any) => Promise<void>;
  deleteEmployeeBadge: (id: string) => Promise<void>;
  addQualityIncident: (incident: any) => Promise<void>;
}

// DEFINICJA ZDARZEŃ I PRZYPISANIE DO RÓL
const ALL_EVENT_TYPES = [
    // --- REKRUTACJA ---
    { code: 'cand_reg', label: 'Zarejestrowano w systemie', category: 'rekrutacja', roles: ['candidate', 'hr'] },
    { code: 'cand_upd', label: 'Dane kandydata zostały zmienione', category: 'rekrutacja', roles: ['candidate', 'hr'] },
    { code: 'cand_docs_req', label: 'Prośba o dane do umowy', category: 'rekrutacja', roles: ['candidate', 'hr'] },
    { code: 'cand_docs_sent', label: 'Dane do umowy zostały wysłane', category: 'rekrutacja', roles: ['candidate', 'hr'] },
    { code: 'doc_upl', label: 'Dokument został wgrany', category: 'rekrutacja', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    { code: 'doc_stat', label: 'Dokument zatwierdzony / odrzucony', category: 'rekrutacja', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    
    // --- UMOWY I TRIAL ---
    { code: 'trial_start', label: 'Przeniesienie na okres próbny', category: 'trial', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    { code: 'trial_rem', label: 'Przypomnienie o końcu okresu próbnego', category: 'trial', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    { code: 'contract_perm', label: 'Przeniesienie na stały kontrakt', category: 'trial', roles: ['employee', 'brigadir', 'hr'] },
    { code: 'contract_exp', label: 'Zbliżający się koniec umowy', category: 'trial', roles: ['employee', 'brigadir', 'hr'] },
    { code: 'team_trial_rem', label: 'Okres próbny podwładnego kończy się', category: 'trial', roles: ['brigadir', 'coordinator', 'hr'] },
    
    // --- NAWYKI I TESTY ---
    { code: 'test_ok', label: 'Test teoretyczny zaliczony', category: 'skills', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    { code: 'prac_assigned', label: 'Wyznaczono praktykę (po teście)', category: 'skills', roles: ['employee', 'brigadir', 'hr'] },
    { code: 'prac_stat', label: 'Praktyka zaliczona / odrzucona', category: 'skills', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    { code: 'prac_verify_req', label: 'Nowa praktyka do sprawdzenia', category: 'skills', roles: ['brigadir', 'coordinator', 'hr'] },
    { code: 'skill_stat', label: 'Nawyk zaliczony / odrzucony', category: 'skills', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    { code: 'rate_upd', label: 'Stawka godzinowa została zmieniona', category: 'skills', roles: ['candidate', 'employee', 'brigadir', 'hr'] },
    
    // --- JAKOŚĆ I FINANSE ---
    { code: 'qual_warn', label: 'Ostrzeżenie dotyczące jakości (1/2)', category: 'quality', roles: ['employee', 'brigadir', 'coordinator', 'hr'] },
    { code: 'qual_block', label: 'Blokada bonusu jakościowego (2/2)', category: 'quality', roles: ['employee', 'brigadir', 'coordinator', 'hr'] },
    { code: 'team_qual_alert', label: 'Błąd jakościowy w nadzorowanym zespole', category: 'quality', roles: ['coordinator', 'work_manager', 'hr'] },
    
    // --- PROGRAM POLECEŃ ---
    { code: 'ref_inv', label: 'Zaproszenie znajomego (Loyalty)', category: 'referrals', roles: ['employee', 'brigadir', 'hr'] },
    { code: 'ref_bonus', label: 'Naliczono bonus za polecenie', category: 'referrals', roles: ['employee', 'brigadir', 'hr'] },
    
    // --- SYSTEM I ZESPÓŁ ---
    { code: 'team_mod', label: 'Zmiana składu Twojej brygady', category: 'system', roles: ['brigadir', 'hr'] },
    { code: 'doc_exp_alert', label: 'Wygasające dokumenty (SEP/UDT/Lekarskie)', category: 'system', roles: ['employee', 'brigadir', 'coordinator', 'work_manager', 'hr'] },
    { code: 'sys_report', label: 'Raport okresowy gotowy', category: 'system', roles: ['coordinator', 'work_manager', 'hr'] },
    { code: 'wm_crit_exp', label: 'Krytyczne wygaśnięcia w całej firmie', category: 'system', roles: ['work_manager', 'hr'] }
];

const CONFIG_ROLES = [Role.HR, Role.CANDIDATE, Role.EMPLOYEE, Role.BRIGADIR, Role.COORDINATOR, 'work_manager'];

const generateDefaultSettings = (): NotificationSetting[] => {
    const settings: NotificationSetting[] = [];
    CONFIG_ROLES.forEach(role => {
        ALL_EVENT_TYPES.forEach(event => {
            if (event.roles.includes(role as any)) {
                settings.push({
                    id: `${role}_${event.code}`,
                    label: event.label,
                    category: event.category as any,
                    target_role: role as any,
                    system: false,
                    email: false,
                    sms: false
                });
            }
        });
    });
    return settings;
};

const DEFAULT_NOTIFICATIONS = generateDefaultSettings();

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    users: [],
    userSkills: [],
    skills: [],
    tests: [],
    testAttempts: [],
    candidateHistory: [],
    appNotifications: [],
    systemConfig: {
      baseRate: 24,
      contractBonuses: { [ContractType.UOP]: 0, [ContractType.UZ]: 1, [ContractType.B2B]: 7 },
      studentBonus: 3,
      bonusDocumentTypes: [],
      bonusPermissionTypes: [],
      terminationReasons: [],
      positions: ['Pomocnik', 'Elektromonter', 'Elektryk', 'Brygadzista', 'Koordynator Robót', 'Kierownik Robót']
    },
    notificationSettings: [],
    positions: [],
    monthlyBonuses: {},
    qualityIncidents: [],
    employeeNotes: [],
    employeeBadges: [],
    toast: null,
    libraryResources: []
  });

  const fetchData = async () => {
    try {
      const { data: dbUsers } = await supabase.from('users').select('*');
      const { data: dbSkills } = await supabase.from('skills').select('*');
      const { data: dbUserSkills } = await supabase.from('user_skills').select('*');
      const { data: dbHistory } = await supabase.from('candidate_history').select('*');
      const { data: dbTests } = await supabase.from('tests').select('*');
      const { data: dbAttempts } = await supabase.from('test_attempts').select('*');
      const { data: dbNotifSettings } = await supabase.from('notification_settings').select('*');

      setState(prev => ({
        ...prev,
        users: dbUsers || [],
        skills: dbSkills || [],
        userSkills: dbUserSkills || [],
        candidateHistory: dbHistory || [],
        tests: dbTests || [],
        testAttempts: dbAttempts || [],
        notificationSettings: (dbNotifSettings && dbNotifSettings.length > 0) ? dbNotifSettings : DEFAULT_NOTIFICATIONS
      }));
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const login = async (email: string, pass: string) => {
    const { data: { user }, error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    const { data } = await supabase.from('users').select('*').eq('id', user?.id).single();
    if (data) setState(prev => ({ ...prev, currentUser: data }));
  };

  const logout = () => setState(prev => ({ ...prev, currentUser: null }));
  const loginAsUser = (user: User) => setState(prev => ({ ...prev, currentUser: user }));

  const addUser = async (userData: any) => {
    const { data } = await supabase.from('users').insert([userData]).select().single();
    if (data) setState(prev => ({ ...prev, users: [data, ...prev.users] }));
  };

  const deleteUser = async (id: string) => {
    await supabase.from('users').delete().eq('id', id);
    setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== id) }));
  };

  const updateUser = async (userId: string, updates: Partial<User>) => {
    const processedUpdates = { ...updates };
    const { data, error } = await supabase.from('users').update(processedUpdates).eq('id', userId).select().single();
    if (error) throw error;
    if (data) setState(prev => ({ ...prev, users: prev.users.map(u => u.id === userId ? data : u), currentUser: prev.currentUser?.id === userId ? data : prev.currentUser }));
  };

  const addCandidate = async (userData: Partial<User>): Promise<User> => {
    const response = await supabase.functions.invoke('create-candidate', { body: userData });
    if (response.error) throw new Error(JSON.stringify(response.error));
    const newCandidate = response.data.data;
    setState(prev => ({ ...prev, users: [newCandidate, ...prev.users] }));
    await logCandidateAction(newCandidate.id, 'Dodano kandydata');
    return newCandidate;
  };

  const moveCandidateToTrial = async (id: string, config: any) => {
    const updates = { status: UserStatus.TRIAL, ...config };
    await updateUser(id, updates);
  };

  const logCandidateAction = async (candidateId: string, action: string) => {
    const newLog = { candidate_id: candidateId, action, created_at: new Date().toISOString(), performed_by: state.currentUser ? `${state.currentUser.first_name} ${state.currentUser.last_name}` : 'System' };
    const { data } = await supabase.from('candidate_history').insert([newLog]).select().single();
    if (data) setState(prev => ({ ...prev, candidateHistory: [data, ...prev.candidateHistory] }));
  };

  const resetTestAttempt = async (testId: string, userId: string) => {
    setState(prev => ({ ...prev, testAttempts: prev.testAttempts.filter(ta => !(ta.test_id === testId && ta.user_id === userId)) }));
  };

  const addCandidateDocument = async (userId: string, docData: any) => {
    const payload = { user_id: userId, status: docData.status || SkillStatus.PENDING, is_archived: false, ...docData };
    const { data, error } = await supabase.from('user_skills').insert([payload]).select().single();
    if (error) throw error;
    setState(prev => ({ ...prev, userSkills: [data, ...prev.userSkills] }));
  };

  const updateCandidateDocumentDetails = async (docId: string, updates: any) => {
    const { data, error } = await supabase.from('user_skills').update(updates).eq('id', docId).select().single();
    if (error) throw error;
    setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === docId ? data : us) }));
  };

  const updateUserSkillStatus = async (userSkillId: string, status: SkillStatus, reason?: string) => {
    const { data } = await supabase.from('user_skills').update({ status, rejection_reason: reason }).eq('id', userSkillId).select().single();
    if (data) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us) }));
  };

  const archiveCandidateDocument = async (docId: string) => {
    const { data } = await supabase.from('user_skills').update({ is_archived: true }).eq('id', docId).select().single();
    if (data) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === docId ? data : us) }));
  };

  const restoreCandidateDocument = async (docId: string) => {
    const { data } = await supabase.from('user_skills').update({ is_archived: false }).eq('id', docId).select().single();
    if (data) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === docId ? data : us) }));
  };

  const hireCandidate = async (userId: string, hiredDate: string, contractEndDate?: string) => {
    const updates = { status: UserStatus.ACTIVE, hired_date: hiredDate, contract_end_date: contractEndDate };
    await updateUser(userId, updates);
  };

  const triggerNotification = (type: string, title: string, message: string, link?: string) => {
    const newNotif = { id: crypto.randomUUID(), title, message, isRead: false, createdAt: new Date().toISOString(), link };
    setState(prev => ({ ...prev, appNotifications: [newNotif, ...prev.appNotifications], toast: { title, message } }));
  };

  const assignBrigadir = async (userId: string, brigadirId: string) => { await updateUser(userId, { assigned_brigadir_id: brigadirId }); };

  const resetSkillProgress = async (userId: string, skillId: string, mode: 'theory' | 'practice' | 'both') => { console.log(`Resetting skill ${skillId} for user ${userId} mode: ${mode}`); };

  const addEmployeeNote = async (note: any) => {
    const { data } = await supabase.from('employee_notes').insert([{ ...note, created_at: new Date().toISOString() }]).select().single();
    if (data) setState(prev => ({ ...prev, employeeNotes: [data, ...prev.employeeNotes] }));
  };

  const deleteEmployeeNote = async (id: string) => {
    await supabase.from('employee_notes').delete().eq('id', id);
    setState(prev => ({ ...prev, employeeNotes: prev.employeeNotes.filter(n => n.id !== id) }));
  };

  const payReferralBonus = async (userId: string) => { await updateUser(userId, { referral_bonus_paid: true, referral_bonus_paid_date: new Date().toISOString() }); };

  const addSkill = async (skill: Omit<Skill, 'id'>) => {
    const { data } = await supabase.from('skills').insert([skill]).select().single();
    if (data) setState(prev => ({ ...prev, skills: [data, ...prev.skills] }));
  };

  const updateSkill = async (id: string, skill: Partial<Skill>) => {
    const { data } = await supabase.from('skills').update(skill).eq('id', id).select().single();
    if (data) setState(prev => ({ ...prev, skills: prev.skills.map(s => s.id === id ? data : s) }));
  };

  const deleteSkill = async (id: string) => {
    await supabase.from('skills').delete().eq('id', id);
    setState(prev => ({ ...prev, skills: prev.skills.filter(s => s.id !== id) }));
  };

  const addLibraryResource = async (res: LibraryResource) => {
    const { data } = await supabase.from('library').insert([res]).select().single();
    if (data) setState(prev => ({ ...prev, libraryResources: [data, ...prev.libraryResources] }));
  };

  const updateLibraryResource = async (id: string, res: Partial<LibraryResource>) => {
    const { data } = await supabase.from('library').update(res).eq('id', id).select().single();
    if (data) setState(prev => ({ ...prev, libraryResources: prev.libraryResources.map(r => r.id === id ? data : r) }));
  };

  const deleteLibraryResource = async (id: string) => {
    await supabase.from('library').delete().eq('id', id);
    setState(prev => ({ ...prev, libraryResources: prev.libraryResources.filter(r => r.id !== id) }));
  };

  const addTest = async (test: Omit<Test, 'id'>) => {
    const { data } = await supabase.from('tests').insert([test]).select().single();
    if (data) setState(prev => ({ ...prev, tests: [data, ...prev.tests] }));
  };

  const updateTest = async (id: string, test: Partial<Test>) => {
    const { data } = await supabase.from('tests').update(test).eq('id', id).select().single();
    if (data) setState(prev => ({ ...prev, tests: prev.tests.map(t => t.id === id ? data : t) }));
  };

  const startTest = (skillId: string) => { console.log('Test started for skill:', skillId); };

  const submitTest = async (testId: string, answers: number[][], score: number, passed: boolean) => {
    const attempt = { user_id: state.currentUser?.id, test_id: testId, score, passed, completed_at: new Date().toISOString() };
    const { data } = await supabase.from('test_attempts').insert([attempt]).select().single();
    if (data) setState(prev => ({ ...prev, testAttempts: [data, ...prev.testAttempts] }));
  };

  const updateSystemConfig = async (config: SystemConfig) => { setState(prev => ({ ...prev, systemConfig: config })); };

  const updateNotificationSettings = async (settings: NotificationSetting[]) => {
    setState(prev => ({ ...prev, notificationSettings: settings }));
    const { error } = await supabase.from('notification_settings').upsert(settings);
    if (error) {
        console.error("Error saving notification settings:", error);
        throw error;
    }
  };

  const addPosition = async (pos: Omit<Position, 'id'>) => {
    const { data } = await supabase.from('positions').insert([pos]).select().single();
    if (data) setState(prev => ({ ...prev, positions: [data, ...prev.positions] }));
  };

  const updatePosition = async (id: string, pos: Partial<Position>) => {
    const { data } = await supabase.from('positions').update(pos).eq('id', id).select().single();
    if (data) setState(prev => ({ ...prev, positions: prev.positions.map(p => p.id === id ? data : p) }));
  };

  const deletePosition = async (id: string) => {
    await supabase.from('positions').delete().eq('id', id);
    setState(prev => ({ ...prev, positions: prev.positions.filter(p => p.id !== id) }));
  };

  const reorderPositions = async (positions: Position[]) => { setState(prev => ({ ...prev, positions })); };

  const markNotificationAsRead = (id: string) => { setState(prev => ({ ...prev, appNotifications: prev.appNotifications.map(n => n.id === id ? { ...n, isRead: true } : n) })); };

  const markAllNotificationsAsRead = () => { setState(prev => ({ ...prev, appNotifications: prev.appNotifications.map(n => ({ ...n, isRead: true })) })); };

  const clearToast = () => setState(prev => ({ ...prev, toast: null }));

  const inviteFriend = (firstName: string, lastName: string, phone: string, targetPosition: string) => { console.log('Inviting friend:', firstName, lastName); };

  const confirmSkillPractice = async (userSkillId: string, brigadirId: string) => {
    const updates = { status: SkillStatus.CONFIRMED, practice_checked_by: brigadirId, practice_date: new Date().toISOString(), confirmed_at: new Date().toISOString() };
    const { data } = await supabase.from('user_skills').update(updates).eq('id', userSkillId).select().single();
    if (data) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us) }));
  };

  const saveSkillChecklistProgress = async (userSkillId: string, progress: any) => {
    const { data } = await supabase.from('user_skills').update({ checklist_progress: progress }).eq('id', userSkillId).select().single();
    if (data) setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? data : us) }));
  };

  const addEmployeeBadge = async (badge: any) => {
    const { data } = await supabase.from('employee_badges').insert([{ ...badge, created_at: new Date().toISOString() }]).select().single();
    if (data) setState(prev => ({ ...prev, employeeBadges: [data, ...prev.employeeBadges] }));
  };

  const deleteEmployeeBadge = async (id: string) => {
    await supabase.from('employee_badges').delete().eq('id', id);
    setState(prev => ({ ...prev, employeeBadges: prev.employeeBadges.filter(b => b.id !== id) }));
  };

  const addQualityIncident = async (incident: any) => {
    const { data } = await supabase.from('quality_incidents').insert([incident]).select().single();
    if (data) setState(prev => ({ ...prev, qualityIncidents: [data, ...prev.qualityIncidents] }));
  };

  return (
    <AppContext.Provider value={{ 
        state, setState, login, logout, loginAsUser, addUser, deleteUser, updateUser, addCandidate, moveCandidateToTrial, logCandidateAction,
        resetTestAttempt, addCandidateDocument, updateCandidateDocumentDetails, updateUserSkillStatus, archiveCandidateDocument, restoreCandidateDocument,
        hireCandidate, triggerNotification, assignBrigadir, resetSkillProgress, addEmployeeNote, deleteEmployeeNote, payReferralBonus, addSkill,
        updateSkill, deleteSkill, addLibraryResource, updateLibraryResource, deleteLibraryResource, addTest, updateTest, startTest, submitTest,
        updateSystemConfig, updateNotificationSettings, addPosition, updatePosition, deletePosition, reorderPositions, markNotificationAsRead,
        markAllNotificationsAsRead, clearToast, inviteFriend, confirmSkillPractice, saveSkillChecklistProgress, addEmployeeBadge, deleteEmployeeBadge, addQualityIncident
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
