
import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, BarChart3, Calendar, ClipboardList, FileCheck, DollarSign,
  Receipt, Clock, Users, MessageSquare, Paperclip, Loader2, Plus, X,
  Pencil, Trash2, Upload, Download, Eye, Check, XCircle, Search,
  ChevronDown, Building2, MapPin, TrendingUp, FileText, Settings,
  ExternalLink, AlertCircle, Wrench, Tag, Hash, CheckCircle2, FileDown
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
  ContractorClient, ProjectAttendanceConfirmation, ProjectAttendanceRow,
  WorkerDay, WorkerDayEntry
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
