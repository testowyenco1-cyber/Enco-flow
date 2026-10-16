import React, { useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from 'lucide-react';
import { Order, formatDatePL } from '../types/enco';

interface CalendarViewProps {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
}

const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const monthLabel = (date: Date) => date.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

export const CalendarView: React.FC<CalendarViewProps> = ({ orders, onSelectOrder }) => {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [search, setSearch] = useState('');
  const [stationType, setStationType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dailyLimit, setDailyLimit] = useState(() => {
    const saved = Number(localStorage.getItem('enco_calendar_daily_limit') || 3);
    return Number.isFinite(saved) && saved >= 1 ? Math.min(99, Math.floor(saved)) : 3;
  });

  const filteredOrders = useMemo(() => orders.filter((order) => {
    if (order.archivedAt) return false;
    const query = search.trim().toLowerCase();
    if (query && ![order.orderNumber, order.client, order.projectName, order.stationSize].some((value) => (value || '').toLowerCase().includes(query))) return false;
    const size = (order.stationSize || '').toUpperCase();
    if (stationType === 'BEK' && !size.includes('BEK')) return false;
    if (stationType === 'NZ' && !size.includes('NZ')) return false;
    if (stationType === 'other' && (size.includes('BEK') || size.includes('NZ'))) return false;
    if (statusFilter === 'ready' && order.status !== 'READY') return false;
    if (statusFilter === 'problem' && order.status !== 'PROBLEM' && !order.items.some((item) => item.status === 'PROBLEM')) return false;
    if (statusFilter === 'active' && (order.status === 'READY' || order.archivedAt)) return false;
    return true;
  }), [orders, search, stationType, statusFilter]);

  const calendarDays = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return { date, key: toISODate(date), inMonth: date.getMonth() === visibleMonth.getMonth() };
    });
  }, [visibleMonth]);

  const monthOrders = filteredOrders.filter((order) => {
    if (!order.departureDate) return false;
    const date = new Date(`${order.departureDate}T12:00:00`);
    return date.getFullYear() === visibleMonth.getFullYear() && date.getMonth() === visibleMonth.getMonth();
  });
  const undatedCount = filteredOrders.filter((order) => !order.departureDate).length;

  const changeLimit = (value: number) => {
    const safeValue = Number.isFinite(value) ? Math.max(1, Math.min(99, Math.floor(value))) : 1;
    setDailyLimit(safeValue);
    localStorage.setItem('enco_calendar_daily_limit', String(safeValue));
  };

  const shiftMonth = (delta: number) => setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <section className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-700"><CalendarDays className="h-6 w-6" /><span className="text-xs font-bold uppercase tracking-wider">Planowanie logistyki</span></div>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Kalendarz wyjazdów</h1>
          <p className="mt-1 text-sm text-slate-500">Porównuj termin z oferty z aktualnym planem i kontroluj liczbę stacji zaplanowanych na dany dzień.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-xs text-slate-500">Wyjazdy w miesiącu</p><p className="mt-1 text-2xl font-black text-slate-900">{monthOrders.length}</p></div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3"><p className="text-xs text-slate-500">Przepełnione dni</p><p className="mt-1 text-2xl font-black text-rose-600">{calendarDays.filter(({ key, inMonth }) => inMonth && filteredOrders.filter((order) => order.departureDate === key).length > dailyLimit).length}</p></div>
          <label className="rounded-xl border border-slate-200 bg-white px-4 py-3"><span className="block text-xs text-slate-500">Limit stacji / dzień</span><input aria-label="Limit stacji na dzień" type="number" min={1} max={99} value={dailyLimit} onChange={(event) => changeLimit(Number(event.target.value))} className="mt-1 w-full max-w-24 rounded-md border border-slate-200 px-2 py-1 text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" /></label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
          <div className="relative flex-1 min-w-0"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Szukaj: numer zlecenia, klient, projekt..." className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div className="flex flex-wrap items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-slate-400" />
            <select value={stationType} onChange={(event) => setStationType(event.target.value)} aria-label="Filtr typu stacji" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">Wszystkie typy</option><option value="BEK">BEK</option><option value="NZ">NZ</option><option value="other">Pozostałe</option></select>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtr statusu" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">Wszystkie statusy</option><option value="active">W realizacji</option><option value="ready">Gotowe</option><option value="problem">Z problemem</option></select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
          <div><h2 className="text-lg font-bold capitalize text-slate-900">{monthLabel(visibleMonth)}</h2><p className="text-xs text-slate-500">Data w kalendarzu oznacza aktualnie planowany wyjazd.</p></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => setVisibleMonth(startOfMonth(new Date()))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold hover:bg-slate-50">Dziś</button><button type="button" aria-label="Poprzedni miesiąc" onClick={() => shiftMonth(-1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button><button type="button" aria-label="Następny miesiąc" onClick={() => shiftMonth(1)} className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button></div>
        </div>
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">{['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Niedz'].map((day) => <div key={day} className="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500 sm:px-2">{day}</div>)}</div>
        <div className="grid grid-cols-7">
          {calendarDays.map(({ date, key, inMonth }) => {
            const dayOrders = filteredOrders.filter((order) => order.departureDate === key).sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, 'pl'));
            const overloaded = dayOrders.length > dailyLimit;
            return <div key={key} className={`min-h-28 border-b border-r border-slate-100 p-1 sm:min-h-36 sm:p-2 ${inMonth ? 'bg-white' : 'bg-slate-50/70'} ${overloaded ? 'bg-rose-50' : ''}`}>
              <div className="mb-1 flex items-center justify-between gap-1"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${inMonth ? 'text-slate-700' : 'text-slate-300'}`}>{date.getDate()}</span>{dayOrders.length > 0 && <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${overloaded ? 'bg-rose-600 text-white' : 'bg-blue-100 text-blue-800'}`}>{dayOrders.length} st.</span>}</div>
              {overloaded && <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-rose-700"><AlertTriangle className="h-3 w-3 shrink-0" /><span>Limit przekroczony</span></div>}
              <div className="space-y-1">
                {dayOrders.slice(0, 3).map((order) => <button key={order.id} type="button" onClick={() => onSelectOrder(order.id)} title={`${order.orderNumber} · ${order.client} · Oferta: ${order.originalDepartureDate ? formatDatePL(order.originalDepartureDate) : 'brak zapisanej daty'} · Wyjazd: ${formatDatePL(order.departureDate)}`} className={`block w-full min-w-0 rounded-md border px-1.5 py-1 text-left text-[10px] leading-tight hover:brightness-95 sm:px-2 sm:text-xs ${order.originalDepartureDate && order.originalDepartureDate !== order.departureDate ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-blue-200 bg-blue-50 text-blue-900'}`}><span className="block truncate font-bold">{order.orderNumber}</span><span className="hidden truncate sm:block">{order.projectName}</span><span className={`mt-0.5 block truncate text-[9px] sm:text-[10px] ${order.originalDepartureDate && order.originalDepartureDate !== order.departureDate ? 'text-amber-800' : 'text-blue-800'}`}>Oferta: {order.originalDepartureDate ? formatDatePL(order.originalDepartureDate) : 'brak danych'}</span></button>)}
                {dayOrders.length > 3 && <p className="px-1 text-[10px] font-semibold text-slate-500">+{dayOrders.length - 3} kolejnych</p>}
              </div>
            </div>;
          })}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 px-4 py-3 text-xs text-slate-600"><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-blue-200" />Termin zgodny z ofertą lub brak daty pierwotnej</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200" />Wyjazd przesunięty względem oferty</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-rose-200" />Dzienny limit przekroczony — ostrzeżenie, bez automatycznego przesuwania</span></div>
      </div>
      {undatedCount > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{undatedCount} zleceń po zastosowaniu filtrów nie ma ustawionej daty wyjazdu i nie pojawia się w kalendarzu.</div>}
      {filteredOrders.length === 0 && <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Brak zleceń pasujących do wybranych filtrów.</div>}
    </section>
  );
};
