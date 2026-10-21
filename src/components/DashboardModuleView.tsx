import React, { useEffect, useState } from 'react';
import { Order, ITEM_DEFINITIONS, STATUS_META, ItemStatus } from '../types/enco';
import { Search, LayoutDashboard } from 'lucide-react';
import type { EncoTask } from '../types/tasks';
import { fetchTasks } from '../services/taskService';

interface DashboardModuleViewProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
}

const isTaskOrdered = (status: ItemStatus) => status !== 'NOT_ORDERED' && status !== 'NOT_APPLICABLE';

export const DashboardModuleView: React.FC<DashboardModuleViewProps> = ({ orders, onSelectOrder }) => {
  const columns = ITEM_DEFINITIONS;
  const activeOrders = orders.filter((order) => !order.archivedAt);
  const [tasks, setTasks] = useState<EncoTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);

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
          <table className="w-full border-separate border-spacing-0 text-[11px]">
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr>
                <th scope="col" className="sticky left-0 z-30 min-w-[190px] border-b border-r border-slate-200 bg-slate-100 px-2.5 py-2 text-left font-bold text-slate-700">
                  Nazwa stacji / ZL
                </th>
                {columns.map((column) => (
                  <th key={column.type} scope="col" title={column.description} className="min-w-[48px] max-w-[68px] border-b border-r border-slate-200 px-1.5 py-2 text-center font-bold text-slate-600">
                    <span className="block truncate">{column.shortName}</span>
                  </th>
                ))}
                <th scope="col" title="Liczba aktualnych zadań z panelu zadań i przypomnień (bez wykonanych)" className="sticky right-0 z-30 min-w-[64px] border-b border-l border-slate-200 bg-slate-100 px-2 py-2 text-center font-bold text-slate-700">
                  Zadania
                </th>
              </tr>
              <tr>
                <th className="sticky left-0 z-30 border-b border-r border-slate-200 bg-white px-2.5 py-1 text-left text-[10px] font-medium text-slate-400">Stacja / numer zlecenia</th>
                {columns.map((column) => (
                  <th key={column.type} title={column.description} className="border-b border-r border-slate-200 bg-white px-1 py-1 text-center text-[9px] font-normal text-slate-400">
                    <span className="block truncate">{column.name}</span>
                  </th>
                ))}
                <th className="sticky right-0 z-30 border-b border-l border-slate-200 bg-white px-1 py-1 text-center text-[9px] font-normal text-slate-400">aktywn.</th>
              </tr>
            </thead>
            <tbody>
              {activeOrders.map((order) => {
                const itemsByType = new Map(order.items.map((item) => [item.type, item]));
                const activeTaskCount = tasks.filter((task) => task.orderId === order.id && task.status !== 'done').length;
                return (
                  <tr key={order.id} className="group cursor-pointer hover:bg-blue-50/70" onClick={() => onSelectOrder(order.id)}>
                    <td className="sticky left-0 z-10 border-b border-r border-slate-100 bg-white px-2.5 py-1.5 group-hover:bg-blue-50/70">
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
                        <td key={column.type} title={item ? column.name + ': ' + (meta?.label || status) : column.name + ': brak pozycji'} className="border-b border-r border-slate-100 px-1 py-1 text-center">
                          {item ? (
                            <span className={'mx-auto inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold ' + (status === 'NOT_ORDERED' ? 'bg-slate-100 text-slate-400' : status === 'ORDERED' ? 'bg-blue-100 text-blue-700' : status === 'IN_PROGRESS' ? 'bg-amber-100 text-amber-800' : status === 'READY' ? 'bg-emerald-100 text-emerald-700' : status === 'PROBLEM' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-400')}>
                              {status === 'NOT_APPLICABLE' ? '—' : status === 'NOT_ORDERED' ? '·' : status === 'ORDERED' ? 'Z' : status === 'IN_PROGRESS' ? 'R' : status === 'READY' ? '✓' : status === 'PROBLEM' ? '!' : '·'}
                            </span>
                          ) : <span className="text-slate-200">·</span>}
                        </td>
                      );
                    })}
                    <td className="sticky right-0 z-10 border-b border-l border-slate-100 bg-white px-2 py-1.5 text-center group-hover:bg-blue-50/70">
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
