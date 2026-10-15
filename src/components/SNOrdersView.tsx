import React, { useMemo, useState } from 'react';
import { CircuitBoard, Search, ExternalLink } from 'lucide-react';
import { Order, OrderItem, SN_CONFIG_EXAMPLES } from '../types/enco';
import { UserRoleProfile, USER_PROFILES, canEditItemType } from '../types/userRole';

const TYPES = [
  { label: 'SIEMENS', producer: 'Siemens', model: '8DJH 24 Blue GIS' },
  { label: 'XIRIA', producer: 'EATON', model: 'Xiria' },
  { label: 'RM AirSeT', producer: 'Schneider Electric', model: 'AirSeT' },
  { label: 'RM AirSeT - STOEN', producer: 'Schneider Electric', model: 'RM AirSeT - STOEN' },
] as const;
type SNType = typeof TYPES[number];
interface Props {
  orders: Order[];
  currentProfile?: UserRoleProfile;
  onUpdateItem: (orderId: string, item: OrderItem) => void;
  onNavigateToOrder: (orderId: string) => void;
}
const field = 'w-full min-w-[130px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-100';

export const SNOrdersView: React.FC<Props> = ({ orders, currentProfile, onUpdateItem, onNavigateToOrder }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const profile = currentProfile || USER_PROFILES.admin;
  const canEdit = canEditItemType(profile, 'ROZDZIELNICA_SN');
  const rows = useMemo(() => orders.flatMap(order => (order.items || [])
    .filter(item => item.type === 'ROZDZIELNICA_SN')
    .map(item => ({ order, item })))
    .filter(({ order, item }) => {
      const model = item.details?.model || item.details?.typRozdzielnicy || '';
      const type = TYPES.find(t => t.model === model)?.label || '';
      const haystack = [order.orderNumber, order.projectName, order.client, model, item.details?.numerSeryjny].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(search.trim().toLowerCase()) && (filter === 'all' || filter === type);
    }), [orders, search, filter]);

  const patch = (orderId: string, item: OrderItem, details: Record<string, unknown>) => {
    onUpdateItem(orderId, { ...item, details: { ...(item.details || {}), ...details }, updatedAt: new Date().toISOString() });
  };
  const selectType = (orderId: string, item: OrderItem, label: string) => {
    const selected = TYPES.find(t => t.label === label);
    if (selected) patch(orderId, item, { producent: selected.producer, model: selected.model, typRozdzielnicy: selected.model });
  };

  return <section className="space-y-4">
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CircuitBoard className="h-5 w-5" /></div><div><h1 className="text-xl font-bold text-slate-900">Rozdzielnice SN</h1><p className="text-xs text-slate-500">Zestawienie danych z istniejących zleceń — bez tworzenia osobnej bazy.</p></div></div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Szukaj zlecenia, projektu, klienta..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs" /></div>
        <select value={filter} onChange={e => setFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"><option value="all">Wszystkie typy</option>{TYPES.map(t => <option key={t.label} value={t.label}>{t.label}</option>)}</select>
      </div>
    </div>
    <div className="flex flex-wrap gap-2">{TYPES.map(t => <div key={t.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"><strong>{t.label}</strong><span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5">{orders.reduce((n,o)=>n+(o.items||[]).filter(i=>i.type==='ROZDZIELNICA_SN' && (i.details?.model || i.details?.typRozdzielnicy)===t.model).length,0)}</span></div>)}</div>
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="border-b border-slate-200 px-4 py-3 text-xs font-bold text-slate-800">Rozdzielnice przypisane do zleceń ({rows.length}) <span className="ml-2 font-normal text-slate-500">Zmiany wymagają użycia przycisku „Zapisz zmiany”.</span></div>
      {rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Brak rozdzielnic SN pasujących do wyszukiwania.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1450px] text-left"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{['Zlecenie / projekt','Klient','Typ','Konfiguracja','Numer seryjny','Plan dostawy','Fakt. dostawa','Plan do Pyskowic','SN w Pyskowicach','Status'].map(x=><th key={x} className="px-3 py-3">{x}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(({order,item})=>{const model=item.details?.model||item.details?.typRozdzielnicy||'';const selected=TYPES.find(t=>t.model===model);return <tr key={item.id} className="align-top hover:bg-blue-50/30">
        <td className="px-3 py-3"><button onClick={()=>onNavigateToOrder(order.id)} className="flex max-w-[230px] items-start gap-1 text-left"><span><span className="block font-mono text-xs font-bold text-blue-700">{order.orderNumber}</span><span className="mt-1 block text-xs font-semibold text-slate-800">{order.projectName||'—'}</span></span><ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-slate-400" /></button></td>
        <td className="px-3 py-3 text-xs text-slate-600">{order.client||'—'}</td>
        <td className="px-3 py-3"><select aria-label="Typ rozdzielnicy SN" disabled={!canEdit} value={selected?.label||''} onChange={e=>selectType(order.id,item,e.target.value)} className={field}><option value="">Wybierz typ</option>{TYPES.map(t=><option key={t.label} value={t.label}>{t.label}</option>)}</select></td>
        <td className="px-3 py-3"><input aria-label="Konfiguracja pól" disabled={!canEdit} list="sn-config-examples" value={item.details?.konfiguracjaPol||''} onChange={e=>patch(order.id,item,{konfiguracjaPol:e.target.value})} placeholder="np. L-L-L-T" className={field}/><datalist id="sn-config-examples">{SN_CONFIG_EXAMPLES.map(c=><option key={c} value={c}/>)}</datalist></td>
        <td className="px-3 py-3"><input aria-label="Numer seryjny" disabled={!canEdit} value={item.details?.numerSeryjny||''} onChange={e=>patch(order.id,item,{numerSeryjny:e.target.value})} placeholder="Numer seryjny" className={field}/></td>
        <td className="px-3 py-3"><input aria-label="Planowana data dostawy" type="date" disabled={!canEdit} value={item.details?.dataDostawyPlan||''} onChange={e=>patch(order.id,item,{dataDostawyPlan:e.target.value})} className={field}/></td>
        <td className="px-3 py-3"><input aria-label="Faktyczna data dostawy" type="date" disabled={!canEdit} value={item.details?.dataDostawyFakt||''} onChange={e=>patch(order.id,item,{dataDostawyFakt:e.target.value})} className={field}/></td>
        <td className="px-3 py-3"><input aria-label="Planowana dostawa do Pyskowic" type="date" disabled={!canEdit} value={item.details?.dataPlanDostawyPyskowice||''} onChange={e=>patch(order.id,item,{dataPlanDostawyPyskowice:e.target.value})} className={field}/></td>
        <td className="px-3 py-3"><select aria-label="Rozdzielnica SN w Pyskowicach" disabled={!canEdit} value={item.details?.snWPyskowicach||''} onChange={e=>patch(order.id,item,{snWPyskowicach:e.target.value})} className={field}><option value="">Nieustalone</option><option value="TAK">TAK</option><option value="NIE">NIE</option><option value="BRAK">BRAK / niepotrzebne</option></select></td>
        <td className="px-3 py-3"><select aria-label="Status rozdzielnicy SN" disabled={!canEdit} value={item.status} onChange={e=>onUpdateItem(order.id,{...item,status:e.target.value as OrderItem['status'],updatedAt:new Date().toISOString()})} className={field}><option value="NOT_ORDERED">Nie zamówiono</option><option value="ORDERED">Zamówiono</option><option value="IN_PROGRESS">W realizacji</option><option value="READY">Gotowe</option><option value="PROBLEM">Problem</option><option value="NOT_APPLICABLE">Nie dotyczy</option></select></td>
      </tr>})}</tbody></table></div>}
    </div>
  </section>;
};
