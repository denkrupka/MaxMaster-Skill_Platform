
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  User, Role, Skill, UserSkill, Test, TestAttempt, LibraryResource, 
  CandidateHistoryEntry, AppNotification, NotificationSetting, SystemConfig, 
  UserStatus, SkillStatus, VerificationType, MonthlyBonus, ContractType, QualityIncident, EmployeeNote, NoteCategory, NoteSeverity, EmployeeBadge, BadgeType, ChecklistItemState, VerificationAttachment, VerificationNote, VerificationLog, Position
} from '../types';
import { 
  USERS, SKILLS, TESTS, TEST_ATTEMPTS, LIBRARY_RESOURCES, 
  CANDIDATE_HISTORY, TERMINATION_REASONS, QUALITY_INCIDENTS, USER_SKILLS, EMPLOYEE_NOTES, EMPLOYEE_BADGES, BONUS_DOCUMENT_TYPES
} from '../constants';

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
}

// Interface for Context
interface AppContextType {
  state: AppState;
  login: (role: Role) => void;
  loginAsUser: (user: User) => void;
  logout: () => void;
  addUser: (user: Partial<User>) => void;
  updateUser: (userId: string, data: Partial<User>) => void;
  deleteUser: (userId: string) => void;
  addCandidate: (user: Partial<User>) => User;
  logCandidateAction: (candidateId: string, action: string) => void;
  startTest: (skillId: string) => void;
  submitTest: (skillId: string, score: number, duration?: number) => void;
  resetTestAttempt: (attemptId: string) => void;
  addSkill: (skill: Omit<Skill, 'id'>) => void;
  updateSkill: (skillId: string, data: Partial<Skill>) => void;
  deleteSkill: (skillId: string) => void;
  addTest: (test: Omit<Test, 'id'>) => void;
  updateTest: (testId: string, data: Partial<Test>) => void;
  addLibraryResource: (resource: Omit<LibraryResource, 'id'>) => void;
  updateLibraryResource: (resourceId: string, data: Partial<LibraryResource>) => void;
  deleteLibraryResource: (resourceId: string) => void;
  addCandidateDocument: (userId: string, doc: Partial<UserSkill>) => void;
  updateCandidateDocumentDetails: (docId: string, data: Partial<UserSkill>) => void;
  archiveCandidateDocument: (docId: string) => void;
  restoreCandidateDocument: (docId: string) => void;
  updateUserSkillStatus: (userSkillId: string, status: SkillStatus, rejectionReason?: string) => void;
  moveCandidateToTrial: (candidateId: string, brigadirId: string, startDate: string, endDate: string, rate: number) => void;
  hireCandidate: (candidateId: string, hiredDate?: string, contractEndDate?: string) => void;
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
  
  addQualityIncident: (incident: Omit<QualityIncident, 'id'>) => void;

  // Employee Notes
  addEmployeeNote: (note: Omit<EmployeeNote, 'id' | 'created_at'>) => void;
  deleteEmployeeNote: (id: string) => void;

