import React, { useEffect, useMemo, useState } from 'react';
import { CircuitBoard, Search, Plus, Save, Trash2, RefreshCw, ExternalLink, PackageCheck, Truck, Warehouse } from 'lucide-react';
import { Order } from '../types/enco';
import { UserRoleProfile, USER_PROFILES, canEditItemType } from '../types/userRole';

type SNType = 'SIEMENS' | 'XIRIA' | 'RM_AIRSET' | 'RM_AIRSET_STOEN';
type SNCategory = 'DELIVERED' | 'TO_DELIVER' | 'WAREHOUSE';
interface SNRecord {
  id: string;
  type: SNType;
  category: SNCategory;
  rodzaj: string;
  ilosc: number;
  terminDostawy: string;
  nrZamowienia: string;
  projekt: string;
  lokalizacja: string;
}
interface Props {
  orders: Order[];
  currentProfile?: UserRoleProfile;
  onNavigateToOrder: (orderId: string) => void;
}
const TYPES: { key: SNType; label: string }[] = [
  { key: 'SIEMENS', label: 'SIEMENS' },
  { key: 'XIRIA', label: 'XIRIA' },
  { key: 'RM_AIRSET', label: 'RM AirSeT' },
  { key: 'RM_AIRSET_STOEN', label: 'RM AirSeT – STOEN' },
];
const CATEGORIES: { key: SNCategory; label: string; icon: React.ReactNode }[] = [
  { key: 'DELIVERED', label: 'Dostarczone', icon: <PackageCheck className="h-4 w-4" /> },
  { key: 'TO_DELIVER', label: 'Do dostarczenia', icon: <Truck className="h-4 w-4" /> },
  { key: 'WAREHOUSE', label: 'Wolne na magazynie', icon: <Warehouse className="h-4 w-4" /> },
];
const inputClass = 'w-full min-w-[120px] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 focus:border-blue-500 focus:outline-none disabled:bg-slate-100';
const makeId = () => `sn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const SNOrdersView: React.FC<Props> = ({ orders, currentProfile, onNavigateToOrder }) => {
  const [records, setRecords] = useState<SNRecord[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<SNType>('SIEMENS');
  const [selectedCategory, setSelectedCategory] = useState<SNCategory>('DELIVERED');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const profile = currentProfile || USER_PROFILES.admin;
  const canEdit = canEditItemType(profile, 'ROZDZIELNICA_SN');

  const loadRecords = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/sn-switchgear');
      if (!response.ok) throw new Error('Nie udało się pobrać zestawienia SN z serwera.');
      const data = await response.json();
      if (!data.success || !Array.isArray(data.records)) throw new Error(data.error || 'Nieprawidłowe dane zestawienia SN.');
      setRecords(data.records);
      setDeletedIds([]);
      setNotice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd pobierania zestawienia SN.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRecords(); }, []);

  const visibleRecords = useMemo(() => records.filter(record =>
    record.type === selectedType &&
    record.category === selectedCategory &&
    [record.rodzaj, record.terminDostawy, record.nrZamowienia, record.projekt, record.lokalizacja]
      .filter(Boolean).join(' ').toLowerCase().includes(search.trim().toLowerCase())
  ), [records, selectedType, selectedCategory, search]);

  const typeCounts = useMemo(() => TYPES.reduce((acc, type) => {
    acc[type.key] = records.filter(record => record.type === type.key).length;
    return acc;
  }, {} as Record<SNType, number>), [records]);

  const categoryCounts = useMemo(() => CATEGORIES.reduce((acc, category) => {
    acc[category.key] = records.filter(record => record.type === selectedType && record.category === category.key).length;
    return acc;
  }, {} as Record<SNCategory, number>), [records, selectedType]);

  const patchRecord = (id: string, patch: Partial<SNRecord>) => {
    setRecords(current => current.map(record => record.id === id ? { ...record, ...patch } : record));
    setNotice('');
  };

  const addRecord = () => {
    if (!canEdit) return;
    const record: SNRecord = {
      id: makeId(), type: selectedType, category: selectedCategory, rodzaj: '', ilosc: 1,
      terminDostawy: selectedCategory === 'DELIVERED' ? 'dostarczono' : '',
      nrZamowienia: '', projekt: '', lokalizacja: '',
    };
    setRecords(current => [...current, record]);
    setNotice('');
  };

  const removeRecord = (id: string) => {
    if (!canEdit) return;
    setRecords(current => current.filter(record => record.id !== id));
    setDeletedIds(current => current.includes(id) ? current : [...current, id]);
    setNotice('');
  };

  const saveRecords = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/sn-switchgear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records, deletedIds }),
      });
      if (!response.ok) throw new Error('Nie udało się zapisać zestawienia SN.');
      const data = await response.json();
      if (!data.success || !Array.isArray(data.records)) throw new Error(data.error || 'Błąd zapisu zestawienia SN.');
      setRecords(data.records);
      setDeletedIds([]);
      setNotice('Zestawienie rozdzielnic SN zapisano na serwerze.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu zestawienia SN.');
    } finally {
      setSaving(false);
    }
  };

  const matchingOrder = (record: SNRecord) => orders.find(order =>
    order.orderNumber.trim().toLowerCase() === record.nrZamowienia.trim().toLowerCase() ||
    (!!record.projekt.trim() && order.projectName.trim().toLowerCase() === record.projekt.trim().toLowerCase())
  );

  return <section className="space-y-4">
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CircuitBoard className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-bold text-slate-900">Zestawienie rozdzielnic SN</h1><p className="text-xs text-slate-500">Wspólna lista magazynowa i dostaw rozdzielnic średniego napięcia.</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Szukaj rodzaju, zamówienia, projektu..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs" /></div>
        <button type="button" onClick={() => void loadRecords()} disabled={loading || saving} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" /> Odśwież</button>
        {canEdit && <button type="button" onClick={() => void saveRecords()} disabled={saving || loading} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Save className="h-3.5 w-3.5" />{saving ? 'Zapisywanie…' : 'Zapisz zestawienie'}</button>}
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
      {TYPES.map(type => <button type="button" key={type.key} onClick={() => setSelectedType(type.key)} className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${selectedType === type.key ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
        <span className="text-sm font-bold text-slate-800">{type.label}</span><span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-slate-600">{typeCounts[type.key] || 0}</span>
      </button>)}
    </div>

    <div className="flex flex-wrap gap-2">
      {CATEGORIES.map(category => <button type="button" key={category.key} onClick={() => setSelectedCategory(category.key)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${selectedCategory === category.key ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
        {category.icon}{category.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedCategory === category.key ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{categoryCounts[category.key] || 0}</span>
      </button>)}
    </div>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div><h2 className="text-sm font-bold text-slate-900">{TYPES.find(type => type.key === selectedType)?.label} · {CATEGORIES.find(category => category.key === selectedCategory)?.label}</h2><p className="mt-0.5 text-xs text-slate-500">Pozycje: {visibleRecords.length}. Zmiany należy zapisać przyciskiem „Zapisz zestawienie”.</p></div>
        {canEdit && <button type="button" onClick={addRecord} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"><Plus className="h-3.5 w-3.5" /> Dodaj pozycję</button>}
      </div>
      {loading ? <div className="p-10 text-center text-sm text-slate-500">Pobieranie zestawienia…</div> : visibleRecords.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Brak pozycji w tej sekcji. Możesz dodać pierwszą pozycję przyciskiem powyżej.</div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[1200px] text-left">
          <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr>{['L.p.','Rodzaj','Ilość','Termin dostawy','Nr zamówienia','Projekt','Lokalizacja',''].map((label,index)=><th key={label || index} className="px-3 py-3">{label}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRecords.map(record => {
              const order = matchingOrder(record);
              return <tr key={record.id} className="align-top hover:bg-blue-50/30">
                <td className="px-3 py-3 text-xs text-slate-500">{visibleRecords.findIndex(item => item.id === record.id) + 1}</td>
                <td className="px-3 py-3"><input aria-label="Rodzaj rozdzielnicy" disabled={!canEdit} value={record.rodzaj} onChange={event => patchRecord(record.id,{rodzaj:event.target.value})} placeholder="Typ / konfiguracja" className={`${inputClass} min-w-[270px]`}/></td>
                <td className="px-3 py-3"><input aria-label="Ilość" type="number" min="0" disabled={!canEdit} value={record.ilosc} onChange={event => patchRecord(record.id,{ilosc:Math.max(0,Number(event.target.value)||0)})} className={`${inputClass} min-w-[70px]`}/></td>
                <td className="px-3 py-3"><input aria-label="Termin dostawy" disabled={!canEdit} value={record.terminDostawy} onChange={event => patchRecord(record.id,{terminDostawy:event.target.value})} placeholder="Data lub „dostarczono”" className={`${inputClass} min-w-[160px]`}/></td>
                <td className="px-3 py-3"><input aria-label="Numer zamówienia" disabled={!canEdit} value={record.nrZamowienia} onChange={event => patchRecord(record.id,{nrZamowienia:event.target.value})} placeholder="Nr zamówienia" className={inputClass}/></td>
                <td className="px-3 py-3"><div className="flex items-start gap-1"><input aria-label="Projekt" disabled={!canEdit} value={record.projekt} onChange={event => patchRecord(record.id,{projekt:event.target.value})} placeholder="Projekt" className={`${inputClass} min-w-[250px]`}/>{order && <button type="button" title={`Otwórz zlecenie ${order.orderNumber}`} onClick={() => onNavigateToOrder(order.id)} className="rounded p-1.5 text-blue-700 hover:bg-blue-50"><ExternalLink className="h-4 w-4"/></button>}</div></td>
                <td className="px-3 py-3"><input aria-label="Lokalizacja" disabled={!canEdit} value={record.lokalizacja} onChange={event => patchRecord(record.id,{lokalizacja:event.target.value})} placeholder="Lokalizacja" className={inputClass}/></td>
                <td className="px-3 py-3">{canEdit && <button type="button" title="Usuń pozycję" onClick={() => removeRecord(record.id)} className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4"/></button>}</td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
    </div>
  </section>;
};
