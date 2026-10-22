import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpDown, CalendarDays, CheckCircle2, ClipboardList, LoaderCircle, RefreshCw, Search, UserRound, Users } from 'lucide-react';
import type { AuthDepartmentId } from '../types/auth';
import type { EncoTask, EncoTaskStatus } from '../types/tasks';
import { fetchTasks, updateTaskStatus } from '../services/taskService';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';

type DepartmentFilter = 'all' | AuthDepartmentId;
type SortKey = 'orderNumber' | 'description' | 'assigneeName' | 'dueDate' | 'createdAt';
type SortDirection = 'asc' | 'desc';

interface Props {
  orders: any[];
  doorOrders?: any[];
  onSelectOrder: (orderId: string) => void;
  onOpenDoorModule?: () => void;
  currentProfile?: UserRoleProfile;
}

const DEPARTMENTS: Array<{ value: DepartmentFilter; label: string }> = [
  { value: 'all', label: 'Wszystkie działy' },
  { value: 'dzial_handlowy', label: 'Dział Handlowy' },
  { value: 'logistyka', label: 'Logistyka' },
  { value: 'pyskowice', label: 'Produkcja – Pyskowice' },
  { value: 'plochocinska', label: 'Produkcja – Płochocińska' },
];
const DEPARTMENT_LABELS: Record<AuthDepartmentId, string> = {
  dzial_handlowy: 'Dział Handlowy',
  logistyka: 'Logistyka',
  pyskowice: 'Pyskowice',
  plochocinska: 'Płochocińska',
};
const STATUS_LABELS: Record<EncoTaskStatus, string> = { todo: 'Do wykonania', in_progress: 'W toku', done: 'Wykonane' };