  // Employee Badges
  addEmployeeBadge: (badge: Omit<EmployeeBadge, 'id' | 'created_at'>) => void;
  deleteEmployeeBadge: (id: string) => void;

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

const INITIAL_POSITIONS: Position[] = [
  { id: 'p1', name: 'Pomocnik', order: 1, responsibilities: ['Dbanie o porządek', 'Pomoc w transporcie'], required_skill_ids: ['e1'] },
  { id: 'p2', name: 'Elektromonter', order: 2, responsibilities: ['Montaż tras kablowych', 'Układanie kabli'], required_skill_ids: ['m1', 'e2'] },
  { id: 'p3', name: 'Elektryk', order: 3, responsibilities: ['Prefabrykacja rozdzielnic', 'Pomiary'], required_skill_ids: ['e1', 'e2', 'u1'] },
  { id: 'p4', name: 'Brygadzista', order: 4, responsibilities: ['Nadzór nad zespołem', 'Odbiory'], required_skill_ids: ['u1', 'u2_doc'], brigadier_bonuses: [{ id: 'b1', name: 'Premia za brak usterki', amount: 500 }] },
  { id: 'p5', name: 'Koordynator Robót', order: 5, responsibilities: ['Harmonogramowanie', 'Materiały'], required_skill_ids: ['u1'], min_monthly_rate: 8000, max_monthly_rate: 12000 },
  { id: 'p6', name: 'Kierownik Robót', order: 6, responsibilities: ['Nadzór ogólny', 'Kontakt z inwestorem'], required_skill_ids: ['u1'], min_monthly_rate: 10000, max_monthly_rate: 18000 },
];

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AppState>({
    currentUser: null,
    users: USERS,
    skills: SKILLS,
    userSkills: USER_SKILLS, 
    tests: TESTS,
    testAttempts: TEST_ATTEMPTS,
    libraryResources: LIBRARY_RESOURCES,
    candidateHistory: CANDIDATE_HISTORY,
    appNotifications: [],
    systemConfig: {
      baseRate: 24.0,
      contractBonuses: { [ContractType.UOP]: 0, [ContractType.UZ]: 1, [ContractType.B2B]: 7 },
      studentBonus: 3.0,
      bonusDocumentTypes: [
          { id: 'bhp_szkol', label: 'Szkolenie BHP (Wstępne/Okresowe)', bonus: 0 },
          { id: 'badania', label: 'Orzeczenie Lekarskie (Wysokościowe)', bonus: 0 },
          { id: 'other', label: 'Inny dokument', bonus: 0 }
      ],
      bonusPermissionTypes: [
          { id: 'sep_e', label: 'SEP E z pomiarami', bonus: 0.5 },
          { id: 'sep_d', label: 'SEP D z pomiarami', bonus: 0.5 },
          { id: 'udt_pod', label: 'UDT - Podnośniki (IP)', bonus: 1.0 },
      ],
      terminationReasons: TERMINATION_REASONS,
      positions: ['Pomocnik', 'Elektromonter', 'Elektryk', 'Brygadzista', 'Kierownik Robót']
    },
    positions: INITIAL_POSITIONS,
    monthlyBonuses: {},
    qualityIncidents: QUALITY_INCIDENTS,
    employeeNotes: EMPLOYEE_NOTES,
    employeeBadges: EMPLOYEE_BADGES,
    toast: null,
    notificationSettings: [
      { id: 'status_change', label: 'Zmiana statusu', system: true, email: true, sms: false },
      { id: 'test_passed', label: 'Zaliczony test', system: true, email: false, sms: false },
      { id: 'doc_uploaded', label: 'Nowy dokument', system: true, email: true, sms: false },
      { id: 'candidate_link', label: 'Wysłanie linku', system: false, email: true, sms: true },
      { id: 'trial_ending', label: 'Koniec okresu próbnego', system: true, email: true, sms: false },
      { id: 'termination', label: 'Zwolnienie pracownika', system: true, email: true, sms: false }
    ]
  });

  const triggerNotification = (type: string, title: string, message: string, link?: string) => {
      const setting = state.notificationSettings.find(s => s.id === type);
      if (setting?.system) {
          const newNotif: AppNotification = { id: `notif_${Date.now()}`, title, message, isRead: false, createdAt: new Date().toISOString(), link };
          setState(prev => ({ ...prev, appNotifications: [newNotif, ...prev.appNotifications], toast: { title, message } }));
      }
  };

  const login = (role: Role) => {
      let user = state.users.find(u => u.role === role && (u.id === 'u1' || u.id === 'u2' || u.id === 'u3' || u.id === 'u4' || u.id === 'u5'));
      if (!user) user = state.users.find(u => u.role === role);
      setState(prev => ({ ...prev, currentUser: user || null }));
  };

  const loginAsUser = (user: User) => setState(prev => ({ ...prev, currentUser: user }));
  const logout = () => setState(prev => ({ ...prev, currentUser: null }));

