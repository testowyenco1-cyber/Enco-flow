import React, { useMemo, useState } from 'react';
import { FileText, Search, ChevronRight, PackageCheck, Eye, CalendarDays } from 'lucide-react';
import type { Order } from '../types/enco';
import type { UserRoleProfile } from '../types/userRole';
import { canEditItemType } from '../types/userRole';

interface DocumentsModuleViewProps {
  orders: Order[];
  currentProfile: UserRoleProfile;
  onOpenDocument: (order: Order) => void;
}

export const DocumentsModuleView: React.FC<DocumentsModuleViewProps> = ({ orders, currentProfile, onOpenDocument }) => {
  const [query, setQuery] = useState('');
  const [selectedFormType, setSelectedFormType] = useState('zlecenie-obudowy');
  const formTypes = [
    { id: 'zlecenie-obudowy', title: 'Zlecenie obudowy', description: 'Formularz obudowy stacji.', available: true },
    { id: 'zlecenie-produkcyjne-nn', title: 'Zlecenie produkcyjne NN', description: 'Dokument produkcyjny dla rozdzielnicy NN.', available: false },
    { id: 'zapytanie-serwispol', title: 'Zapytanie Serwispol', description: 'Zapytanie ofertowe do Serwispol.', available: false },
    { id: 'zlecenie-telemechanika', title: 'Zlecenie telemechanika', description: 'Dokument dotyczący telemechaniki.', available: false },
    { id: 'zlecenie-montazu', title: 'Zlecenie montażu', description: 'Dokument dotyczący prac montażowych.', available: false },
  ];
  const canEditEnclosure = canEditItemType(currentProfile, 'OBUDOWA');
  const filteredOrders = useMemo(() => {
    const search = query.trim().toLocaleLowerCase('pl-PL');
    const sorted = [...orders].sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, 'pl-PL', { numeric: true }));
    if (!search) return sorted;
    return sorted.filter((order) =>
      [order.orderNumber, order.projectName, order.client, order.stationSize]
        .some((value) => String(value || '').toLocaleLowerCase('pl-PL').includes(search))
    );
  }, [orders, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><FileText className="h-5 w-5" /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Centrum dokumentów</h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Najpierw wybierz typ dokumentu, a potem zlecenie, dla którego chcesz go przygotować. Podgląd i wydruk nie zapisują zmian w zleceniu.</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Zlecenie obudowy dostępne</span>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3"><h2 className="text-sm font-bold text-slate-900">1. Wybierz typ formularza</h2><p className="mt-1 text-xs text-slate-500">Pozostałe typy będą aktywowane w kolejnych etapach przebudowy.</p></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {formTypes.map((type) => {
            const selected = selectedFormType === type.id;
            return <button key={type.id} type="button" disabled={!type.available} onClick={() => setSelectedFormType(type.id)} className={'flex min-h-32 items-start gap-3 rounded-xl border p-3 text-left transition-colors ' + (selected ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : type.available ? 'border-slate-200 hover:border-blue-300 hover:bg-slate-50' : 'cursor-not-allowed border-slate-200 bg-slate-50/70 text-slate-400')}>
              <span className={'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ' + (selected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}><FileText className="h-4 w-4"/></span>
              <span className="min-w-0"><span className="block text-sm font-bold">{type.title}</span><span className="mt-1 block text-xs leading-5">{type.description}</span><span className={'mt-2 block text-[10px] font-bold uppercase tracking-wide ' + (type.available ? selected ? 'text-blue-700' : 'text-emerald-700' : 'text-slate-400')}>{type.available ? selected ? 'Wybrany' : 'Dostępny' : 'W przygotowaniu'}</span></span>
            </button>;
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">2. Wybierz zlecenie</h2>
            <p className="mt-1 text-xs text-slate-500">Dane nagłówka i terminu zostaną odczytane ze wskazanego zlecenia. Przed zapisaniem nadal możesz je sprawdzić.</p>
          </div>
          <span className="text-xs tabular-nums text-slate-500">{filteredOrders.length} zleceń</span>
        </div>
        <label className="relative mt-4 block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Szukaj po numerze ZL, nazwie obiektu lub kliencie…" className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
        </label>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
          <div className="hidden grid-cols-[minmax(110px,0.65fr)_minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(100px,0.7fr)_minmax(170px,0.9fr)] gap-3 bg-slate-50 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 md:grid">
            <span>Nr ZL</span><span>Projekt / obiekt</span><span>Klient</span><span>Typ / rozmiar</span><span>Akcja</span>
          </div>
          {filteredOrders.map((order) => {
            const hasObudowa = order.items.some((item) => item.type === 'OBUDOWA');
            return (
              <div key={order.id} className="grid grid-cols-1 gap-3 border-t border-slate-100 px-4 py-3 first:border-t-0 hover:bg-slate-50/70 md:grid-cols-[minmax(110px,0.65fr)_minmax(180px,1.3fr)_minmax(150px,1fr)_minmax(100px,0.7fr)_minmax(170px,0.9fr)] md:items-center">
                <div><span className="text-sm font-bold text-blue-700">{order.orderNumber}</span><span className="mt-1 block text-[10px] text-slate-400 md:hidden">Numer zlecenia</span></div>
                <div className="min-w-0"><p className="break-words text-sm font-semibold text-slate-800">{order.projectName || 'Bez nazwy projektu'}</p><span className="mt-1 block text-[10px] text-slate-400 md:hidden">Projekt / obiekt</span></div>
                <div className="min-w-0"><p className="break-words text-sm text-slate-600">{order.client || '—'}</p><span className="mt-1 block text-[10px] text-slate-400 md:hidden">Klient</span></div>
                <div className="text-sm text-slate-600">{order.stationSize || '—'}<span className="mt-1 block text-[10px] text-slate-400 md:hidden">Typ / rozmiar</span></div>
                <div className="flex flex-wrap items-center gap-2">
                  {hasObudowa ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-800"><PackageCheck size={12}/> Obudowa jest w zleceniu</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-800"><CalendarDays size={12}/> Brak elementu Obudowa</span>
                  )}
                  <button type="button" onClick={() => onOpenDocument(order)} disabled={!hasObudowa || selectedFormType !== 'zlecenie-obudowy'} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {canEditEnclosure ? <FileText size={14}/> : <Eye size={14}/>} {canEditEnclosure ? 'Otwórz formularz' : 'Podgląd formularza'} <ChevronRight size={13}/>
                  </button>
                </div>
              </div>
            );
          })}
          {filteredOrders.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Nie znaleziono zleceń pasujących do wyszukiwania.</p>}
        </div>
      </section>

    </div>
  );
};
