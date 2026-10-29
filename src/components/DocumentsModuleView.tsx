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
            <p className="mt-1 max-w-2xl text-sm text-slate-600">Wybierz zlecenie, a następnie typ formularza. Formularz obudowy możesz edytować, zobaczyć na żywo po prawej i wydrukować do sprawdzenia przed zatwierdzeniem zmian w zleceniu.</p>
          </div>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">Zlecenie obudowy dostępne</span>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900">1. Wybierz zlecenie</h2>
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
            <span>Nr ZL</span><span>Projekt / obiekt</span><span>Klient</span><span>Typ / rozmiar</span><span>Formularze</span>
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
                  <button type="button" onClick={() => onOpenDocument(order)} disabled={!hasObudowa} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300">
                    {canEditEnclosure ? <FileText size={14}/> : <Eye size={14}/>} {canEditEnclosure ? 'Otwórz formularze' : 'Podgląd formularzy'} <ChevronRight size={13}/>
                  </button>
                </div>
              </div>
            );
          })}
          {filteredOrders.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">Nie znaleziono zleceń pasujących do wyszukiwania.</p>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Zlecenie obudowy', detail: 'Aktywne: edycja, podgląd, PDF i oddzielne zatwierdzenie.', active: true },
          { title: 'Zlecenie produkcyjne NN', detail: 'Typ formularza jest przygotowany do dodania.', active: false },
          { title: 'Zapytanie Serwispol', detail: 'Typ formularza jest przygotowany do dodania.', active: false },
          { title: 'Zlecenie telemechanika / montażu', detail: 'Typy formularzy są przygotowane do dodania.', active: false },
        ].map((entry) => (
          <article key={entry.title} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2"><h3 className="text-sm font-bold text-slate-800">{entry.title}</h3><span className={'rounded-full px-2 py-1 text-[9px] font-bold ' + (entry.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{entry.active ? 'Dostępny' : 'W przygotowaniu'}</span></div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{entry.detail}</p>
          </article>
        ))}
      </section>
    </div>
  );
};
