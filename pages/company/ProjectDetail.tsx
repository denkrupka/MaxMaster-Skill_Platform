
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  ArrowLeft, BarChart3, Calendar, ClipboardList, FileCheck, DollarSign,
  Receipt, Clock, Users, MessageSquare, Paperclip, Loader2, Plus, X,
  Pencil, Trash2, Upload, Download, Eye, Check, XCircle, Search,
  ChevronDown, Building2, MapPin, TrendingUp, FileText, Settings,
  ExternalLink, AlertCircle, Wrench, Tag, Hash, ScanLine, FileInput,
  ChevronLeft, ChevronRight
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
  { key: 'summary', label: 'Podsumowanie', icon: <BarChart3 className="w-4 h-4" /> },
  { key: 'schedule', label: 'Harmonogram', icon: <Calendar className="w-4 h-4" /> },
  { key: 'tasks', label: 'Zadania', icon: <ClipboardList className="w-4 h-4" /> },
  { key: 'protocols', label: 'Protokoły', icon: <FileCheck className="w-4 h-4" />, onlyRyczalt: true },
  { key: 'income', label: 'Przychody', icon: <DollarSign className="w-4 h-4" /> },
  { key: 'costs', label: 'Koszty', icon: <Receipt className="w-4 h-4" /> },
  { key: 'timeTracking', label: 'Ewidencja czasu', icon: <Clock className="w-4 h-4" /> },
  { key: 'members', label: 'Pracownicy', icon: <Users className="w-4 h-4" /> },
  { key: 'issues', label: 'Zgłoszenia', icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'attachments', label: 'Załączniki', icon: <Paperclip className="w-4 h-4" /> },
];

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

  const visibleTabs = TABS.filter(t => {
    if (t.onlyRyczalt && project.billing_type !== 'ryczalt') return false;
    return true;
  });

  const renderSummary = () => (
    <div className="space-y-6">
      {/* Key metrics */}
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

  const renderSchedule = () => (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">Harmonogram budżetowy</h3>
      {schedule.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Brak danych harmonogramu</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Rok</th>
              <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Miesiąc</th>
              <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Planowana kwota netto (PLN)</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map(s => (
              <tr key={s.id} className="border-b border-gray-100">
                <td className="px-4 py-2 text-sm text-gray-600">{s.year}</td>
                <td className="px-4 py-2 text-sm text-gray-600">{s.month}</td>
                <td className="px-4 py-2 text-sm text-gray-900 text-right">{s.planned_amount.toLocaleString('pl-PL')} PLN</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  const renderTasks = () => (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Brak zadań</p>
      ) : (
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zadanie</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Priorytet</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Przypisany</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map(task => (
              <tr key={task.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-medium text-gray-900">{task.title}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    task.status === 'done' ? 'bg-green-100 text-green-700' :
                    task.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    task.status === 'review' ? 'bg-purple-100 text-purple-700' :
                    task.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {task.status === 'todo' ? 'Do zrobienia' :
                     task.status === 'in_progress' ? 'W trakcie' :
                     task.status === 'review' ? 'Przegląd' :
                     task.status === 'done' ? 'Zrobione' : 'Anulowane'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    task.priority === 'urgent' ? 'bg-red-100 text-red-700' :
                    task.priority === 'high' ? 'bg-orange-100 text-orange-700' :
                    task.priority === 'medium' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {task.priority === 'urgent' ? 'Pilny' :
                     task.priority === 'high' ? 'Wysoki' :
                     task.priority === 'medium' ? 'Średni' : 'Niski'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{getUserName(task.assigned_to)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{task.due_date ? new Date(task.due_date).toLocaleDateString('pl-PL') : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

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

  // ─── Costs Tab State ───
  const [costSubTab, setCostSubTab] = useState<'direct' | 'labor'>('direct');
  const [costMonth, setCostMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showCostMethodModal, setShowCostMethodModal] = useState(false);
  const [showCostFormModal, setShowCostFormModal] = useState(false);
  const [isScanningDocument, setIsScanningDocument] = useState(false);
  const costFileInputRef = useRef<HTMLInputElement>(null);
  const [costFormData, setCostFormData] = useState({
    document_type: '',
    document_number: '',
    issue_date: '',
    payment_due_date: '',
    issuer: '',
    value_netto: '',
    category: '',
    payment_status: 'Nieopłacone',
  });
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [savingCost, setSavingCost] = useState(false);

  // Payment status options with ability to add custom ones
  const DEFAULT_PAYMENT_STATUSES = ['Nieopłacone', 'Opłacone', 'Częściowo opłacone', 'Przeterminowane'];
  const [customPaymentStatuses, setCustomPaymentStatuses] = useState<string[]>([]);
  const [showAddStatusInput, setShowAddStatusInput] = useState(false);
  const [newStatusValue, setNewStatusValue] = useState('');
  const allPaymentStatuses = [...DEFAULT_PAYMENT_STATUSES, ...customPaymentStatuses];

  const COST_CATEGORIES = ['Materiały', 'Usługi', 'Transport', 'Narzędzia', 'Wynajem', 'Podwykonawcy', 'Inne'];
  const DOCUMENT_TYPES = ['Faktura VAT', 'Rachunek', 'Paragon', 'Nota księgowa', 'Umowa', 'Inne'];

  const resetCostForm = () => {
    setCostFormData({
      document_type: '',
      document_number: '',
      issue_date: '',
      payment_due_date: '',
      issuer: '',
      value_netto: '',
      category: '',
      payment_status: 'Nieopłacone',
    });
    setEditingCostId(null);
  };

  const handleScanDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanningDocument(true);
    setShowCostMethodModal(false);

    try {
      const base64Promise = new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(file);
      });
      const base64Data = await base64Promise;

      const { data, error } = await supabase.functions.invoke('parse-cost-document', {
        body: {
          fileBase64: base64Data,
          mimeType: file.type || 'application/pdf',
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Failed to parse document');

      const result = data.data;
      setCostFormData({
        document_type: result.document_type || '',
        document_number: result.document_number || '',
        issue_date: result.issue_date || '',
        payment_due_date: result.payment_due_date || '',
        issuer: result.issuer || '',
        value_netto: result.value_netto ? String(result.value_netto) : '',
        category: result.category || '',
        payment_status: 'Nieopłacone',
      });
      setShowCostFormModal(true);
    } catch (err) {
      console.error('Document scan error:', err);
      setCostFormData(prev => ({ ...prev }));
      setShowCostFormModal(true);
    } finally {
      setIsScanningDocument(false);
      if (costFileInputRef.current) costFileInputRef.current.value = '';
    }
  };

  const handleSaveCost = async () => {
    if (!currentUser || !costFormData.document_number || !costFormData.value_netto) return;
    setSavingCost(true);
    try {
      const payload = {
        project_id: project.id,
        company_id: currentUser.company_id,
        cost_type: 'direct' as const,
        document_type: costFormData.document_type || null,
        document_number: costFormData.document_number,
        issue_date: costFormData.issue_date || null,
        payment_due_date: costFormData.payment_due_date || null,
        issuer: costFormData.issuer || null,
        value_netto: parseFloat(costFormData.value_netto) || 0,
        category: costFormData.category || null,
        payment_status: costFormData.payment_status || 'Nieopłacone',
      };

      if (editingCostId) {
        const { error } = await supabase.from('project_costs').update(payload).eq('id', editingCostId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('project_costs').insert(payload);
        if (error) throw error;
      }

      await loadProjectData();
      setShowCostFormModal(false);
      resetCostForm();
    } catch (err) {
      console.error('Error saving cost:', err);
    } finally {
      setSavingCost(false);
    }
  };

  const handleDeleteCost = async (costId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten koszt?')) return;
    try {
      const { error } = await supabase.from('project_costs').delete().eq('id', costId);
      if (error) throw error;
      await loadProjectData();
    } catch (err) {
      console.error('Error deleting cost:', err);
    }
  };

  const handleEditCost = (cost: ProjectCost) => {
    setCostFormData({
      document_type: cost.document_type || '',
      document_number: cost.document_number || '',
      issue_date: cost.issue_date || '',
      payment_due_date: cost.payment_due_date || '',
      issuer: cost.issuer || '',
      value_netto: String(cost.value_netto || 0),
      category: cost.category || '',
      payment_status: cost.payment_status || 'Nieopłacone',
    });
    setEditingCostId(cost.id);
    setShowCostFormModal(true);
  };

  const addCustomPaymentStatus = () => {
    const trimmed = newStatusValue.trim();
    if (trimmed && !allPaymentStatuses.includes(trimmed)) {
      setCustomPaymentStatuses(prev => [...prev, trimmed]);
      setCostFormData(prev => ({ ...prev, payment_status: trimmed }));
    }
    setNewStatusValue('');
    setShowAddStatusInput(false);
  };

  // Month navigation helpers
  const navigateMonth = (dir: number) => {
    const [y, m] = costMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setCostMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  const monthLabel = (() => {
    const [y, m] = costMonth.split('-').map(Number);
    const months = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];
    return `${months[m - 1]} ${y}`;
  })();

  // Filter direct costs by selected month
  const filteredDirectCosts = costs.filter(c => {
    if (c.cost_type !== 'direct') return false;
    if (!c.issue_date) return false;
    const d = new Date(c.issue_date);
    const [y, m] = costMonth.split('-').map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
  });

  const filteredDirectCostsTotal = filteredDirectCosts.reduce((s, c) => s + (c.value_netto || 0), 0);

  // Labor costs calculations
  const laborCostsForMonth = useMemo(() => {
    const [y, m] = costMonth.split('-').map(Number);
    const monthStart = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const monthEnd = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;

    // Get project member IDs and their payment types/rates
    const memberMap = new Map<string, { payment_type: string; hourly_rate: number }>();
    members.forEach(mem => {
      memberMap.set(mem.user_id, {
        payment_type: mem.payment_type || 'hourly',
        hourly_rate: mem.hourly_rate || 0,
      });
    });

    const memberUserIds = Array.from(memberMap.keys());

    // Filter time logs for this project's tasks in the selected month
    const projectTaskIds = tasks.map(t => t.id);
    const monthTimeLogs = timeLogs.filter(tl => {
      if (!projectTaskIds.includes(tl.task_id)) return false;
      if (!memberUserIds.includes(tl.user_id)) return false;
      return tl.date >= monthStart && tl.date <= monthEnd;
    });

    // Split by payment type
    let hourlyMinutes = 0;
    let hourlyValue = 0;
    let akordMinutes = 0;
    let akordValue = 0;

    monthTimeLogs.forEach(tl => {
      const memInfo = memberMap.get(tl.user_id);
      if (!memInfo) return;
      const hours = (tl.minutes || 0) / 60;

      if (memInfo.payment_type === 'akord') {
        akordMinutes += tl.minutes || 0;
        // For akord, get value from task definition
        const task = tasks.find(t => t.id === tl.task_id);
        if (task && task.worker_payment_type === 'akord' && task.worker_rate_per_unit) {
          akordValue += hours * (task.worker_rate_per_unit || 0);
        } else {
          akordValue += hours * memInfo.hourly_rate;
        }
      } else {
        hourlyMinutes += tl.minutes || 0;
        hourlyValue += hours * memInfo.hourly_rate;
      }
    });

    return { hourlyMinutes, hourlyValue, akordMinutes, akordValue };
  }, [costMonth, members, tasks, timeLogs]);

  // ─── Cost Method Modal (Scan vs Manual) ───
  const renderCostMethodModal = () => {
    if (!showCostMethodModal && !isScanningDocument) return null;

    if (isScanningDocument) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
            <p className="text-sm font-medium text-gray-700">Skanowanie dokumentu...</p>
            <p className="text-xs text-gray-400">AI analizuje dane z dokumentu</p>
          </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowCostMethodModal(false)} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">Dodaj koszt</h2>
            <button onClick={() => setShowCostMethodModal(false)} className="p-1 rounded hover:bg-gray-100">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-sm text-gray-500">Wybierz sposób dodania kosztu:</p>
            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => costFileInputRef.current?.click()}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <ScanLine className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Skanuj dokument</p>
                  <p className="text-xs text-gray-500">AI wyciągnie dane z faktury/rachunku (OCR)</p>
                </div>
              </button>
              <button
                onClick={() => {
                  setShowCostMethodModal(false);
                  resetCostForm();
                  setShowCostFormModal(true);
                }}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                  <FileInput className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Wprowadź ręcznie</p>
                  <p className="text-xs text-gray-500">Wypełnij formularz samodzielnie</p>
                </div>
              </button>
            </div>
          </div>
          <input
            ref={costFileInputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleScanDocument}
          />
        </div>
      </div>
    );
  };

  // ─── Cost Form Modal ───
  const renderCostFormModal = () => {
    if (!showCostFormModal) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => { setShowCostFormModal(false); resetCostForm(); }} />
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white z-10 flex items-center justify-between px-5 py-3 border-b border-gray-200">
            <h2 className="text-base font-semibold text-gray-900">
              {editingCostId ? 'Edytuj koszt' : 'Nowy koszt bezpośredni'}
            </h2>
            <button onClick={() => { setShowCostFormModal(false); resetCostForm(); }} className="p-1 rounded hover:bg-gray-100">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            {/* Document type */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Typ dokumentu</label>
              <select
                value={costFormData.document_type}
                onChange={e => setCostFormData(prev => ({ ...prev, document_type: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Wybierz typ...</option>
                {DOCUMENT_TYPES.map(dt => (
                  <option key={dt} value={dt}>{dt}</option>
                ))}
              </select>
            </div>

            {/* Document number */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Nr dokumentu *</label>
              <input
                type="text"
                value={costFormData.document_number}
                onChange={e => setCostFormData(prev => ({ ...prev, document_number: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="np. FV/2026/01/001"
              />
            </div>

            {/* Dates row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data wystawienia</label>
                <input
                  type="date"
                  value={costFormData.issue_date}
                  onChange={e => setCostFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Termin płatności</label>
                <input
                  type="date"
                  value={costFormData.payment_due_date}
                  onChange={e => setCostFormData(prev => ({ ...prev, payment_due_date: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Issuer */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Wystawca dokumentu</label>
              <input
                type="text"
                value={costFormData.issuer}
                onChange={e => setCostFormData(prev => ({ ...prev, issuer: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Nazwa firmy lub osoby"
              />
            </div>

            {/* Value netto */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Wartość dokumentu netto (PLN) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={costFormData.value_netto}
                onChange={e => setCostFormData(prev => ({ ...prev, value_netto: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="0.00"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategoria</label>
              <select
                value={costFormData.category}
                onChange={e => setCostFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Wybierz kategorię...</option>
                {COST_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Payment status with add-new */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Status opłaty</label>
              <div className="flex gap-2">
                <select
                  value={costFormData.payment_status}
                  onChange={e => setCostFormData(prev => ({ ...prev, payment_status: e.target.value }))}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {allPaymentStatuses.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowAddStatusInput(!showAddStatusInput)}
                  className="px-2 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600"
                  title="Dodaj nowy status"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {showAddStatusInput && (
                <div className="flex gap-2 mt-2">
                  <input
                    type="text"
                    value={newStatusValue}
                    onChange={e => setNewStatusValue(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addCustomPaymentStatus()}
                    placeholder="Nazwa nowego statusu"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    autoFocus
                  />
                  <button
                    onClick={addCustomPaymentStatus}
                    className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Dodaj
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="sticky bottom-0 bg-white flex justify-end gap-2 px-5 py-3 border-t border-gray-200">
            <button
              onClick={() => { setShowCostFormModal(false); resetCostForm(); }}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Anuluj
            </button>
            <button
              onClick={handleSaveCost}
              disabled={savingCost || !costFormData.document_number || !costFormData.value_netto}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {savingCost && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingCostId ? 'Zapisz zmiany' : 'Dodaj koszt'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCosts = () => (
    <div className="space-y-4">
      {/* Summary cards */}
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

      {/* Sub-tabs */}
      <div className="flex gap-0 border-b border-gray-200">
        <button
          onClick={() => setCostSubTab('direct')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            costSubTab === 'direct'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Koszty bezpośrednie
        </button>
        <button
          onClick={() => setCostSubTab('labor')}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            costSubTab === 'labor'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          Koszty robocizny
        </button>
      </div>

      {/* Direct Costs Sub-tab */}
      {costSubTab === 'direct' && (
        <div className="space-y-4">
          {/* Header: month selector + add button */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">{monthLabel}</span>
              <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                Suma: <span className="font-semibold text-gray-900">{filteredDirectCostsTotal.toLocaleString('pl-PL')} PLN</span>
              </span>
              <button
                onClick={() => setShowCostMethodModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Plus className="w-4 h-4" />
                Dodaj koszt
              </button>
            </div>
          </div>

          {/* Direct costs list */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            {filteredDirectCosts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">Brak kosztów bezpośrednich w wybranym miesiącu</p>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nr dokumentu</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data wystawienia</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Termin płatności</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wystawca</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wartość netto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategoria</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status opłaty</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDirectCosts.map(c => (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.document_number || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.issue_date ? new Date(c.issue_date).toLocaleDateString('pl-PL') : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.payment_due_date ? new Date(c.payment_due_date).toLocaleDateString('pl-PL') : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.issuer || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{c.value_netto.toLocaleString('pl-PL')} PLN</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{c.category || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          c.payment_status === 'Opłacone' || c.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                          c.payment_status === 'Przeterminowane' ? 'bg-red-100 text-red-700' :
                          c.payment_status === 'Częściowo opłacone' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {c.payment_status || 'Nieopłacone'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleEditCost(c)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600"
                            title="Edytuj"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCost(c.id)}
                            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-red-600"
                            title="Usuń"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Labor Costs Sub-tab */}
      {costSubTab === 'labor' && (
        <div className="space-y-4">
          {/* Month selector */}
          <div className="flex items-center gap-2">
            <button onClick={() => navigateMonth(-1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-gray-700 min-w-[140px] text-center">{monthLabel}</span>
            <button onClick={() => navigateMonth(1)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Labor costs summary */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ wynagrodzenia</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ilość roboczogodzin</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wartość (PLN)</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">Godzinowe</span>
                      <span className="text-sm text-gray-700">Wynagrodzenie roboczogodzinowe</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {(laborCostsForMonth.hourlyMinutes / 60).toFixed(1)} godz.
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-bold">
                    {laborCostsForMonth.hourlyValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                  </td>
                </tr>
                <tr className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">Akord</span>
                      <span className="text-sm text-gray-700">Wynagrodzenie akordowe</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">
                    {(laborCostsForMonth.akordMinutes / 60).toFixed(1)} godz.
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-bold">
                    {laborCostsForMonth.akordValue.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                  </td>
                </tr>
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">Razem</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-bold">
                    {((laborCostsForMonth.hourlyMinutes + laborCostsForMonth.akordMinutes) / 60).toFixed(1)} godz.
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right font-bold">
                    {(laborCostsForMonth.hourlyValue + laborCostsForMonth.akordValue).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PLN
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Koszty robocizny są obliczane automatycznie na podstawie zalogowanych godzin pracy i stawek przypisanych pracownikom w projekcie.
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      {renderCostMethodModal()}
      {renderCostFormModal()}
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
      <div className="flex items-center gap-3 mb-6">
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

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto">
        <div className="flex gap-0 min-w-max">
          {visibleTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
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
