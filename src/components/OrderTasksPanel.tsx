import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Check, ChevronRight, ClipboardList, LoaderCircle, Plus, RefreshCw, UserRound, Users, PanelRightClose, PanelRightOpen } from 'lucide-react';
import type { AuthDepartmentId } from '../types/auth';
import type { EncoTask, EncoTaskStatus, TaskAssigneeUser } from '../types/tasks';
import type { UserRoleProfile } from '../types/userRole';
import { createTask, fetchTaskAssignees, fetchTasks, updateTaskStatus } from '../services/taskService';

interface Props {
  orderId: string;
  orderNumber: string;
  projectName: string;
  client: string;
  currentProfile: UserRoleProfile;
  onOpenChange?: (isOpen: boolean) => void;
}

const DEPARTMENTS: Array<{ id: AuthDepartmentId; label: string }> = [
  { id: 'dzial_handlowy', label: 'Dział Handlowy' },
  { id: 'logistyka', label: 'Logistyka' },
  { id: 'pyskowice', label: 'Produkcja – Pyskowice' },
  { id: 'plochocinska', label: 'Produkcja – Płochocińska' },
];

const STATUS_LABELS: Record<EncoTaskStatus, string> = {
  todo: 'Do wykonania',
  in_progress: 'W toku',
  done: 'Wykonane',
};

function formatDate(value: string): string {
  if (!value) return 'Nie ustalono';
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pl-PL');
}

