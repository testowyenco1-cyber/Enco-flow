import React from 'react';
import {
  DoorOrder,
  formatPLN,
  formatDatePL,
  checkDoorOrderOverdue,
} from '../types/enco';
import {
  Layers,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  Plus,
  Tag,
  DollarSign,
  FileText,
  Building2,
  Unlink,
} from 'lucide-react';

export interface DoorFormData {
  numerDokumentu?: string;
  ilosc?: string;
  typ?: string;
  lokalizacja?: string;
  dodatkoweWyposazenie?: string;
}

interface DoorFormProps {
  initialData?: Record<string, any>;
  orderNumber?: string;
  doorOrders: DoorOrder[];
  onChange: (details: Record<string, any>) => void;
  onNavigateToDoorModule?: (numerDokumentu?: string) => void;
  onCreateDoorOrderForStation?: () => void;
}

export const DoorForm: React.FC<DoorFormProps> = ({
  initialData = {},
  orderNumber = '',
  doorOrders = [],
  onChange,
  onNavigateToDoorModule,
  onCreateDoorOrderForStation,
}) => {
  const currentDoc = (initialData.numerDokumentu || '').trim();

  // Find linked door order:
  // 1. By explicit document number if set
  // 2. Or automatically by matching station orderNumber in doorOrder.numeryZl
  const linkedByDoc = currentDoc
    ? doorOrders.find(
        (d) => d.numerDokumentu.trim().toLowerCase() === currentDoc.toLowerCase()
      )
    : undefined;

  const linkedByZl = !linkedByDoc && orderNumber
    ? doorOrders.find((d) =>
        d.numeryZl.some((zl) => {
          const cleanZl = zl.trim().toUpperCase();
          const cleanOrd = orderNumber.trim().toUpperCase();
          if (cleanZl === cleanOrd) return true;
          const numZl = cleanZl.replace(/[^0-9]/g, '');
          const numOrd = cleanOrd.replace(/[^0-9]/g, '');
          return numZl && numOrd && numZl === numOrd;
        })
      )
    : undefined;

  const activeLinkedDoorOrder = linkedByDoc || linkedByZl;

  const handleFieldChange = (field: string, val: string) => {
    onChange({
      ...initialData,
      [field]: val,
    });
  };

  const handleSelectDoorOrder = (docNumber: string) => {
    const selected = doorOrders.find((d) => d.numerDokumentu === docNumber);
    const updated = {
      ...initialData,
      numerDokumentu: docNumber,
    };
    // If the selected door order has remarks or info, we can also assistively sync
    onChange(updated);
  };

  const handleUnlink = () => {
    const updated = { ...initialData };
    delete updated.numerDokumentu;
    onChange(updated);
  };

  // Status computation for linked door order
  const overdueInfo = activeLinkedDoorOrder
    ? checkDoorOrderOverdue(
        activeLinkedDoorOrder.terminZamowienia,
        activeLinkedDoorOrder.terminDostawy
      )
    : null;

  return (
    <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
      {/* 1. Header with Module Connection Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded-md bg-amber-500 text-slate-950 font-bold">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Integracja z modułem „Drzwi”
          </span>
          <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
            Rejestr PZD
          </span>
        </div>

        {activeLinkedDoorOrder ? (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Połączono z: {activeLinkedDoorOrder.numerDokumentu}
            </span>
            {onNavigateToDoorModule && (
              <button
                type="button"
                onClick={() => onNavigateToDoorModule(activeLinkedDoorOrder.numerDokumentu)}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-white hover:bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 cursor-pointer transition-colors shadow-2xs"
                title="Otwórz moduł Drzwi z tym zamówieniem"
              >
                <span>Otwórz w module</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-slate-500 bg-white px-2.5 py-1 rounded-md border border-slate-200 inline-flex items-center gap-1.5">
            Brak powiązania z modułem Drzwi
          </span>
        )}
      </div>

      {/* 2. Linked Door Order Live Card (if matched) */}
      {activeLinkedDoorOrder ? (
        <div className="p-3.5 bg-white rounded-xl border border-blue-200 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-black text-blue-900">
                  {activeLinkedDoorOrder.numerDokumentu}
                </span>
                <span className="text-[11px] font-mono text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  Kat: {activeLinkedDoorOrder.kategoria || '—'}
                </span>
                {overdueInfo?.isOverdue ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    Opóźnione ({overdueInfo.daysDiff} dni)
                  </span>
                ) : activeLinkedDoorOrder.terminDostawy ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    Dostarczone ({formatDatePL(activeLinkedDoorOrder.terminDostawy)})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                    <Clock className="w-3 h-3 text-amber-600" />
                    W toku (termin: {formatDatePL(activeLinkedDoorOrder.terminZamowienia)})
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                <strong>Przypisane realizacje:</strong>{' '}
                {activeLinkedDoorOrder.kontrahentRealizacje || '—'}
              </p>
            </div>

            <div className="flex items-center gap-1.5 self-start">
              {currentDoc && (
                <button
                  type="button"
                  onClick={handleUnlink}
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-rose-600 px-2 py-1 rounded hover:bg-rose-50 border border-transparent hover:border-rose-200 cursor-pointer transition-colors"
                  title="Rozłącz powiązanie z tym dokumentem"
                >
                  <Unlink className="w-3 h-3" />
                  <span>Rozłącz</span>
                </button>
              )}
            </div>
          </div>

          {/* Quick status details from the door module */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Data zamówienia</span>
              <span className="font-mono font-bold text-slate-800">
                {formatDatePL(activeLinkedDoorOrder.dataZamowienia)}
              </span>
            </div>

            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Termin z zamówienia</span>
              <span className="font-mono font-bold text-blue-900">
                {formatDatePL(activeLinkedDoorOrder.terminZamowienia)}
              </span>
            </div>

            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Termin dostawy</span>
              <span className={`font-mono font-bold ${activeLinkedDoorOrder.terminDostawy ? 'text-emerald-700' : 'text-amber-700'}`}>
                {activeLinkedDoorOrder.terminDostawy
                  ? formatDatePL(activeLinkedDoorOrder.terminDostawy)
                  : 'Nieustalony'}
              </span>
            </div>

            <div className="bg-slate-50 p-2 rounded-lg">
              <span className="text-[10px] text-slate-500 block">Wartość brutto</span>
              <span className="font-mono font-bold text-slate-900">
                {formatPLN(activeLinkedDoorOrder.wartoscBrutto)}
              </span>
            </div>
          </div>

          {activeLinkedDoorOrder.uwagi && (
            <div className="text-[11px] text-slate-600 bg-amber-50/60 p-2 rounded border border-amber-200/50">
              <span className="font-bold text-amber-900">Uwagi z modułu Drzwi: </span>
              {activeLinkedDoorOrder.uwagi}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-white rounded-xl border border-dashed border-slate-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <p className="font-medium text-slate-800">
              Element drzwi nie jest jeszcze powiązany z żadnym zamówieniem PZD.
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Wybierz istniejące zamówienie drzwi z listy lub utwórz nowe przypisane do tego zlecenia ({orderNumber}).
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {onCreateDoorOrderForStation && (
              <button
                type="button"
                onClick={onCreateDoorOrderForStation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Utwórz PZD dla {orderNumber}</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* 3. Selector of PZD document & manual technical fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Numer dokumentu zamówienia drzwi (PZD)
          </label>
          <div className="flex items-center gap-1.5">
            <select
              value={currentDoc}
              onChange={(e) => handleSelectDoorOrder(e.target.value)}
              className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            >
              <option value="">— Wybierz lub wpisz dokument PZD —</option>
              {doorOrders.map((d) => (
                <option key={d.id} value={d.numerDokumentu}>
                  {d.numerDokumentu} ({d.kontrahentRealizacje || d.numeryZl.join(', ')})
                </option>
              ))}
            </select>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Wybór dokumentu automatycznie synchronizuje status dostawy z modułem „Drzwi”.
          </p>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1">
            Ręczny wpis numeru dokumentu PZD
          </label>
          <input
            type="text"
            value={initialData.numerDokumentu || ''}
            onChange={(e) => handleFieldChange('numerDokumentu', e.target.value)}
            placeholder="np. PZD/363/2026"
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Możesz też wprowadzić niestandardowy numer PZD ręcznie.
          </p>
        </div>
      </div>

      {/* 4. Technical Door Details (Ilość, Typ, Lokalizacja, Dodatkowe wyposażenie) */}
      <div className="pt-2 border-t border-slate-200">
        <div className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
          Parametry techniczne drzwi stacji
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Ilość kompletów
            </label>
            <input
              type="text"
              value={initialData.ilosc || ''}
              onChange={(e) => handleFieldChange('ilosc', e.target.value)}
              placeholder="np. 3 komplety"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Typ drzwi
            </label>
            <input
              type="text"
              value={initialData.typ || ''}
              onChange={(e) => handleFieldChange('typ', e.target.value)}
              placeholder="np. Aluminiowe dwuskrzydłowe z żaluzjami IP43"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Lokalizacja na stacji
            </label>
            <input
              type="text"
              value={initialData.lokalizacja || ''}
              onChange={(e) => handleFieldChange('lokalizacja', e.target.value)}
              placeholder="np. Komora transformatora, komora SN/nN"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Wyposażenie dodatkowe / zamki
            </label>
            <input
              type="text"
              value={initialData.dodatkoweWyposazenie || ''}
              onChange={(e) => handleFieldChange('dodatkoweWyposazenie', e.target.value)}
              placeholder="np. Zamki MasterKey energetyki, blokada otwarcia 90°"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
