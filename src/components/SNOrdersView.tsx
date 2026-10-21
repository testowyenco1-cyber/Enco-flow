import React, { useEffect, useMemo, useState } from 'react';
import { CircuitBoard, Search, Plus, Save, Trash2, RefreshCw, ExternalLink, PackageCheck, Truck, Warehouse, ArrowUpDown, ChevronUp, ChevronDown, Copy, Download } from 'lucide-react';
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
  dostarczono?: boolean;
  nrZamowienia: string;
  projekt: string;
  linkedOrderId?: string;
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
const inputClass = 'w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs font-medium text-slate-950 placeholder:text-slate-500 hover:border-slate-300 hover:bg-white focus:border-blue-500 focus:bg-white focus:outline-none disabled:bg-transparent';
const filterClass = 'w-full min-w-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-slate-800 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none';
const AIRSET_RODZAJE = [
  'RM AirSet 24kV20kA NE-IIQ + napędy; wys. 1,625',
  'RM AirSet 24kV20kA NE-IIIQ + napędy; wys. 1,625',
  'RM AirSet NE-IIIQ 24kV20kA; wys. 1,625',
  'RM AirSet NE-III 24kV20kA; wys. 1,4',
  'RM AirSet 24kV20kA NE-III + napędy; wys. 1,4',
  'RM AirSet NE-IIII 24kV20kA; wys. 1,4',
  'RM AirSet 24kV20kA NE-IIII + napędy; wys. 1,4',
  'RM AirSet 24kV20kA NE-IIQ; wys. 1,625',
  'RM AirSet NE-IIIB + napędy; 24kV20kA; wys. 1,625',
  'RM AirSet RE-IIII+LE-B + napędy; 24kV20kA; wys. 1,625',
  'RM AirSet RE-IIII+LE-Q + napędy; 24kV20kA; wys. 1,625',
  'RM AirSet RE-IIQ+LE-II + napędy; 24kV20kA; wys. 1,625',
  'RM AirSet 24kV 630A, 20kA/3s RE-II+LE-IIQ + napędy',
];
const SIEMENS_RODZAJE = [
  '8DJH blue GIS RRR',
  '8DJH blue GIS RRT',
  '8DJH blue GIS RRRT',
  '8DJH blue GIS RRRR',
  '8DJH blue GIS RRRR + NAPĘDY',
  '8DJH blue GIS RRT + NAPĘDY W POLACH R',
  '8DJH blue GIS RRRT + NAPĘDY W POLACH R',
  '8DJH blue GIS RRR + NAPĘDY, OSŁONY POGŁĘBIONE',
  '8DJH blue GIS RRRR + NAPĘDY, OSŁONY POGŁĘBIONE',
];
const XIRIA_RODZAJE = [
  'XIRIA xGear KKT',
  'XIRIA xGear KKT + NAPĘDY',
  'XIRIA xGear KKK + NAPĘDY',
  'XIRIA xGear KKKT',
  'XIRIA xGear KKKT + NAPĘDY',
  'XIRIA xGear KKKKT + NAPĘDY',
];
const AIRSET_STOEN_RODZAJE = [
  'Pole potrzeb własnych LE-Q',
  'RM AirSet RE-IIB 24kV 20kA; wys. 1,625',
  'Napęd do AirSet do pól liniowych',
  'RM AirSet RE-IIIB 24kV 20kA; wys. 1,625',
  'Pole LE-Q (pod TPW)',
];
type SortKey = 'rodzaj' | 'ilosc' | 'terminDostawy' | 'nrZamowienia' | 'projekt' | 'lokalizacja';
const makeId = () => `sn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

export const SNOrdersView: React.FC<Props> = ({ orders, currentProfile, onNavigateToOrder }) => {
  const [records, setRecords] = useState<SNRecord[]>([]);
  // Last server-confirmed version: send only changed rows to avoid overwriting edits from other users.
  const [serverSnapshot, setServerSnapshot] = useState<SNRecord[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<SNType>('SIEMENS');
  const [selectedCategory, setSelectedCategory] = useState<SNCategory | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<SortKey>('rodzaj');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [addingRodzajFor, setAddingRodzajFor] = useState<string | null>(null);
  const [activeProjectSuggestionsFor, setActiveProjectSuggestionsFor] = useState<string | null>(null);
  const [newRodzaj, setNewRodzaj] = useState('');
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
      setServerSnapshot(data.records);
      setDeletedIds([]);
      setNotice('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd pobierania zestawienia SN.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadRecords(); }, []);

  const visibleRecords = useMemo(() => records.filter(record => {
    if (record.type !== selectedType || (selectedCategory !== 'ALL' && record.category !== selectedCategory)) return false;
    const allText = [record.rodzaj, record.terminDostawy, record.nrZamowienia, record.projekt, record.lokalizacja].filter(Boolean).join(' ').toLowerCase();
    if (!allText.includes(search.trim().toLowerCase())) return false;
    return Object.entries(columnFilters).every(([key, value]) => !value.trim() || String(record[key as keyof SNRecord] ?? '').toLowerCase().includes(value.trim().toLowerCase()));
  }).sort((a, b) => {
    const av = a[sortKey], bv = b[sortKey];
    const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''), 'pl', { numeric: true, sensitivity: 'base' });
    return sortDirection === 'asc' ? comparison : -comparison;
  }), [records, selectedType, selectedCategory, search, columnFilters, sortKey, sortDirection]);

  const typeCounts = useMemo(() => TYPES.reduce((acc, type) => {
    acc[type.key] = records.filter(record => record.type === type.key).length;
    return acc;
  }, {} as Record<SNType, number>), [records]);

  const categoryCounts = useMemo(() => CATEGORIES.reduce((acc, category) => {
    acc[category.key] = records.filter(record => record.type === selectedType && record.category === category.key).length;
    return acc;
  }, {} as Record<SNCategory, number>), [records, selectedType]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDirection(current => current === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDirection('asc'); }
  };
  const sortHeader = (label: string, key: SortKey) => <button type="button" onClick={() => toggleSort(key)} className="inline-flex items-center gap-1 text-left hover:text-blue-700" title={'Sortuj według: ' + label}>{label}{sortKey === key ? (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}</button>;

  const rodzajDictionaries = useMemo(() => {
    const buildDictionary = (type: SNType, defaults: string[]) => {
      const stored = records
        .filter(record => record.type === type)
        .map(record => record.rodzaj.trim())
        .filter(Boolean);
      return Array.from(new Set([...defaults, ...stored])).sort((a, b) => a.localeCompare(b, 'pl', { numeric: true, sensitivity: 'base' }));
    };
    return {
      RM_AIRSET: buildDictionary('RM_AIRSET', AIRSET_RODZAJE),
      RM_AIRSET_STOEN: buildDictionary('RM_AIRSET_STOEN', AIRSET_STOEN_RODZAJE),
      SIEMENS: buildDictionary('SIEMENS', SIEMENS_RODZAJE),
      XIRIA: buildDictionary('XIRIA', XIRIA_RODZAJE),
    };
  }, [records]);

  const rodzajOptions = selectedType === 'RM_AIRSET'
    ? rodzajDictionaries.RM_AIRSET
    : selectedType === 'RM_AIRSET_STOEN'
      ? rodzajDictionaries.RM_AIRSET_STOEN
      : selectedType === 'SIEMENS'
        ? rodzajDictionaries.SIEMENS
        : selectedType === 'XIRIA'
          ? rodzajDictionaries.XIRIA
          : [];

  const addRodzajOption = (recordId: string) => {
    const value = newRodzaj.trim();
    if (!value) return;
    patchRecord(recordId, { rodzaj: value });
    setNewRodzaj('');
    setAddingRodzajFor(null);
  };

  const patchRecord = (id: string, patch: Partial<SNRecord>) => {
    if (saving) return;
    setRecords(current => current.map(record => record.id === id ? { ...record, ...patch } : record));
    setNotice('');
  };

  const addRecord = () => {
    if (!canEdit || saving) return;
    const record: SNRecord = {
      id: makeId(), type: selectedType, category: 'TO_DELIVER', rodzaj: '', ilosc: 1,
      terminDostawy: '',
      nrZamowienia: '', projekt: '', linkedOrderId: undefined, lokalizacja: '',
    };
    setRecords(current => [...current, record]);
    setNotice('');
  };

  const duplicateRecord = (id: string) => {
    if (!canEdit || saving) return;
    const source = records.find(record => record.id === id);
    if (!source) return;
    const copy: SNRecord = { ...source, id: makeId() };
    setRecords(current => {
      const index = current.findIndex(record => record.id === id);
      if (index < 0) return [...current, copy];
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    setNotice('Skopiowano pozycję. Pamiętaj, aby zapisać zestawienie.');
  };

  const removeRecord = (id: string) => {
    if (!canEdit || saving) return;
    setRecords(current => current.filter(record => record.id !== id));
    setDeletedIds(current => current.includes(id) ? current : [...current, id]);
    setNotice('');
  };

  const saveRecords = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const changedRecords = records.filter(record => {
        const previous = serverSnapshot.find(saved => saved.id === record.id);
        return !previous || JSON.stringify(previous) !== JSON.stringify(record);
      });
      const response = await fetch('/api/sn-switchgear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ records: changedRecords, deletedIds }),
      });
      if (!response.ok) throw new Error('Nie udało się zapisać zestawienia SN.');
      const data = await response.json();
      if (!data.success || !Array.isArray(data.records)) throw new Error(data.error || 'Błąd zapisu zestawienia SN.');
      setRecords(data.records);
      setServerSnapshot(data.records);
      setDeletedIds([]);
      setNotice('Zestawienie rozdzielnic SN zapisano na serwerze.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu zestawienia SN.');
    } finally {
      setSaving(false);
    }
  };

  const exportSNToExcel = () => {
    const categoryLabel = selectedCategory === 'ALL' ? 'Wszystkie' : CATEGORIES.find(category => category.key === selectedCategory)?.label || selectedCategory;
    const typeLabel = TYPES.find(type => type.key === selectedType)?.label || selectedType;
    const headers = ['Typ rozdzielnicy', 'Sekcja', 'Lp.', 'Rodzaj', 'Ilość', 'Termin dostawy', 'Nr zamówienia', 'Projekt / ZL', 'Lokalizacja'];
    const escapeCell = (value: unknown) => {
      const text = String(value ?? '');
      return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const rows = [
      headers.map(escapeCell).join(';'),
      ...visibleRecords.map((record, index) => [
        typeLabel, categoryLabel, index + 1, record.rodzaj, record.ilosc,
        record.terminDostawy, record.nrZamowienia, record.projekt, record.lokalizacja,
      ].map(escapeCell).join(';')),
    ];
    const blob = new Blob(['\uFEFFsep=;\r\n' + rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ENCO_Zestawienie_SN_${selectedType}_${selectedCategory}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const orderLabel = (order: Order) => `${order.orderNumber} ${order.projectName}`.trim();

  const matchingOrder = (record: SNRecord) => {
    if (record.linkedOrderId) {
      const linked = orders.find(order => order.id === record.linkedOrderId);
      if (linked) return linked;
    }
    const project = record.projekt.trim().toLowerCase();
    return orders.find(order =>
      (!!project && (
        order.projectName.trim().toLowerCase() === project ||
        orderLabel(order).toLowerCase() === project ||
        project.startsWith(`${order.orderNumber.trim().toLowerCase()} `)
      ))
    );
  };

  return <section className="space-y-4">
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><CircuitBoard className="h-5 w-5" /></div>
        <div><h1 className="text-xl font-bold text-slate-900">Zestawienie rozdzielnic SN</h1><p className="text-xs text-slate-500">Wspólna lista magazynowa i dostaw rozdzielnic średniego napięcia.</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Szukaj rodzaju, zamówienia, projektu..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-xs" /></div>
        <button type="button" onClick={exportSNToExcel} disabled={loading} title="Eksportuj widoczne pozycje do pliku otwieranego w Excelu" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50"><Download className="h-3.5 w-3.5" /> Eksport Excel</button>
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
      <button type="button" onClick={() => setSelectedCategory('ALL')} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${selectedCategory === 'ALL' ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
        <CircuitBoard className="h-4 w-4" />Wszystkie<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedCategory === 'ALL' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{typeCounts[selectedType] || 0}</span>
      </button>
      {CATEGORIES.map(category => <button type="button" key={category.key} onClick={() => setSelectedCategory(category.key)} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${selectedCategory === category.key ? 'border-slate-800 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
        {category.icon}{category.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${selectedCategory === category.key ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600'}`}>{categoryCounts[category.key] || 0}</span>
      </button>)}
    </div>

    {error && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
    {notice && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}

    <div className={`overflow-hidden rounded-xl border border-slate-200 bg-white ${saving ? 'pointer-events-none opacity-70' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div><h2 className="text-sm font-bold text-slate-900">{TYPES.find(type => type.key === selectedType)?.label} · {selectedCategory === 'ALL' ? 'Wszystkie' : CATEGORIES.find(category => category.key === selectedCategory)?.label}</h2><p className="mt-0.5 text-xs text-slate-500">Pozycje: {visibleRecords.length}. Zmiany należy zapisać przyciskiem „Zapisz zestawienie”.</p></div>
        {canEdit && <button type="button" onClick={addRecord} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100"><Plus className="h-3.5 w-3.5" /> Dodaj pozycję</button>}
      </div>
      {loading ? <div className="p-10 text-center text-sm text-slate-500">Pobieranie zestawienia…</div> : visibleRecords.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Brak pozycji w tej sekcji. Możesz dodać pierwszą pozycję przyciskiem powyżej.</div> : <div className="w-full min-w-0">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup><col style={{ width: '3%' }} /><col style={{ width: '19%' }} /><col style={{ width: '5%' }} /><col style={{ width: '11%' }} /><col style={{ width: '11%' }} /><col style={{ width: '25%' }} /><col style={{ width: '14%' }} /><col style={{ width: '12%' }} /></colgroup>
          <thead className="bg-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-700">
            <tr className="border-b border-slate-200"><th className="px-2 py-1">Lp.</th><th className="px-2 py-1">{sortHeader('Rodzaj','rodzaj')}</th><th className="px-2 py-2">{sortHeader('Ilość','ilosc')}</th><th className="px-2 py-2">{sortHeader('Termin','terminDostawy')}</th><th className="px-2 py-2">{sortHeader('Nr zamówienia','nrZamowienia')}</th><th className="px-2 py-2">{sortHeader('Projekt / ZL','projekt')}</th><th className="px-2 py-2">{sortHeader('Lokalizacja','lokalizacja')}</th><th className="px-2 py-2">Akcje</th></tr>
            <tr className="border-b border-slate-200 bg-white"><th className="px-1 py-0.5"><button type="button" onClick={() => setColumnFilters({})} className="text-[11px] font-semibold text-blue-800 hover:underline">Wyczyść</button></th>{(['rodzaj','ilosc','terminDostawy','nrZamowienia','projekt','lokalizacja'] as const).map(key => <th key={key} className="px-1 py-0.5"><input aria-label={'Filtr: ' + key} value={columnFilters[key] || ''} onChange={event => setColumnFilters(current => ({...current,[key]:event.target.value}))} placeholder="Filtruj…" className={filterClass}/></th>)}<th className="px-1 py-1"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRecords.map(record => {
              const order = matchingOrder(record);
              return <tr key={record.id} className={`align-top transition-colors ${record.category === 'DELIVERED' ? 'bg-blue-100/85 hover:bg-blue-200/65' : record.category === 'WAREHOUSE' ? 'bg-green-100/85 hover:bg-green-200/65' : 'hover:bg-blue-50/30'}`}>
                <td className="px-2 py-1.5 text-[11px] font-medium text-slate-600">{visibleRecords.findIndex(item => item.id === record.id) + 1}</td>
                <td className="min-w-0 px-1 py-1">
                  {(record.type === 'RM_AIRSET' || record.type === 'RM_AIRSET_STOEN' || record.type === 'SIEMENS' || record.type === 'XIRIA') && canEdit ? <div className="min-w-0 space-y-1">
                    <select aria-label="Rodzaj rozdzielnicy" value={addingRodzajFor === record.id ? '__add_new__' : record.rodzaj} onChange={event => {
                      if (event.target.value === '__add_new__') { setAddingRodzajFor(record.id); setNewRodzaj(''); }
                      else { setAddingRodzajFor(null); patchRecord(record.id, { rodzaj: event.target.value }); }
                    }} className={`${inputClass} min-w-0`}>
                      <option value="">Wybierz rodzaj…</option>
                      {rodzajOptions.map(option => <option key={option} value={option}>{option}</option>)}
                      <option value="__add_new__">＋ Dodaj nowy rodzaj…</option>
                    </select>
                    {addingRodzajFor === record.id && <div className="flex min-w-0 gap-1">
                      <input aria-label="Nowy rodzaj rozdzielnicy" autoFocus value={newRodzaj} onChange={event => setNewRodzaj(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); addRodzajOption(record.id); } if (event.key === 'Escape') setAddingRodzajFor(null); }} placeholder="Wpisz nowy rodzaj" className={`${inputClass} min-w-0 border-slate-300 bg-white`}/>
                      <button type="button" onClick={() => addRodzajOption(record.id)} className="shrink-0 rounded border border-blue-200 px-1.5 text-[10px] font-semibold text-blue-700 hover:bg-blue-50">Dodaj</button>
                    </div>}
                  </div> : <input aria-label="Rodzaj rozdzielnicy" disabled={!canEdit} value={record.rodzaj} onChange={event => patchRecord(record.id,{rodzaj:event.target.value})} placeholder="Typ / konfiguracja" className={`${inputClass} min-w-0`}/>}
                </td>
                <td className="min-w-0 px-2 py-1"><input aria-label="Ilość" type="number" min="0" disabled={!canEdit} value={record.ilosc} onChange={event => patchRecord(record.id,{ilosc:Math.max(0,Number(event.target.value)||0)})} className={`${inputClass} min-w-0`}/></td>
                <td className="min-w-0 px-2 py-2">
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <input aria-label="Termin dostawy" type="date" disabled={!canEdit} value={/^\d{4}-\d{2}-\d{2}$/.test(record.terminDostawy) ? record.terminDostawy : ''} onChange={event => patchRecord(record.id,{terminDostawy:event.target.value})} className={`${inputClass} min-w-0`}/>
                    <label className="flex items-center gap-1 text-[10px] text-slate-600">
                      <input aria-label="Dostarczono" type="checkbox" disabled={!canEdit} checked={record.dostarczono === true || record.terminDostawy.trim().toLocaleLowerCase('pl') === 'dostarczono'} onChange={event => {
                        if (event.target.checked) {
                          const today = new Date();
                          const todayLocal = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                          const currentDate = /^\d{4}-\d{2}-\d{2}$/.test(record.terminDostawy) ? record.terminDostawy : todayLocal;
                          patchRecord(record.id, { terminDostawy: currentDate, dostarczono: true });
                        } else {
                          patchRecord(record.id, { dostarczono: false, terminDostawy: /^\d{4}-\d{2}-\d{2}$/.test(record.terminDostawy) ? record.terminDostawy : '' });
                        }
                      }} className="h-3 w-3 rounded border-slate-300"/>
                      Dostarczono
                    </label>
                  </div>
                </td>
                <td className="min-w-0 px-2 py-1"><input aria-label="Numer zamówienia" disabled={!canEdit} value={record.nrZamowienia} onChange={event => patchRecord(record.id,{nrZamowienia:event.target.value})} placeholder="Nr zamówienia" className={inputClass}/></td>
                <td className={`min-w-0 px-2 py-1 ${activeProjectSuggestionsFor === record.id ? 'relative z-30' : ''}`}><div className="flex min-w-0 items-center gap-1"><div className="relative min-w-0 flex-1">{canEdit ? <><input aria-label="Projekt / ZL" autoComplete="off" value={record.projekt} onFocus={() => setActiveProjectSuggestionsFor(record.id)} onBlur={() => setActiveProjectSuggestionsFor(current => current === record.id ? null : current)} onChange={event => { const value = event.target.value; const matchedOrder = orders.find(item => orderLabel(item).toLocaleLowerCase('pl') === value.trim().toLocaleLowerCase('pl') || item.orderNumber.trim().toLocaleLowerCase('pl') === value.trim().toLocaleLowerCase('pl')); patchRecord(record.id, { projekt: value, linkedOrderId: matchedOrder?.id }); setActiveProjectSuggestionsFor(record.id); }} onKeyDown={event => { if (event.key === 'Escape') setActiveProjectSuggestionsFor(null); if (event.key === 'ArrowDown') { event.preventDefault(); setActiveProjectSuggestionsFor(record.id); } }} placeholder="Wpisz projekt lub numer ZL…" className={`${inputClass} min-w-0`}/>{activeProjectSuggestionsFor === record.id && (() => { const query = record.projekt.trim().toLocaleLowerCase('pl'); const suggestions = orders.filter(item => !query || orderLabel(item).toLocaleLowerCase('pl').includes(query) || item.orderNumber.toLocaleLowerCase('pl').includes(query) || item.projectName.toLocaleLowerCase('pl').includes(query)).slice(0, 8); return suggestions.length > 0 ? <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg">{suggestions.map(item => <button key={item.id} type="button" onMouseDown={event => event.preventDefault()} onClick={() => { patchRecord(record.id, { linkedOrderId: item.id, projekt: orderLabel(item) }); setActiveProjectSuggestionsFor(null); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-xs text-slate-800 last:border-b-0 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none"><span className="block truncate font-semibold">{orderLabel(item)}</span><span className="block truncate text-[10px] text-slate-500">ZL: {item.orderNumber}</span></button>)}</div> : null; })()}</> : <input aria-label="Projekt / ZL" disabled value={record.projekt} className={`${inputClass} min-w-0`}/>}<p className="mt-0.5 truncate text-[10px] font-medium text-slate-600">{order ? `Powiązano: ${order.orderNumber} — ${order.projectName}` : 'Wpisz nazwę projektu lub wybierz podpowiedź z listy, aby powiązać zlecenie ZL.'}</p></div>{order && <button type="button" title={`Otwórz zlecenie ${order.orderNumber}`} onClick={() => onNavigateToOrder(order.id)} className="rounded p-1.5 text-blue-700 hover:bg-blue-50"><ExternalLink className="h-4 w-4"/></button>}</div></td>
                <td className="min-w-0 px-2 py-1"><input aria-label="Lokalizacja" disabled={!canEdit} value={record.lokalizacja} onChange={event => patchRecord(record.id,{lokalizacja:event.target.value})} placeholder="Lokalizacja" className={inputClass}/></td>
                <td className="min-w-0 px-2 py-1"><div className="flex min-w-0 flex-col gap-1.5">{canEdit && <><select aria-label="Typ główny rozdzielnicy" value={record.type} onChange={event => patchRecord(record.id,{type:event.target.value as SNType})} className="w-full min-w-0 rounded-md border border-slate-300 bg-white px-1 py-0.5 text-[11px] font-medium text-slate-800">{TYPES.map(type => <option key={type.key} value={type.key}>{type.label}</option>)}</select><select aria-label="Przenieś do sekcji" value={record.category} onChange={event => patchRecord(record.id,{category:event.target.value as SNCategory})} className="w-full min-w-0 rounded border border-slate-200 bg-white px-1 py-0.5 text-[11px] font-medium text-slate-800">{CATEGORIES.map(category => <option key={category.key} value={category.key}>{category.label}</option>)}</select><div className="flex items-center gap-1"><button type="button" title="Kopiuj pozycję" aria-label={`Kopiuj pozycję ${record.rodzaj || record.id}`} onClick={() => duplicateRecord(record.id)} className="rounded-md p-1.5 text-blue-700 hover:bg-blue-50 hover:text-blue-900"><Copy className="h-4 w-4"/></button><button type="button" title="Usuń pozycję" onClick={() => removeRecord(record.id)} className="rounded-md p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600"><Trash2 className="h-4 w-4"/></button></div></>}</div></td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
    </div>
  </section>;
};
