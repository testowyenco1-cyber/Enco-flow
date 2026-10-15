import React, { useMemo, useState } from 'react';
import { Search, ExternalLink, CircuitBoard, Save } from 'lucide-react';
import { Order, OrderItem, SN_CONFIG_EXAMPLES } from '../types/enco';
import { UserRoleProfile, USER_PROFILES, canEditItemType } from '../types/userRole';

const SN_TYPES = [
  { label: 'SIEMENS', producer: 'Siemens', model: '8DJH 24 Blue GIS' },
  { label: 'XIRIA', producer: 'EATON', model: 'Xiria' },
  { label: 'RM AirSeT', producer: 'Schneider Electric', model: 'AirSeT' },
  { label: 'RM AirSeT - STOEN', producer: 'Schneider Electric', model: 'RM AirSeT - STOEN' },
] as const;

type SNType = typeof SN_TYPES[number];

interface SNOrdersViewProps {
  orders: Order[];
  currentProfile?: UserRoleProfile;
  onUpdateItem: (orderId: string, item: OrderItem) => void;
  onNavigateToOrder: (orderId: string) => void;
}

const inputClass = 'w-full min-w-[130px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-500';
const labelClass = 'mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500';

export const SNOrdersView: React.FC<SNOrdersViewProps> = ({
  orders,
  currentProfile,
  onUpdateItem,
  onNavigateToOrder,
}) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const profile = currentProfile || USER_PROFILES.admin;
  const canEdit = canEditItemType(profile, 'ROZDZIELNICA_SN');

  const rows = useMemo(() => orders.flatMap((order) =>
    (order.items || [])
      .filter((item) => item.type === 'ROZDZIELNICA_SN')
      .map((item) => ({ order, item }))
  ).filter(({ order, item }) => {
    const text = [order.orderNumber, order.projectName, order.client, item.details?.model, item.details?.numerSeryjny]
      .filter(Boolean).join(' ').toLowerCase();
    const matchesSearch = text.includes(search.trim().toLowerCase());
    const model = item.details?.model || item.details?.typRozdzielnicy || '';
    const matchesType = typeFilter === 'all' || SN_TYPES.some((type) =>
      type.label === typeFilter && type.model === model
    );
    return matchesSearch && matchesType;
  }), [orders, search, typeFilter]);

  const updateDetails = (orderId: string, item: OrderItem, patch: Record<string, unknown>) => {
    onUpdateItem(orderId, {
      ...item,
      details: { ...(item.details || {}), ...patch },
      updatedAt: new Date().toISOString(),
    });
  };

  const setType = (orderId: string, item: OrderItem, selected: SNType | undefined) => {
    if (!selected) return;
    updateDetails(orderId, item, {
      producent: selected.producer,
      model: selected.model,
      typRozdzielnicy: selected.model,
    });
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <CircuitBoard className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Zestawienie rozdzielnic SN</h1>
              <p className="mt-0.5 text-xs text-slate-500">Dane pobierane bezpośrednio z istniejących zleceń stacji.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj zlecenia, projektu, klienta..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
          </div>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700">
            <option value="all">Wszystkie typy</option>
            {SN_TYPES.map((type) => <option key={type.label} value={type.label}>{type.label}</option>)}
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {SN_TYPES.map((type) => {
          const count = orders.reduce((total, order) => total + (order.items || []).filter((item) =>
            item.type === 'ROZDZIELNICA_SN' && (item.details?.model || item.details?.typRozdzielnicy) === type.model
          ).length, 0);
          return <div key={type.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><span className="font-bold text-slate-800">{type.label}</span><span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-slate-600">{count}</span></div>;
        })}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <div className="text-xs font-bold text-slate-800">Rozdzielnice przypisane do zleceń <span className="ml-1 font-mono text-slate-500">({rows.length})</span></div>
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500"><Save className="h-3.5 w-3.5" />Zmiany zapiszesz przyciskiem „Zapisz zmiany” u góry aplikacji.</div>
        </div>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">Nie znaleziono rozdzielnic SN pasujących do filtrów.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1500px] border-collapse text-left">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-3">Zlecenie / projekt</th>
                  <th className="px-3 py-3">Klient</th>
                  <th className="px-3 py-3">Typ</th>
                  <th className="px-3 py-3">Konfiguracja</th>
                  <th className="px-3 py-3">Numer seryjny</th>
                  <th className="px-3 py-3">Plan dostawy</th>
                  <th className="px-3 py-3">Fakt. dostawa</th>
                  <th className="px-3 py-3">Plan do Pyskowic</th>
                  <th className="px-3 py-3">SN w Pyskowicach</th>
                  <th className="px-3 py-3">Status elementu</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map(({ order, item }) => {
                  const model = item.details?.model || item.details?.typRozdzielnicy || '';
                  const selectedType = SN_TYPES.find((type) => type.model === model);
                  const snInPyskowice = item.details?.snWPyskowicach || '';
                  return (
                    <tr key={item.id} className="align-top hover:bg-blue-50/30">
                      <td className="px-3 py-3">
                        <button type="button" onClick={() => onNavigateToOrder(order.id)} className="group flex max-w-[230px] items-start gap-1.5 text-left">
                          <span className="min-w-0">
                            <span className="block font-mono text-xs font-bold text-blue-700 group-hover:underline">{order.orderNumber}</span>
                            <span className="mt-1 block text-xs font-semibold text-slate-800">{order.projectName || '—'}</span>
                          </span>
                          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" />
                        </button>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-600">{order.client || '—'}</td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Typ rozdzielnicy</label>
                        <select aria-label="Typ rozdzielnicy SN" disabled={!canEdit} value={selectedType?.label || ''} onChange={(e) => setType(order.id, item, SN_TYPES.find((type) => type.label === e.target.value))} className={inputClass}>
                          <option value="" disabled>Wybierz typ</option>
                          {SN_TYPES.map((type) => <option key={type.label} value={type.label}>{type.label}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Konfiguracja pól</label>
                        <input aria-label="Konfiguracja pól" disabled={!canEdit} list="sn-config-options" value={item.details?.konfiguracjaPol || ''} onChange={(e) => updateDetails(order.id, item, { konfiguracjaPol: e.target.value })} placeholder="np. L-L-L-T" className={inputClass} />
                        <datalist id="sn-config-options">{SN_CONFIG_EXAMPLES.map((config) => <option key={config} value={config} />)}</datalist>
                      </td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Numer seryjny</label>
                        <input aria-label="Numer seryjny" disabled={!canEdit} value={item.details?.numerSeryjny || ''} onChange={(e) => updateDetails(order.id, item, { numerSeryjny: e.target.value })} placeholder="Numer seryjny" className={inputClass} />
                      </td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Plan dostawy</label>
                        <input aria-label="Planowana data dostawy" type="date" disabled={!canEdit} value={item.details?.dataDostawyPlan || ''} onChange={(e) => updateDetails(order.id, item, { dataDostawyPlan: e.target.value })} className={inputClass} />
                      </td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Faktyczna dostawa</label>
                        <input aria-label="Faktyczna data dostawy" type="date" disabled={!canEdit} value={item.details?.dataDostawyFakt || ''} onChange={(e) => updateDetails(order.id, item, { dataDostawyFakt: e.target.value })} className={inputClass} />
                      </td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Plan do Pyskowic</label>
                        <input aria-label="Planowana data dostawy do Pyskowic" type="date" disabled={!canEdit} value={item.details?.dataPlanDostawyPyskowice || ''} onChange={(e) => updateDetails(order.id, item, { dataPlanDostawyPyskowice: e.target.value })} className={inputClass} />
                      </td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Obecność w Pyskowicach</label>
                        <select aria-label="Rozdzielnica SN w Pyskowicach" disabled={!canEdit} value={snInPyskowice} onChange={(e) => updateDetails(order.id, item, { snWPyskowicach: e.target.value })} className={inputClass}>
                          <option value="">Nieustalone</option>
                          <option value="TAK">TAK</option>
                          <option value="NIE">NIE</option>
                          <option value="BRAK">BRAK / niepotrzebne</option>
                        </select>
                      </td>
                      <td className="px-3 py-3">
                        <label className={labelClass}>Status</label>
                        <select aria-label="Status rozdzielnicy SN" disabled={!canEdit} value={item.status} onChange={(e) => onUpdateItem(order.id, { ...item, status: e.target.value as OrderItem['status'], updatedAt: new Date().toISOString() })} className={inputClass}>
                          <option value="NOT_ORDERED">Nie zamówiono</option>
                          <option value="ORDERED">Zamówiono</option>
                          <option value="IN_PROGRESS">W realizacji</option>
                          <option value="READY">Gotowe</option>
                          <option value="PROBLEM">Problem</option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] leading-relaxed text-slate-500">Każdy wiersz pochodzi z elementu „ROZDZIELNICA SN” istniejącego zlecenia. Zmiany są od razu widoczne lokalnie i wymagają zatwierdzenia przyciskiem „Zapisz zmiany”.</p>
    </section>
  );
};
