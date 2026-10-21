import React, { useEffect, useState } from 'react';
import { X, Database, Building2, CircuitBoard, Layers, Boxes, RefreshCw, Save, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';

type DatabaseKey = 'sn-catalog' | 'door-catalog' | 'obudowa-variants' | 'sn-switchgear';
type DatabaseDefinition = {
  key: DatabaseKey;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  endpoint: string;
  responseKey: string;
  kind: 'object' | 'array';
};

const DATABASES: DatabaseDefinition[] = [
  { key: 'sn-catalog', title: 'Producenci i modele SN', description: 'Słownik producentów rozdzielnic SN i przypisanych modeli.', icon: CircuitBoard, endpoint: '/api/sn-catalog', responseKey: 'catalog', kind: 'object' },
  { key: 'door-catalog', title: 'Katalog ślusarki drzwi', description: 'Warianty i kombinacje elementów ślusarki.', icon: Layers, endpoint: '/api/door-catalog', responseKey: 'variants', kind: 'array' },
  { key: 'obudowa-variants', title: 'Warianty obudów', description: 'Wspólne niestandardowe wymiary obudów BEK i NZ.', icon: Boxes, endpoint: '/api/obudowa-variants', responseKey: 'variants', kind: 'array' },
  { key: 'sn-switchgear', title: 'Zestawienie rozdzielnic SN', description: 'Rejestr rozdzielnic SN, stanów i powiązań z zamówieniami.', icon: Database, endpoint: '/api/sn-switchgear', responseKey: 'records', kind: 'array' },
];

interface DatabaseManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCustomers: () => void;
}

export const DatabaseManagementModal: React.FC<DatabaseManagementModalProps> = ({ isOpen, onClose, onOpenCustomers }) => {
  const [activeKey, setActiveKey] = useState<DatabaseKey>('sn-catalog');
  const [draft, setDraft] = useState('');
  const [originalIds, setOriginalIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const active = DATABASES.find((database) => database.key === activeKey) || DATABASES[0];

  const loadDatabase = async (key: DatabaseKey) => {
    const definition = DATABASES.find((database) => database.key === key) || DATABASES[0];
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch(definition.endpoint);
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Nie udało się pobrać danych.');
      const value = key === 'sn-catalog'
        ? { producers: data.producers || [], modelsByProducer: data.modelsByProducer || {} }
        : data[definition.responseKey];
      if (value === undefined) throw new Error('Serwer zwrócił nieoczekiwany format danych.');
      setDraft(JSON.stringify(value, null, 2));
      setOriginalIds(Array.isArray(value) ? value.map((entry: any) => String(entry?.id ?? '')).filter(Boolean) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd odczytu bazy danych.');
      setDraft('');
      setOriginalIds([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadDatabase(activeKey);
  }, [isOpen, activeKey]);

  const saveDatabase = async () => {
    let value: any;
    try {
      value = JSON.parse(draft);
    } catch {
      setError('Nie można zapisać danych: sprawdź poprawność formatu JSON.');
      return;
    }
    if (active.kind === 'array' && !Array.isArray(value)) {
      setError('Ta baza musi być listą rekordów (tablicą JSON).');
      return;
    }
    if (active.kind === 'object' && (!value || typeof value !== 'object' || Array.isArray(value))) {
      setError('Ta baza musi być obiektem JSON.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      let body: Record<string, unknown>;
      if (activeKey === 'sn-catalog') body = { action: 'replaceCatalog', catalog: value };
      else if (activeKey === 'door-catalog') body = { variants: value };
      else if (activeKey === 'obudowa-variants') body = { variants: value };
      else {
        const newIds = value.map((entry: any) => String(entry?.id ?? '')).filter(Boolean);
        body = { records: value, deletedIds: originalIds.filter((id) => !newIds.includes(id)) };
      }
      const response = await fetch(active.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Nie udało się zapisać bazy danych.');
      const savedValue = activeKey === 'sn-catalog'
        ? { producers: data.producers || [], modelsByProducer: data.modelsByProducer || {} }
        : data[active.responseKey];
      if (savedValue !== undefined) {
        setDraft(JSON.stringify(savedValue, null, 2));
        setOriginalIds(Array.isArray(savedValue) ? savedValue.map((entry: any) => String(entry?.id ?? '')).filter(Boolean) : []);
      }
      setNotice('Zmiany zapisano na serwerze.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Błąd zapisu bazy danych.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Bazy danych ENCO FLOW">
      <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="rounded-xl bg-blue-50 p-2.5 text-blue-700"><Database className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Bazy danych</h2>
              <p className="mt-1 text-xs text-slate-500">Wspólne słowniki i katalogi wykorzystywane w ENCO FLOW.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Zamknij"><X className="h-5 w-5" /></button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="max-h-48 space-y-1 overflow-y-auto border-b border-slate-200 bg-slate-50 p-3 md:max-h-none md:border-b-0 md:border-r">
            <button type="button" onClick={() => { onClose(); onOpenCustomers(); }} className="flex w-full items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left hover:border-slate-200 hover:bg-white">
              <Building2 className="h-4 w-4 shrink-0 text-slate-600" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">Baza klientów</span><span className="mt-0.5 block text-[11px] text-slate-500">Firmy i osoby kontaktowe</span></span>
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
            <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Słowniki i katalogi</div>
            {DATABASES.map((database) => {
              const Icon = database.icon;
              return <button key={database.key} type="button" onClick={() => setActiveKey(database.key)} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors ${activeKey === database.key ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-transparent text-slate-700 hover:border-slate-200 hover:bg-white'}`}>
                <Icon className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">{database.title}</span>
                {activeKey === database.key && <ChevronRight className="h-4 w-4 shrink-0" />}
              </button>;
            })}
          </aside>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
              <h3 className="text-sm font-bold text-slate-900">{active.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{active.description}</p>
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">Edytuj dane w formacie JSON. Zmiany dotyczą wspólnego katalogu na serwerze.</p>
                <button type="button" disabled={loading || saving} onClick={() => void loadDatabase(activeKey)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />Odśwież</button>
              </div>
              <textarea value={draft} onChange={(event) => { setDraft(event.target.value); setNotice(''); }} spellCheck={false} disabled={loading || saving} aria-label={`Dane bazy: ${active.title}`} className="min-h-64 flex-1 resize-y rounded-xl border border-slate-300 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-60" />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  {error && <p role="alert" className="flex items-start gap-2 text-xs text-rose-700"><AlertCircle className="h-4 w-4 shrink-0" />{error}</p>}
                  {notice && <p className="flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</p>}
                </div>
                <button type="button" disabled={loading || saving || !draft.trim()} onClick={() => void saveDatabase()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'Zapisywanie…' : 'Zapisz bazę'}</button>
              </div>
            </div>
          </div>
        </div>
        <footer className="flex justify-end border-t border-slate-200 px-5 py-3"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Zamknij</button></footer>
      </section>
    </div>
  );
};
