import React, { useState, useEffect, useMemo } from 'react';
import { DoorOrder, DoorOrderHistoryEntry, formatDatePL, Order } from '../types/enco';
import {
  X,
  Check,
  Calendar,
  AlertCircle,
  Plus,
  Trash2,
  Tag,
  DollarSign,
  Clock,
  FileText,
  Building2,
  CheckSquare,
  Square,
  Search,
  Lock,
} from 'lucide-react';
import { normalizeOrderNumber, isSameOrderNumber } from '../utils/orderNumberUtils';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';

interface DoorOrderModalProps {
  order: DoorOrder | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (order: DoorOrder) => void;
  onDelete?: (orderId: string) => void;
  orders?: Order[];
  existingZlSuggestions?: string[];
  existingStationSuggestions?: string[];
  initialZl?: string;
  initialRealizacje?: string;
  currentProfile?: UserRoleProfile;
}

export const DoorOrderModal: React.FC<DoorOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onSave,
  onDelete,
  orders = [],
  existingZlSuggestions = [],
  existingStationSuggestions = [],
  initialZl,
  initialRealizacje,
  currentProfile,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const canManageDoors = profile.canManageDoors;
  const isEditing = Boolean(order);

  // Form states
  const [numerDokumentu, setNumerDokumentu] = useState('');
  const [dataZamowienia, setDataZamowienia] = useState('');
  const [terminZamowienia, setTerminZamowienia] = useState('');
  const [kategoria, setKategoria] = useState('');
  const [numeryZl, setNumeryZl] = useState<string[]>([]);
  const [zlInput, setZlInput] = useState('');
  const [kontrahentRealizacje, setKontrahentRealizacje] = useState('');
  const [terminDostawy, setTerminDostawy] = useState('');
  const [uwagi, setUwagi] = useState('');
  const [wartoscNetto, setWartoscNetto] = useState<string>('');
  const [wartoscBrutto, setWartoscBrutto] = useState<string>('');
  const [historyNote, setHistoryNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setConfirmDelete(false);
    if (order) {
      setNumerDokumentu(order.numerDokumentu || '');
      setDataZamowienia(order.dataZamowienia || '');
      setTerminZamowienia(order.terminZamowienia || '');
      setKategoria(order.kategoria || '');
      setNumeryZl(Array.isArray(order.numeryZl) ? [...order.numeryZl] : []);
      setZlInput('');
      setKontrahentRealizacje(order.kontrahentRealizacje || '');
      setTerminDostawy(order.terminDostawy || '');
      setUwagi(order.uwagi || '');
      setWartoscNetto(order.wartoscNetto !== null && order.wartoscNetto !== undefined ? String(order.wartoscNetto) : '');
      setWartoscBrutto(order.wartoscBrutto !== null && order.wartoscBrutto !== undefined ? String(order.wartoscBrutto) : '');
      setHistoryNote('');
      setError(null);
    } else {
      // Default initial values for new door order
      const today = '2026-10-09';
      setNumerDokumentu('PZD/' + Math.floor(380 + Math.random() * 40) + '/2026');
      setDataZamowienia(today);
      setTerminZamowienia('2026-11-09');
      setKategoria('27/2026/PARAUM/ST');
      setNumeryZl(initialZl ? [initialZl] : []);
      setZlInput('');
      setKontrahentRealizacje(initialRealizacje || '');
      setTerminDostawy('');
      setUwagi('');
      setWartoscNetto('12824.00');
      setWartoscBrutto('15773.52');
      setHistoryNote('');
      setError(null);
    }
  }, [order, isOpen, initialZl, initialRealizacje]);

  // Obliczenie listy dostępnych i aktywnych numerów zleceń w systemie
  const availableOrdersList = useMemo(() => {
    const list: Array<{
      orderNumber: string;
      stationName: string;
      client?: string;
      stationSize?: string;
      status?: string;
    }> = [];

    const seen = new Set<string>();

    if (orders && orders.length > 0) {
      orders.forEach((o) => {
        if (o.orderNumber && !seen.has(o.orderNumber.toUpperCase())) {
          seen.add(o.orderNumber.toUpperCase());
          list.push({
            orderNumber: o.orderNumber,
            stationName: `${o.stationSize ? o.stationSize + ' ' : ''}${o.projectName}`.trim(),
            client: o.client,
            stationSize: o.stationSize,
            status: o.status,
          });
        }
      });
    }

    // Dodanie podpowiedzi zewnętrznych/archiwalnych jeśli nie ma ich na liście zleceń
    existingZlSuggestions.forEach((sugg) => {
      if (sugg && !seen.has(sugg.toUpperCase())) {
        seen.add(sugg.toUpperCase());
        list.push({
          orderNumber: sugg,
          stationName: '',
        });
      }
    });

    if (!zlInput.trim()) return list;

    const q = zlInput.trim().toLowerCase();
    return list.filter((item) => {
      const matchNum = item.orderNumber.toLowerCase().includes(q);
      const matchStation = item.stationName.toLowerCase().includes(q);
      const matchClient = (item.client || '').toLowerCase().includes(q);
      return matchNum || matchStation || matchClient;
    });
  }, [orders, existingZlSuggestions, zlInput]);

  if (!isOpen) return null;

  const handleAddZl = (val?: string, stationName?: string) => {
    const raw = (val || zlInput).trim();
    if (!raw) return;

    // Support comma or space separated ZL numbers
    const parts = raw.split(/[,;\s]+/).map((p) => p.trim()).filter(Boolean);
    const updated = [...numeryZl];
    parts.forEach((p) => {
      const formatted = normalizeOrderNumber(p);
      if (formatted && !updated.some((u) => isSameOrderNumber(u, formatted))) {
        updated.push(formatted);
      }
    });
    setNumeryZl(updated);
    setZlInput('');

    // Jeśli podano stację i nie ma jej jeszcze w polu kontrahentRealizacje, zaproponuj/dopisz
    if (stationName && !kontrahentRealizacje.toLowerCase().includes(stationName.toLowerCase())) {
      setKontrahentRealizacje((prev) => (prev ? `${prev}, ${stationName}` : stationName));
    }
  };

  const handleToggleZl = (zlNumber: string, stationName?: string) => {
    const isAlreadySelected = numeryZl.some(
      (z) => isSameOrderNumber(z, zlNumber)
    );

    if (isAlreadySelected) {
      setNumeryZl((prev) => prev.filter((z) => !isSameOrderNumber(z, zlNumber)));
    } else {
      handleAddZl(zlNumber, stationName);
    }
  };

  const handleRemoveZl = (index: number) => {
    setNumeryZl((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!numerDokumentu.trim()) {
      setError('Wprowadź numer dokumentu zamówienia drzwi (np. PZD/363/2026).');
      return;
    }
    if (!dataZamowienia) {
      setError('Wybierz datę złożenia zamówienia.');
      return;
    }
    if (!terminZamowienia) {
      setError('Wybierz planowany termin z zamówienia.');
      return;
    }

    const nowIso = new Date().toISOString();
    const finalHistory: DoorOrderHistoryEntry[] = order?.history ? [...order.history] : [];

    // Track changes for history if editing
    if (order) {
      if (order.terminZamowienia !== terminZamowienia) {
        finalHistory.unshift({
          id: `h_${Date.now()}_1`,
          timestamp: nowIso,
          field: 'terminZamowienia',
          fieldName: 'Termin z zamówienia',
          oldValue: formatDatePL(order.terminZamowienia),
          newValue: formatDatePL(terminZamowienia),
          note: historyNote.trim() || 'Aktualizacja terminu z zamówienia',
        });
      }
      if ((order.terminDostawy || '') !== (terminDostawy || '')) {
        finalHistory.unshift({
          id: `h_${Date.now()}_2`,
          timestamp: nowIso,
          field: 'terminDostawy',
          fieldName: 'Termin dostawy',
          oldValue: order.terminDostawy ? formatDatePL(order.terminDostawy) : 'Nieustalony',
          newValue: terminDostawy ? formatDatePL(terminDostawy) : 'Nieustalony',
          note: historyNote.trim() || 'Aktualizacja rzeczywistego terminu dostawy',
        });
      }
      if ((order.uwagi || '').trim() !== (uwagi || '').trim()) {
        finalHistory.unshift({
          id: `h_${Date.now()}_3`,
          timestamp: nowIso,
          field: 'uwagi',
          fieldName: 'Uwagi',
          oldValue: order.uwagi || 'Brak',
          newValue: uwagi.trim() || 'Brak',
          note: historyNote.trim() || 'Zmiana treści uwag',
        });
      }
    } else {
      // Creation history entry
      finalHistory.unshift({
        id: `h_${Date.now()}_init`,
        timestamp: nowIso,
        field: 'ogolne',
        fieldName: 'Utworzenie zamówienia',
        oldValue: '—',
        newValue: `${numerDokumentu.trim()} (termin: ${formatDatePL(terminZamowienia)})`,
        note: 'Rejestracja nowego zamówienia drzwi w ENCO Flow',
      });
    }

    const nettoNum = wartoscNetto.trim() === '' ? null : parseFloat(wartoscNetto.replace(',', '.'));
    const bruttoNum = wartoscBrutto.trim() === '' ? null : parseFloat(wartoscBrutto.replace(',', '.'));

    const doorOrderData: DoorOrder = {
      id: order?.id || `door_ord_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      numerDokumentu: numerDokumentu.trim(),
      dataZamowienia,
      terminZamowienia,
      kategoria: kategoria.trim() || '27/2026/PARAUM/ST',
      numeryZl: numeryZl.length > 0 ? numeryZl : (zlInput.trim() ? [zlInput.trim()] : []),
      kontrahentRealizacje: kontrahentRealizacje.trim(),
      terminDostawy: terminDostawy.trim(),
      uwagi: uwagi.trim(),
      wartoscNetto: isNaN(nettoNum as number) ? null : nettoNum,
      wartoscBrutto: isNaN(bruttoNum as number) ? null : bruttoNum,
      history: finalHistory,
      createdAt: order?.createdAt || nowIso,
      updatedAt: nowIso,
    };

    onSave(doorOrderData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600/30 text-blue-400 border border-blue-500/30">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {isEditing ? `Edycja zamówienia drzwi: ${order?.numerDokumentu}` : 'Nowe zamówienie drzwi'}
              </h2>
              <p className="text-xs text-slate-400">
                Śledzenie dostaw drzwi do stacji transformatorowych
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-xs text-rose-800">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4.5 max-h-[75vh] overflow-y-auto">
          {!canManageDoors && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-xs text-amber-900 font-medium">
              <Lock className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Profil „{profile.name}” posiada uprawnienia tylko do podglądu modułu drzwi. Wprowadzanie zmian i usuwanie jest zablokowane.</span>
            </div>
          )}
          {/* Row 1: Numer dokumentu & Kategoria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Numer dokumentu <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={numerDokumentu}
                onChange={(e) => setNumerDokumentu(e.target.value)}
                placeholder="np. PZD/363/2026"
                required
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Główny numer zamówienia zakupu drzwi</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kategoria
              </label>
              <input
                type="text"
                value={kategoria}
                onChange={(e) => setKategoria(e.target.value)}
                placeholder="np. 27/2026/PARAUM/ST"
                className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg font-mono text-slate-800 bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <p className="text-[10px] text-slate-500 mt-1">Oznaczenie kategorii lub kodu zamówienia</p>
            </div>
          </div>

          {/* Row 2: Daty (Data zamówienia, Termin z zamówienia, Termin dostawy) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
            <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Terminy i kalendarz realizacji
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Data zamówienia <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={dataZamowienia}
                  onChange={(e) => setDataZamowienia(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Dzień złożenia zamówienia</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Termin z zamówienia <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={terminZamowienia}
                  onChange={(e) => setTerminZamowienia(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">Wymagany termin wg umowy/zamówienia</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Termin dostawy
                  </label>
                  {terminDostawy && (
                    <button
                      type="button"
                      onClick={() => setTerminDostawy('')}
                      className="text-[10px] text-blue-600 hover:underline cursor-pointer"
                    >
                      Oznacz jako nieustalony
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={terminDostawy}
                  onChange={(e) => setTerminDostawy(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                />
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {terminDostawy ? `Potwierdzona data: ${formatDatePL(terminDostawy)}` : 'Puste = Nieustalony'}
                </p>
              </div>
            </div>
          </div>

          {/* Row 3: Numery ZL (wielokrotne) z pełną listą aktywnych i dostępnych zleceń */}
          <div className="p-3.5 bg-slate-50/90 rounded-xl border border-slate-200/90 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  Lista aktywnych i dostępnych numerów zleceń (Numery ZL)
                </label>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Wybierz zlecenia z poniższej listy lub wpisz dowolny numer ręcznie
                </p>
              </div>
              <span className="text-[11px] font-bold bg-blue-50 text-blue-800 px-2.5 py-0.5 rounded-full border border-blue-200 shadow-2xs">
                Przypisano: {numeryZl.length}
              </span>
            </div>

            {/* Wyszukiwanie / ręczne wprowadzanie numeru ZL (TARGET SELECTOR ELEMENT) */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={zlInput}
                onChange={(e) => setZlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddZl();
                  }
                }}
                placeholder="Filtruj listę lub wpisz numer (np. ZL1, ZL/58/2026)..."
                className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase bg-white text-slate-900 placeholder:text-slate-400 placeholder:normal-case focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => handleAddZl()}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Dodaj wpisany</span>
              </button>
            </div>

            {/* Wybrane numery ZL */}
            {numeryZl.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white rounded-lg border border-blue-200/90 shadow-2xs">
                <span className="text-[10px] uppercase font-bold text-blue-700 mr-1 flex items-center gap-1">
                  <CheckSquare className="w-3 h-3 text-blue-600" />
                  Wybrane do drzwi ({numeryZl.length}):
                </span>
                {numeryZl.map((zl, idx) => (
                  <span
                    key={zl}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 border border-blue-300 text-blue-900 rounded-md text-xs font-mono font-bold shadow-2xs"
                  >
                    <Tag className="w-3 h-3 text-blue-600" />
                    <span>{zl}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveZl(idx)}
                      className="ml-1 text-blue-400 hover:text-rose-600 cursor-pointer"
                      title="Usuń numer ZL"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => setNumeryZl([])}
                  className="ml-auto text-[10px] text-slate-400 hover:text-rose-600 cursor-pointer hover:underline"
                >
                  Wyczyść wszystkie
                </button>
              </div>
            )}

            {/* Interaktywna lista aktywnych i dostępnych zleceń z systemu ENCO */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-600 px-0.5">
                <span className="font-bold flex items-center gap-1 text-slate-700">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  Aktywne i dostępne zlecenia ({availableOrdersList.length}):
                </span>
                <span className="text-[10px] text-slate-400">
                  Kliknij, aby przypisać lub odpiąć zlecenie
                </span>
              </div>

              <div className="max-h-56 overflow-y-auto space-y-1.5 p-1.5 bg-white rounded-xl border border-slate-200">
                {availableOrdersList.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    Brak zleceń pasujących do wpisanej frazy „{zlInput}”.
                    {zlInput.trim() && (
                      <div className="mt-1">
                        <button
                          type="button"
                          onClick={() => handleAddZl()}
                          className="text-blue-600 hover:underline font-semibold cursor-pointer"
                        >
                          + Dodaj „{zlInput}” jako nowy numer ZL
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  availableOrdersList.map((item) => {
                    const isSelected = numeryZl.some(
                      (z) => isSameOrderNumber(z, item.orderNumber)
                    );

                    return (
                      <div
                        key={item.orderNumber}
                        onClick={() => handleToggleZl(item.orderNumber, item.stationName)}
                        className={`p-2 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-3 text-xs ${
                          isSelected
                            ? 'bg-blue-50/90 border-blue-400 text-blue-950 ring-1 ring-blue-300 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`p-1 rounded-md shrink-0 transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {isSelected ? (
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            ) : (
                              <Plus className="w-3.5 h-3.5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {item.orderNumber}
                              </span>
                              {item.stationName && (
                                <span className="font-semibold text-slate-800 truncate text-[11px]">
                                  {item.stationName}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
                              {item.client && <span>Klient: {item.client}</span>}
                              {item.stationSize && <span>• Typ: {item.stationSize}</span>}
                              {item.status && (
                                <span className="text-slate-400">• Status: {item.status}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white shadow-2xs'
                                : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
                            }`}
                          >
                            {isSelected ? '✓ Przypisane' : '+ Wybierz'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Row 4: Kontrahent / przypisane realizacje */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Kontrahent / przypisane realizacje (wiele stacji)
            </label>
            <input
              type="text"
              value={kontrahentRealizacje}
              onChange={(e) => setKontrahentRealizacje(e.target.value)}
              placeholder="np. BEK 250/420 Plichy, NZ 130/290 Lisuny – El-system"
              className="w-full text-xs px-3 py-2.5 border border-slate-300 rounded-lg text-slate-900 bg-white"
            />
            {existingStationSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                <span className="font-semibold text-slate-400">Dodaj ze stacji:</span>
                {existingStationSuggestions.slice(0, 4).map((sugg) => (
                  <button
                    key={sugg}
                    type="button"
                    onClick={() => {
                      const next = kontrahentRealizacje
                        ? `${kontrahentRealizacje}, ${sugg}`
                        : sugg;
                      setKontrahentRealizacje(next);
                    }}
                    className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded border border-slate-300 cursor-pointer"
                  >
                    + {sugg}
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-1">
              Wymień nazwy stacji, typy obudów lub kontrahentów, do których przypisane są drzwi.
            </p>
          </div>

          {/* Row 5: Wartości finansowe (Netto i Brutto bez wymuszania VAT) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                Wartości z dokumentu (PLN)
              </h3>
              <span className="text-[10px] text-slate-500">
                Wprowadzane z dokumentu (bez auto-przeliczania)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Wartość netto (PLN)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wartoscNetto}
                    onChange={(e) => setWartoscNetto(e.target.value)}
                    placeholder="12824.00"
                    className="w-full text-xs pl-3 pr-8 py-2 border border-slate-300 rounded-lg font-mono bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    zł
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Wartość brutto (PLN)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={wartoscBrutto}
                    onChange={(e) => setWartoscBrutto(e.target.value)}
                    placeholder="15773.52"
                    className="w-full text-xs pl-3 pr-8 py-2 border border-slate-300 rounded-lg font-mono bg-white"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold pointer-events-none">
                    zł
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 6: Uwagi */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Uwagi do zamówienia
            </label>
            <textarea
              rows={3}
              value={uwagi}
              onChange={(e) => setUwagi(e.target.value)}
              placeholder="np. Kolor RAL 7035, atestowane zamki energetyki MasterKey, żaluzje komory trafo"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white"
            />
          </div>

          {/* Row 7: Notatka do historii (tylko w trybie edycji) */}
          {isEditing && (
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-600 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                Komentarz do wpisu historii (opcjonalny)
              </label>
              <input
                type="text"
                value={historyNote}
                onChange={(e) => setHistoryNote(e.target.value)}
                placeholder="np. Przesunięcie terminu uzgodnione z producentem na prośbę montażu"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg text-slate-800 bg-slate-50"
              />
              <p className="text-[10px] text-slate-400 mt-0.5">
                Każda zmiana dat lub uwag zostanie trwale zarejestrowana w historii tego zamówienia.
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
            <div>
              {isEditing && onDelete && order && canManageDoors && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirmDelete) {
                      onDelete(order.id);
                    } else {
                      setConfirmDelete(true);
                    }
                  }}
                  className={`px-3 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                    confirmDelete
                      ? 'bg-rose-600 text-white hover:bg-rose-700 shadow-xs'
                      : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200'
                  }`}
                  title={confirmDelete ? 'Kliknij ponownie, aby bezpowrotnie usunąć' : 'Usuń to zamówienie drzwi'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{confirmDelete ? 'Potwierdź usunięcie' : 'Usuń zamówienie'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                {canManageDoors ? 'Anuluj' : 'Zamknij'}
              </button>
              {canManageDoors ? (
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>{isEditing ? 'Zapisz zmiany' : 'Dodaj zamówienie'}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-semibold select-none">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Tylko podgląd</span>
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