function dueLabel(value: string, status: EncoTaskStatus): { label: string; style: string } {
  if (status === 'done') return { label: 'Zakończone', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
  if (!value) return { label: 'Bez terminu', style: 'bg-slate-100 text-slate-600 border-slate-200' };
  const date = new Date(value + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (!Number.isNaN(date.getTime()) && date < today) return { label: 'Po terminie', style: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (!Number.isNaN(date.getTime()) && date.getTime() === today.getTime()) return { label: 'Termin dziś', style: 'bg-amber-50 text-amber-800 border-amber-200' };
  return { label: 'Termin', style: 'bg-blue-50 text-blue-700 border-blue-200' };
}

export const OrderTasksPanel: React.FC<Props> = ({ orderId, orderNumber, projectName, client, currentProfile, onOpenChange }) => {
  const [isOpen, setIsOpen] = useState(() => {
    try { return window.localStorage.getItem('enco-flow-order-tasks-panel') !== 'collapsed'; }
    catch { return true; }
  });
  const [tasks, setTasks] = useState<EncoTask[]>([]);
  const [users, setUsers] = useState<TaskAssigneeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeType, setAssigneeType] = useState<'department' | 'person'>('department');
  const [department, setDepartment] = useState<AuthDepartmentId>('dzial_handlowy');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  useEffect(() => {
    try { window.localStorage.setItem('enco-flow-order-tasks-panel', isOpen ? 'open' : 'collapsed'); }
    catch { /* Panel remains usable when storage is unavailable. */ }
  }, [isOpen]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [allTasks, allUsers] = await Promise.all([fetchTasks(), fetchTaskAssignees()]);
      setUsers(allUsers);
      if (!userId && allUsers.length) setUserId(allUsers[0].id);

      setTasks(allTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać zadań.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // Lista jest pobierana po otwarciu zlecenia; kolejne odświeżenie użytkownik uruchamia ręcznie.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const orderTasks = useMemo(() => tasks
    .filter((task) => String(task.orderId) === String(orderId))
    .filter((task) => showCompleted || task.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || b.createdAt.localeCompare(a.createdAt)), [tasks, orderId, showCompleted]);
  const activeCount = tasks.filter((task) => String(task.orderId) === String(orderId) && task.status !== 'done').length;
  const showSalesReminder = activeCount === 0 && (currentProfile.id === 'dzial_handlowy' || currentProfile.id === 'admin');
  const canCreateTask = currentProfile.id !== 'ogolny';

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const task = await createTask({
        orderId,
        description: description.trim(),
        dueDate,
        assigneeType,
        assigneeDepartment: assigneeType === 'department'
          ? department
          : users.find((user) => user.id === userId)?.departments[0],
        assigneeUserId: assigneeType === 'person' ? userId : undefined,
      });
      setTasks((current) => [task, ...current.filter((item) => item.id !== task.id)]);
            setDescription('');
      setDueDate('');
      setIsFormOpen(false);
      setNotice('Zadanie zapisano na serwerze.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się utworzyć zadania.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (task: EncoTask, status: EncoTaskStatus) => {
    setError('');
    setNotice('');
    try {
      const updated = await updateTaskStatus(task.id, status);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić statusu zadania.');
    }
  };

  return (
    <>
      {!isOpen && (
        <button type="button" onClick={() => setIsOpen(true)} className="fixed right-0 top-1/2 z-50 flex -translate-y-1/2 items-center gap-2 rounded-l-xl border border-r-0 border-slate-300 bg-slate-900 px-3 py-4 text-white transition-colors hover:bg-slate-800" aria-label="Otwórz panel zadań" title="Zadania">
          <PanelRightOpen className="h-5 w-5" />
          <span className="text-xs font-bold [writing-mode:vertical-rl] rotate-180">Zadania</span>
        </button>
      )}
      <aside className={"fixed right-0 top-16 z-40 flex h-[calc(100dvh-4rem)] w-[360px] max-w-[calc(100vw-16px)] flex-col overflow-hidden border-l border-slate-200 bg-white transition-transform duration-300 ease-in-out " + (isOpen ? "translate-x-0" : "translate-x-full")}>
            <div className="flex items-start justify-between gap-2 border-b border-slate-200 bg-slate-900 px-3 py-4 text-white">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-bold">Zadania</div>
                <p className="mt-1 truncate text-[11px] text-slate-300">{orderNumber} · {projectName || client}</p>
                <p className="mt-1 text-[11px] text-slate-400">{activeCount} aktywne {activeCount === 1 ? 'zadanie' : 'zadania'}</p>
              </div>
              <button type="button" onClick={() => setIsOpen((open) => !open)} className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800 hover:text-white" aria-label={isOpen ? "Zwiń panel zadań" : "Rozwiń panel zadań"} title={isOpen ? "Zwiń panel" : "Rozwiń panel"}><PanelRightClose className="h-4 w-4" /></button>
            </div>

            <>
{showSalesReminder && (
  <div className="mx-3 mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-3 text-xs text-amber-900">
    <div className="font-bold">Przypomnienie dla Działu Handlowego</div>
    <p className="mt-1">Wszystkie zadania dla tego zlecenia są wykonane lub nie ma żadnych zadań. Sprawdź zlecenie i wykonaj dalsze czynności handlowe.</p>
  </div>
)}
<div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <button type="button" onClick={() => setIsFormOpen((open) => !open)} disabled={!canCreateTask} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">
                <Plus className="h-4 w-4" /> Nowe zadanie
              </button>
              <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50" title="Pobierz aktualną listę z serwera">
                {loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Odśwież
              </button>
            </div>

            {isFormOpen && (
              <form onSubmit={handleCreate} className="space-y-3 border-b border-blue-100 bg-blue-50/60 p-4">
                <label className="block text-xs font-semibold text-slate-700">Opis zadania
                  <textarea required maxLength={500} rows={2} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Np. zamówić drzwi" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-blue-500/30" />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block min-w-0 text-xs font-semibold text-slate-700">Odpowiedzialny
                    <select value={assigneeType} onChange={(event) => setAssigneeType(event.target.value as 'department' | 'person')} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                      <option value="department">Dział</option><option value="person">Osoba</option>
                    </select>
                  </label>
                  <label className="block min-w-0 text-xs font-semibold text-slate-700">{assigneeType === 'department' ? 'Dział' : 'Osoba'}
                    {assigneeType === 'department' ? (
                      <select required value={department} onChange={(event) => setDepartment(event.target.value as AuthDepartmentId)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                        {DEPARTMENTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                      </select>
                    ) : (
                      <select required value={userId} onChange={(event) => setUserId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs">
                        {users.map((user) => <option key={user.id} value={user.id}>{user.displayName}{user.isAdmin ? ' · Admin' : ''}</option>)}
                      </select>
                    )}
                  </label>
                </div>
                <label className="block text-xs font-semibold text-slate-700">Termin wykonania
                  <input required type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs" />
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setIsFormOpen(false)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600">Anuluj</button>
                  <button type="submit" disabled={saving || !description.trim() || !dueDate || (assigneeType === 'person' && !userId)} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">
                    {saving ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Zapisz zadanie
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <p className="text-[11px] text-slate-500">Termin i status każdego zadania można kontrolować tutaj.</p>
              <label className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-slate-600">
                <input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Wykonane
              </label>
            </div>

            {error && <div role="alert" className="mx-4 mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
            {notice && <div role="status" className="mx-4 mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">{notice}</div>}

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {loading && orderTasks.length === 0 ? (
                <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Pobieranie zadań…</div>
              ) : orderTasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 px-4 py-9 text-center">
                  <ClipboardList className="mx-auto h-7 w-7 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-700">{showCompleted ? 'Brak zadań do wyświetlenia' : 'Brak aktywnych zadań'}</p>
                  <p className="mt-1 text-xs text-slate-500">Utwórz zadanie, aby pojawiło się tutaj i w Planie działań.</p>
                  {canCreateTask && <button type="button" onClick={() => setIsFormOpen(true)} className="mt-3 text-xs font-bold text-blue-700 hover:underline">Dodaj pierwsze zadanie</button>}
                </div>
              ) : orderTasks.map((task) => {
                const due = dueLabel(task.dueDate, task.status);
                return (
                  <article key={task.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className={'whitespace-pre-wrap break-words text-sm font-semibold ' + (task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900')}>{task.description}</p>
                      <span className={'shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ' + due.style}>{due.label}</span>
                    </div>
                    <div className="mt-3 flex items-start gap-2 text-xs text-slate-600">
                      {task.assigneeType === 'person' ? <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                      <span className="break-words">{task.assigneeName || (task.assigneeDepartment ? DEPARTMENTS.find((item) => item.id === task.assigneeDepartment)?.label : 'Nieprzypisano')}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-600"><CalendarDays className="h-3.5 w-3.5 shrink-0" /> Termin: <strong>{formatDate(task.dueDate)}</strong></div>
                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <span className="text-[10px] text-slate-400">Dodał(a): {task.createdByName}</span>
                      <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                        <ChevronRight className="h-3.5 w-3.5" />
                        <select aria-label={'Status zadania: ' + task.description} value={task.status} onChange={(event) => void handleStatusChange(task, event.target.value as EncoTaskStatus)} className="max-w-[140px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px]">
                          <option value="todo">{STATUS_LABELS.todo}</option><option value="in_progress">{STATUS_LABELS.in_progress}</option><option value="done">{STATUS_LABELS.done}</option>
                        </select>
                      </label>
                    </div>
                  </article>
                );
              })}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-[10px] text-slate-500">Zmiany zadań są zapisywane na serwerze po kliknięciu „Zapisz zadanie” lub zmianie statusu.</div>

            </>
          </aside>
    </>
  );
};
