
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  ArrowLeft, BarChart3, Calendar, ClipboardList, FileCheck, DollarSign,
  Receipt, Clock, Users, MessageSquare, Paperclip, Loader2, Plus, X,
  Pencil, Trash2, Upload, Download, Eye, Check, XCircle, Search,
  ChevronDown, Building2, MapPin, TrendingUp, FileText, Settings,
  ExternalLink, AlertCircle, Wrench, Tag, Hash, CheckCircle2, FileDown,
  ScanLine, FileInput, ToggleLeft, ToggleRight,
  ChevronLeft, ChevronRight, Save, UserPlus, HardHat, CheckCircle, Image, File, UploadCloud
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
  ContractorClient, ContractorClientContact, ProjectIssueCategory,
  ProjectAttendanceConfirmation, ProjectAttendanceRow,
  WorkerDay, WorkerDayEntry
} from '../../types';
import { uploadDocument } from '../../lib/supabase';

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
  const [clientContacts, setClientContacts] = useState<ContractorClientContact[]>([]);
  const [issueCategories, setIssueCategories] = useState<ProjectIssueCategory[]>([]);
  const [issueHistory, setIssueHistory] = useState<ProjectIssueHistoryEntry[]>([]);

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

  // Member modals
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addMemberType, setAddMemberType] = useState<ProjectMemberType>('employee');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberForm, setMemberForm] = useState({
    user_id: '',
    role: 'member' as 'manager' | 'member',
    payment_type: 'hourly' as ProjectMemberPaymentType,
    hourly_rate: '',
    position: '',
    member_status: 'assigned' as ProjectMemberStatus,
  });

  // Issue modals
  const [showAddIssueModal, setShowAddIssueModal] = useState(false);
  const [showIssueDetailModal, setShowIssueDetailModal] = useState(false);
  const [selectedIssue, setSelectedIssue] = useState<ProjectIssue | null>(null);
  const [editingIssue, setEditingIssue] = useState<ProjectIssue | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [issueForm, setIssueForm] = useState({
    name: '',
    reporter_company: '',
    category: '',
    description: '',
    file_urls: [] as string[],
  });
  const [issueFiles, setIssueFiles] = useState<File[]>([]);
  const [issueHistoryText, setIssueHistoryText] = useState('');
  const [issueHistoryFiles, setIssueHistoryFiles] = useState<File[]>([]);

  // Attachment modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const ACCEPTED_EXTENSIONS = ['.jpg', '.png', '.pdf', '.dwg', '.xls', '.xlsx', '.doc', '.docx', '.mov', '.mp4'];
  const ACCEPTED_MIME_TYPES = 'image/jpeg,image/png,application/pdf,.dwg,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/quicktime,video/mp4';

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

  // Attendance tracking state
  const [attendanceRows, setAttendanceRows] = useState<ProjectAttendanceRow[]>([]);
  const [attendanceConfirmations, setAttendanceConfirmations] = useState<ProjectAttendanceConfirmation[]>([]);
  const [attendanceDateFrom, setAttendanceDateFrom] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [attendanceDateTo, setAttendanceDateTo] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 0);
    return d.toISOString().split('T')[0];
  });
  const [attendanceLoading, setAttendanceLoading] = useState(false);

  useEffect(() => {
    if (currentUser && project) loadProjectData();
  }, [currentUser, project?.id]);

  const safeQuery = (promise: Promise<any>) => promise.then(r => r.data || []).catch(() => []);

  const loadProjectData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const [tasks, members, timeLogs, protocols, income, costs, schedule, issues, files, categories, contacts] = await Promise.all([
        safeQuery(supabase.from('project_tasks').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_members').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('task_time_logs').select('*').eq('company_id', currentUser.company_id)),
        safeQuery(supabase.from('project_protocols').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_income').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_costs').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_schedule').select('*').eq('project_id', project.id)),
        safeQuery(supabase.from('project_issues').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_files').select('*').eq('project_id', project.id).order('created_at', { ascending: false })),
        safeQuery(supabase.from('project_issue_categories').select('*').eq('company_id', currentUser.company_id).order('name')),
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
      setIssueCategories(categories);
      setClientContacts(contacts);
    } catch (err) {
      console.error('Error loading project data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load attendance data for project members
  const loadAttendanceData = async () => {
    if (!currentUser || members.length === 0) {
      setAttendanceRows([]);
      return;
    }
    setAttendanceLoading(true);
    try {
      const memberUserIds = members.filter(m => m.member_status === 'assigned').map(m => m.user_id);
      if (memberUserIds.length === 0) {
        setAttendanceRows([]);
        setAttendanceLoading(false);
        return;
      }

      // Load worker_days for project members in date range
      const [workerDaysRes, entriesRes, confirmationsRes] = await Promise.all([
        supabase.from('worker_days').select('*')
          .in('user_id', memberUserIds)
          .gte('date', attendanceDateFrom)
          .lte('date', attendanceDateTo)
          .in('status', ['present', 'late', 'incomplete']),
        supabase.from('worker_day_entries').select('*')
          .in('user_id', memberUserIds)
          .eq('company_id', currentUser.company_id),
        safeQuery(supabase.from('project_attendance_confirmations').select('*')
          .eq('project_id', project.id)
          .gte('date', attendanceDateFrom)
          .lte('date', attendanceDateTo)),
      ]);

      const workerDays: WorkerDay[] = workerDaysRes.data || [];
      const allEntries: WorkerDayEntry[] = entriesRes.data || [];
      const confirmations: ProjectAttendanceConfirmation[] = confirmationsRes || [];
      setAttendanceConfirmations(confirmations);

      // Map worker_day entries to attendance rows
      const rows: ProjectAttendanceRow[] = [];

      for (const wd of workerDays) {
        const dayEntries = allEntries.filter(e => e.worker_day_id === wd.id);
        const user = users.find(u => u.id === wd.user_id);
        const userName = user ? `${user.first_name} ${user.last_name}` : 'Nieznany';
        const date = new Date(wd.date);
        const dayOfWeek = date.getDay();
        const isSaturday = dayOfWeek === 6;
        const isSunday = dayOfWeek === 0;

        const confirmation = confirmations.find(c => c.user_id === wd.user_id && c.date === wd.date);

        // Find which task this user was working on for this project on this date
        const userTaskLogs = timeLogs.filter(tl =>
          tl.user_id === wd.user_id && tl.date === wd.date &&
          tasks.some(t => t.id === tl.task_id)
        );

        const taskNames = userTaskLogs.length > 0
          ? [...new Set(userTaskLogs.map(tl => tasks.find(t => t.id === tl.task_id)?.title || '-'))].join(', ')
          : '-';

        // Department from entries or project
        const entryDept = dayEntries.length > 0 && dayEntries[0].department_id
          ? departments.find(d => d.id === dayEntries[0].department_id)?.name || '-'
          : getDepartmentName(project.department_id);

        // Get work start/end from entries
        let workStart: string | undefined;
        let workEnd: string | undefined;
        if (dayEntries.length > 0) {
          const sorted = [...dayEntries].sort((a, b) =>
            new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
          );
          workStart = sorted[0].start_time;
          const lastEntry = sorted[sorted.length - 1];
          workEnd = lastEntry.finish_time || undefined;
        }

        const totalHours = wd.work_time_minutes / 60;
        const overtimeHours = wd.overtime_minutes / 60;

        rows.push({
          user_id: wd.user_id,
          user_name: userName,
          department_name: entryDept,
          task_name: taskNames,
          date: wd.date,
          work_start: workStart,
          work_end: workEnd,
          total_hours: totalHours,
          overtime_hours: overtimeHours,
          is_saturday: isSaturday,
          is_sunday: isSunday,
          client_confirmed: confirmation?.client_confirmed || false,
          confirmation_id: confirmation?.id,
        });
      }

      // Sort by date then by name
      rows.sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.user_name.localeCompare(b.user_name);
      });

      setAttendanceRows(rows);
    } catch (err) {
      console.error('Error loading attendance data:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  useEffect(() => {
    if (!loading && members.length > 0 && activeTab === 'timeTracking') {
      loadAttendanceData();
    }
  }, [loading, members, activeTab, attendanceDateFrom, attendanceDateTo]);

  const toggleClientConfirmation = async (row: ProjectAttendanceRow) => {
    if (!currentUser) return;
    const newConfirmed = !row.client_confirmed;
    try {
      if (row.confirmation_id) {
        await supabase.from('project_attendance_confirmations')
          .update({
            client_confirmed: newConfirmed,
            confirmed_at: newConfirmed ? new Date().toISOString() : null,
            confirmed_by: newConfirmed ? currentUser.id : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.confirmation_id);
      } else {
        await supabase.from('project_attendance_confirmations').insert({
          project_id: project.id,
          company_id: currentUser.company_id,
          user_id: row.user_id,
          date: row.date,
          client_confirmed: newConfirmed,
          confirmed_at: newConfirmed ? new Date().toISOString() : null,
          confirmed_by: newConfirmed ? currentUser.id : null,
        });
      }
      // Reload attendance data
      loadAttendanceData();
    } catch (err) {
      console.error('Error toggling confirmation:', err);
    }
  };

  const formatTime = (isoStr?: string) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '-';
    }
  };

  const showOvertimeColumns = project.billing_type === 'hourly' && (
    project.overtime_paid || project.saturday_paid || project.sunday_paid
  );

  const exportAttendancePDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFontSize(16);
    doc.text('Lista obecnosci', 14, 15);
    doc.setFontSize(10);
    doc.text(`Projekt: ${project.name}`, 14, 22);
    doc.text(`Obiekt: ${getDepartmentName(project.department_id)}`, 14, 28);
    doc.text(`Okres: ${new Date(attendanceDateFrom).toLocaleDateString('pl-PL')} - ${new Date(attendanceDateTo).toLocaleDateString('pl-PL')}`, 14, 34);
    doc.text(`Wygenerowano: ${new Date().toLocaleDateString('pl-PL')} ${new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`, 14, 40);

    // Build header row
    const headRow: string[] = ['Lp.', 'Imie i nazwisko', 'Obiekt', 'Zadanie', 'Data', 'Rozpoczecie pracy', 'Zakonczenie pracy', 'Ilosc godzin'];
    if (showOvertimeColumns) {
      if (project.overtime_paid) headRow.push('Nadgodziny');
      if (project.saturday_paid) headRow.push('Soboty');
      if (project.sunday_paid) headRow.push('Niedziele');
    }
    headRow.push('Potwierdzenie');

    // Build data rows
    const bodyRows = attendanceRows.map((row, idx) => {
      const dataRow: string[] = [
        String(idx + 1),
        row.user_name,
        row.department_name,
        row.task_name,
        new Date(row.date).toLocaleDateString('pl-PL'),
        formatTime(row.work_start),
        formatTime(row.work_end),
        row.total_hours.toFixed(1),
      ];
      if (showOvertimeColumns) {
        if (project.overtime_paid) dataRow.push(row.overtime_hours > 0 ? row.overtime_hours.toFixed(1) : '-');
        if (project.saturday_paid) dataRow.push(row.is_saturday ? row.total_hours.toFixed(1) : '-');
        if (project.sunday_paid) dataRow.push(row.is_sunday ? row.total_hours.toFixed(1) : '-');
      }
      dataRow.push(row.client_confirmed ? 'TAK' : '');
      return dataRow;
    });

    // Summary row
    const totalHours = attendanceRows.reduce((s, r) => s + r.total_hours, 0);
    const totalOvertime = attendanceRows.reduce((s, r) => s + r.overtime_hours, 0);
    const totalSaturdayHours = attendanceRows.filter(r => r.is_saturday).reduce((s, r) => s + r.total_hours, 0);
    const totalSundayHours = attendanceRows.filter(r => r.is_sunday).reduce((s, r) => s + r.total_hours, 0);

    const summaryRow: string[] = ['', 'RAZEM', '', '', '', '', '', totalHours.toFixed(1)];
    if (showOvertimeColumns) {
      if (project.overtime_paid) summaryRow.push(totalOvertime.toFixed(1));
      if (project.saturday_paid) summaryRow.push(totalSaturdayHours.toFixed(1));
      if (project.sunday_paid) summaryRow.push(totalSundayHours.toFixed(1));
    }
    summaryRow.push('');
    bodyRows.push(summaryRow);

    autoTable(doc, {
      startY: 46,
      head: [headRow],
      body: bodyRows,
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data: any) => {
        // Bold the summary row
        if (data.row.index === bodyRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = [229, 231, 235];
        }
      },
    });

    // Signature fields
    const finalY = (doc as any).lastAutoTable?.finalY || 180;
    const sigY = finalY + 20;
    doc.setFontSize(9);
    doc.text('Podpis Zleceniodawcy: ___________________________', 14, sigY);
    doc.text('Podpis Wykonawcy: ___________________________', 160, sigY);
    doc.text('Data: _______________', 14, sigY + 10);
    doc.text('Data: _______________', 160, sigY + 10);

    doc.save(`lista_obecnosci_${project.name.replace(/\s+/g, '_')}_${attendanceDateFrom}_${attendanceDateTo}.pdf`);
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

  // ===== MEMBER HANDLERS =====
  const openAddMemberModal = (type: ProjectMemberType) => {
    setAddMemberType(type);
    setMemberSearch('');
    setMemberForm({
      user_id: '',
      role: 'member',
      payment_type: 'hourly',
      hourly_rate: '',
      position: '',
      member_status: 'assigned',
    });
    setShowAddMemberModal(true);
  };

  const handleAddMember = async () => {
    if (!currentUser || !memberForm.user_id) return;
    const { error } = await supabase.from('project_members').insert({
      project_id: project.id,
      user_id: memberForm.user_id,
      role: memberForm.role,
      member_type: addMemberType,
      payment_type: memberForm.payment_type,
      hourly_rate: memberForm.hourly_rate ? parseFloat(memberForm.hourly_rate) : null,
      position: memberForm.position || null,
      member_status: memberForm.member_status,
    });
    if (!error) {
      setShowAddMemberModal(false);
      loadProjectData();
    }
  };

  const handleUpdateMemberStatus = async (memberId: string, newStatus: ProjectMemberStatus) => {
    const { error } = await supabase.from('project_members').update({ member_status: newStatus }).eq('id', memberId);
    if (!error) loadProjectData();
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tego pracownika z projektu?')) return;
    const { error } = await supabase.from('project_members').delete().eq('id', memberId);
    if (!error) loadProjectData();
  };

  const filteredUsersForMember = useMemo(() => {
    const existingUserIds = members.map(m => m.user_id);
    return companyUsers.filter(u => {
      if (existingUserIds.includes(u.id)) return false;
      if (memberSearch) {
        const search = memberSearch.toLowerCase();
        return `${u.first_name} ${u.last_name}`.toLowerCase().includes(search);
      }
      return true;
    });
  }, [companyUsers, members, memberSearch]);

  // ===== ISSUE HANDLERS =====
  const resetIssueForm = () => {
    setIssueForm({ name: '', reporter_company: '', category: '', description: '', file_urls: [] });
    setIssueFiles([]);
    setEditingIssue(null);
  };

  const openAddIssueModal = () => {
    resetIssueForm();
    setShowAddIssueModal(true);
  };

  const openEditIssueModal = (issue: ProjectIssue) => {
    setEditingIssue(issue);
    setIssueForm({
      name: issue.name,
      reporter_company: issue.reporter_company || '',
      category: issue.category || '',
      description: issue.description || '',
      file_urls: issue.file_urls || [],
    });
    setIssueFiles([]);
    setShowAddIssueModal(true);
  };

  const handleSaveIssue = async () => {
    if (!currentUser || !issueForm.name) return;
    const uploadedUrls: string[] = [...issueForm.file_urls];
    for (const file of issueFiles) {
      const url = await uploadDocument(file, currentUser.id);
      if (url) uploadedUrls.push(url);
    }
    if (editingIssue) {
      const { error } = await supabase.from('project_issues').update({
        name: issueForm.name,
        reporter_company: issueForm.reporter_company || null,
        category: issueForm.category || null,
        description: issueForm.description || null,
        file_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
        updated_at: new Date().toISOString(),
      }).eq('id', editingIssue.id);
      if (!error) { setShowAddIssueModal(false); resetIssueForm(); loadProjectData(); }
    } else {
      const { error } = await supabase.from('project_issues').insert({
        project_id: project.id,
        company_id: currentUser.company_id,
        name: issueForm.name,
        reporter_id: currentUser.id,
        reporter_company: issueForm.reporter_company || null,
        category: issueForm.category || null,
        status: 'new',
        description: issueForm.description || null,
        accepted: false,
        file_urls: uploadedUrls.length > 0 ? uploadedUrls : null,
      });
      if (!error) { setShowAddIssueModal(false); resetIssueForm(); loadProjectData(); }
    }
  };

  const handleChangeIssueStatus = async (issueId: string, newStatus: ProjectIssueStatus) => {
    if (!currentUser) return;
    const { error } = await supabase.from('project_issues').update({
      status: newStatus, updated_at: new Date().toISOString(),
    }).eq('id', issueId);
    if (!error) {
      await supabase.from('project_issue_history').insert({
        issue_id: issueId, user_id: currentUser.id,
        action: `Zmiana statusu na: ${newStatus === 'new' ? 'Nowe' : newStatus === 'in_progress' ? 'W trakcie' : newStatus === 'completed' ? 'Zakończone' : 'Anulowane'}`,
      });
      loadProjectData();
      if (selectedIssue?.id === issueId) {
        setSelectedIssue({ ...selectedIssue, status: newStatus });
        loadIssueHistory(issueId);
      }
    }
  };

  const handleToggleIssueAccepted = async (issueId: string, accepted: boolean) => {
    if (!currentUser) return;
    const { error } = await supabase.from('project_issues').update({
      accepted, updated_at: new Date().toISOString(),
    }).eq('id', issueId);
    if (!error) {
      await supabase.from('project_issue_history').insert({
        issue_id: issueId, user_id: currentUser.id,
        action: accepted ? 'Zaakceptowano poprawkę' : 'Cofnięto akceptację',
      });
      loadProjectData();
    }
  };

  const loadIssueHistory = async (issueId: string) => {
    const { data } = await supabase.from('project_issue_history').select('*').eq('issue_id', issueId).order('created_at', { ascending: true });
    setIssueHistory(data || []);
  };

  const openIssueDetail = async (issue: ProjectIssue) => {
    setSelectedIssue(issue);
    setIssueHistoryText('');
    setIssueHistoryFiles([]);
    await loadIssueHistory(issue.id);
    setShowIssueDetailModal(true);
  };

  const handleAddIssueHistoryEntry = async () => {
    if (!currentUser || !selectedIssue || (!issueHistoryText && issueHistoryFiles.length === 0)) return;
    const fileUrls: string[] = [];
    for (const file of issueHistoryFiles) {
      const url = await uploadDocument(file, currentUser.id);
      if (url) fileUrls.push(url);
    }
    const { error } = await supabase.from('project_issue_history').insert({
      issue_id: selectedIssue.id, user_id: currentUser.id, action: 'Komentarz',
      description: issueHistoryText || null, file_urls: fileUrls.length > 0 ? fileUrls : null,
    });
    if (!error) { setIssueHistoryText(''); setIssueHistoryFiles([]); loadIssueHistory(selectedIssue.id); }
  };

  const handleAddCategory = async () => {
    if (!currentUser || !newCategoryName.trim()) return;
    const { data, error } = await supabase.from('project_issue_categories').insert({
      company_id: currentUser.company_id, name: newCategoryName.trim(),
    }).select().single();
    if (!error && data) {
      setIssueCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setIssueForm(prev => ({ ...prev, category: data.name }));
      setNewCategoryName(''); setShowNewCategoryInput(false);
    }
  };

  const handleCreateTaskFromIssue = async () => {
    if (!currentUser || !selectedIssue) return;
    const { data, error } = await supabase.from('project_tasks').insert({
      project_id: project.id, company_id: currentUser.company_id,
      name: `Zgłoszenie: ${selectedIssue.name}`, description: selectedIssue.description || '',
      status: 'todo', priority: 'medium', billing_type: project.billing_type || 'ryczalt', worker_payment_type: 'hourly',
    }).select().single();
    if (!error && data) {
      await supabase.from('project_issues').update({ task_id: data.id, updated_at: new Date().toISOString() }).eq('id', selectedIssue.id);
      await supabase.from('project_issue_history').insert({ issue_id: selectedIssue.id, user_id: currentUser.id, action: `Utworzono zadanie: ${data.name}` });
      loadProjectData(); loadIssueHistory(selectedIssue.id);
      setSelectedIssue({ ...selectedIssue, task_id: data.id });
    }
  };

  // ===== ATTACHMENT HANDLERS =====
  const isFileAccepted = (file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    return ACCEPTED_EXTENSIONS.includes(ext);
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isFileAccepted);
    setUploadFiles(prev => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(isFileAccepted);
      setUploadFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const handleUploadFiles = async () => {
    if (!currentUser || uploadFiles.length === 0) return;
    setUploading(true);
    try {
      for (const file of uploadFiles) {
        const url = await uploadDocument(file, currentUser.id);
        if (url) {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          await supabase.from('project_files').insert({
            project_id: project.id, company_id: currentUser.company_id,
            name: file.name, file_type: ext, file_url: url, file_size: file.size, uploaded_by: currentUser.id,
          });
        }
      }
      setUploadFiles([]); setShowUploadModal(false); loadProjectData();
    } finally { setUploading(false); }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć ten załącznik?')) return;
    const { error } = await supabase.from('project_files').delete().eq('id', fileId);
    if (!error) loadProjectData();
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (['jpg', 'jpeg', 'png'].includes(type)) return <Image className="w-4 h-4 text-green-500" />;
    if (['pdf'].includes(type)) return <FileText className="w-4 h-4 text-red-500" />;
    if (['doc', 'docx'].includes(type)) return <FileText className="w-4 h-4 text-blue-500" />;
    if (['xls', 'xlsx'].includes(type)) return <FileText className="w-4 h-4 text-green-600" />;
    if (['mov', 'mp4'].includes(type)) return <File className="w-4 h-4 text-purple-500" />;
    return <File className="w-4 h-4 text-gray-500" />;
  };

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

  const UNIT_OPTIONS = ['szt.', 'm', 'm²', 'm³', 'mb', 'kg', 'l', 'kpl.', 'op.', 'godz.', 'usł.'];

  const renderTaskFormFields = (form: TaskFormState, setForm: (f: TaskFormState) => void, membersDropdownOpen: boolean, setMembersDropdownOpen: (v: boolean) => void) => (
    <div className="space-y-3">
      {/* Row 1: Nazwa + Forma wynagrodzenia */}
      <div className="grid grid-cols-[1fr,auto] gap-3 items-end">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Nazwa zadania</label>
          <input
            type="text"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Nazwa zadania"
          />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Forma wynagrodzenia</label>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setForm({ ...form, billing_type: 'ryczalt' })}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                form.billing_type === 'ryczalt' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Ryczałt
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, billing_type: 'hourly' })}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                form.billing_type === 'hourly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Roboczogodziny
            </button>
          </div>
        </div>
      </div>

      {/* Row 2: Billing fields */}
      {form.billing_type === 'hourly' ? (
        <div className="w-48">
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Ilość godzin</label>
          <div className="relative">
            <input
              type="number"
              value={form.hourly_value || ''}
              onChange={e => setForm({ ...form, hourly_value: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm pr-12 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">godz.</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Ilość</label>
            <input
              type="number"
              value={form.quantity || ''}
              onChange={e => setForm({ ...form, quantity: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Jed. miary</label>
            <select
              value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
            >
              {UNIT_OPTIONS.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Cena jedn.</label>
            <input
              type="number"
              value={form.price_per_unit || ''}
              onChange={e => setForm({ ...form, price_per_unit: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Wartość</label>
            <div className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm bg-gray-50 text-gray-700 font-medium">
              {(form.quantity * form.price_per_unit).toLocaleString('pl-PL')} PLN
            </div>
          </div>
        </div>
      )}

      {/* Row 3: Worker payment + rate inline */}
      <div className="grid grid-cols-[auto,1fr] gap-3 items-end">
        <div>
          <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Forma wynagrodzenia pracownika</label>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => setForm({ ...form, worker_payment_type: 'akord' })}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                form.worker_payment_type === 'akord' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Akord
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, worker_payment_type: 'hourly' })}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                form.worker_payment_type === 'hourly' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Roboczogodziny
            </button>
          </div>
        </div>
        {form.worker_payment_type === 'akord' && (
          <div>
            <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Wynagrodzenie pracownika (wartość jedn.)</label>
            <input
              type="number"
              value={form.worker_rate_per_unit || ''}
              onChange={e => setForm({ ...form, worker_rate_per_unit: parseFloat(e.target.value) || 0 })}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.00"
            />
          </div>
        )}
      </div>

      {/* Row 4: Assigned users */}
      <div className="relative">
        <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Pracownicy odpowiedzialni</label>
        <button
          type="button"
          onClick={() => setMembersDropdownOpen(!membersDropdownOpen)}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm text-left bg-white flex items-center justify-between focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
        >
          <span className={form.assigned_users.length > 0 ? 'text-gray-700' : 'text-gray-400'}>
            {form.assigned_users.length > 0
              ? form.assigned_users.map(id => getUserName(id)).join(', ')
              : 'Wybierz pracowników'}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        </button>
        {membersDropdownOpen && (
          <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
            {members.map(m => (
              <label
                key={m.user_id}
                className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
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
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                />
                {getUserName(m.user_id)}
              </label>
            ))}
            {members.length === 0 && (
              <p className="px-2.5 py-1.5 text-sm text-gray-400">Brak pracowników w projekcie</p>
            )}
          </div>
        )}
      </div>

      {/* Row 5: Deadlines inline */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 mb-0.5">
            <input
              type="checkbox"
              checked={form.has_start_deadline}
              onChange={e => setForm({ ...form, has_start_deadline: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            Termin rozpoczęcia
          </label>
          {form.has_start_deadline && (
            <div className="flex gap-1.5">
              <input
                type="date"
                value={form.start_date}
                onChange={e => setForm({ ...form, start_date: e.target.value })}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="time"
                value={form.start_time}
                onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 mb-0.5">
            <input
              type="checkbox"
              checked={form.has_end_deadline}
              onChange={e => setForm({ ...form, has_end_deadline: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
            />
            Termin zakończenia
          </label>
          {form.has_end_deadline && (
            <div className="flex gap-1.5">
              <input
                type="date"
                value={form.end_date}
                onChange={e => setForm({ ...form, end_date: e.target.value })}
                className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="time"
                value={form.end_time}
                onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Row 6: Description */}
      <div>
        <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Opis zadania</label>
        <textarea
          value={form.description}
          onChange={e => setForm({ ...form, description: e.target.value })}
          rows={2}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 resize-none"
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
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">Dodaj zadanie</h2>
              <button onClick={() => setShowAddTask(false)} className="p-0.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              {renderTaskFormFields(taskForm, setTaskForm, addTaskMembersDropdown, setAddTaskMembersDropdown)}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={() => setShowAddTask(false)} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                Anuluj
              </button>
              <button
                onClick={() => handleSaveTask(false)}
                disabled={savingTask || !taskForm.name.trim()}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {savingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Dodaj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => { setSelectedTask(null); setEditTaskMembersDropdown(false); }}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto m-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
              <h2 className="text-base font-semibold text-gray-900">{selectedTask.title}</h2>
              <button onClick={() => { setSelectedTask(null); setEditTaskMembersDropdown(false); }} className="p-0.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Detail tabs */}
            <div className="border-b border-gray-200 px-5">
              <div className="flex gap-0">
                {[
                  { key: 'edit' as const, label: 'Edytuj' },
                  { key: 'description' as const, label: 'Opis zadania' },
                  { key: 'attachments' as const, label: 'Załączniki' },
                ].map(t => (
                  <button
                    key={t.key}
                    onClick={() => setTaskDetailTab(t.key)}
                    className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
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

            <div className="px-5 py-4">
              {taskDetailTab === 'edit' && (
                <>
                  {renderTaskFormFields(editingTask, setEditingTask, editTaskMembersDropdown, setEditTaskMembersDropdown)}
                  <div className="flex justify-end mt-3">
                    <button
                      onClick={() => handleSaveTask(true)}
                      disabled={savingTask || !editingTask.name.trim()}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    >
                      {savingTask && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
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

  // =========== REMAINING TABS (unchanged) ===========
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
    const totalHours = attendanceRows.reduce((s, r) => s + r.total_hours, 0);
    const totalOvertime = attendanceRows.reduce((s, r) => s + r.overtime_hours, 0);
    const totalSaturdayHours = attendanceRows.filter(r => r.is_saturday).reduce((s, r) => s + r.total_hours, 0);
    const totalSundayHours = attendanceRows.filter(r => r.is_sunday).reduce((s, r) => s + r.total_hours, 0);
    const confirmedCount = attendanceRows.filter(r => r.client_confirmed).length;

    return (
      <div className="space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Razem godzin</p>
            <p className="text-xl font-bold text-gray-900 mt-1">{totalHours.toFixed(1)} godz.</p>
          </div>
          {showOvertimeColumns && project.overtime_paid && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Nadgodziny</p>
              <p className="text-xl font-bold text-orange-600 mt-1">{totalOvertime.toFixed(1)} godz.</p>
            </div>
          )}
          {showOvertimeColumns && project.saturday_paid && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Soboty</p>
              <p className="text-xl font-bold text-blue-600 mt-1">{totalSaturdayHours.toFixed(1)} godz.</p>
            </div>
          )}
          {showOvertimeColumns && project.sunday_paid && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase font-medium">Niedziele</p>
              <p className="text-xl font-bold text-purple-600 mt-1">{totalSundayHours.toFixed(1)} godz.</p>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-xs text-gray-500 uppercase font-medium">Potwierdzone</p>
            <p className="text-xl font-bold text-green-600 mt-1">{confirmedCount} / {attendanceRows.length}</p>
          </div>
        </div>

        {/* Filters and actions bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Od:</label>
              <input
                type="date"
                value={attendanceDateFrom}
                onChange={e => setAttendanceDateFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600">Do:</label>
              <input
                type="date"
                value={attendanceDateTo}
                onChange={e => setAttendanceDateTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
              />
            </div>
            <div className="flex-1" />
            <button
              onClick={exportAttendancePDF}
              disabled={attendanceRows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <FileDown className="w-4 h-4" />
              Pobierz PDF
            </button>
          </div>
        </div>

        {/* Attendance table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          {attendanceLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span className="ml-2 text-sm text-gray-500">Wczytywanie listy obecności...</span>
            </div>
          ) : attendanceRows.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400">Brak wpisów obecności w wybranym okresie</p>
              <p className="text-xs text-gray-300 mt-1">Lista wypełnia się automatycznie na podstawie ewidencji pracowników przypisanych do projektu</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase w-8">Lp.</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Imię i nazwisko</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Obiekt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zadanie</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Rozpoczęcie pracy</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zakończenie pracy</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Ilość godzin</th>
                  {showOvertimeColumns && project.overtime_paid && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nadgodziny</th>
                  )}
                  {showOvertimeColumns && project.saturday_paid && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Soboty</th>
                  )}
                  {showOvertimeColumns && project.sunday_paid && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Niedziele</th>
                  )}
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Potwierdzenie Zleceniodawcy</th>
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((row, idx) => (
                  <tr
                    key={`${row.user_id}-${row.date}`}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${
                      row.is_saturday ? 'bg-blue-50/30' : row.is_sunday ? 'bg-purple-50/30' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-400">{idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{row.user_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{row.department_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 max-w-[200px] truncate" title={row.task_name}>{row.task_name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                      {new Date(row.date).toLocaleDateString('pl-PL', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatTime(row.work_start)}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{formatTime(row.work_end)}</td>
                    <td className="px-4 py-3 text-sm text-gray-900 text-right font-medium">{row.total_hours.toFixed(1)}</td>
                    {showOvertimeColumns && project.overtime_paid && (
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {row.overtime_hours > 0 ? (
                          <span className="text-orange-600">{row.overtime_hours.toFixed(1)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    )}
                    {showOvertimeColumns && project.saturday_paid && (
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {row.is_saturday ? (
                          <span className="text-blue-600">{row.total_hours.toFixed(1)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    )}
                    {showOvertimeColumns && project.sunday_paid && (
                      <td className="px-4 py-3 text-sm text-right font-medium">
                        {row.is_sunday ? (
                          <span className="text-purple-600">{row.total_hours.toFixed(1)}</span>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleClientConfirmation(row)}
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors ${
                          row.client_confirmed
                            ? 'bg-green-100 border-green-300 text-green-600 hover:bg-green-200'
                            : 'bg-white border-gray-300 text-gray-300 hover:border-gray-400 hover:text-gray-400'
                        }`}
                        title={row.client_confirmed ? 'Potwierdzone przez zleceniodawcę' : 'Kliknij aby potwierdzić'}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-300">
                  <td className="px-4 py-3 text-sm font-bold text-gray-700" colSpan={7}>RAZEM</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{totalHours.toFixed(1)}</td>
                  {showOvertimeColumns && project.overtime_paid && (
                    <td className="px-4 py-3 text-sm font-bold text-orange-600 text-right">{totalOvertime.toFixed(1)}</td>
                  )}
                  {showOvertimeColumns && project.saturday_paid && (
                    <td className="px-4 py-3 text-sm font-bold text-blue-600 text-right">{totalSaturdayHours.toFixed(1)}</td>
                  )}
                  {showOvertimeColumns && project.sunday_paid && (
                    <td className="px-4 py-3 text-sm font-bold text-purple-600 text-right">{totalSundayHours.toFixed(1)}</td>
                  )}
                  <td className="px-4 py-3 text-sm font-bold text-green-600 text-center">{confirmedCount} / {attendanceRows.length}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    );
  };

  const renderMembers = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => openAddMemberModal('employee')} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <UserPlus className="w-4 h-4" /> Dodaj pracownika
        </button>
        <button onClick={() => openAddMemberModal('subcontractor')} className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700">
          <HardHat className="w-4 h-4" /> Dodaj podwykonawcę
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {members.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak przypisanych pracowników</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Imię i nazwisko</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Stanowisko</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Forma wynagrodzenia</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {members.map(m => (
                <tr key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{getUserName(m.user_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{m.position || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${m.member_type === 'employee' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                      {m.member_type === 'employee' ? 'Pracownik' : 'Podwykonawca'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {m.payment_type === 'hourly' ? `Stawka: ${m.hourly_rate || 0} zł/godz.` : 'Akord'}
                  </td>
                  <td className="px-4 py-3">
                    <select value={m.member_status} onChange={e => handleUpdateMemberStatus(m.id, e.target.value as ProjectMemberStatus)}
                      className={`text-xs font-medium rounded px-2 py-1 border-0 cursor-pointer ${
                        m.member_status === 'assigned' ? 'bg-green-100 text-green-700' :
                        m.member_status === 'temporarily_unassigned' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                      <option value="assigned">Dopisany do projektu</option>
                      <option value="unassigned">Odpisany od projektu</option>
                      <option value="temporarily_unassigned">Czasowo odpisany</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDeleteMember(m.id)} className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Usuń z projektu">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{addMemberType === 'employee' ? 'Dodaj pracownika' : 'Dodaj podwykonawcę'}</h3>
              <button onClick={() => setShowAddMemberModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wyszukaj pracownika</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Szukaj po imieniu lub nazwisku..."
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto">
                {filteredUsersForMember.length === 0 ? (
                  <p className="text-sm text-gray-400 p-3 text-center">Brak dostępnych pracowników</p>
                ) : (
                  filteredUsersForMember.map(u => (
                    <button key={u.id} onClick={() => setMemberForm(prev => ({ ...prev, user_id: u.id }))}
                      className={`w-full text-left px-3 py-2 text-sm border-b border-gray-100 last:border-0 hover:bg-gray-50 ${memberForm.user_id === u.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}>
                      {u.first_name} {u.last_name}
                      {u.target_position && <span className="text-gray-400 ml-2">({u.target_position})</span>}
                    </button>
                  ))
                )}
              </div>
              {memberForm.user_id && (<>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stanowisko</label>
                  <input type="text" value={memberForm.position} onChange={e => setMemberForm(prev => ({ ...prev, position: e.target.value }))} placeholder="np. Murarz, Elektryk..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Rola</label>
                    <select value={memberForm.role} onChange={e => setMemberForm(prev => ({ ...prev, role: e.target.value as 'manager' | 'member' }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="member">Członek</option><option value="manager">Kierownik</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Forma wynagrodzenia</label>
                    <select value={memberForm.payment_type} onChange={e => setMemberForm(prev => ({ ...prev, payment_type: e.target.value as ProjectMemberPaymentType }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                      <option value="hourly">Stawka godzinowa</option><option value="akord">Akord</option>
                    </select>
                  </div>
                </div>
                {memberForm.payment_type === 'hourly' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stawka (zł/godz.)</label>
                    <input type="number" value={memberForm.hourly_rate} onChange={e => setMemberForm(prev => ({ ...prev, hourly_rate: e.target.value }))} placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  </div>
                )}
              </>)}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => setShowAddMemberModal(false)} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleAddMember} disabled={!memberForm.user_id} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Dodaj</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderIssues = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={openAddIssueModal} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Dodaj zgłoszenie
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {issues.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak zgłoszeń</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zgłaszający</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Firma</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Zadanie</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Kategoria</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akceptacja</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Akcje</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(iss => (
                <tr key={iss.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => openIssueDetail(iss)}>
                  <td className="px-4 py-3 text-sm font-medium text-blue-600 hover:text-blue-800">{iss.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getUserName(iss.reporter_id)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{iss.reporter_company || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    {iss.task_id ? (
                      <button onClick={e => { e.stopPropagation(); setActiveTab('tasks'); }} className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> {tasks.find(t => t.id === iss.task_id)?.name || 'Zadanie'}
                      </button>
                    ) : <span className="text-gray-400">-</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{iss.category || '-'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      iss.status === 'completed' ? 'bg-green-100 text-green-700' : iss.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                      iss.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {iss.status === 'new' ? 'Nowe' : iss.status === 'in_progress' ? 'W trakcie' : iss.status === 'completed' ? 'Zakończone' : 'Anulowane'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleToggleIssueAccepted(iss.id, !iss.accepted)}
                      className={`p-1 rounded ${iss.accepted ? 'text-green-600' : 'text-gray-300 hover:text-gray-500'}`}
                      title={iss.accepted ? 'Zaakceptowano' : 'Nie zaakceptowano'}>
                      <CheckCircle className="w-5 h-5" />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEditIssueModal(iss)} className="p-1 text-gray-400 hover:text-blue-600 transition-colors" title="Edytuj">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {/* Add/Edit Issue Modal */}
      {showAddIssueModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{editingIssue ? 'Edytuj zgłoszenie' : 'Dodaj zgłoszenie'}</h3>
              <button onClick={() => { setShowAddIssueModal(false); resetIssueForm(); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nazwa *</label>
                <input type="text" value={issueForm.name} onChange={e => setIssueForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Nazwa zgłoszenia"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Firma zgłaszająca</label>
                <input type="text" value={issueForm.reporter_company} onChange={e => setIssueForm(prev => ({ ...prev, reporter_company: e.target.value }))} placeholder="Nazwa firmy"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kategoria</label>
                <div className="flex gap-2">
                  <select value={issueForm.category} onChange={e => setIssueForm(prev => ({ ...prev, category: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                    <option value="">-- Wybierz kategorię --</option>
                    {issueCategories.map(cat => (<option key={cat.id} value={cat.name}>{cat.name}</option>))}
                  </select>
                  <button onClick={() => setShowNewCategoryInput(!showNewCategoryInput)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50" title="Dodaj nową kategorię">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {showNewCategoryInput && (
                  <div className="flex gap-2 mt-2">
                    <input type="text" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Nowa kategoria..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
                    <button onClick={handleAddCategory} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">Dodaj</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Opis</label>
                <textarea value={issueForm.description} onChange={e => setIssueForm(prev => ({ ...prev, description: e.target.value }))} rows={4} placeholder="Opis zgłoszenia - co należy wykonać..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Załączniki</label>
                <input type="file" multiple onChange={e => { if (e.target.files) setIssueFiles(prev => [...prev, ...Array.from(e.target.files!)]); }}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
                {issueFiles.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {issueFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        <span>{f.name}</span>
                        <button onClick={() => setIssueFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
                {issueForm.file_urls.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {issueForm.file_urls.map((url, i) => (
                      <div key={i} className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 truncate">{url.split('/').pop()}</a>
                        <button onClick={() => setIssueForm(prev => ({ ...prev, file_urls: prev.file_urls.filter((_, idx) => idx !== i) }))} className="text-red-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => { setShowAddIssueModal(false); resetIssueForm(); }} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleSaveIssue} disabled={!issueForm.name} className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {editingIssue ? 'Zapisz' : 'Dodaj'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Issue Detail Modal */}
      {showIssueDetailModal && selectedIssue && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedIssue.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Zgłosił: {getUserName(selectedIssue.reporter_id)} | {new Date(selectedIssue.created_at).toLocaleString('pl-PL')}
                  {selectedIssue.reporter_company && ` | ${selectedIssue.reporter_company}`}
                </p>
              </div>
              <button onClick={() => setShowIssueDetailModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-gray-500">Status:</span>
                {(['new', 'in_progress', 'completed', 'cancelled'] as ProjectIssueStatus[]).map(st => (
                  <button key={st} onClick={() => handleChangeIssueStatus(selectedIssue.id, st)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      selectedIssue.status === st
                        ? (st === 'new' ? 'bg-amber-200 text-amber-800' : st === 'in_progress' ? 'bg-blue-200 text-blue-800' :
                           st === 'completed' ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800')
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}>
                    {st === 'new' ? 'Nowe' : st === 'in_progress' ? 'W trakcie' : st === 'completed' ? 'Zakończone' : 'Anulowane'}
                  </button>
                ))}
              </div>
              {selectedIssue.description && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-1">Opis - co należy wykonać</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedIssue.description}</p>
                </div>
              )}
              {selectedIssue.file_urls && selectedIssue.file_urls.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">Załączniki zgłoszenia</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedIssue.file_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm hover:bg-blue-100">
                        <Paperclip className="w-3 h-3" /> {url.split('/').pop()?.substring(0, 30)}
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {!selectedIssue.task_id ? (
                <button onClick={handleCreateTaskFromIssue} className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
                  <ClipboardList className="w-4 h-4" /> Utwórz zadanie
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle className="w-4 h-4" /> Powiązane zadanie: {tasks.find(t => t.id === selectedIssue.task_id)?.name || 'Zadanie'}
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Historia zgłoszenia</h4>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0"><MessageSquare className="w-4 h-4 text-blue-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900"><span className="font-medium">{getUserName(selectedIssue.reporter_id)}</span><span className="text-gray-500"> utworzył zgłoszenie</span></p>
                      <p className="text-xs text-gray-400">{new Date(selectedIssue.created_at).toLocaleString('pl-PL')}</p>
                    </div>
                  </div>
                  {issueHistory.map(entry => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0"><MessageSquare className="w-4 h-4 text-gray-500" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-900"><span className="font-medium">{getUserName(entry.user_id)}</span><span className="text-gray-500"> - {entry.action}</span></p>
                        {entry.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{entry.description}</p>}
                        {entry.file_urls && entry.file_urls.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {entry.file_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-blue-600 rounded text-xs hover:bg-gray-200">
                                <Paperclip className="w-3 h-3" /> {url.split('/').pop()?.substring(0, 20)}
                              </a>
                            ))}
                          </div>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">{new Date(entry.created_at).toLocaleString('pl-PL')}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-gray-200 pt-4">
                  <textarea value={issueHistoryText} onChange={e => setIssueHistoryText(e.target.value)} rows={2} placeholder="Dodaj komentarz..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                  <div className="flex items-center justify-between mt-2">
                    <input type="file" multiple onChange={e => { if (e.target.files) setIssueHistoryFiles(Array.from(e.target.files)); }} className="text-xs text-gray-500" />
                    <button onClick={handleAddIssueHistoryEntry} disabled={!issueHistoryText && issueHistoryFiles.length === 0}
                      className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">Wyślij</button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAttachments = () => (
    <div className="space-y-4">
      <div className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={e => { handleFileDrop(e); setShowUploadModal(true); }}>
        <UploadCloud className="w-10 h-10 text-gray-400 mx-auto mb-3" />
        <p className="text-sm text-gray-600 mb-1">Przeciągnij i upuść plik, który chcesz dodać do tego projektu</p>
        <p className="text-xs text-gray-400 mb-3">lub kliknij w przycisk poniżej i wybierz plik ze swojego komputera</p>
        <button onClick={() => { setUploadFiles([]); setShowUploadModal(true); }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          <Upload className="w-4 h-4" /> Dodaj załącznik
        </button>
        <p className="text-xs text-gray-400 mt-3">Akceptowane pliki: .jpg, .png, .pdf, .dwg, .xls, .xlsx, .doc, .docx, .mov, .mp4</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        {files.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">Brak załączników</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Nazwa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Typ</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Dodano przez</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Data dodania</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Podgląd</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Pobierz</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Usuń</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => (
                <tr key={f.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">{getFileIcon(f.file_type)}<span className="text-sm font-medium text-gray-900">{f.name}</span></div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 uppercase">{f.file_type}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{getUserName(f.uploaded_by)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{new Date(f.created_at).toLocaleDateString('pl-PL')}</td>
                  <td className="px-4 py-3 text-center">
                    <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Podgląd"><Eye className="w-4 h-4" /></a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <a href={f.file_url} download={f.name} className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="Pobierz"><Download className="w-4 h-4" /></a>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDeleteFile(f.id)} className="inline-flex items-center justify-center p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Usuń"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Dodaj załączniki</h3>
              <button onClick={() => { setShowUploadModal(false); setUploadFiles([]); }} className="p-1 text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
                onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleFileDrop}>
                <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Przeciągnij pliki tutaj lub</p>
                <label className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 cursor-pointer">
                  <Upload className="w-4 h-4" /> Wybierz pliki
                  <input type="file" multiple accept={ACCEPTED_MIME_TYPES} onChange={handleFileSelect} className="hidden" />
                </label>
                <p className="text-xs text-gray-400 mt-2">.jpg, .png, .pdf, .dwg, .xls, .xlsx, .doc, .docx, .mov, .mp4</p>
              </div>
              {uploadFiles.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-gray-700">Wybrane pliki ({uploadFiles.length}):</p>
                  {uploadFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                      <div className="flex items-center gap-2 min-w-0">
                        {getFileIcon(f.name.split('.').pop() || '')}
                        <span className="text-sm text-gray-700 truncate">{f.name}</span>
                        <span className="text-xs text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                      </div>
                      <button onClick={() => setUploadFiles(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-gray-400 hover:text-red-600"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-200">
              <button onClick={() => { setShowUploadModal(false); setUploadFiles([]); }} className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Anuluj</button>
              <button onClick={handleUploadFiles} disabled={uploadFiles.length === 0 || uploading}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
                {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                {uploading ? 'Przesyłanie...' : `Prześlij (${uploadFiles.length})`}
              </button>
            </div>
          </div>
        </div>
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
