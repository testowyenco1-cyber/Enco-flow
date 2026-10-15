import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownUp, Copy, Plus, Save, Search, Trash2, RefreshCw, DoorOpen, ClipboardList } from 'lucide-react';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';

type DoorVariant = {
  id: string;
  grupa: 'NZ' | 'NZ — rama BEK' | 'BEK';
  numer: string;
  wymiarZewnetrzny: string;
  swiatloOtworu: string;
  kolor: string;
  kraty: string;
  opis: string;
};

interface DoorCatalogViewProps {
  onBackToOrders: () => void;
  currentProfile?: UserRoleProfile;
}

const EMPTY_VARIANT: Omit<DoorVariant, 'id'> = {
  grupa: 'NZ', numer: '', wymiarZewnetrzny: '', swiatloOtworu: '', kolor: '', kraty: '', opis: '',
};

export const DoorCatalogView: React.FC<DoorCatalogViewProps> = ({ onBackToOrders, currentProfile }) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const canEdit = profile.canManageDoors;
  const [variants, setVariants] = useState<DoorVariant[]>([]);
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [sort, setSort] = useState<{ key: keyof DoorVariant; asc: boolean }>({ key: 'grupa', asc: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newVariantId, setNewVariantId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DoorVariant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  const loadCatalog = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/door-catalog');
      const json = await response.json();
      if (!response.ok || !json.success || !Array.isArray(json.variants)) throw new Error('Nie udało się pobrać katalogu');
      setVariants(json.variants);
      setNotice('');
    } catch {
      setNotice('Nie udało się pobrać katalogu z serwera. Sprawdź połączenie i odśwież.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCatalog(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('pl-PL');
    return variants.filter((v) => {
      if (groupFilter !== 'all' && v.grupa !== groupFilter) return false;
      if (!q) return true;
      return [v.numer, v.grupa, v.wymiarZewnetrzny, v.swiatloOtworu, v.kolor, v.kraty, v.opis]
        .some((value) => String(value || '').toLocaleLowerCase('pl-PL').includes(q));
    }).sort((a, b) => {
      const av = String(a[sort.key] || '').toLocaleLowerCase('pl-PL');
      const bv = String(b[sort.key] || '').toLocaleLowerCase('pl-PL');
      return av.localeCompare(bv, 'pl-PL', { numeric: true }) * (sort.asc ? 1 : -1);
    });
  }, [variants, search, groupFilter, sort]);

  const saveCatalog = async (next: DoorVariant[]): Promise<boolean> => {
    if (!canEdit) return false;
    setSaving(true);
    try {
      const response = await fetch('/api/door-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variants: next }),
      });
      const json = await response.json();
      if (!response.ok || !json.success || !Array.isArray(json.variants)) throw new Error('Błąd zapisu');
      setVariants(json.variants);
      setNotice('Katalog zapisany na serwerze.');
      return true;
    } catch {
      setNotice('Nie udało się zapisać katalogu. Zmiany nie zostały potwierdzone przez serwer.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (variant: DoorVariant) => { setEditingId(variant.id); setDraft({ ...variant }); };
  const cancelEdit = () => {
    if (draft && draft.id === newVariantId) setVariants((current) => current.filter((v) => v.id !== draft.id));
    setNewVariantId(null);
    setEditingId(null);
    setDraft(null);
  };
  const commitDraft = async () => {
    if (!draft || !canEdit) return;
    const next = variants.map((v) => v.id === draft.id ? draft : v);
    const saved = await saveCatalog(next);
    if (saved) { setNewVariantId(null); setEditingId(null); setDraft(null); }
  };
  const duplicate = async (variant: DoorVariant) => {
    if (!canEdit) return;
    const copy = { ...variant, id: `door_variant_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, numer: variant.numer ? `${variant.numer} kopia` : '' };
    const next = [...variants];
    const index = next.findIndex((v) => v.id === variant.id);
    next.splice(index + 1, 0, copy);
    await saveCatalog(next);
  };
  const addVariant = () => {
    if (!canEdit) return;
    const variant: DoorVariant = { ...EMPTY_VARIANT, id: `door_variant_${Date.now()}` };
    setVariants((current) => [variant, ...current]);
    setSearch('');
    setGroupFilter('all');
    setSort({ key: 'grupa', asc: true });
    setEditingId(variant.id);
    setNewVariantId(variant.id);
    setDraft(variant);
  };
  const deleteVariant = async (variant: DoorVariant) => {
    if (!canEdit || !window.confirm(`Usunąć kombinację ${variant.grupa} — ${variant.numer || variant.wymiarZewnetrzny}?`)) return;
    await saveCatalog(variants.filter((v) => v.id !== variant.id));
  };
  const setField = (key: keyof DoorVariant, value: string) => {
    if (draft) setDraft({ ...draft, [key]: value });
  };
  const sortBy = (key: keyof DoorVariant) => setSort((current) => ({ key, asc: current.key === key ? !current.asc : true }));

  const fieldClass = 'w-full min-w-24 rounded border border-slate-300 bg-white px-1.5 py-1 text-xs font-medium text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-200';
  const cell = (value: string) => <span className="text-xs font-medium text-slate-800">{value || '—'}</span>;
  const headers: { key: keyof DoorVariant; label: string }[] = [
    { key: 'grupa', label: 'Grupa' }, { key: 'numer', label: 'Nr' }, { key: 'wymiarZewnetrzny', label: 'Wymiar zewnętrzny' },
    { key: 'swiatloOtworu', label: 'W świetle otworu' }, { key: 'kolor', label: 'Kolor' }, { key: 'kraty', label: 'Kraty' }, { key: 'opis', label: 'Opis' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><DoorOpen className="h-5 w-5" /></div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Moduł Drzwi</h1>
            <p className="text-xs text-slate-500">Katalog kombinacji ślusarki · {variants.length} pozycji</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={onBackToOrders} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><ClipboardList className="h-4 w-4" /> Rejestr zamówień PZD</button>
          <button type="button" onClick={() => void loadCatalog()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-4 w-4" /> Odśwież</button>
          {canEdit && <button type="button" onClick={addVariant} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><Plus className="h-4 w-4" /> Dodaj kombinację</button>}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-56 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj wymiaru, koloru, krat, opisu..." className="w-full rounded-lg border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none" />
        </div>
        <select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800">
          <option value="all">Wszystkie grupy</option><option value="NZ">NZ</option><option value="NZ — rama BEK">Drzwi do NZ, rama BEK</option><option value="BEK">BEK</option>
        </select>
        <span className="text-xs font-semibold text-slate-600">Widoczne: {filtered.length} / {variants.length}</span>
      </div>

      {notice && <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${notice.includes('nie udało') ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice}</div>}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {loading ? <div className="p-10 text-center text-sm text-slate-500">Ładowanie katalogu…</div> : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead className="bg-slate-100">
                <tr>{headers.map((h) => <th key={h.key} className="whitespace-nowrap border-b border-slate-200 px-2 py-2 text-[11px] font-bold text-slate-700"><button type="button" onClick={() => sortBy(h.key)} className="inline-flex items-center gap-1 hover:text-blue-700">{h.label}<ArrowDownUp className="h-3 w-3" />{sort.key === h.key ? <span>{sort.asc ? '↑' : '↓'}</span> : null}</button></th>)}<th className="border-b border-slate-200 px-2 py-2 text-[11px] font-bold text-slate-700">Akcje</th></tr>
              </thead>
              <tbody>
                {filtered.map((variant) => {
                  const isEditing = editingId === variant.id && draft?.id === variant.id;
                  const row = isEditing ? draft! : variant;
                  return <tr key={variant.id} className="border-b border-slate-100 hover:bg-blue-50/40">
                    {headers.map((h) => <td key={h.key} className="px-2 py-1.5 align-middle">
                      {isEditing && canEdit ? h.key === 'grupa' ? <select value={row.grupa} onChange={(e) => setField('grupa', e.target.value)} className={fieldClass}><option value="NZ">NZ</option><option value="NZ — rama BEK">NZ — rama BEK</option><option value="BEK">BEK</option></select> : <input value={String(row[h.key] || '')} onChange={(e) => setField(h.key, e.target.value)} className={fieldClass} aria-label={h.label} /> : h.key === 'grupa' ? <span className="whitespace-nowrap rounded bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">{variant.grupa}</span> : cell(String(variant[h.key] || ''))}
                    </td>)}
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {isEditing && canEdit ? <div className="flex items-center gap-1"><button type="button" onClick={() => void commitDraft()} disabled={saving} title="Zapisz pozycję" className="rounded p-1.5 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"><Save className="h-4 w-4" /></button><button type="button" onClick={cancelEdit} title="Anuluj edycję" className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">Anuluj</button></div> : <div className="flex items-center gap-1">{canEdit && <button type="button" onClick={() => startEdit(variant)} title="Edytuj kombinację" className="rounded px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50">Edytuj</button>}{canEdit && <button type="button" onClick={() => void duplicate(variant)} title="Kopiuj kombinację" className="rounded p-1.5 text-blue-700 hover:bg-blue-50"><Copy className="h-4 w-4" /></button>}{canEdit && <button type="button" onClick={() => void deleteVariant(variant)} title="Usuń kombinację" className="rounded p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>}</div>}
                    </td>
                  </tr>;
                })}
                {filtered.length === 0 && <tr><td colSpan={headers.length + 1} className="p-10 text-center text-sm text-slate-500">Brak kombinacji pasujących do filtra.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[11px] text-slate-500">Zmiany w katalogu są zapisywane na serwerze i dostępne dla pozostałych użytkowników po odświeżeniu. Kolory zapisane jako „8014?” zachowano zgodnie z przesłanym zestawieniem.</p>
    </div>
  );
};
