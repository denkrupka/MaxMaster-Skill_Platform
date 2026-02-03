
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, BarChart3, Calendar, ClipboardList, FileCheck, DollarSign,
  Receipt, Clock, Users, MessageSquare, Paperclip, Loader2, Plus, X,
  Pencil, Trash2, Upload, Download, Eye, Check, XCircle, Search,
  ChevronDown, Building2, MapPin, TrendingUp, FileText, Settings,
  ExternalLink, AlertCircle, Wrench, Tag, Hash, ToggleLeft, ToggleRight
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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
  ContractorClient, ContractorClientContact
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
  const [clientContacts, setClientContacts] = useState<ContractorClientContact[]>([]);

  // Protocol modal state
  const [showProtocolModal, setShowProtocolModal] = useState(false);
  const [protocolForm, setProtocolForm] = useState({
    protocol_type: 'standard' as 'standard' | 'additional',
    protocol_number: '',
    invoice_number: '',
    period_from: '',
    period_to: '',
    client_representative_id: '',
    tasks_data: [] as { task_id: string; name: string; value: number; completion_percent: number }[],
  });
  const [savingProtocol, setSavingProtocol] = useState(false);

  // Protocol preview modal
  const [previewProtocol, setPreviewProtocol] = useState<ProjectProtocol | null>(null);

  // Income modal state
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [incomeForm, setIncomeForm] = useState({
    document_type: 'faktura' as ProjectIncome['document_type'],
    document_number: '',
    issue_date: '',
    payment_due_date: '',
    value: 0,
    basis_id: '',
    basis_type: '' as 'protocol' | 'timesheet' | '',
    payment_status: 'unpaid',
  });
  const [savingIncome, setSavingIncome] = useState(false);

  useEffect(() => {
    if (currentUser && project) loadProjectData();
  }, [currentUser, project?.id]);

  const safeQuery = (promise: Promise<any>) => promise.then(r => r.data || []).catch(() => []);

  const loadProjectData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [tasks, members, timeLogs, protocols, income, costs, schedule, issues, files, contacts] = await Promise.all([
        safeQuery(supabase.from('project_tasks').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_members').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('task_time_logs').select('*').eq('company_id', currentUser.company_id)),
        safeQuery(supabase.from('project_protocols').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_income').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_costs').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_schedule').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_issues').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_files').select('*').eq('project_id', project.id)),
        project.contractor_client_id
          ? safeQuery(supabase.from('contractor_client_contacts').select('*').eq('client_id', project.contractor_client_id))
          : Promise.resolve([]),
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
      setClientContacts(contacts);
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

  // ---- Protocol helpers ----

  const generateProtocolNumber = () => {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const kodObiektu = dept?.kod_obiektu || 'PRJ';
    const monthProtocols = protocols.filter(p => {
      const d = new Date(p.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const seq = monthProtocols.length + 1;
    return `${kodObiektu}-${seq}/${month}/${year}`;
  };

  const openCreateProtocolModal = () => {
    const tasksData = tasks.map(t => ({
      task_id: t.id,
      name: t.title,
      value: t.total_value || (t.quantity && t.price_per_unit ? t.quantity * t.price_per_unit : 0),
      completion_percent: 0,
    }));
    setProtocolForm({
      protocol_type: 'standard',
      protocol_number: generateProtocolNumber(),
      invoice_number: '',
      period_from: '',
      period_to: '',
      client_representative_id: '',
      tasks_data: tasksData,
    });
    setShowProtocolModal(true);
  };

  const saveProtocol = async () => {
    if (!currentUser) return;
    setSavingProtocol(true);
    try {
      const totalValue = protocolForm.tasks_data.reduce((s, t) => s + (t.value * t.completion_percent / 100), 0);
      const totalPercent = protocolForm.tasks_data.length > 0
        ? Math.round(protocolForm.tasks_data.reduce((s, t) => s + t.completion_percent, 0) / protocolForm.tasks_data.length)
        : 0;
      const payload: any = {
        project_id: project.id,
        company_id: currentUser.company_id,
        protocol_number: protocolForm.protocol_number,
        protocol_type: protocolForm.protocol_type,
        advancement_percent: totalPercent,
        period_from: protocolForm.period_from || null,
        period_to: protocolForm.period_to || null,
        total_value: totalValue,
        invoice_number: protocolForm.invoice_number || null,
        client_representative_id: protocolForm.client_representative_id || null,
        tasks_data: protocolForm.tasks_data,
        accepted: false,
      };
      const { error } = await supabase.from('project_protocols').insert(payload);
      if (error) throw error;
      setShowProtocolModal(false);
      loadProjectData();
    } catch (err) {
      console.error('Error saving protocol:', err);
    } finally {
      setSavingProtocol(false);
    }
  };

  const getContactName = (contactId?: string) => {
    if (!contactId) return '-';
    const c = clientContacts.find(cc => cc.id === contactId);
    return c ? `${c.first_name} ${c.last_name}` : '-';
  };

  const generateProtocolPDF = (p: ProjectProtocol) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(16);
    doc.text('PROTOKÓŁ ODBIORU ROBÓT', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.text(`Nr protokołu: ${p.protocol_number}`, 14, 35);
    doc.text(`Typ: ${p.protocol_type === 'standard' ? 'Roboty zgodnie z umową' : 'Prace dodatkowe'}`, 14, 42);
    doc.text(`Projekt: ${project.name}`, 14, 49);
    doc.text(`Klient: ${getCustomerName(project.contractor_client_id || project.customer_id)}`, 14, 56);
    if (p.period_from || p.period_to) {
      doc.text(`Okres wykonania robót: ${p.period_from ? new Date(p.period_from).toLocaleDateString('pl-PL') : '-'} – ${p.period_to ? new Date(p.period_to).toLocaleDateString('pl-PL') : '-'}`, 14, 63);
    }
    if (p.invoice_number) {
      doc.text(`Nr faktury bieżącej: ${p.invoice_number}`, 14, 70);
    }
    doc.text(`Zaawansowanie: ${p.advancement_percent}%`, 14, 77);
    doc.text(`Wartość robót: ${p.total_value.toLocaleString('pl-PL')} PLN netto`, 14, 84);
    doc.text(`Przedstawiciel klienta: ${getContactName(p.client_representative_id)}`, 14, 91);

    const tasksArr = (p.tasks_data || []) as ProjectProtocolTask[];
    if (tasksArr.length > 0) {
      autoTable(doc, {
        startY: 100,
        head: [['Lp.', 'Nazwa zadania', 'Wartość (PLN)', '% Wykonania']],
        body: tasksArr.map((t, i) => [
          String(i + 1),
          t.name,
          t.value.toLocaleString('pl-PL'),
          `${t.completion_percent}%`,
        ]),
        styles: { fontSize: 8 },
        headStyles: { fillColor: [59, 130, 246] },
      });
    }

    const finalY = (doc as any).lastAutoTable?.finalY || 110;
    doc.setFontSize(10);
    doc.text(`Akceptacja: ${p.accepted ? 'TAK' : 'NIE'}`, 14, finalY + 15);
    doc.text(`Data wystawienia: ${new Date(p.created_at).toLocaleDateString('pl-PL')}`, 14, finalY + 22);

    doc.line(14, finalY + 45, 80, finalY + 45);
    doc.text('Podpis wykonawcy', 14, finalY + 50);
    doc.line(pageWidth - 80, finalY + 45, pageWidth - 14, finalY + 45);
    doc.text('Podpis klienta', pageWidth - 80, finalY + 50);

    doc.save(`protokol_${p.protocol_number.replace(/\//g, '-')}.pdf`);
  };

  const renderProtocols = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-900">Protokoły</h3>
        <button
          onClick={openCreateProtocolModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Utwórz protokół
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {protocols.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak protokołów</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nr protokołu</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">% Zaawansowania</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Okres wykonania robót</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Wartość robót netto</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akceptacja</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{p.protocol_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.min(p.advancement_percent, 100)}%` }} />
                      </div>
                      <span>{p.advancement_percent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {p.period_from ? new Date(p.period_from).toLocaleDateString('pl-PL') : '-'}
                    {' – '}
                    {p.period_to ? new Date(p.period_to).toLocaleDateString('pl-PL') : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{p.total_value.toLocaleString('pl-PL')} PLN</td>
                  <td className="px-4 py-3 text-center">
                    {p.accepted ? (
                      <Check className="w-5 h-5 text-green-600 mx-auto" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setPreviewProtocol(p)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                        title="Podgląd"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => generateProtocolPDF(p)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-blue-600"
                        title="Pobierz PDF"
                      >
                        <Download className="w-4 h-4" />
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
  );

  // ---- Income helpers ----

  const DOCUMENT_TYPE_LABELS: Record<string, string> = {
    faktura: 'Faktura',
    paragon: 'Paragon',
    nota_odsetkowa: 'Nota odsetkowa',
    nota_ksiegowa: 'Nota księgowa',
    faktura_zaliczkowa: 'Faktura zaliczkowa',
  };

  const getBasisLabel = (incItem: ProjectIncome) => {
    if (!incItem.basis_id) return '-';
    if (incItem.basis_type === 'protocol') {
      const proto = protocols.find(p => p.id === incItem.basis_id);
      return proto ? proto.protocol_number : incItem.basis_id;
    }
    return incItem.basis_id;
  };

  const usedBasisIds = useMemo(() => {
    return new Set(income.filter(i => i.basis_id).map(i => i.basis_id));
  }, [income]);

  const availableBasisOptions = useMemo(() => {
    const options: { id: string; label: string; type: 'protocol' | 'timesheet' }[] = [];
    protocols.forEach(p => {
      if (!usedBasisIds.has(p.id)) {
        options.push({ id: p.id, label: `Protokół: ${p.protocol_number}`, type: 'protocol' });
      }
    });
    return options;
  }, [protocols, usedBasisIds]);

  const openCreateIncomeModal = () => {
    setIncomeForm({
      document_type: 'faktura',
      document_number: '',
      issue_date: new Date().toISOString().split('T')[0],
      payment_due_date: '',
      value: 0,
      basis_id: '',
      basis_type: '',
      payment_status: 'unpaid',
    });
    setShowIncomeModal(true);
  };

  const saveIncome = async () => {
    if (!currentUser) return;
    setSavingIncome(true);
    try {
      const payload: any = {
        project_id: project.id,
        company_id: currentUser.company_id,
        document_type: incomeForm.document_type,
        document_number: incomeForm.document_number,
        issue_date: incomeForm.issue_date,
        payment_due_date: incomeForm.payment_due_date,
        value: incomeForm.value,
        basis_id: incomeForm.basis_id || null,
        basis_type: incomeForm.basis_type || null,
        payment_status: incomeForm.payment_status,
      };
      const { error } = await supabase.from('project_income').insert(payload);
      if (error) throw error;
      setShowIncomeModal(false);
      loadProjectData();
    } catch (err) {
      console.error('Error saving income:', err);
    } finally {
      setSavingIncome(false);
    }
  };

  const renderIncome = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Przychody</h3>
          <span className="text-sm font-bold text-green-600">{totalIncome.toLocaleString('pl-PL')} PLN netto</span>
        </div>
        <button
          onClick={openCreateIncomeModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Dodaj przychód
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
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
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Podstawa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status płatności</th>
              </tr>
            </thead>
            <tbody>
              {income.map(i => (
                <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-600">{DOCUMENT_TYPE_LABELS[i.document_type] || i.document_type}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{i.document_number}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(i.issue_date).toLocaleDateString('pl-PL')}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(i.payment_due_date).toLocaleDateString('pl-PL')}</td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">{i.value.toLocaleString('pl-PL')} PLN</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getBasisLabel(i)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      i.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {i.payment_status === 'paid' ? 'Opłacone' : 'Nieopłacone'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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

      {/* ===== Protocol Preview Modal ===== */}
      {previewProtocol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setPreviewProtocol(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-5 py-3 border-b">
              <h2 className="text-base font-semibold">Podgląd protokołu</h2>
              <button onClick={() => setPreviewProtocol(null)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">Nr protokołu:</span> <span className="font-medium">{previewProtocol.protocol_number}</span></div>
                <div><span className="text-gray-500">Typ:</span> <span className="font-medium">{previewProtocol.protocol_type === 'standard' ? 'Roboty zgodnie z umową' : 'Prace dodatkowe'}</span></div>
                <div><span className="text-gray-500">Zaawansowanie:</span> <span className="font-medium">{previewProtocol.advancement_percent}%</span></div>
                <div><span className="text-gray-500">Wartość robót netto:</span> <span className="font-medium">{previewProtocol.total_value.toLocaleString('pl-PL')} PLN</span></div>
                <div><span className="text-gray-500">Okres od:</span> <span className="font-medium">{previewProtocol.period_from ? new Date(previewProtocol.period_from).toLocaleDateString('pl-PL') : '-'}</span></div>
                <div><span className="text-gray-500">Okres do:</span> <span className="font-medium">{previewProtocol.period_to ? new Date(previewProtocol.period_to).toLocaleDateString('pl-PL') : '-'}</span></div>
                {previewProtocol.invoice_number && <div><span className="text-gray-500">Nr faktury:</span> <span className="font-medium">{previewProtocol.invoice_number}</span></div>}
                <div><span className="text-gray-500">Przedstawiciel klienta:</span> <span className="font-medium">{getContactName(previewProtocol.client_representative_id)}</span></div>
                <div><span className="text-gray-500">Akceptacja:</span> <span className={`font-medium ${previewProtocol.accepted ? 'text-green-600' : 'text-amber-600'}`}>{previewProtocol.accepted ? 'Zaakceptowany' : 'Oczekuje'}</span></div>
              </div>

              {((previewProtocol.tasks_data || []) as ProjectProtocolTask[]).length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Zadania wykonane</h4>
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Lp.</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Nazwa</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Wartość</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">% Wykonania</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((previewProtocol.tasks_data || []) as ProjectProtocolTask[]).map((t, i) => (
                        <tr key={i} className="border-b border-gray-100">
                          <td className="px-3 py-2 text-sm text-gray-600">{i + 1}</td>
                          <td className="px-3 py-2 text-sm text-gray-900">{t.name}</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right">{t.value.toLocaleString('pl-PL')} PLN</td>
                          <td className="px-3 py-2 text-sm text-gray-900 text-right">{t.completion_percent}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => { generateProtocolPDF(previewProtocol); }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
                >
                  <Download className="w-4 h-4" />
                  Pobierz PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Create Protocol Modal ===== */}
      {showProtocolModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowProtocolModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-5 py-3 border-b">
              <h2 className="text-base font-semibold">Utwórz protokół</h2>
              <button onClick={() => setShowProtocolModal(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              {/* Toggle: standard / additional */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Typ robót</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setProtocolForm(f => ({ ...f, protocol_type: 'standard' }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      protocolForm.protocol_type === 'standard'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {protocolForm.protocol_type === 'standard' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    Roboty zgodnie z umową
                  </button>
                  <button
                    type="button"
                    onClick={() => setProtocolForm(f => ({ ...f, protocol_type: 'additional' }))}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      protocolForm.protocol_type === 'additional'
                        ? 'bg-blue-50 border-blue-300 text-blue-700'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {protocolForm.protocol_type === 'additional' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    Prace dodatkowe
                  </button>
                </div>
              </div>

              {/* Protocol number */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Nr protokołu</label>
                <input
                  type="text"
                  value={protocolForm.protocol_number}
                  onChange={e => setProtocolForm(f => ({ ...f, protocol_number: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Invoice number */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Nr Faktury bieżącej</label>
                <input
                  type="text"
                  value={protocolForm.invoice_number}
                  onChange={e => setProtocolForm(f => ({ ...f, invoice_number: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Opcjonalnie"
                />
              </div>

              {/* Period */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">Okres od</label>
                  <input
                    type="date"
                    value={protocolForm.period_from}
                    onChange={e => setProtocolForm(f => ({ ...f, period_from: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">Okres do</label>
                  <input
                    type="date"
                    value={protocolForm.period_to}
                    onChange={e => setProtocolForm(f => ({ ...f, period_to: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Tasks */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Zadania wykonane</h4>
                {protocolForm.tasks_data.length === 0 ? (
                  <p className="text-sm text-gray-400 py-2">Brak zadań w projekcie</p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Nazwa</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Wartość (PLN)</th>
                          <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 w-32">% Wykonania</th>
                        </tr>
                      </thead>
                      <tbody>
                        {protocolForm.tasks_data.map((t, idx) => (
                          <tr key={t.task_id} className="border-b border-gray-100">
                            <td className="px-3 py-2 text-sm text-gray-900">{t.name}</td>
                            <td className="px-3 py-2 text-sm text-gray-900 text-right">{t.value.toLocaleString('pl-PL')}</td>
                            <td className="px-3 py-2 text-right">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                value={t.completion_percent}
                                onChange={e => {
                                  const val = Math.min(100, Math.max(0, Number(e.target.value)));
                                  setProtocolForm(f => ({
                                    ...f,
                                    tasks_data: f.tasks_data.map((tt, i) => i === idx ? { ...tt, completion_percent: val } : tt),
                                  }));
                                }}
                                className="w-20 px-2 py-1 border border-slate-200 rounded text-sm text-right focus:ring-2 focus:ring-blue-500"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Client representative */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Przedstawiciel klienta</label>
                <select
                  value={protocolForm.client_representative_id}
                  onChange={e => setProtocolForm(f => ({ ...f, client_representative_id: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Wybierz —</option>
                  {clientContacts.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} {c.last_name}{c.position ? ` (${c.position})` : ''}</option>
                  ))}
                </select>
              </div>

              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Wartość robót netto:</span>
                  <span className="font-semibold">
                    {protocolForm.tasks_data.reduce((s, t) => s + (t.value * t.completion_percent / 100), 0).toLocaleString('pl-PL')} PLN
                  </span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Średnie zaawansowanie:</span>
                  <span className="font-semibold">
                    {protocolForm.tasks_data.length > 0
                      ? Math.round(protocolForm.tasks_data.reduce((s, t) => s + t.completion_percent, 0) / protocolForm.tasks_data.length)
                      : 0}%
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowProtocolModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Anuluj
                </button>
                <button
                  onClick={saveProtocol}
                  disabled={savingProtocol || !protocolForm.protocol_number}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingProtocol ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Zapisz protokół'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Add Income Modal ===== */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowIncomeModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white z-10 flex justify-between items-center px-5 py-3 border-b">
              <h2 className="text-base font-semibold">Dodaj przychód</h2>
              <button onClick={() => setShowIncomeModal(false)}><X className="w-4 h-4 text-gray-400 hover:text-gray-600" /></button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Document type */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Typ dokumentu</label>
                <select
                  value={incomeForm.document_type}
                  onChange={e => setIncomeForm(f => ({ ...f, document_type: e.target.value as ProjectIncome['document_type'] }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="faktura">Faktura</option>
                  <option value="paragon">Paragon</option>
                  <option value="nota_odsetkowa">Nota odsetkowa</option>
                  <option value="nota_ksiegowa">Nota księgowa</option>
                  <option value="faktura_zaliczkowa">Faktura zaliczkowa</option>
                </select>
              </div>

              {/* Document number */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Nr dokumentu</label>
                <input
                  type="text"
                  value={incomeForm.document_number}
                  onChange={e => setIncomeForm(f => ({ ...f, document_number: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">Data wystawienia</label>
                  <input
                    type="date"
                    value={incomeForm.issue_date}
                    onChange={e => setIncomeForm(f => ({ ...f, issue_date: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-0.5">Termin płatności</label>
                  <input
                    type="date"
                    value={incomeForm.payment_due_date}
                    onChange={e => setIncomeForm(f => ({ ...f, payment_due_date: e.target.value }))}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Value */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Wartość netto (PLN)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={incomeForm.value || ''}
                  onChange={e => setIncomeForm(f => ({ ...f, value: Number(e.target.value) }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Basis */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Podstawa</label>
                <select
                  value={incomeForm.basis_id ? `${incomeForm.basis_type}:${incomeForm.basis_id}` : ''}
                  onChange={e => {
                    if (!e.target.value) {
                      setIncomeForm(f => ({ ...f, basis_id: '', basis_type: '' }));
                    } else {
                      const [type, id] = e.target.value.split(':');
                      setIncomeForm(f => ({ ...f, basis_id: id, basis_type: type as 'protocol' | 'timesheet' }));
                    }
                  }}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Brak —</option>
                  {availableBasisOptions.map(o => (
                    <option key={o.id} value={`${o.type}:${o.id}`}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Payment status */}
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-0.5">Status płatności</label>
                <select
                  value={incomeForm.payment_status}
                  onChange={e => setIncomeForm(f => ({ ...f, payment_status: e.target.value }))}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="unpaid">Nieopłacone</option>
                  <option value="paid">Opłacone</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowIncomeModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                  Anuluj
                </button>
                <button
                  onClick={saveIncome}
                  disabled={savingIncome || !incomeForm.document_number || !incomeForm.issue_date || !incomeForm.payment_due_date}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {savingIncome ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Zapisz przychód'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
