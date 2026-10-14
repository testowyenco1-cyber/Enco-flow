import React from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Edit2, FileText, Trash2, Truck } from 'lucide-react';
import { DoorOrder, formatDatePL, formatPLN, checkDoorOrderOverdue } from '../types/enco';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';

interface DoorOrderDetailViewProps {
  order: DoorOrder;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onQuickConfirm: () => void;
  currentProfile?: UserRoleProfile;
}

export const DoorOrderDetailView: React.FC<DoorOrderDetailViewProps> = ({
  order, onBack, onEdit, onDelete, onQuickConfirm, currentProfile,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const canManage = profile.canManageDoors;
  const delivery = checkDoorOrderOverdue(order.terminZamowienia, order.terminDostawy);

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <ArrowLeft className="h-4 w-4" /> Wróć do listy zamówień drzwi
        </button>
        <span className="text-xs text-slate-500">Podstrona zamówienia drzwi</span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="bg-slate-900 p-6 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-300"><FileText className="h-4 w-4" /> Zamówienie drzwi</div>
              <h1 className="text-2xl font-black tracking-tight">{order.numerDokumentu}</h1>
              <p className="mt-2 text-sm text-slate-300">{order.kategoria || 'Brak kategorii / numeru postępowania'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canManage && <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-bold hover:bg-blue-500"><Edit2 className="h-4 w-4" /> Edytuj</button>}
              {canManage && <button type="button" onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg border border-rose-400/50 px-3 py-2 text-sm font-bold text-rose-200 hover:bg-rose-950"><Trash2 className="h-4 w-4" /> Usuń</button>}
            </div>
          </div>
        </header>

        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500"><CalendarDays className="h-4 w-4" /> Data zamówienia</div><div className="text-lg font-bold text-slate-900">{formatDatePL(order.dataZamowienia)}</div></div>
          <div className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500"><Clock className="h-4 w-4" /> Termin wymagany</div><div className={`text-lg font-bold ${delivery.isOverdue ? 'text-rose-700' : 'text-slate-900'}`}>{formatDatePL(order.terminZamowienia)}</div></div>
          <div className="rounded-xl border border-slate-200 p-4"><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-500"><Truck className="h-4 w-4" /> Data dostawy</div><div className="text-lg font-bold text-slate-900">{formatDatePL(order.terminDostawy)}</div></div>
        </div>

        <div className="grid gap-5 border-t border-slate-100 p-5 md:grid-cols-2">
          <div><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Powiązane zlecenia ZL</h2><div className="flex flex-wrap gap-2">{order.numeryZl?.length ? order.numeryZl.map((zl) => <span key={zl} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 font-mono text-sm font-bold text-blue-800">{zl}</span>) : <span className="text-sm text-slate-400">Brak powiązanych zleceń</span>}</div></div>
          <div><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Stacje / realizacje / kontrahent</h2><p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{order.kontrahentRealizacje || 'Brak danych'}</p></div>
          <div><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Wartość zamówienia</h2><p className="text-sm text-slate-700">Netto: <strong>{formatPLN(order.wartoscNetto)}</strong></p><p className="text-sm text-slate-700">Brutto: <strong>{formatPLN(order.wartoscBrutto)}</strong></p></div>
          <div><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Status dostawy</h2><div className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold ${order.terminDostawy ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : delivery.isOverdue ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>{order.terminDostawy ? <CheckCircle2 className="h-4 w-4" /> : <Clock className="h-4 w-4" />}{order.terminDostawy ? 'Dostarczono' : delivery.label}</div>{canManage && !order.terminDostawy && <button type="button" onClick={onQuickConfirm} className="mt-3 block rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">Potwierdź dostawę dzisiaj</button>}</div>
        </div>
        <div className="border-t border-slate-100 p-5"><h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Uwagi</h2><p className="whitespace-pre-wrap text-sm leading-6 text-slate-800">{order.uwagi || 'Brak uwag'}</p></div>
        <div className="border-t border-slate-100 p-5"><h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Historia zmian</h2>{order.history?.length ? <ol className="space-y-3">{[...order.history].reverse().map((entry) => <li key={entry.id} className="border-l-2 border-blue-200 pl-3"><div className="text-xs font-bold text-slate-800">{entry.fieldName} · {new Date(entry.timestamp).toLocaleString('pl-PL')}</div><div className="mt-1 text-sm text-slate-600">{entry.oldValue || '—'} → {entry.newValue || '—'}</div>{entry.note && <p className="mt-1 text-xs text-slate-500">{entry.note}</p>}</li>)}</ol> : <p className="text-sm text-slate-400">Brak zapisanych wpisów historii.</p>}</div>
      </section>
    </div>
  );
};
