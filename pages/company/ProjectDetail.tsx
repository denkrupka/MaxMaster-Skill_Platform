
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, BarChart3, Calendar, ClipboardList, FileCheck, DollarSign,
  Receipt, Clock, Users, MessageSquare, Paperclip, Loader2, Plus, X,
  Pencil, Trash2, Upload, Download, Eye, Check, XCircle, Search,
  ChevronDown, Building2, MapPin, TrendingUp, FileText, Settings,
  ExternalLink, AlertCircle, Wrench, Tag, Hash, ChevronLeft, ChevronRight,
  Save
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import {
  Project, ProjectTask, ProjectMember, ProjectCustomer, TaskTimeLog,
  TaskAttachment, TaskStatus_Project, TaskPriority, ProjectStatus, User,
  Department, ProjectBillingType, ProjectNameMode, ProjectProtocol,
  ProjectIncome, ProjectCost, ProjectScheduleEntry, ProjectIssue,
  ProjectFile, ProjectMemberType, ProjectMemberPaymentType, ProjectMemberStatus,
  ProjectIssueStatus, ProjectTaskBillingType, ProjectTaskWorkerPayment,
  ProjectProtocolTask, ProjectIssueHistoryEntry, ProjectCustomerContact,
  ContractorClient
} from '../../types';

const PROJECT_STATUS_CONFIG: Record<ProjectStatus, { label: string; bg: string; text: string }> = {
  active: { label: 'Aktywny', bg: 'bg-green-100', text: 'text-green-700' },
  completed: { label: 'Zakończony', bg: 'bg-blue-100', text: 'text-blue-700' },
  archived: { label: 'Zarchiwizowany', bg: 'bg-gray-100', text: 'text-gray-600' },
  on_hold: { label: 'Wstrzymany', bg: 'bg-amber-100', text: 'text-amber-700' },
};

type TabKey = 'summary' | 'schedule' | 'tasks' | 'protocols' | 'income' | 'costs' | 'timeTracking' | 'members' | 'issues' | 'attachments';

interface TabDef {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  onlyRyczalt?: boolean;
}

const TABS: TabDef[] = [
  { key: 'summary', label: 'Podsumowanie', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: 'schedule', label: 'Harmonogram', icon: <Calendar className="w-3.5 h-3.5" /> },
  { key: 'tasks', label: 'Zadania', icon: <ClipboardList className="w-3.5 h-3.5" /> },
  { key: 'protocols', label: 'Protokoły', icon: <FileCheck className="w-3.5 h-3.5" />, onlyRyczalt: true },
  { key: 'income', label: 'Przychody', icon: <DollarSign className="w-3.5 h-3.5" /> },
  { key: 'costs', label: 'Koszty', icon: <Receipt className="w-3.5 h-3.5" /> },
  { key: 'timeTracking', label: 'Ewidencja czasu', icon: <Clock className="w-3.5 h-3.5" /> },
  { key: 'members', label: 'Pracownicy', icon: <Users className="w-3.5 h-3.5" /> },
  { key: 'issues', label: 'Zgłoszenia', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  { key: 'attachments', label: 'Załączniki', icon: <Paperclip className="w-3.5 h-3.5" /> },
];

const MONTH_NAMES = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

// Helper: count working days, saturdays, sundays in a date range within a specific month/year
function countDaysInMonth(year: number, month: number) {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workDays = 0, saturdays = 0, sundays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day === 0) sundays++;
    else if (day === 6) saturdays++;
    else workDays++;
  }
  return { workDays, saturdays, sundays };
}

interface ProjectDetailPageProps {
  project: Project;
  projects: Project[];
  customers: ProjectCustomer[];
  contractorClients?: ContractorClient[];
  departments: Department[];
  companyUsers: User[];
  users: User[];
  onBack: () => void;
  onEditProject: (project: Project) => void;
  onUpdateProject: (updated: Project) => void;
}

// Task form state
interface TaskFormState {
  name: string;
  billing_type: ProjectTaskBillingType;
  hourly_value: number;
  quantity: number;
  unit: string;
  price_per_unit: number;
  worker_payment_type: ProjectTaskWorkerPayment;
  worker_rate_per_unit: number;
  assigned_users: string[];
  has_start_deadline: boolean;
  start_date: string;
  start_time: string;
  has_end_deadline: boolean;
  end_date: string;
  end_time: string;
  description: string;
}

const emptyTaskForm: TaskFormState = {
  name: '',
  billing_type: 'ryczalt',
  hourly_value: 0,
  quantity: 0,
  unit: 'szt.',
  price_per_unit: 0,
  worker_payment_type: 'hourly',
  worker_rate_per_unit: 0,
  assigned_users: [],
  has_start_deadline: false,
  start_date: '',
  start_time: '',
  has_end_deadline: false,
  end_date: '',
  end_time: '',
  description: '',
};