  const addUser = (userData: Partial<User>) => {
      const newUser: User = { id: `u_${Date.now()}`, status: UserStatus.ACTIVE, base_rate: state.systemConfig.baseRate, hired_date: new Date().toISOString(), role: Role.EMPLOYEE, first_name: '', last_name: '', email: '', ...userData } as User;
      setState(prev => ({ ...prev, users: [...prev.users, newUser] }));
  };

  const updateUser = (userId: string, data: Partial<User>) => {
      setState(prev => ({ ...prev, users: prev.users.map(u => u.id === userId ? { ...u, ...data } : u), currentUser: prev.currentUser?.id === userId ? { ...prev.currentUser, ...data } : prev.currentUser }));
  };

  const deleteUser = (userId: string) => setState(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId) }));

  const addCandidate = (userData: Partial<User>): User => {
      const newUser: User = { id: `c_${Date.now()}`, role: Role.CANDIDATE, status: UserStatus.STARTED, base_rate: state.systemConfig.baseRate, hired_date: new Date().toISOString(), first_name: '', last_name: '', email: '', ...userData } as User;
      setState(prev => ({ ...prev, users: [...prev.users, newUser], candidateHistory: [...prev.candidateHistory, { id: `h_${Date.now()}`, candidate_id: newUser.id, date: new Date().toISOString(), action: 'Dodano kandydata', performed_by: prev.currentUser ? `${prev.currentUser.first_name} ${prev.currentUser.last_name}` : 'System' }] }));
      return newUser;
  };

  const logCandidateAction = (candidateId: string, action: string) => {
      setState(prev => ({ ...prev, candidateHistory: [...prev.candidateHistory, { id: `h_${Date.now()}`, candidate_id: candidateId, date: new Date().toISOString(), action: action, performed_by: prev.currentUser ? (prev.currentUser.role === Role.CANDIDATE ? 'Kandydat' : `${prev.currentUser.first_name} ${prev.currentUser.last_name}`) : 'System' }] }));
  };

  const startTest = (skillId: string) => { if (!state.currentUser) return; logCandidateAction(state.currentUser.id, `Rozpoczęto test dla umiejętności ID: ${skillId}`); };

  const submitTest = (skillId: string, score: number, duration?: number) => {
      if (!state.currentUser) return;
      const userId = state.currentUser.id;
      const skill = state.skills.find(s => s.id === skillId);
      const passed = score >= (skill?.required_pass_rate || 80);
      const test = state.tests.find(t => t.skill_ids.includes(skillId));
      const attempt: TestAttempt = { id: `ta_${Date.now()}`, user_id: userId, test_id: test?.id || 'unknown', score, passed, completed_at: new Date().toISOString(), duration_seconds: duration };

      setState(prev => {
          const existingSkill = prev.userSkills.find(us => us.user_id === userId && us.skill_id === skillId);
          let updatedUserSkills = existingSkill 
            ? prev.userSkills.map(us => us.user_id === userId && us.skill_id === skillId ? { ...us, theory_score: score, status: passed ? (skill?.verification_type === VerificationType.THEORY_ONLY ? SkillStatus.CONFIRMED : SkillStatus.THEORY_PASSED) : SkillStatus.FAILED, confirmed_at: passed && skill?.verification_type === VerificationType.THEORY_ONLY ? new Date().toISOString() : us.confirmed_at } : us)
            : [...prev.userSkills, { id: `us_${Date.now()}`, user_id: userId, skill_id: skillId, status: passed ? (skill?.verification_type === VerificationType.THEORY_ONLY ? SkillStatus.CONFIRMED : SkillStatus.THEORY_PASSED) : SkillStatus.FAILED, theory_score: score, confirmed_at: passed && skill?.verification_type === VerificationType.THEORY_ONLY ? new Date().toISOString() : undefined }];
          return { ...prev, testAttempts: [...prev.testAttempts, attempt], userSkills: updatedUserSkills };
      });

      logCandidateAction(userId, `Zakończono test: ${skill?.name_pl} - Wynik: ${score}% (${passed ? 'Zaliczony' : 'Niezaliczony'})`);
      if (passed) {
          const userName = `${state.currentUser.first_name} ${state.currentUser.last_name}`;
          const role = state.currentUser.role;
          const link = role === Role.CANDIDATE ? '/hr/candidates' : (role === Role.EMPLOYEE ? '/hr/employees' : '/hr/trial');
          triggerNotification('test_passed', 'Zaliczony Test', `${userName} zaliczył test: ${skill?.name_pl}`, link);
      }
  };

  const resetTestAttempt = (attemptId: string) => setState(prev => ({ ...prev, testAttempts: prev.testAttempts.filter(ta => ta.id !== attemptId) }));

  const addSkill = (skill: Omit<Skill, 'id'>) => setState(prev => ({ ...prev, skills: [...prev.skills, { ...skill, id: `s_${Date.now()}` }] }));
  const updateSkill = (skillId: string, data: Partial<Skill>) => setState(prev => ({ ...prev, skills: prev.skills.map(s => s.id === skillId ? { ...s, ...data } : s) }));
  const deleteSkill = (skillId: string) => updateSkill(skillId, { is_archived: true });

  const addTest = (test: Omit<Test, 'id'>) => setState(prev => ({ ...prev, tests: [...prev.tests, { ...test, id: `t_${Date.now()}` }] }));
  const updateTest = (testId: string, data: Partial<Test>) => setState(prev => ({ ...prev, tests: prev.tests.map(t => t.id === testId ? { ...t, ...data } : t) }));

  const addLibraryResource = (resource: Omit<LibraryResource, 'id'>) => setState(prev => ({ ...prev, libraryResources: [...prev.libraryResources, { ...resource, id: `res_${Date.now()}` }] }));
  const updateLibraryResource = (resourceId: string, data: Partial<LibraryResource>) => setState(prev => ({ ...prev, libraryResources: prev.libraryResources.map(r => r.id === resourceId ? { ...r, ...data } : r) }));
  const deleteLibraryResource = (resourceId: string) => updateLibraryResource(resourceId, { is_archived: true });

  const addCandidateDocument = (userId: string, doc: Partial<UserSkill>) => {
      const newDoc: UserSkill = { id: `doc_${Date.now()}`, user_id: userId, skill_id: doc.skill_id || 'doc_generic', status: SkillStatus.PENDING, ...doc } as UserSkill;
      setState(prev => ({ ...prev, userSkills: [...prev.userSkills, newDoc] }));
      logCandidateAction(userId, `Dodano dokument: ${doc.custom_name}`);
  };

  const updateCandidateDocumentDetails = (docId: string, data: Partial<UserSkill>) => setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === docId ? { ...us, ...data } : us) }));
  const archiveCandidateDocument = (docId: string) => updateCandidateDocumentDetails(docId, { is_archived: true });
  const restoreCandidateDocument = (docId: string) => updateCandidateDocumentDetails(docId, { is_archived: false });

  const updateUserSkillStatus = (userSkillId: string, status: SkillStatus, rejectionReason?: string) => {
      setState(prev => {
          const us = prev.userSkills.find(u => u.id === userSkillId);
          if (us) {
              const skill = prev.skills.find(s => s.id === us.skill_id);
              const isDoc = skill?.verification_type === VerificationType.DOCUMENT || us.skill_id.startsWith('doc_');
              const name = us.custom_name || (skill ? skill.name_pl : us.skill_id);
              logCandidateAction(us.user_id, status === SkillStatus.FAILED ? `Odrzucono ${isDoc ? 'dokument' : 'praktykę'}: ${name}${rejectionReason ? ` (${rejectionReason})` : ''}` : `Zatwierdzono ${isDoc ? 'dokument' : 'praktykę'}: ${name}`);
          }
          return { ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? { ...us, status, rejectionReason, confirmed_at: status === SkillStatus.CONFIRMED && !us.confirmed_at ? new Date().toISOString() : us.confirmed_at } : us) };
      });
  };

  const moveCandidateToTrial = (candidateId: string, brigadirId: string, startDate: string, endDate: string, rate: number) => {
      updateUser(candidateId, { status: UserStatus.TRIAL, role: Role.EMPLOYEE, assigned_brigadir_id: brigadirId, hired_date: startDate, trial_end_date: endDate, base_rate: rate });
      logCandidateAction(candidateId, `Rozpoczęcie okresu próbnego. Brygadzista: ${brigadirId}`);
  };

  const hireCandidate = (candidateId: string, hiredDate?: string, contractEndDate?: string) => {
      updateUser(candidateId, { status: UserStatus.ACTIVE, role: Role.EMPLOYEE, hired_date: hiredDate || new Date().toISOString(), contract_end_date: contractEndDate, trial_end_date: undefined });
      logCandidateAction(candidateId, 'Zatrudnienie na stałe');
  };

  const assignBrigadir = (userId: string, brigadirId: string) => updateUser(userId, { assigned_brigadir_id: brigadirId });

  const resetSkillProgress = (userId: string, skillId: string, mode: 'theory'|'practice'|'both') => {
      setState(prev => ({ ...prev, userSkills: prev.userSkills.filter(us => !(us.user_id === userId && us.skill_id === skillId)), testAttempts: mode === 'theory' || mode === 'both' ? prev.testAttempts.filter(ta => !(ta.user_id === userId && prev.tests.find(t => t.id === ta.test_id)?.skill_ids.includes(skillId))) : prev.testAttempts }));
      logCandidateAction(userId, `Reset postępu: ${skillId} (${mode})`);
  };

  const addPosition = (posData: Omit<Position, 'id' | 'order'>) => setState(prev => ({ ...prev, positions: [...prev.positions, { ...posData, id: `p_${Date.now()}`, order: prev.positions.length + 1 }] }));
  const updatePosition = (id: string, data: Partial<Position>) => setState(prev => ({ ...prev, positions: prev.positions.map(p => p.id === id ? { ...p, ...data } : p) }));
  const deletePosition = (id: string) => setState(prev => ({ ...prev, positions: prev.positions.filter(p => p.id !== id) }));
  const reorderPositions = (newPositions: Position[]) => setState(prev => ({ ...prev, positions: newPositions.map((p, idx) => ({ ...p, order: idx + 1 })) }));

  const confirmSkillPractice = (userSkillId: string, checkerId: string) => {
      setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? { ...us, status: SkillStatus.CONFIRMED, practice_checked_by: checkerId, practice_date: new Date().toISOString(), confirmed_at: new Date().toISOString() } : us) }));
      const us = state.userSkills.find(u => u.id === userSkillId);
      // Fix: Referenced state.skills correctly instead of an undefined local name.
      if (us) logCandidateAction(us.user_id, `Zaliczono praktykę: ${state.skills.find(s => s.id === us.skill_id)?.name_pl || 'Unknown'}`);
  };

  const saveSkillChecklistProgress = (userSkillId: string, progress: Record<number, ChecklistItemState>) => setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? { ...us, checklist_progress: progress } : us) }));
  const updateVerificationDetails = (userSkillId: string, data: Partial<UserSkill>) => setState(prev => ({ ...prev, userSkills: prev.userSkills.map(us => us.id === userSkillId ? { ...us, ...data } : us) }));
  
  const addQualityIncident = (incident: Omit<QualityIncident, 'id'>) => setState(prev => ({ ...prev, qualityIncidents: [...prev.qualityIncidents, { ...incident, id: `qi_${Date.now()}` }] }));

  const addEmployeeNote = (note: Omit<EmployeeNote, 'id' | 'created_at'>) => setState(prev => ({ ...prev, employeeNotes: [{ ...note, id: `note_${Date.now()}`, created_at: new Date().toISOString() }, ...prev.employeeNotes] }));
  const deleteEmployeeNote = (id: string) => setState(prev => ({ ...prev, employeeNotes: prev.employeeNotes.filter(n => n.id !== id) }));

  const addEmployeeBadge = (badge: Omit<EmployeeBadge, 'id' | 'created_at'>) => {
      const id = `badge_${Date.now()}`;
      setState(prev => ({ ...prev, employeeBadges: [{ ...badge, id, created_at: new Date().toISOString() }, ...prev.employeeBadges] }));
      if (state.users.find(u => u.id === badge.employee_id)) triggerNotification('status_change', 'Otrzymano Odznakę!', `Gratulacje! Otrzymałeś odznakę "${badge.type}"`);
  };

  const deleteEmployeeBadge = (id: string) => setState(prev => ({ ...prev, employeeBadges: prev.employeeBadges.filter(b => b.id !== id) }));

  const inviteFriend = (firstName: string, lastName: string, phone: string, targetPosition: string) => {
    if (!state.currentUser) return;
    const newFriend: User = { id: `ref_${Date.now()}`, first_name: firstName, last_name: lastName, phone, email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@referral.pl`, role: Role.CANDIDATE, status: UserStatus.INVITED, hired_date: new Date().toISOString(), referred_by_id: state.currentUser.id, target_position: targetPosition, source: `Polecenie: ${state.currentUser.first_name} ${state.currentUser.last_name}` };
    setState(prev => ({ ...prev, users: [newFriend, ...prev.users] }));
    triggerNotification('candidate_link', 'Wysłano Zaproszenie', `Polecenie dla ${firstName} ${lastName} zostało zapisane.`);
    logCandidateAction(state.currentUser.id, `Zaproś znajomego: ${firstName} ${lastName}`);
  };

  const payReferralBonus = (referralUserId: string) => {
    setState(prev => ({ ...prev, users: prev.users.map(u => u.id === referralUserId ? { ...u, referral_bonus_paid: true, referral_bonus_paid_date: new Date().toISOString() } : u) }));
    const referralUser = state.users.find(u => u.id === referralUserId);
    if (referralUser?.referred_by_id) logCandidateAction(referralUser.referred_by_id, `Wypłacono bonus za polecenie: ${referralUser.first_name}`);
  };

  const updateSystemConfig = (config: SystemConfig) => setState(prev => ({ ...prev, systemConfig: config }));
  const updateNotificationSettings = (settings: NotificationSetting[]) => setState(prev => ({ ...prev, notificationSettings: settings }));
  const markNotificationAsRead = (id: string) => setState(prev => ({ ...prev, appNotifications: prev.appNotifications.map(n => n.id === id ? { ...n, isRead: true } : n) }));
  const markAllNotificationsAsRead = () => setState(prev => ({ ...prev, appNotifications: prev.appNotifications.map(n => ({ ...n, isRead: true })) }));
  const clearToast = () => setState(prev => ({ ...prev, toast: null }));

  return (
    <AppContext.Provider value={{
      state, login, loginAsUser, logout, addUser, updateUser, deleteUser, addCandidate, logCandidateAction, startTest, submitTest, resetTestAttempt, addSkill, updateSkill, deleteSkill, addTest, updateTest, addLibraryResource, updateLibraryResource, deleteLibraryResource, addCandidateDocument, updateCandidateDocumentDetails, archiveCandidateDocument, restoreCandidateDocument, updateUserSkillStatus, moveCandidateToTrial, hireCandidate, assignBrigadir, resetSkillProgress, addPosition, updatePosition, deletePosition, reorderPositions, confirmSkillPractice, saveSkillChecklistProgress, updateVerificationDetails, addQualityIncident, addEmployeeNote, deleteEmployeeNote, addEmployeeBadge, deleteEmployeeBadge, inviteFriend, payReferralBonus, updateSystemConfig, updateNotificationSettings, triggerNotification, markNotificationAsRead, markAllNotificationsAsRead, clearToast
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