function dateLabel(value: string): string {
  if (!value) return '—';
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('pl-PL');
}
function isOverdue(task: EncoTask): boolean {
  if (!task.dueDate || task.status === 'done') return false;
  const date = new Date(task.dueDate + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(date.getTime()) && date < today;
}
function defaultDepartment(profile: UserRoleProfile): DepartmentFilter {
  if (profile.id === 'dzial_handlowy') return 'dzial_handlowy';
  if (profile.id === 'logistyka') return 'logistyka';
  if (profile.id === 'pyskowice') return 'pyskowice';
  if (profile.id === 'plochocinska') return 'plochocinska';
  return 'all';
}

export const ActionDashboardView: React.FC<Props> = ({ orders, onSelectOrder, currentProfile }) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const [tasks, setTasks] = useState<EncoTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState<DepartmentFilter>(() => defaultDepartment(profile));
  const [sortKey, setSortKey] = useState<SortKey>('dueDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showCompleted, setShowCompleted] = useState(false);
  const [updatingIds, setUpdatingIds] = useState<string[]>([]);

  useEffect(() => { setDepartment(defaultDepartment(profile)); }, [profile.id]);
  const load = async () => {
    setLoading(true);
    setError('');
    try { setTasks(await fetchTasks()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Nie udało się pobrać zadań.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('pl');
    const filtered = tasks.filter((task) => {
      if (!showCompleted && task.status === 'done') return false;
      if (department !== 'all' && task.assigneeDepartment !== department) return false;
      if (!query) return true;
      return [task.orderNumber, task.projectName, task.client, task.description, task.assigneeName, task.createdByName]
        .some((value) => String(value || '').toLocaleLowerCase('pl').includes(query));
    });
    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'orderNumber') cmp = a.orderNumber.localeCompare(b.orderNumber, 'pl', { numeric: true });
      else if (sortKey === 'description') cmp = a.description.localeCompare(b.description, 'pl');
      else if (sortKey === 'assigneeName') cmp = a.assigneeName.localeCompare(b.assigneeName, 'pl');
      else {
        const av = sortKey === 'dueDate' ? a.dueDate : a.createdAt;
        const bv = sortKey === 'dueDate' ? b.dueDate : b.createdAt;
        if (sortKey === 'dueDate' && Boolean(av) !== Boolean(bv)) return av ? -1 : 1;
        cmp = av.localeCompare(bv);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return filtered;
  }, [tasks, search, department, sortKey, sortDirection, showCompleted]);

  const handleStatus = async (task: EncoTask, status: EncoTaskStatus) => {
    setUpdatingIds((current) => [...current, task.id]);
    setError('');
    try {
      const updated = await updateTaskStatus(task.id, status);
      setTasks((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zmienić statusu zadania.');
    } finally {
      setUpdatingIds((current) => current.filter((id) => id !== task.id));
    }
  };

  const activeCount = tasks.filter((task) => task.status !== 'done').length;
  const overdueCount = tasks.filter(isOverdue).length;
  const completedCount = tasks.filter((task) => task.status === 'done').length;
  const showSalesReminders = profile.id === 'dzial_handlowy' || profile.id === 'admin';
  const ordersNeedingSalesFollowUp = showSalesReminders
    ? orders.filter((order) => !tasks.some((task) => String(task.orderId) === String(order.id) && task.status !== 'done'))
    : [];

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="border-b border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ClipboardList className="h-5 w-5 text-blue-600" /> Plan działań</h1>
              <p className="mt-1 max-w-3xl text-xs text-slate-600">Wspólny rejestr zadań utworzonych przy zleceniach. Zmiana statusu jest widoczna również w panelu zadania na karcie zlecenia po odświeżeniu.</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-600">Aktywne: <strong className="text-slate-900">{activeCount}</strong></span>
              <span className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">Po terminie: <strong>{overdueCount}</strong></span>
              <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-700">Wykonane: <strong>{completedCount}</strong></span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj ZL, zadania, osoby..." className="w-full min-w-0 rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30" />
            </div>
            <select aria-label="Filtruj zadania według działu" value={department} onChange={(event) => setDepartment(event.target.value as DepartmentFilter)} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              {DEPARTMENTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select aria-label="Sortuj zadania" value={sortKey} onChange={(event) => { const next = event.target.value as SortKey; setSortKey(next); setSortDirection(next === 'createdAt' ? 'desc' : 'asc'); }} className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
              <option value="orderNumber">Sortuj: numer ZL</option><option value="description">Sortuj: opis zadania</option><option value="assigneeName">Sortuj: odpowiedzialny</option><option value="dueDate">Sortuj: termin wykonania</option><option value="createdAt">Sortuj: data dodania</option>
            </select>
            <button type="button" onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"><ArrowUpDown className="h-3.5 w-3.5" />{sortDirection === 'asc' ? 'Rosnąco' : 'Malejąco'}</button>
            <div className="flex gap-2">
              <label className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2 text-xs text-slate-600"><input type="checkbox" checked={showCompleted} onChange={(event) => setShowCompleted(event.target.checked)} /> Pokaż wykonane</label>
              <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50" title="Odśwież listę zadań">{loading ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</button>
            </div>
          </div>
        </div>
        {error && <div role="alert" className="mx-4 mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</div>}
        {showSalesReminders && ordersNeedingSalesFollowUp.length > 0 && (
          <section className="mx-4 mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950">
            <h2 className="text-sm font-bold">Przypomnienia dla Działu Handlowego</h2>
            <p className="mt-1 text-xs">W tych zleceniach wszystkie zadania są wykonane lub nie ma żadnych zadań. Sprawdź zlecenie i wykonaj dalsze czynności handlowe.</p>
            <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-white">
              <ul className="divide-y divide-slate-100">
                {ordersNeedingSalesFollowUp.map((order) => (
                  <li key={String(order.id)}>
                    <div className="flex items-center justify-between gap-3 px-3 py-3 transition-colors hover:bg-amber-50/50">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-semibold text-slate-800">{String(order.orderNumber || order.number || order.zlNumber || 'Zlecenie')}</div>
                        <div className="mt-0.5 truncate text-[11px] text-slate-500">{order.projectName || order.client || 'Brak nazwy projektu'}</div>
                      </div>
                      <button type="button" onClick={() => onSelectOrder(String(order.id))} className="shrink-0 rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30">
                        Otwórz zlecenie <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
        {loading && tasks.length === 0 ? <div className="flex items-center justify-center gap-2 p-10 text-xs text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Pobieranie zadań…</div>
          : visibleTasks.length === 0 ? <div className="p-10 text-center"><CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-500" /><h2 className="text-sm font-bold text-slate-800">Brak zadań spełniających wybrane kryteria</h2><p className="mt-1 text-xs text-slate-500">Zadania dodaje się z panelu „Zadania i przypomnienia” przy konkretnym zleceniu.</p></div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-left"><thead className="border-b border-slate-200 bg-slate-50"><tr className="text-[10px] uppercase tracking-wide text-slate-500"><th className="px-4 py-3">ZL / projekt</th><th className="px-4 py-3">Zadanie</th><th className="px-4 py-3">Odpowiedzialny</th><th className="px-4 py-3">Termin</th><th className="px-4 py-3">Dodano</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">
            {visibleTasks.map((task) => <tr key={task.id} className="align-top hover:bg-blue-50/40">
              <td className="px-4 py-3"><button type="button" onClick={() => onSelectOrder(task.orderId)} className="text-left text-xs font-bold text-blue-700 hover:underline">{task.orderNumber || 'Bez numeru ZL'}</button><div className="mt-1 max-w-[190px] whitespace-normal text-[11px] text-slate-500">{task.projectName || task.client}</div></td>
              <td className="px-4 py-3"><div className="min-w-[200px] whitespace-pre-wrap break-words text-xs font-semibold text-slate-800">{task.description}</div><div className="mt-1 text-[10px] text-slate-400">Dodał(a): {task.createdByName}</div></td>
              <td className="px-4 py-3"><div className="flex items-start gap-2 text-xs text-slate-700">{task.assigneeType === 'person' ? <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />}<span className="max-w-[170px] whitespace-normal">{task.assigneeName || (task.assigneeDepartment ? DEPARTMENT_LABELS[task.assigneeDepartment] : 'Nieprzypisano')}</span></div></td>
              <td className="whitespace-nowrap px-4 py-3 text-xs"><div className={isOverdue(task) ? 'font-bold text-rose-700' : 'text-slate-700'}><CalendarDays className="mr-1 inline h-3.5 w-3.5" />{dateLabel(task.dueDate)}</div>{isOverdue(task) && <div className="mt-1 text-[10px] text-rose-600"><AlertTriangle className="mr-1 inline h-3 w-3" />Po terminie</div>}</td>
              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{dateLabel((task.createdAt || '').slice(0, 10))}</td>
              <td className="px-4 py-3"><select aria-label={'Status zadania ' + task.description} disabled={updatingIds.includes(task.id) || (profile.id === 'ogolny')} value={task.status} onChange={(event) => void handleStatus(task, event.target.value as EncoTaskStatus)} className="max-w-[150px] rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] disabled:opacity-50"><option value="todo">{STATUS_LABELS.todo}</option><option value="in_progress">{STATUS_LABELS.in_progress}</option><option value="done">{STATUS_LABELS.done}</option></select>{updatingIds.includes(task.id) && <LoaderCircle className="ml-1 inline h-3 w-3 animate-spin text-slate-400" />}</td>
            </tr>)}
          </tbody></table></div>}
      </section>
    </div>
  );
};