export const ProjectDetailPage: React.FC<ProjectDetailPageProps> = ({
  project, projects, customers, contractorClients = [], departments, companyUsers, users,
  onBack, onEditProject, onUpdateProject
}) => {
  const { state, setState } = useAppContext();
  const { currentUser } = state;

  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [loading, setLoading] = useState(true);

  // Data for tabs
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [timeLogs, setTimeLogs] = useState<TaskTimeLog[]>([]);
  const [protocols, setProtocols] = useState<ProjectProtocol[]>([]);
  const [income, setIncome] = useState<ProjectIncome[]>([]);
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [schedule, setSchedule] = useState<ProjectScheduleEntry[]>([]);
  const [issues, setIssues] = useState<ProjectIssue[]>([]);
  const [files, setFiles] = useState<ProjectFile[]>([]);

  // Summary mode: 'month' or 'all'
  const [summaryMode, setSummaryMode] = useState<'month' | 'all'>('month');
  const [summaryMonth, setSummaryMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  // Schedule tab state
  const [scheduleMonth, setScheduleMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [scheduleInput, setScheduleInput] = useState('');
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Tasks modal state
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState<TaskFormState>({ ...emptyTaskForm });
  const [savingTask, setSavingTask] = useState(false);
  const [selectedTask, setSelectedTask] = useState<ProjectTask | null>(null);
  const [taskDetailTab, setTaskDetailTab] = useState<'edit' | 'description' | 'attachments'>('edit');
  const [taskAttachments, setTaskAttachments] = useState<TaskAttachment[]>([]);
  const [editingTask, setEditingTask] = useState<TaskFormState>({ ...emptyTaskForm });
  const [showMembersDropdown, setShowMembersDropdown] = useState(false);

  useEffect(() => {
    if (currentUser && project) loadProjectData();
  }, [currentUser, project?.id]);

  const safeQuery = (promise: Promise<any>) => promise.then(r => r.data || []).catch(() => []);

  const loadProjectData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [tasks, members, timeLogs, protocols, income, costs, schedule, issues, files] = await Promise.all([
        safeQuery(supabase.from('project_tasks').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_members').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('task_time_logs').select('*').eq('company_id', currentUser.company_id)),
        safeQuery(supabase.from('project_protocols').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_income').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_costs').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_schedule').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_issues').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_files').select('*').eq('project_id', project.id)),
      ]);
      setTasks(tasks);
      setMembers(members);
      setTimeLogs(timeLogs);
      setProtocols(protocols);
      setIncome(income);
      setCosts(costs);
      setSchedule(schedule);
      setIssues(issues);
      setFiles(files);
    } catch (err) {
      console.error('Error loading project data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getUserName = (userId?: string) => {
    if (!userId) return 'Nieprzypisany';
    const u = users.find(u => u.id === userId);
    return u ? `${u.first_name} ${u.last_name}` : 'Nieznany';
  };

  const getCustomerName = (customerId?: string) => {
    if (!customerId) return '-';
    const cc = contractorClients.find(c => c.id === customerId);
    if (cc) return cc.name;
    return customers.find(c => c.id === customerId)?.name || '-';
  };

  const getDepartmentName = (deptId?: string) => {
    if (!deptId) return '-';
    return departments.find(d => d.id === deptId)?.name || '-';
  };

  const statusCfg = PROJECT_STATUS_CONFIG[project.status];
  const dept = project.department_id ? departments.find(d => d.id === project.department_id) : null;

  // Calculations
  const totalIncome = income.reduce((s, i) => s + (i.value || 0), 0);
  const totalDirectCosts = costs.filter(c => c.cost_type === 'direct').reduce((s, c) => s + (c.value_netto || 0), 0);
  const totalLaborCosts = costs.filter(c => c.cost_type === 'labor').reduce((s, c) => s + (c.value_netto || 0), 0);
  const totalCosts = totalDirectCosts + totalLaborCosts;
  const profit = (project.billing_type === 'ryczalt' ? (project.budget_amount || 0) : totalIncome) - totalCosts;

  const totalLoggedMinutes = timeLogs
    .filter(tl => tasks.some(t => t.id === tl.task_id))
    .reduce((s, tl) => s + (tl.minutes || 0), 0);

  // Monthly analytics calculations
  const getMonthlyAnalytics = (year: number, month: number) => {
    const { workDays, saturdays, sundays } = countDaysInMonth(year, month);

    // Planned revenue
    let plannedRevenue = 0;
    if (project.billing_type === 'ryczalt') {
      // From schedule for this month
      const entry = schedule.find(s => s.year === year && s.month === month);
      plannedRevenue = entry ? entry.planned_amount : 0;
    } else {
      // Hourly (RG) calculation
      const membersCount = members.length;
      const dailyHours = project.overtime_base_hours || 8;
      const rate = project.hourly_rate || 0;

      // Base: workers × working_days × daily_hours × rate
      plannedRevenue = membersCount * workDays * dailyHours * rate;

      // Saturday hours
      if (project.saturday_paid && project.saturday_rate && project.saturday_hours) {
        plannedRevenue += project.saturday_hours * project.saturday_rate * saturdays;
      }

      // Sunday hours
      if (project.sunday_paid && project.sunday_rate && project.sunday_hours) {
        plannedRevenue += project.sunday_hours * project.sunday_rate * sundays;
      }
    }

    // Monthly costs
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const monthDirectCosts = costs
      .filter(c => c.cost_type === 'direct' && c.issue_date && new Date(c.issue_date) >= monthStart && new Date(c.issue_date) <= monthEnd)
      .reduce((s, c) => s + (c.value_netto || 0), 0);

    const monthLaborCosts = costs
      .filter(c => c.cost_type === 'labor' && c.issue_date && new Date(c.issue_date) >= monthStart && new Date(c.issue_date) <= monthEnd)
      .reduce((s, c) => s + (c.value_netto || 0), 0);

    const monthPlannedProfit = plannedRevenue - monthDirectCosts - monthLaborCosts;

    return { plannedRevenue, monthDirectCosts, monthLaborCosts, monthPlannedProfit };
  };

  const visibleTabs = TABS.filter(t => {
    if (t.onlyRyczalt && project.billing_type !== 'ryczalt') return false;
    return true;
  });

  // =========== SUMMARY TAB ===========
  const renderSummary = () => {
    const analytics = summaryMode === 'month'
      ? getMonthlyAnalytics(summaryMonth.year, summaryMonth.month)
      : null;

    return (
      <div className="space-y-6">
        {/* Mode switcher */}
        <div className="flex items-center gap-4">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setSummaryMode('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                summaryMode === 'month' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Miesiąc
            </button>
            <button
              onClick={() => setSummaryMode('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                summaryMode === 'all' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Cały czas
            </button>
          </div>
          {summaryMode === 'month' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const m = summaryMonth.month === 1 ? 12 : summaryMonth.month - 1;
                  const y = summaryMonth.month === 1 ? summaryMonth.year - 1 : summaryMonth.year;
                  setSummaryMonth({ year: y, month: m });
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
                {MONTH_NAMES[summaryMonth.month - 1]} {summaryMonth.year}
              </span>
              <button
                onClick={() => {
                  const m = summaryMonth.month === 12 ? 1 : summaryMonth.month + 1;
                  const y = summaryMonth.month === 12 ? summaryMonth.year + 1 : summaryMonth.year;
                  setSummaryMonth({ year: y, month: m });
                }}
                className="p-1 rounded hover:bg-gray-100 text-gray-500"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Analytics cards */}
        {summaryMode === 'month' && analytics && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Planowany przychód</p>
              <p className="text-xl font-bold text-blue-600 mt-1">{analytics.plannedRevenue.toLocaleString('pl-PL')} PLN</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                {project.billing_type === 'ryczalt' ? 'z harmonogramu' : 'wg stawki RG'}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Koszty bezpośrednie</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{analytics.monthDirectCosts.toLocaleString('pl-PL')} PLN</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Koszty robocizny</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{analytics.monthLaborCosts.toLocaleString('pl-PL')} PLN</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Planowany zysk</p>
              <p className={`text-xl font-bold mt-1 ${analytics.monthPlannedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {analytics.monthPlannedProfit.toLocaleString('pl-PL')} PLN
              </p>
            </div>
          </div>
        )}

        {/* All-time metrics */}
        {summaryMode === 'all' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Budżet netto</p>
              <p className="text-xl font-bold text-gray-900 mt-1">
                {project.billing_type === 'ryczalt'
                  ? `${(project.budget_amount || 0).toLocaleString('pl-PL')} PLN`
                  : `${(project.hourly_rate || 0)} PLN/godz.`}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Przychody netto</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{totalIncome.toLocaleString('pl-PL')} PLN</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Koszty netto</p>
              <p className="text-xl font-bold text-gray-900 mt-1">{totalCosts.toLocaleString('pl-PL')} PLN</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Zysk netto</p>
              <p className={`text-xl font-bold mt-1 ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profit.toLocaleString('pl-PL')} PLN
              </p>
            </div>
          </div>
        )}

        {/* Project info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Informacje o projekcie</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Klient</span><span className="text-gray-900">{getCustomerName(project.contractor_client_id || project.customer_id)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Obiekt</span><span className="text-gray-900">{getDepartmentName(project.department_id)}</span></div>
              {dept?.kod_obiektu && <div className="flex justify-between"><span className="text-gray-500">Kod budowy</span><span className="text-gray-900">{dept.kod_obiektu}</span></div>}
              {dept?.rodzaj && <div className="flex justify-between"><span className="text-gray-500">Rodzaj</span><span className="text-gray-900">{dept.rodzaj}</span></div>}
              {dept?.typ && <div className="flex justify-between"><span className="text-gray-500">Typ</span><span className="text-gray-900">{dept.typ}</span></div>}
              {(dept?.address_street || dept?.address_city) && (
                <div className="flex justify-between"><span className="text-gray-500">Adres</span><span className="text-gray-900">{[dept.address_street, dept.address_postal_code, dept.address_city].filter(Boolean).join(', ')}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">Forma wynagrodzenia</span><span className="text-gray-900">{project.billing_type === 'ryczalt' ? 'Ryczałt' : 'Roboczogodziny'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Data rozpoczęcia</span><span className="text-gray-900">{project.start_date ? new Date(project.start_date).toLocaleDateString('pl-PL') : '-'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Data zakończenia</span><span className="text-gray-900">{project.end_date ? new Date(project.end_date).toLocaleDateString('pl-PL') : '-'}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Statystyki</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Zadania</span><span className="text-gray-900">{tasks.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Pracownicy</span><span className="text-gray-900">{members.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Zalogowane godziny</span><span className="text-gray-900">{(totalLoggedMinutes / 60).toFixed(1)} godz.</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Koszty bezpośrednie netto</span><span className="text-gray-900">{totalDirectCosts.toLocaleString('pl-PL')} PLN</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Koszty robocizny netto</span><span className="text-gray-900">{totalLaborCosts.toLocaleString('pl-PL')} PLN</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Zgłoszenia</span><span className="text-gray-900">{issues.length}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Załączniki</span><span className="text-gray-900">{files.length}</span></div>
            </div>
          </div>
        </div>

        {/* Budget progress for ryczalt */}
        {project.billing_type === 'ryczalt' && project.budget_amount && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Realizacja budżetu netto</h3>
            <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
              <span>Zafakturowano: {totalIncome.toLocaleString('pl-PL')} PLN</span>
              <span>Budżet: {project.budget_amount.toLocaleString('pl-PL')} PLN</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              {(() => {
                const pct = Math.min((totalIncome / project.budget_amount) * 100, 100);
                return (
                  <div
                    className={`h-3 rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                );
              })()}
            </div>
          </div>
        )}

        {project.description && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Opis</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{project.description}</p>
          </div>
        )}
      </div>
    );
  };

  // =========== SCHEDULE TAB ===========
  const currentScheduleEntry = useMemo(() => {
    return schedule.find(s => s.year === scheduleMonth.year && s.month === scheduleMonth.month);
  }, [schedule, scheduleMonth]);

  useEffect(() => {
    setScheduleInput(currentScheduleEntry ? String(currentScheduleEntry.planned_amount) : '');
  }, [currentScheduleEntry, scheduleMonth]);

  const saveScheduleEntry = async () => {
    if (!currentUser) return;
    setScheduleSaving(true);
    try {
      const amount = parseFloat(scheduleInput) || 0;
      if (currentScheduleEntry) {
        await supabase.from('project_schedule').update({ planned_amount: amount }).eq('id', currentScheduleEntry.id);
        setSchedule(prev => prev.map(s => s.id === currentScheduleEntry.id ? { ...s, planned_amount: amount } : s));
      } else {
        const { data } = await supabase.from('project_schedule').insert({
          project_id: project.id,
          company_id: currentUser.company_id,
          year: scheduleMonth.year,
          month: scheduleMonth.month,
          planned_amount: amount,
        }).select().single();
        if (data) setSchedule(prev => [...prev, data]);
      }
    } catch (err) {
      console.error('Error saving schedule:', err);
    } finally {
      setScheduleSaving(false);
    }
  };

  const renderSchedule = () => (
    <div className="space-y-4">
      {/* Month navigation */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Prognoza miesięczna</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const m = scheduleMonth.month === 1 ? 12 : scheduleMonth.month - 1;
                const y = scheduleMonth.month === 1 ? scheduleMonth.year - 1 : scheduleMonth.year;
                setScheduleMonth({ year: y, month: m });
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-gray-700 min-w-[140px] text-center">
              {MONTH_NAMES[scheduleMonth.month - 1]} {scheduleMonth.year}
            </span>
            <button
              onClick={() => {
                const m = scheduleMonth.month === 12 ? 1 : scheduleMonth.month + 1;
                const y = scheduleMonth.month === 12 ? scheduleMonth.year + 1 : scheduleMonth.year;
                setScheduleMonth({ year: y, month: m });
              }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Prognozowana kwota netto (PLN)</label>
            <input
              type="number"
              value={scheduleInput}
              onChange={e => setScheduleInput(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
          <button
            onClick={saveScheduleEntry}
            disabled={scheduleSaving}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {scheduleSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Zapisz
          </button>
        </div>
      </div>

      {/* Overview table */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Przegląd harmonogramu</h3>
        {schedule.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak danych harmonogramu</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Miesiąc</th>
                <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Planowana kwota netto (PLN)</th>
              </tr>
            </thead>
            <tbody>
              {[...schedule].sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month)).map(s => (
                <tr
                  key={s.id}
                  className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                    s.year === scheduleMonth.year && s.month === scheduleMonth.month ? 'bg-blue-50' : ''
                  }`}
                  onClick={() => setScheduleMonth({ year: s.year, month: s.month })}
                >
                  <td className="px-4 py-2 text-sm text-gray-600">{MONTH_NAMES[s.month - 1]} {s.year}</td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right font-medium">{s.planned_amount.toLocaleString('pl-PL')} PLN</td>
                </tr>
              ))}
              <tr className="bg-gray-50 font-semibold">
                <td className="px-4 py-2 text-sm text-gray-900">Razem</td>
                <td className="px-4 py-2 text-sm text-gray-900 text-right">{schedule.reduce((s, e) => s + e.planned_amount, 0).toLocaleString('pl-PL')} PLN</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  // =========== TASKS TAB ===========
  const handleSaveTask = async (isEdit = false) => {
    if (!currentUser) return;
    setSavingTask(true);
    const form = isEdit ? editingTask : taskForm;
    try {
      const taskData: any = {
        project_id: project.id,
        company_id: currentUser.company_id,
        title: form.name,
        description: form.description,
        billing_type: form.billing_type,
        status: 'todo' as TaskStatus_Project,
        priority: 'medium' as TaskPriority,
        is_archived: false,
        worker_payment_type: form.worker_payment_type,
        worker_rate_per_unit: form.worker_payment_type === 'akord' ? form.worker_rate_per_unit : null,
        assigned_users: form.assigned_users,
        assigned_to: form.assigned_users.length > 0 ? form.assigned_users[0] : null,
        has_start_deadline: form.has_start_deadline,
        start_date: form.has_start_deadline ? form.start_date || null : null,
        start_time: form.has_start_deadline ? form.start_time || null : null,
        has_end_deadline: form.has_end_deadline,
        due_date: form.has_end_deadline ? form.end_date || null : null,
        end_time: form.has_end_deadline ? form.end_time || null : null,
      };

      if (form.billing_type === 'ryczalt') {
        taskData.quantity = form.quantity;
        taskData.unit = form.unit;
        taskData.price_per_unit = form.price_per_unit;
        taskData.total_value = form.quantity * form.price_per_unit;
        taskData.hourly_value = null;
      } else {
        taskData.hourly_value = form.hourly_value;
        taskData.quantity = null;
        taskData.unit = null;
        taskData.price_per_unit = null;
        taskData.total_value = form.hourly_value;
      }

      if (isEdit && selectedTask) {
        const { data } = await supabase.from('project_tasks').update(taskData).eq('id', selectedTask.id).select().single();
        if (data) {
          setTasks(prev => prev.map(t => t.id === selectedTask.id ? data : t));
          setSelectedTask(data);
        }
      } else {
        taskData.created_by = currentUser.id;
        const { data } = await supabase.from('project_tasks').insert(taskData).select().single();
        if (data) setTasks(prev => [data, ...prev]);
        setShowAddTask(false);
        setTaskForm({ ...emptyTaskForm });
      }
    } catch (err) {
      console.error('Error saving task:', err);
    } finally {
      setSavingTask(false);
    }
  };

  const loadTaskAttachments = async (taskId: string) => {
    const { data } = await supabase.from('task_attachments').select('*').eq('task_id', taskId).order('created_at', { ascending: false });
    setTaskAttachments(data || []);
  };

  const openTaskDetail = (task: ProjectTask) => {
    setSelectedTask(task);
    setTaskDetailTab('edit');
    setEditingTask({
      name: task.title,
      billing_type: task.billing_type,
      hourly_value: task.hourly_value || 0,
      quantity: task.quantity || 0,
      unit: task.unit || 'szt.',
      price_per_unit: task.price_per_unit || 0,
      worker_payment_type: task.worker_payment_type,
      worker_rate_per_unit: task.worker_rate_per_unit || 0,
      assigned_users: task.assigned_users || [],
      has_start_deadline: task.has_start_deadline || false,
      start_date: task.start_date || '',
      start_time: task.start_time || '',
      has_end_deadline: task.has_end_deadline || false,
      end_date: task.due_date || '',
      end_time: task.end_time || '',
      description: task.description || '',
    });
    loadTaskAttachments(task.id);
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0] || !selectedTask || !currentUser) return;
    const file = e.target.files[0];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `task-attachments/${selectedTask.id}/${Date.now()}_${safeName}`;

    try {
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);

      await supabase.from('task_attachments').insert({
        task_id: selectedTask.id,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: currentUser.id,
      });
      loadTaskAttachments(selectedTask.id);
    } catch (err) {
      console.error('Error uploading attachment:', err);
    }
    e.target.value = '';
  };

  const renderTaskFormFields = (form: TaskFormState, setForm: (f: TaskFormState) => void, membersDropdownOpen: boolean, setMembersDropdownOpen: (v: boolean) => void) => (
    <div className="space-y-4">
      {/* Nazwa */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Nazwa zadania</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm({ ...form, name: e.target.value })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Nazwa zadania"
        />
      </div>

      {/* Billing type toggle */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Forma wynagrodzenia</label>
        <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setForm({ ...form, billing_type: 'ryczalt' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              form.billing_type === 'ryczalt' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Ryczałt
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, billing_type: 'hourly' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              form.billing_type === 'hourly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Roboczogodziny
          </button>
        </div>
      </div>

      {/* Billing fields */}
      {form.billing_type === 'hourly' ? (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Wartość (PLN)</label>
          <input
            type="number"
            value={form.hourly_value || ''}
            onChange={e => setForm({ ...form, hourly_value: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ilość</label>
            <input
              type="number"
              value={form.quantity || ''}
              onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Jed. miary</label>
            <input
              type="text"
              value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Cena za 1</label>
            <input
              type="number"
              value={form.price_per_unit || ''}
              onChange={e => setForm({ ...form, price_per_unit: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Wartość</label>
            <input
              type="text"
              readOnly
              value={`${(form.quantity * form.price_per_unit).toLocaleString('pl-PL')} PLN`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-700"
            />
          </div>
        </div>
      )}

      {/* Worker payment type */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Forma wynagrodzenia pracownika</label>
        <div className="flex bg-gray-100 rounded-lg p-0.5 w-fit">
          <button
            type="button"
            onClick={() => setForm({ ...form, worker_payment_type: 'akord' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              form.worker_payment_type === 'akord' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Akord
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, worker_payment_type: 'hourly' })}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              form.worker_payment_type === 'hourly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Roboczogodziny
          </button>
        </div>
      </div>

      {form.worker_payment_type === 'akord' && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Wynagrodzenie pracownika za 1</label>
          <input
            type="number"
            value={form.worker_rate_per_unit || ''}
            onChange={e => setForm({ ...form, worker_rate_per_unit: parseFloat(e.target.value) || 0 })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      )}

      {/* Assigned users */}
      <div className="relative">
        <label className="block text-xs font-medium text-gray-700 mb-1">Pracownicy odpowiedzialni</label>
        <button
          type="button"
          onClick={() => setMembersDropdownOpen(!membersDropdownOpen)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-left bg-white flex items-center justify-between focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <span className="text-gray-700">
            {form.assigned_users.length > 0
              ? form.assigned_users.map(id => getUserName(id)).join(', ')
              : 'Wybierz pracowników'}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-400" />
        </button>
        {membersDropdownOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {members.map(m => (
              <label
                key={m.user_id}
                className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={form.assigned_users.includes(m.user_id)}
                  onChange={e => {
                    const newUsers = e.target.checked
                      ? [...form.assigned_users, m.user_id]
                      : form.assigned_users.filter(id => id !== m.user_id);
                    setForm({ ...form, assigned_users: newUsers });
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                {getUserName(m.user_id)}
              </label>
            ))}
            {members.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">Brak pracowników w projekcie</p>
            )}
          </div>
        )}
      </div>

      {/* Deadlines */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
            <input
              type="checkbox"
              checked={form.has_start_deadline}
              onChange={e => setForm({ ...form, has_start_deadline: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Termin rozpoczęcia
          </label>
          {form.has_start_deadline && (
            <div className="flex gap-2">
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-gray-700 mb-2">
            <input
              type="checkbox"
              checked={form.has_end_deadline}
              onChange={e => setForm({ ...form, has_end_deadline: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            Termin zakończenia
          </label>
          {form.has_end_deadline && (
            <div className="flex gap-2">
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Opis zadania</label>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          placeholder="Opis zadania..."
        />
      </div>
    </div>
  );

  const [addTaskMembersDropdown, setAddTaskMembersDropdown] = useState(false);
  const [editTaskMembersDropdown, setEditTaskMembersDropdown] = useState(false);

  const renderTasks = () => (
    <div className="space-y-4">
      {/* Add task button */}
      <div className="flex justify-end">
        <button
          onClick={() => { setShowAddTask(true); setTaskForm({ ...emptyTaskForm }); }}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj zadanie
        </button>
      </div>

      {/* Task list */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {tasks.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak zadań</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data rozpoczęcia</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data zakończenia</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wartość</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(task => (
                <tr
                  key={task.id}
                  className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  onClick={() => openTaskDetail(task)}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{task.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {task.start_date ? new Date(task.start_date).toLocaleDateString('pl-PL') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {task.due_date ? new Date(task.due_date).toLocaleDateString('pl-PL') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {task.total_value ? `${task.total_value.toLocaleString('pl-PL')} PLN` :
                     task.hourly_value ? `${task.hourly_value.toLocaleString('pl-PL')} PLN` : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddTask(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Dodaj zadanie</h2>
              <button onClick={() => setShowAddTask(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {renderTaskFormFields(taskForm, setTaskForm, addTaskMembersDropdown, setAddTaskMembersDropdown)}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200">
              <button onClick={() => setShowAddTask(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">
                Anuluj
              </button>
              <button
                onClick={() => handleSaveTask(false)}
                disabled={savingTask || !taskForm.name.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSelectedTask(null); setEditTaskMembersDropdown(false); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">{selectedTask.title}</h2>
              <button onClick={() => { setSelectedTask(null); setEditTaskMembersDropdown(false); }} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Detail tabs */}
            <div className="border-b border-gray-200 px-6">
              <div className="flex gap-0">
                {[
                  { key: 'edit' as const, label: 'Edytuj' },
                  { key: 'description' as const, label: 'Opis zadania' },
                  { key: 'attachments' as const, label: 'Załączniki' },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTaskDetailTab(t.key)}
                    className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                      taskDetailTab === t.key
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {taskDetailTab === 'edit' && (
                <>
                  {renderTaskFormFields(editingTask, setEditingTask, editTaskMembersDropdown, setEditTaskMembersDropdown)}
                  <div className="flex justify-end mt-4">
                    <button
                      onClick={() => handleSaveTask(true)}
                      disabled={savingTask || !editingTask.name.trim()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingTask && <Loader2 className="w-4 h-4 animate-spin" />}
                      Zapisz zmiany
                    </button>
                  </div>
                </>
              )}
              {taskDetailTab === 'description' && (
                <div>
                  {selectedTask.description ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{selectedTask.description}</p>
                  ) : (
                    <p className="text-sm text-gray-400">Brak opisu zadania</p>
                  )}
                </div>
              )}
              {taskDetailTab === 'attachments' && (
                <div className="space-y-4">
                  <div className="flex justify-end">
                    <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer">
                      <Upload className="w-4 h-4" />
                      Dodaj plik
                      <input type="file" className="hidden" onChange={handleUploadAttachment} />
                    </label>
                  </div>
                  {taskAttachments.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">Brak załączników</p>
                  ) : (
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Autor</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Data</th>
                        </tr>
                      </thead>
                      <tbody>
                        {taskAttachments.map(att => (
                          <tr key={att.id} className="border-b border-gray-100">
                            <td className="px-4 py-2">
                              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                                {att.file_name}
                              </a>
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-600">{getUserName(att.uploaded_by)}</td>
                            <td className="px-4 py-2 text-sm text-gray-600">{new Date(att.created_at).toLocaleDateString('pl-PL')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // =========== REMAINING TABS (unchanged) ===========
  const renderProtocols = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      {protocols.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Brak protokołów</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nr protokołu</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zaawansowanie %</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wartość netto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
            </tr>
          </thead>
          <tbody>
            {protocols.map(p => (
              <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.protocol_number}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{p.protocol_type === 'standard' ? 'Standardowy' : 'Dodatkowy'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{p.advancement_percent}%</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{p.total_value.toLocaleString('pl-PL')} PLN</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${p.accepted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {p.accepted ? 'Zaakceptowany' : 'Oczekuje'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(p.created_at).toLocaleDateString('pl-PL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderIncome = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">Przychody netto</h3>
        <span className="text-sm font-bold text-green-600">{totalIncome.toLocaleString('pl-PL')} PLN netto</span>
      </div>
      {income.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Brak przychodów</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ dokumentu</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nr dokumentu</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data wystawienia</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin płatności</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wartość netto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {income.map(i => (
              <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-600">{i.document_type}</td>
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.document_number}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(i.issue_date).toLocaleDateString('pl-PL')}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(i.payment_due_date).toLocaleDateString('pl-PL')}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{i.value.toLocaleString('pl-PL')} PLN</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    i.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {i.payment_status === 'paid' ? 'Opłacone' : i.payment_status || 'Oczekuje'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderCosts = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Koszty bezpośrednie netto</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{totalDirectCosts.toLocaleString('pl-PL')} PLN</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Koszty robocizny netto</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{totalLaborCosts.toLocaleString('pl-PL')} PLN</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-medium">Razem netto</p>
          <p className="text-lg font-bold text-gray-900 mt-1">{totalCosts.toLocaleString('pl-PL')} PLN</p>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {costs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak kosztów</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dokument</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wystawca</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategoria</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wartość netto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
              </tr>
            </thead>
            <tbody>
              {costs.map(c => (
                <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      c.cost_type === 'direct' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {c.cost_type === 'direct' ? 'Bezpośredni' : 'Robocizna'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">{c.document_number || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.issuer || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.category || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{c.value_netto.toLocaleString('pl-PL')} PLN</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{c.issue_date ? new Date(c.issue_date).toLocaleDateString('pl-PL') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );

  const renderTimeTracking = () => {
    const projectTaskIds = tasks.map(t => t.id);
    const projectTimeLogs = timeLogs.filter(tl => projectTaskIds.includes(tl.task_id));
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {projectTimeLogs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak wpisów ewidencji czasu</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pracownik</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zadanie</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Czas (min)</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Opis</th>
              </tr>
            </thead>
            <tbody>
              {projectTimeLogs.map(tl => (
                <tr key={tl.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{getUserName(tl.user_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tasks.find(t => t.id === tl.task_id)?.title || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(tl.date).toLocaleDateString('pl-PL')}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{tl.minutes}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tl.description || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  };

  const renderMembers = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      {members.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Brak przypisanych pracowników</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pracownik</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rola</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rozliczenie</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stawka netto</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
            </tr>
          </thead>
          <tbody>
            {members.map(m => (
              <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{getUserName(m.user_id)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{m.role === 'manager' ? 'Kierownik' : 'Członek'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{m.member_type === 'employee' ? 'Pracownik' : 'Podwykonawca'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{m.payment_type === 'hourly' ? 'Godzinowe' : 'Akord'}</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">{m.hourly_rate ? `${m.hourly_rate} PLN/godz.` : '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    m.member_status === 'assigned' ? 'bg-green-100 text-green-700' :
                    m.member_status === 'temporarily_unassigned' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {m.member_status === 'assigned' ? 'Przypisany' :
                     m.member_status === 'temporarily_unassigned' ? 'Tymczasowo nieprzypisany' : 'Nieprzypisany'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderIssues = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      {issues.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Brak zgłoszeń</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategoria</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zgłaszający</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
            </tr>
          </thead>
          <tbody>
            {issues.map(iss => (
              <tr key={iss.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{iss.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{iss.category || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    iss.status === 'completed' ? 'bg-green-100 text-green-700' :
                    iss.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    iss.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {iss.status === 'new' ? 'Nowe' :
                     iss.status === 'in_progress' ? 'W trakcie' :
                     iss.status === 'completed' ? 'Zakończone' : 'Anulowane'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{getUserName(iss.reporter_id)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(iss.created_at).toLocaleDateString('pl-PL')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderAttachments = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      {files.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Brak załączników</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dodał</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rozmiar</th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => (
              <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:text-blue-800">
                    {f.name}
                  </a>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{f.file_type}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{getUserName(f.uploaded_by)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{new Date(f.created_at).toLocaleDateString('pl-PL')}</td>
                <td className="px-4 py-3 text-sm text-gray-600 text-right">{f.file_size ? `${(f.file_size / 1024).toFixed(0)} KB` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        </div>
      );
    }
    switch (activeTab) {
      case 'summary': return renderSummary();
      case 'schedule': return renderSchedule();
      case 'tasks': return renderTasks();
      case 'protocols': return renderProtocols();
      case 'income': return renderIncome();
      case 'costs': return renderCosts();
      case 'timeTracking': return renderTimeTracking();
      case 'members': return renderMembers();
      case 'issues': return renderIssues();
      case 'attachments': return renderAttachments();
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
          title="Powrót do listy projektów"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || '#3B82F6' }} />
            <h1 className="text-xl font-bold text-gray-900 truncate">{project.name}</h1>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusCfg.bg} ${statusCfg.text}`}>
              {statusCfg.label}
            </span>
            <span className="text-xs text-gray-400">
              {project.billing_type === 'hourly' ? 'Roboczogodziny' : 'Ryczałt'}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5 ml-7">
            {getCustomerName(project.contractor_client_id || project.customer_id)}
            {project.department_id ? ` / ${getDepartmentName(project.department_id)}` : ''}
          </p>
        </div>
        <button
          onClick={() => onEditProject(project)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <Pencil className="w-4 h-4" />
          Edytuj
        </button>
      </div>

      {/* Compact Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex flex-wrap">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {renderTabContent()}
    </div>
  );
};
