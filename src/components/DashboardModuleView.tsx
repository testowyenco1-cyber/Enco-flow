import React, { useEffect, useState } from 'react';
import { Order, ITEM_DEFINITIONS, STATUS_META } from '../types/enco';
import { Search, LayoutDashboard, ArrowUpDown } from 'lucide-react';
import type { EncoTask } from '../types/tasks';
import { fetchTasks } from '../services/taskService';

interface DashboardModuleViewProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
}

const formatDepartureDate = (date?: string) => {
  if (!date) return '—';
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : date;
};

export const DashboardModuleView: React.FC<DashboardModuleViewProps> = ({ orders, onSelectOrder }) => {
  const columns = ITEM_DEFINITIONS;
  const activeOrders = orders.filter((order) => !order.archivedAt);
  const [departureSort, setDepartureSort] = useState<'asc' | 'desc' | null>(null);
  const [tasks, setTasks] = useState<EncoTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  const displayedOrders = [...activeOrders].sort((a, b) => {
    if (!departureSort) return 0;
    const dateA = a.departureDate ? new Date(a.departureDate).getTime() : Number.NaN;
    const dateB = b.departureDate ? new Date(b.departureDate).getTime() : Number.NaN;
    const validA = Number.isFinite(dateA);
    const validB = Number.isFinite(dateB);
    if (!validA && !validB) return 0;
    if (!validA) return 1;
    if (!validB) return -1;
    return departureSort === 'asc' ? dateA - dateB : dateB - dateA;
  });

  useEffect(() => {
    let cancelled = false;
    fetchTasks()
      .then((loadedTasks) => { if (!cancelled) setTasks(loadedTasks); })
      .catch(() => { if (!cancelled) setTasks([]); })
      .finally(() => { if (!cancelled) setTasksLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <section className="space-y-5 pb-4">
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white"><LayoutDashboard className="h-5 w-5" /></span>
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <span className="ml-auto rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium tabular-nums text-slate-600">{activeOrders.length} aktywnych zleceń</span>
      </div>

      <div className="min-w-0">
        <div className="max-h-[calc(100dvh-210px)] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full table-fixed border-separate border-spacing-0 text-[11px]" style={{ minWidth: 190 + 112 + columns.length * 42 + 84 }}>
            <colgroup>
              <col style={{ width: 190 }} />
              <col style={{ width: 112 }} />
              {columns.map((column) => <col key={column.type} style={{ width: 42 }} />)}
              <col style={{ width: 84 }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-slate-900">
              <tr>
                <th scope="col" className="sticky left-0 z-40 h-[172px] border-b border-r border-slate-700 bg-slate-900 px-4 pb-4 text-left align-bottom font-semibold text-white">
                  <span className="block text-xs tracking-wide">Nazwa stacji / ZL</span>
                  <span className="mt-1 block text-[10px] font-normal text-slate-400">Stacja · numer zlecenia</span>
                </th>
                <th scope="col" title="Data wyjazdu pobierana ze zlecenia. Kliknij, aby sortować." className="sticky left-[190px] z-40 h-[172px] border-b border-r border-slate-700 bg-slate-900 px-2 pb-4 text-center align-bottom font-semibold text-white"><button type="button" onClick={() => setDepartureSort((current) => current === null ? "asc" : current === "asc" ? "desc" : null)} className="inline-flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400" aria-label="Sortuj po dacie wyjazdu">Wyjazd {departureSort === "asc" ? "↑" : departureSort === "desc" ? "↓" : <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />}</button></th>
                {columns.map((column) => (
                  <th key={column.type} scope="col" title={column.description} className="relative h-[172px] border-b border-r border-slate-700/70 bg-slate-900 p-0 align-bottom">
                    <div className="relative h-[172px] w-full overflow-visible">
                      <span className="absolute bottom-4 left-1/2 block whitespace-nowrap text-[11px] font-medium tracking-wide text-slate-100" style={{ transform: "rotate(-55deg)", transformOrigin: "left center" }}>
                        {column.type === "RPW" ? "RPW" : column.type === "TRANSFORMATOR_POTRZEB_WLASNYCH" ? "TPW" : column.name}
                      </span>
                    </div>
                  </th>
                ))}
                <th scope="col" title="Liczba aktualnych zadań z panelu zadań i przypomnień (bez wykonanych)" className="sticky right-0 z-40 h-[172px] border-b border-l border-slate-700 bg-slate-900 px-2 pb-4 text-center align-bottom font-semibold text-white">
                  <span className="block">Zadania</span>
                  <span className="mt-1 block text-[10px] font-normal text-slate-400">aktywne</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.map((order) => {
                const itemsByType = new Map(order.items.map((item) => [item.type, item]));
                const activeTaskCount = tasks.filter((task) => task.orderId === order.id && task.status !== 'done').length;
                return (
                  <tr key={order.id} className="group cursor-pointer odd:bg-white even:bg-slate-50/70 hover:bg-blue-50/70" onClick={() => onSelectOrder(order.id)}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-4 py-3 group-even:bg-slate-50 group-hover:bg-blue-50">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onSelectOrder(order.id); }} className="block w-full text-left focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500">
                        <span className="block whitespace-normal break-words text-[12px] font-semibold leading-snug text-slate-800 group-hover:text-blue-700">{order.projectName || order.stationSize || 'Bez nazwy stacji'}</span>
                        <span className="block whitespace-normal break-words text-[10px] leading-snug text-slate-500">{order.orderNumber} · {order.client}</span>
                      </button>
                    </td>
                    <td className="sticky left-[190px] z-10 border-b border-r border-slate-100 bg-white px-2 py-3 text-center text-[11px] font-semibold tabular-nums text-slate-700 group-even:bg-slate-50 group-hover:bg-blue-50" title={order.departureDate ? `Planowany wyjazd: ${formatDepartureDate(order.departureDate)}` : "Nie wpisano daty wyjazdu w zleceniu"}>{order.departureDate ? formatDepartureDate(order.departureDate) : <span className="font-normal text-slate-400">Brak daty</span>}</td>
                    {columns.map((column) => {
                      const item = itemsByType.get(column.type);
                      const status = item?.status;
                      const meta = status ? STATUS_META[status] : undefined;
                      return (
                        <td key={column.type} title={item ? column.name + ': ' + (meta?.label || status) : column.name + ': brak pozycji'} className="border-b border-r border-slate-100 px-0 py-2 text-center group-hover:bg-blue-50/60">
                          {item ? (
                            <button type="button" onClick={(event) => { event.stopPropagation(); if (status === 'NOT_APPLICABLE') return; try { sessionStorage.setItem('enco_dashboard_target_item_type', column.type); } catch {} onSelectOrder(order.id); }} aria-label={`Otwórz element ${column.name} w zleceniu ${order.orderNumber}`} title={item ? `Otwórz ${column.name} w zleceniu` : column.name} className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                              <span className={'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-0.5 text-[10px] font-bold ' + (status === 'NOT_ORDERED' ? 'bg-slate-200 text-slate-500' : status === 'ORDERED' ? 'bg-blue-600 text-white' : status === 'IN_PROGRESS' ? 'bg-amber-400 text-slate-950' : status === 'READY' ? 'bg-emerald-600 text-white' : status === 'PROBLEM' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-500')}>
                                {status === 'NOT_APPLICABLE' ? '—' : status === 'NOT_ORDERED' ? '·' : status === 'ORDERED' ? 'Z' : status === 'IN_PROGRESS' ? 'R' : status === 'READY' ? '✓' : status === 'PROBLEM' ? '!' : '·'}
                              </span>
                            </button>
                          ) : <span className="text-slate-200">·</span>}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 border-b border-l border-slate-100 bg-white px-2 py-3 text-center group-even:bg-slate-50 group-hover:bg-blue-50">
                      <span className="inline-flex min-w-8 justify-center rounded-lg border border-slate-200 bg-slate-100 px-2 py-1 font-semibold tabular-nums text-slate-700">{tasksLoading ? '…' : activeTaskCount}</span>
                    </td>
                  </tr>
                );
              })}
              {activeOrders.length === 0 && (
                <tr><td colSpan={columns.length + 3} className="px-4 py-10 text-center text-slate-500"><Search className="mx-auto mb-2 h-5 w-5 text-slate-300" />Brak aktywnych zleceń do wyświetlenia.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="px-1 text-[11px] leading-relaxed text-slate-500">Skróty: Z — zlecone, R — w realizacji, ✓ — gotowe, ! — problem. Najedź na nagłówek kolumny, aby zobaczyć opis.</p>
    </section>
  );
};
