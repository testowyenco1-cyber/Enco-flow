import React, { useEffect, useState } from 'react';
import { Order, ITEM_DEFINITIONS, STATUS_META, ItemStatus } from '../types/enco';
import { Search, LayoutDashboard, ArrowUpDown } from 'lucide-react';
import type { EncoTask } from '../types/tasks';
import { fetchTasks } from '../services/taskService';

interface DashboardModuleViewProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
}

const isTaskOrdered = (status: ItemStatus) => status !== 'NOT_ORDERED' && status !== 'NOT_APPLICABLE';

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
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <LayoutDashboard className="h-5 w-5 text-blue-600" />
        <h1 className="text-lg font-bold text-slate-900">Dashboard</h1>
        <span className="text-xs text-slate-500">{activeOrders.length} zleceń</span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="max-h-[calc(100dvh-190px)] overflow-auto">
          <table className="w-full min-w-max border-separate border-spacing-0 text-[11px]">
            <colgroup>
              <col style={{ width: 185 }} />
              {columns.map((column) => <col key={column.type} style={{ width: 30 }} />)}
              <col style={{ width: 88 }} />
              <col style={{ width: 76 }} />
            </colgroup>
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr>
                <th scope="col" className="sticky left-0 z-30 min-w-[185px] border-b border-r border-slate-200 bg-slate-100 px-2 py-1.5 text-left font-bold text-slate-700">
                  <span className="block">Nazwa stacji / ZL</span>
                  <span className="mt-1 block text-[10px] font-normal text-slate-400">Stacja / numer zlecenia</span>
                </th>
                {columns.map((column) => (
                  <th key={column.type} scope="col" title={column.description} className="h-[96px] w-[30px] min-w-[30px] border-b border-r border-slate-200 bg-white p-0 align-bottom">
                    <div className="relative h-[96px] w-[30px] overflow-visible">
                      <span className="absolute bottom-[7px] left-[9px] block origin-bottom-left -rotate-45 whitespace-nowrap text-[10px] font-semibold text-slate-600">
                        {column.name}
                      </span>
                    </div>
                  </th>
                ))}
                <th scope="col" title="Kliknij, aby sortować po dacie wyjazdu" className="sticky right-[76px] z-30 min-w-[88px] border-b border-l border-slate-200 bg-slate-100 px-1 py-1 text-center font-bold text-slate-700"><button type="button" onClick={() => setDepartureSort((current) => current === null ? "asc" : current === "asc" ? "desc" : null)} className="inline-flex items-center justify-center gap-0.5 rounded px-1 py-1 hover:bg-slate-200" aria-label="Sortuj po dacie wyjazdu">{`Wyjazd${departureSort === "asc" ? " ↑" : departureSort === "desc" ? " ↓" : ""}`}<ArrowUpDown className="h-3 w-3" /></button></th>
                <th scope="col" title="Liczba aktualnych zadań z panelu zadań i przypomnień (bez wykonanych)" className="sticky right-0 z-30 min-w-[76px] border-b border-l border-slate-200 bg-slate-100 px-2 py-2 text-center font-bold text-slate-700">
                  <span className="block">Zadania</span>
                  <span className="mt-1 block text-[10px] font-normal text-slate-400">aktywn.</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedOrders.map((order) => {
                const itemsByType = new Map(order.items.map((item) => [item.type, item]));
                const activeTaskCount = tasks.filter((task) => task.orderId === order.id && task.status !== 'done').length;
                return (
                  <tr key={order.id} className="group cursor-pointer hover:bg-blue-50/70" onClick={() => onSelectOrder(order.id)}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-3 py-2 group-hover:bg-blue-50/70">
                      <button type="button" onClick={(event) => { event.stopPropagation(); onSelectOrder(order.id); }} className="block max-w-[260px] text-left">
                        <span className="block truncate font-bold text-blue-700">{order.projectName || order.stationSize || 'Bez nazwy stacji'}</span>
                        <span className="block truncate text-[10px] text-slate-500">{order.orderNumber} · {order.client}</span>
                      </button>
                    </td>
                    {columns.map((column) => {
                      const item = itemsByType.get(column.type);
                      const status = item?.status;
                      const meta = status ? STATUS_META[status] : undefined;
                      return (
                        <td key={column.type} title={item ? column.name + ': ' + (meta?.label || status) : column.name + ': brak pozycji'} className="w-[30px] border-b border-r border-slate-100 px-0 py-1 text-center">
                          {item ? (
                            <span className={'mx-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-sm px-0.5 text-[10px] font-black shadow-sm ' + (status === 'NOT_ORDERED' ? 'bg-slate-200 text-slate-500' : status === 'ORDERED' ? 'bg-blue-600 text-white ring-1 ring-blue-700' : status === 'IN_PROGRESS' ? 'bg-amber-400 text-slate-950 ring-1 ring-amber-600' : status === 'READY' ? 'bg-emerald-600 text-white ring-1 ring-emerald-700' : status === 'PROBLEM' ? 'bg-rose-600 text-white ring-1 ring-rose-700' : 'bg-slate-200 text-slate-500')}>
                              {status === 'NOT_APPLICABLE' ? '—' : status === 'NOT_ORDERED' ? '·' : status === 'ORDERED' ? 'Z' : status === 'IN_PROGRESS' ? 'R' : status === 'READY' ? '✓' : status === 'PROBLEM' ? '!' : '·'}
                            </span>
                          ) : <span className="text-slate-200">·</span>}
                        </td>
                      );
                    })}
                    <td className="sticky right-[76px] z-10 border-b border-l border-slate-100 bg-white px-1 py-2 text-center text-[10px] tabular-nums text-slate-700 group-hover:bg-blue-50/70" title={order.departureDate ? `Planowany wyjazd: ${formatDepartureDate(order.departureDate)}` : 'Brak daty wyjazdu'}>{order.departureDate ? formatDepartureDate(order.departureDate) : '—'}</td>
                    <td className="sticky right-0 z-10 border-b border-l border-slate-100 bg-white px-2 py-2 text-center group-hover:bg-blue-50/70">
                      <span className="inline-flex min-w-7 justify-center rounded bg-slate-100 px-1.5 py-1 font-bold tabular-nums text-slate-700">{tasksLoading ? '…' : activeTaskCount}</span>
                    </td>
                  </tr>
                );
              })}
              {activeOrders.length === 0 && (
                <tr><td colSpan={columns.length + 2} className="px-4 py-10 text-center text-slate-500"><Search className="mx-auto mb-2 h-5 w-5 text-slate-300" />Brak aktywnych zleceń do wyświetlenia.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[10px] text-slate-500">Skróty: Z — zlecone, R — w realizacji, ✓ — gotowe, ! — problem. Najedź na nagłówek kolumny, aby zobaczyć opis.</p>
    </section>
  );
};
