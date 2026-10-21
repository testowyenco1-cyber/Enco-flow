import React, { useState, useEffect } from 'react';
import {
  OrderItem,
  ItemStatus,
  DEFAULT_SN_CONFIG,
  SN_CONFIG_EXAMPLES,
  DoorOrder,
  formatDatePL,
  checkDoorOrderOverdue,
} from '../types/enco';
import { X, Check, AlertCircle, CheckCircle2, Layers, Clock, AlertTriangle, Lock, Plus, Trash2, Settings2, Pencil, Save } from 'lucide-react';
import { StatusSwitcher } from './StatusSwitcher';
import { ObudowaForm, ObudowaFormData } from './ObudowaForm';
import { UserRoleProfile, USER_PROFILES, canEditItemType, getItemPermissionHint } from '../types/userRole';

interface EditItemModalProps {
  item: OrderItem | null;
  doorOrders?: DoorOrder[];
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSave: (updatedItem: OrderItem) => void;
  currentProfile?: UserRoleProfile;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  doorOrders = [],
  isOpen,
  onClose,
  onCancel,
  onSave,
  currentProfile,
}) => {
  const [status, setStatus] = useState<ItemStatus>(item?.status || 'NOT_ORDERED');
  const [orderDate, setOrderDate] = useState(item?.orderDate || '');
  const [plannedDate, setPlannedDate] = useState(item?.plannedDate || '');
  const [completedDate, setCompletedDate] = useState(item?.completedDate || '');
  const [notes, setNotes] = useState(item?.notes || '');
  const [details, setDetails] = useState<Record<string, any>>(item?.details || {});
  const [snError, setSnError] = useState<string | null>(null);
  type SNCatalog = { producers: { name: string; models: string[] }[] };
  const DEFAULT_SN_CATALOG: SNCatalog = { producers: [
    { name: 'Schneider Electric', models: ['AirSeT'] },
    { name: 'EATON', models: ['Xiria'] },
    { name: 'Siemens', models: ['8DJH 24 Blue GIS'] },
  ] };
  const [snCatalog, setSnCatalog] = useState<SNCatalog>(DEFAULT_SN_CATALOG);
  const [snCatalogBusy, setSnCatalogBusy] = useState(false);
  const [snCatalogError, setSnCatalogError] = useState<string | null>(null);
  const [showSnCatalogManager, setShowSnCatalogManager] = useState(false);
  const [newSnProducer, setNewSnProducer] = useState('');
  const [newSnModel, setNewSnModel] = useState('');
  const [editingSnProducer, setEditingSnProducer] = useState<string | null>(null);
  const [editingSnModel, setEditingSnModel] = useState<{ producer: string; model: string } | null>(null);
  const [snRenameValue, setSnRenameValue] = useState('');

  useEffect(() => {
    if (!isOpen || item?.type !== 'ROZDZIELNICA_SN') return;
    let cancelled = false;
    fetch('/api/sn-catalog').then(async (response) => {
      const json = await response.json();
      if (!response.ok || !json.success || !Array.isArray(json.catalog?.producers)) throw new Error(json.error || 'Błąd pobierania katalogu SN.');
      if (!cancelled) { setSnCatalog(json.catalog); setSnCatalogError(null); }
    }).catch(() => {
      if (!cancelled) setSnCatalogError('Nie udało się pobrać katalogu z serwera. Sprawdź połączenie przed zarządzaniem katalogiem.');
    });
    return () => { cancelled = true; };
  }, [isOpen, item?.id, item?.type]);

  const persistSnCatalog = async (nextCatalog: SNCatalog) => {
    setSnCatalogBusy(true); setSnCatalogError(null);
    try {
      const response = await fetch('/api/sn-catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ catalog: nextCatalog }) });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || 'Nie udało się zapisać katalogu SN.');
      setSnCatalog(json.catalog);
      return true;
    } catch (error) {
      setSnCatalogError(error instanceof Error ? error.message : 'Błąd zapisu katalogu SN.');
      return false;
    } finally { setSnCatalogBusy(false); }
  };

  const addSnProducer = async () => {
    const name = newSnProducer.trim();
    if (!name) return;
    if (snCatalog.producers.some((p) => p.name.toLocaleLowerCase('pl-PL') === name.toLocaleLowerCase('pl-PL'))) { setSnCatalogError('Taki producent już istnieje.'); return; }
    if (await persistSnCatalog({ producers: [...snCatalog.producers, { name, models: [] }] })) setNewSnProducer('');
  };
  const addSnModel = async (producerName: string) => {
    const model = newSnModel.trim();
    const producer = snCatalog.producers.find((p) => p.name === producerName);
    if (!producer || !model) return;
    if (producer.models.some((m) => m.toLocaleLowerCase('pl-PL') === model.toLocaleLowerCase('pl-PL'))) { setSnCatalogError('Taki model już istnieje u tego producenta.'); return; }
    if (await persistSnCatalog({ producers: snCatalog.producers.map((p) => p.name === producerName ? { ...p, models: [...p.models, model] } : p) })) setNewSnModel('');
  };
  const deleteSnProducer = async (name: string) => {
    if (!window.confirm(`Usunąć producenta "${name}" z katalogu? Dane zapisane w zleceniach pozostaną bez zmian.`)) return;
    const ok = await persistSnCatalog({ producers: snCatalog.producers.filter((p) => p.name !== name) });
    if (ok && details.producent === name) setDetails((prev) => ({ ...prev, producent: '', model: '', typRozdzielnicy: '' }));
  };
  const deleteSnModel = async (producerName: string, modelName: string) => {
    if (!window.confirm(`Usunąć model "${modelName}" z katalogu? Dane zapisane w zleceniach pozostaną bez zmian.`)) return;
    await persistSnCatalog({ producers: snCatalog.producers.map((p) => p.name === producerName ? { ...p, models: p.models.filter((m) => m !== modelName) } : p) });
  };
  const renameSnProducer = async (oldName: string) => {
    const name = snRenameValue.trim();
    if (!name || name === oldName) { setEditingSnProducer(null); return; }
    if (snCatalog.producers.some((p) => p.name !== oldName && p.name.toLocaleLowerCase('pl-PL') === name.toLocaleLowerCase('pl-PL'))) { setSnCatalogError('Taki producent już istnieje.'); return; }
    const ok = await persistSnCatalog({ producers: snCatalog.producers.map((p) => p.name === oldName ? { ...p, name } : p) });
    if (ok) { if (details.producent === oldName) setDetails((prev) => ({ ...prev, producent: name })); setEditingSnProducer(null); }
  };
  const renameSnModel = async (producerName: string, oldModel: string) => {
    const model = snRenameValue.trim();
    const producer = snCatalog.producers.find((p) => p.name === producerName);
    if (!producer || !model || model === oldModel) { setEditingSnModel(null); return; }
    if (producer.models.some((m) => m !== oldModel && m.toLocaleLowerCase('pl-PL') === model.toLocaleLowerCase('pl-PL'))) { setSnCatalogError('Taki model już istnieje u tego producenta.'); return; }
    const ok = await persistSnCatalog({ producers: snCatalog.producers.map((p) => p.name === producerName ? { ...p, models: p.models.map((m) => m === oldModel ? model : m) } : p) });
    if (ok) { if (details.producent === producerName && (details.model === oldModel || details.typRozdzielnicy === oldModel)) setDetails((prev) => ({ ...prev, model, typRozdzielnicy: model })); setEditingSnModel(null); }
  };

  useEffect(() => {
    if (isOpen && item) {
      setStatus(item.status);
      setOrderDate(item.orderDate || '');
      setPlannedDate(item.plannedDate || '');
      setCompletedDate(item.completedDate || '');
      setNotes(item.notes || '');

      const initialDetails = { ...(item.details || {}) };
      if (item.type === 'ROZDZIELNICA_SN') {
        if (!initialDetails.konfiguracjaPol) {
          initialDetails.konfiguracjaPol = DEFAULT_SN_CONFIG;
        }
        if (!initialDetails.model && initialDetails.typRozdzielnicy) {
          initialDetails.model = initialDetails.typRozdzielnicy;
        }
      }
      if (item.type === 'OBUDOWA') {
        if (!initialDetails.typObudowy) {
          initialDetails.typObudowy = 'BEK';
        }
        if (!initialDetails.rozmiar) {
          initialDetails.rozmiar = initialDetails.typObudowy === 'NZ' ? 'NZ 210/290' : 'BEK 250/350';
        }
        if (!initialDetails.dataGotowosci) {
          initialDetails.dataGotowosci = item.plannedDate || '';
        }
      }
      if (
        item.type === 'ZAP_SERWISPOL' ||
        item.type === 'ZAM_SERWISPOL' ||
        item.type === 'ZAP_JK' ||
        item.type === 'ZAM_JK'
      ) {
        if (!initialDetails.zakresUslugi) {
          initialDetails.zakresUslugi = 'montaż Stacji/Złącza';
        }
      }
      setDetails(initialDetails);
      setSnError(null);
    }
  }, [isOpen, item?.id]);

  // Wszystkie hooki muszą wykonać się przed warunkowym zakończeniem renderowania.
  if (!isOpen || !item) return null;

  const profile = currentProfile || USER_PROFILES.admin;
  const isReadOnly = !canEditItemType(profile, item.type);
  const permHint = getItemPermissionHint(profile, item.type, item.name);

  const handleDetailChange = (key: string, val: any) => {
    setDetails((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleSnProducerChange = (newProducer: string) => {
    const currentModel = details.model || details.typRozdzielnicy || '';
    const allowed = newProducer ? (snCatalog.producers.find((producer) => producer.name === newProducer)?.models || []) : [];
    const isModelStillValid = allowed.includes(currentModel);
    const nextModel = isModelStillValid ? currentModel : '';

    setDetails((prev) => ({
      ...prev,
      producent: newProducer,
      model: nextModel,
      typRozdzielnicy: nextModel,
      konfiguracjaPol: prev.konfiguracjaPol || DEFAULT_SN_CONFIG,
    }));
    setSnError(null);
  };

  const handleSnModelChange = (newModel: string) => {
    setDetails((prev) => ({
      ...prev,
      model: newModel,
      typRozdzielnicy: newModel,
      konfiguracjaPol: prev.konfiguracjaPol || DEFAULT_SN_CONFIG,
    }));
    setSnError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (item.type === 'ROZDZIELNICA_SN') {
      const activeModel = details.model || details.typRozdzielnicy || '';
      const selectedProducer = snCatalog.producers.find((producer) => producer.name === details.producent);
      if (!details.producent || !selectedProducer) { setSnError('Wybierz producenta rozdzielnicy SN z aktualnego katalogu.'); return; }
      if (!activeModel || !selectedProducer.models.includes(activeModel)) { setSnError(`Wybierz model rozdzielnicy SN dostępny dla producenta ${details.producent}.`); return; }

      const rawCount = details.liczbaPol ?? details.iloscPol;
      const parsedCount = Number(rawCount);
      if (rawCount === undefined || rawCount === '' || isNaN(parsedCount) || parsedCount <= 0) {
        setSnError('Wprowadź prawidłową dodatnią liczbę pól rozdzielnicy SN (np. 3 lub 4).');
        return;
      }

      const finalDetails = {
        ...details,
        model: activeModel,
        typRozdzielnicy: activeModel,
        liczbaPol: parsedCount,
        iloscPol: parsedCount,
        konfiguracjaPol: (details.konfiguracjaPol || DEFAULT_SN_CONFIG).trim(),
      };

      onSave({
        ...item,
        status,
        orderDate,
        plannedDate,
        completedDate,
        notes,
        details: finalDetails,
        updatedAt: new Date().toISOString(),
      });
      onClose();
      return;
    }

    if (item.type === 'OBUDOWA') {
      const readyDate = details.dataGotowosci || plannedDate;
      const finalDetails = {
        ...details,
        typObudowy: details.typObudowy || 'BEK',
        rozmiar: details.rozmiar || 'BEK 250/350',
        dataGotowosci: readyDate,
      };

      onSave({
        ...item,
        status,
        orderDate,
        plannedDate: readyDate,
        completedDate:
          status === 'READY'
            ? completedDate || new Date().toISOString().split('T')[0]
            : completedDate,
        notes,
        details: finalDetails,
        updatedAt: new Date().toISOString(),
      });
      onClose();
      return;
    }

    onSave({
      ...item,
      status,
      orderDate,
      plannedDate,
      completedDate,
      notes,
      details,
      updatedAt: new Date().toISOString(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded">
                {item.shortName}
              </span>
              <h2 className="text-lg font-bold text-slate-900">
                {isReadOnly ? `Podgląd: ${item.name}` : `Edycja: ${item.name}`}
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {isReadOnly
                ? `Tryb tylko do odczytu dla konta: ${profile.name}`
                : 'Parametry techniczne, terminy i uwagi do elementu'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel || onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Read-Only Notice Banner */}
        {isReadOnly && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-xl flex items-center justify-between gap-2 shadow-2xs">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                <strong>Tryb tylko do odczytu:</strong> Profil „{profile.name}” ma uprawnienia wyłącznie do podglądu tego elementu. Modyfikacje są zablokowane.
              </span>
            </div>
            <span className="text-[10px] font-mono text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-300 shrink-0">
              Brak zapisu
            </span>
          </div>
        )}

        {/* Form Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status section */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Status elementu
            </label>
            <StatusSwitcher
              currentStatus={status}
              onChange={setStatus}
              variant="segmented"
              readOnly={isReadOnly}
              readOnlyNotice={permHint.reason}
            />
          </div>

          <div className={isReadOnly ? 'pointer-events-none opacity-85 select-none' : ''}>

          {item.type === 'OBUDOWA' ? (
            <div className="space-y-4 pt-1">
              <ObudowaForm
                initialData={details}
                itemStatus={status}
                orderPlannedDate={plannedDate}
                onChange={(formData) => {
                  setDetails((prev) => ({
                    ...prev,
                    ...formData,
                  }));
                  if (formData.dataGotowosci) {
                    setPlannedDate(formData.dataGotowosci);
                  }
                }}
              />
            </div>
          ) : (
            <>
              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-blue-900 mb-1">
                    Data wystawienia zlecenia
                  </label>
                  <input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-blue-300 rounded-lg bg-blue-50/40 focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono text-blue-950 font-bold"
                  />
                  <span className="text-[11px] text-blue-600 mt-0.5 block">
                    Kiedy zamówiono / zlecono etap
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Planowany termin zakończenia
                  </label>
                  <input
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Oczekiwana realizacja
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Rzeczywista data zakończenia
                  </label>
                  <input
                    type="date"
                    value={completedDate}
                    onChange={(e) => setCompletedDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    Faktyczna gotowość
                  </span>
                </div>
              </div>

              {/* Element-specific fields */}
              <div className="border-t border-slate-200 pt-4">
                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                  Specyfikacja i parametry techniczne
                </h3>

            {item.type === 'ROZDZIELNICA_SN' && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                      Konfiguracja rozdzielnicy SN
                    </span>
                    <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                      Średnie Napięcie (SN)
                    </span>
                  </div>
                  {details.producent && (details.model || details.typRozdzielnicy) && (
                    <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      {details.producent} · {details.model || details.typRozdzielnicy}
                    </span>
                  )}
                </div>

                {snError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <span>{snError}</span>
                  </div>
                )}

                {/* 1. Producent & 2. Model — katalog zarządzany z poziomu formularza */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">1. Producent <span className="text-rose-600">*</span></label>
                    <select value={details.producent || ''} onChange={(e) => handleSnProducerChange(e.target.value)} className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold text-slate-900 cursor-pointer">
                      <option value="">— Wybierz producenta SN —</option>
                      {snCatalog.producers.map((producer) => <option key={producer.name} value={producer.name}>{producer.name}</option>)}
                      {details.producent && !snCatalog.producers.some((producer) => producer.name === details.producent) && <option value={details.producent}>{details.producent} (zapis historyczny)</option>}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">Wybierz producenta z katalogu SN.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">2. Model <span className="text-rose-600">*</span></label>
                    <select value={details.model || details.typRozdzielnicy || ''} onChange={(e) => handleSnModelChange(e.target.value)} disabled={!details.producent} className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold cursor-pointer ${!details.producent ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed' : 'bg-white border-slate-300 text-slate-900'}`}>
                      {!details.producent ? <option value="">Najpierw wybierz producenta...</option> : <>
                        <option value="">— Wybierz model ({details.producent}) —</option>
                        {(snCatalog.producers.find((producer) => producer.name === details.producent)?.models || []).map((model) => <option key={model} value={model}>{model}</option>)}
                        {(details.model || details.typRozdzielnicy) && !(snCatalog.producers.find((producer) => producer.name === details.producent)?.models || []).includes(details.model || details.typRozdzielnicy) && <option value={details.model || details.typRozdzielnicy}>{details.model || details.typRozdzielnicy} (zapis historyczny)</option>}
                      </>}
                    </select>
                    <p className="text-[11px] text-slate-500 mt-1">Lista modeli zależy od wybranego producenta.</p>
                  </div>
                </div>

                <div className="mt-3 border border-slate-200 rounded-lg bg-white">
                  <button type="button" onClick={() => setShowSnCatalogManager((value) => !value)} className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg">
                    <span className="inline-flex items-center gap-2"><Settings2 className="w-4 h-4" /> Zarządzaj producentami i modelami</span><span>{showSnCatalogManager ? 'Ukryj' : 'Otwórz'}</span>
                  </button>
                  {showSnCatalogManager && <div className="p-3 border-t border-slate-200 space-y-3">
                    <p className="text-[11px] text-slate-600">Zmiany zapisują się na serwerze i są wspólne dla użytkowników aplikacji.</p>
                    {snCatalogError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">{snCatalogError}</div>}
                    <div className="flex gap-2">
                      <input value={newSnProducer} onChange={(e) => setNewSnProducer(e.target.value)} placeholder="Nazwa nowego producenta" maxLength={100} className="min-w-0 flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg" />
                      <button type="button" disabled={snCatalogBusy || !newSnProducer.trim()} onClick={addSnProducer} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Dodaj</button>
                    </div>
                    <div className="space-y-3">
                      {snCatalog.producers.map((producer) => <div key={producer.name} className="border border-slate-200 rounded-lg p-3 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {editingSnProducer === producer.name ? <>
                            <input autoFocus value={snRenameValue} onChange={(e) => setSnRenameValue(e.target.value)} className="min-w-0 flex-1 text-xs px-2 py-1.5 border border-slate-300 rounded" />
                            <button type="button" disabled={snCatalogBusy} onClick={() => renameSnProducer(producer.name)} className="p-1.5 text-emerald-700" title="Zapisz nazwę"><Save className="w-4 h-4" /></button>
                            <button type="button" onClick={() => setEditingSnProducer(null)} className="p-1.5 text-slate-500" title="Anuluj"><X className="w-4 h-4" /></button>
                          </> : <>
                            <strong className="text-xs text-slate-800 flex-1">{producer.name}</strong>
                            <button type="button" onClick={() => { setEditingSnProducer(producer.name); setSnRenameValue(producer.name); }} className="p-1.5 text-slate-500 hover:text-blue-700" title="Zmień nazwę producenta"><Pencil className="w-4 h-4" /></button>
                            <button type="button" disabled={snCatalogBusy} onClick={() => deleteSnProducer(producer.name)} className="p-1.5 text-rose-600" title="Usuń producenta"><Trash2 className="w-4 h-4" /></button>
                          </>}
                        </div>
                        <div className="space-y-1.5">
                          {producer.models.map((model) => <div key={model} className="flex items-center gap-2 pl-2">
                            {editingSnModel?.producer === producer.name && editingSnModel.model === model ? <>
                              <input autoFocus value={snRenameValue} onChange={(e) => setSnRenameValue(e.target.value)} className="min-w-0 flex-1 text-xs px-2 py-1.5 border border-slate-300 rounded" />
                              <button type="button" disabled={snCatalogBusy} onClick={() => renameSnModel(producer.name, model)} className="p-1 text-emerald-700" title="Zapisz model"><Save className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => setEditingSnModel(null)} className="p-1 text-slate-500" title="Anuluj"><X className="w-3.5 h-3.5" /></button>
                            </> : <>
                              <span className="text-xs text-slate-600 flex-1">{model}</span>
                              <button type="button" onClick={() => { setEditingSnModel({ producer: producer.name, model }); setSnRenameValue(model); }} className="p-1 text-slate-500 hover:text-blue-700" title="Zmień nazwę modelu"><Pencil className="w-3.5 h-3.5" /></button>
                              <button type="button" disabled={snCatalogBusy} onClick={() => deleteSnModel(producer.name, model)} className="p-1 text-rose-600" title="Usuń model"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>}
                          </div>)}
                          {producer.models.length === 0 && <p className="pl-2 text-[11px] text-slate-400">Brak modeli — dodaj pierwszy poniżej.</p>}
                        </div>
                        <div className="flex gap-2 pt-1">
                          <input value={newSnModel} onChange={(e) => setNewSnModel(e.target.value)} placeholder={`Nowy model dla ${producer.name}`} maxLength={120} className="min-w-0 flex-1 text-xs px-2 py-1.5 border border-slate-300 rounded" />
                          <button type="button" disabled={snCatalogBusy || !newSnModel.trim()} onClick={() => addSnModel(producer.name)} className="inline-flex items-center gap-1 px-2 py-1.5 rounded bg-slate-800 text-white text-[11px] font-bold disabled:opacity-50"><Plus className="w-3 h-3" /> Model</button>
                        </div>
                      </div>)}
                    </div>
                  </div>}
                </div>

                {/* 3. Ilość pól (pole liczbowe) & 4. Konfiguracja pól */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200">
                  {/* 3. Ilość pól */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-800">
                        3. Ilość pól <span className="text-rose-600">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400">liczbowe</span>
                    </div>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={details.liczbaPol ?? details.iloscPol ?? ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDetails((prev) => ({
                          ...prev,
                          liczbaPol: val,
                          iloscPol: val,
                        }));
                        setSnError(null);
                      }}
                      placeholder="np. 3 lub 4"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono font-bold text-slate-900"
                    />
                    <div className="flex items-center gap-1.5 mt-2">
                      <span className="text-[10px] text-slate-400">Szybki wybór:</span>
                      {[2, 3, 4, 5].map((cnt) => (
                        <button
                          key={cnt}
                          type="button"
                          onClick={() => {
                            setDetails((prev) => ({
                              ...prev,
                              liczbaPol: cnt,
                              iloscPol: cnt,
                            }));
                            setSnError(null);
                          }}
                          className={`px-2 py-0.5 text-xs font-mono rounded border cursor-pointer ${
                            Number(details.liczbaPol ?? details.iloscPol) === cnt
                              ? 'bg-blue-600 text-white border-blue-700 font-bold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cnt}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 4. Konfiguracja pól (ręczna edycja, domyślnie L-L-L-T) */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-800">
                        4. Konfiguracja pól
                      </label>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Domyślna wartość: <strong className="text-blue-700">L-L-L-T</strong>
                      </span>
                    </div>

                    <input
                      type="text"
                      value={details.konfiguracjaPol ?? DEFAULT_SN_CONFIG}
                      onChange={(e) => handleDetailChange('konfiguracjaPol', e.target.value)}
                      placeholder="Wpisz konfigurację (np. L-L-T, L-L-L-T, L-L-L-L-T, L-T)..."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono font-bold text-blue-950 tracking-wider"
                    />

                    {/* Szybkie przykłady */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                      <span className="text-[11px] text-slate-500">Przykładowe konfiguracje:</span>
                      {SN_CONFIG_EXAMPLES.map((cfg) => (
                        <button
                          key={cfg}
                          type="button"
                          onClick={() => handleDetailChange('konfiguracjaPol', cfg)}
                          className={`px-2 py-0.5 text-xs font-mono rounded border transition-colors cursor-pointer ${
                            (details.konfiguracjaPol || DEFAULT_SN_CONFIG) === cfg
                              ? 'bg-blue-100 text-blue-800 border-blue-300 font-bold'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cfg}
                        </button>
                      ))}
                    </div>

                    {/* Legenda oznaczeń */}
                    <div className="mt-2.5 p-2.5 bg-blue-50/80 border border-blue-200 rounded-lg text-[11px] text-blue-900 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-blue-950">Znaczenie oznaczeń:</span>
                        <span><strong className="font-mono text-blue-950 bg-blue-100 px-1 py-0.5 rounded">L</strong> — pole liniowe</span>
                        <span>•</span>
                        <span><strong className="font-mono text-blue-950 bg-blue-100 px-1 py-0.5 rounded">T</strong> — pole transformatorowe</span>
                      </div>
                      <span className="text-[10px] text-blue-700 italic">Swobodna edycja ręczna</span>
                    </div>
                  </div>
                </div>

                {/* Parametry techniczne / wyposażenie (zachowaj istniejące dane) */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Parametry techniczne / dodatkowe (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={details.parametryTechniczne || ''}
                    onChange={(e) => handleDetailChange('parametryTechniczne', e.target.value)}
                    placeholder="np. 24 kV, 630A, 16kA/1s, SF6-free"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {item.type === 'ROZDZIELNICA_NN' && (
              <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                {/* 1. Typ rozdzielnicy */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    1. Typ rozdzielnicy NN
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => handleDetailChange('typRozdzielnicy', 'RTS-z')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        (details.typRozdzielnicy || 'RTS-z').includes('RTS-z')
                          ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500 shadow-xs'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-blue-900">RTS-z</span>
                        {(details.typRozdzielnicy || 'RTS-z').includes('RTS-z') && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1">Zawieszana</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">obsługa zewnętrzna</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDetailChange('typRozdzielnicy', 'RTS-w')}
                      className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                        (details.typRozdzielnicy || '').includes('RTS-w')
                          ? 'border-blue-600 bg-blue-50/80 ring-2 ring-blue-500 shadow-xs'
                          : 'border-slate-300 bg-white hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-black text-blue-900">RTS-w</span>
                        {(details.typRozdzielnicy || '').includes('RTS-w') && (
                          <span className="w-2 h-2 rounded-full bg-blue-600" />
                        )}
                      </div>
                      <p className="text-xs font-bold text-slate-800 mt-1">Wolnostojąca</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">obsługa wewnętrzna</p>
                    </button>
                  </div>
                </div>

                {/* 2. Ilość pól */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      2. Ilość pól (odpływów bezpiecznikowych)
                    </label>
                    <span className="text-[11px] text-slate-500">
                      Standard: 8, 10, 20 lub wedle uznania
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    {['8', '10', '20'].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => handleDetailChange('iloscPol', qty)}
                        className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-colors cursor-pointer ${
                          String(details.iloscPol || details.liczbaPol || '8') === qty
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {qty} pól
                      </button>
                    ))}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={details.iloscPol || details.liczbaPol || ''}
                      onChange={(e) => handleDetailChange('iloscPol', e.target.value)}
                      placeholder="np. 8, 10, 20 lub wpisz inną ilość pól..."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                </div>

                {/* 3. Data wystawienia zlecenia & 4. Planowana gotowość do transportu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1">
                      Data wystawienia zlecenia
                    </label>
                    <input
                      type="date"
                      value={details.dataWystawieniaZlecenia || details.dataZlecenia || ''}
                      onChange={(e) => handleDetailChange('dataWystawieniaZlecenia', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                    />
                    <span className="text-[11px] text-slate-500 mt-0.5 block">
                      Data rejestracji zlecenia nN
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-blue-900 mb-1">
                      Planowana gotowość do transportu
                    </label>
                    <input
                      type="date"
                      value={details.planowanaGotowoscTransportu || details.dataWydaniaDoTransportu || ''}
                      onChange={(e) => handleDetailChange('planowanaGotowoscTransportu', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                    />
                    <span className="text-[11px] text-blue-600 mt-0.5 block">
                      Data oczekiwania na wydanie do transportu
                    </span>
                  </div>
                </div>

                {/* Wyposażenie dodatkowe */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Wyposażenie dodatkowe / aparatura (opcjonalnie)
                  </label>
                  <input
                    type="text"
                    value={details.wyposazenieDodatkowe || details.wyposazenie || details.konfiguracja || ''}
                    onChange={(e) => handleDetailChange('wyposazenieDodatkowe', e.target.value)}
                    placeholder="np. Rozłącznik główny 1000A, przekładniki prądowe 1000/5A, odpływy bezpiecznikowe NH2"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>
            )}

            {item.type === 'MOST' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Rodzaj kabla</label>
                    <input
                      type="text"
                      value={details.rodzajKabla || ''}
                      onChange={(e) => handleDetailChange('rodzajKabla', e.target.value)}
                      placeholder="np. Kabel jednożyłowy SN"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Typ / przekrój</label>
                    <input
                      type="text"
                      value={details.typPrzekroj || ''}
                      onChange={(e) => handleDetailChange('typPrzekroj', e.target.value)}
                      placeholder="np. XRUHKXS 1x120 mm² Al"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Długość</label>
                    <input
                      type="text"
                      value={details.dlugosc || ''}
                      onChange={(e) => handleDetailChange('dlugosc', e.target.value)}
                      placeholder="np. 3 x 6.5 m"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Rodzaj głowic</label>
                    <input
                      type="text"
                      value={details.rodzajGlowic || ''}
                      onChange={(e) => handleDetailChange('rodzajGlowic', e.target.value)}
                      placeholder="np. Kątowe Raychem"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Ilość głowic</label>
                    <input
                      type="text"
                      value={details.iloscGlowic || ''}
                      onChange={(e) => handleDetailChange('iloscGlowic', e.target.value)}
                      placeholder="np. 6 szt."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {item.type === 'RYS_AKCEPTACJA' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data wysłania do klienta</label>
                    <input
                      type="date"
                      value={details.dataWyslania || ''}
                      onChange={(e) => handleDetailChange('dataWyslania', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data akceptacji klienta</label>
                    <input
                      type="date"
                      value={details.dataAkceptacji || ''}
                      onChange={(e) => handleDetailChange('dataAkceptacji', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Informacje o zmianach / rewizja</label>
                  <input
                    type="text"
                    value={details.informacjeOZmianach || ''}
                    onChange={(e) => handleDetailChange('informacjeOZmianach', e.target.value)}
                    placeholder="np. Wprowadzono korektę usytuowania przepustów kablowych, Rev 02"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {item.type === 'KOLORY' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kolor obudowy</label>
                    <input
                      type="text"
                      value={details.kolorObudowy || ''}
                      onChange={(e) => handleDetailChange('kolorObudowy', e.target.value)}
                      placeholder="np. RAL 7035 jasnoszary"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kolor drzwi</label>
                    <input
                      type="text"
                      value={details.kolorDrzwi || ''}
                      onChange={(e) => handleDetailChange('kolorDrzwi', e.target.value)}
                      placeholder="np. RAL 7016 antracyt"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kolory dodatkowe (dach/cokół)</label>
                    <input
                      type="text"
                      value={details.koloryDodatkowe || ''}
                      onChange={(e) => handleDetailChange('koloryDodatkowe', e.target.value)}
                      placeholder="np. Dach RAL 7016"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Numery RAL</label>
                    <input
                      type="text"
                      value={details.numeryRal || ''}
                      onChange={(e) => handleDetailChange('numeryRal', e.target.value)}
                      placeholder="np. RAL 7035 / RAL 7016"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {item.type === 'OPISY' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Wymagane opisy i tabliczki</label>
                  <textarea
                    rows={2}
                    value={details.wymaganeOpisy || ''}
                    onChange={(e) => handleDetailChange('wymaganeOpisy', e.target.value)}
                    placeholder="Tabliczka stacji, tabliczki ostrzegawcze, schemat ideowy..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Sposób wykonania oznaczeń</label>
                  <input
                    type="text"
                    value={details.sposobWykonania || ''}
                    onChange={(e) => handleDetailChange('sposobWykonania', e.target.value)}
                    placeholder="np. Grawerowane aluminium, laminat UV nitowany"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {item.type === 'DRZWI' && (() => {
              const currentDoc = (details.numerDokumentu || '').trim();
              const matchedOrder = currentDoc
                ? doorOrders.find((d) => d.numerDokumentu.trim().toLowerCase() === currentDoc.toLowerCase())
                : undefined;
              const overdueInfo = matchedOrder
                ? checkDoorOrderOverdue(matchedOrder.terminZamowienia, matchedOrder.terminDostawy)
                : null;

              return (
                <div className="space-y-3.5 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2 pb-2 border-b border-slate-200">
                    <Layers className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Powiązanie z modułem „Drzwi” (Zamówienia PZD)
                    </span>
                  </div>

                  {/* Document selection */}
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-800">
                      Wybierz zamówienie z modułu „Drzwi” lub wpisz numer
                    </label>

                    {doorOrders.length > 0 && (
                      <select
                        value={currentDoc}
                        onChange={(e) => handleDetailChange('numerDokumentu', e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-slate-900"
                      >
                        <option value="">— Wybierz istniejące zamówienie PZD —</option>
                        {doorOrders.map((d) => (
                          <option key={d.id} value={d.numerDokumentu}>
                            {d.numerDokumentu} ({d.kontrahentRealizacje || d.numeryZl.join(', ')})
                          </option>
                        ))}
                      </select>
                    )}

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={details.numerDokumentu || ''}
                        onChange={(e) => handleDetailChange('numerDokumentu', e.target.value)}
                        placeholder="np. PZD/363/2026"
                        className="flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                      />
                      {currentDoc && (
                        <button
                          type="button"
                          onClick={() => handleDetailChange('numerDokumentu', '')}
                          className="px-2.5 py-2 text-xs text-slate-500 hover:text-rose-600 bg-white border border-slate-200 rounded-lg cursor-pointer"
                        >
                          Wyczyść
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Matched order feedback card */}
                  {matchedOrder && (
                    <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-black text-blue-900">{matchedOrder.numerDokumentu}</span>
                        {overdueInfo?.isOverdue ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            Opóźnione ({overdueInfo.daysDiff} dni)
                          </span>
                        ) : matchedOrder.terminDostawy ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Dostarczone ({formatDatePL(matchedOrder.terminDostawy)})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <Clock className="w-3 h-3 text-amber-600" />
                            W toku
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 block">Termin z zamówienia:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {formatDatePL(matchedOrder.terminZamowienia)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Termin dostawy:</span>
                          <span className="font-mono font-semibold text-slate-800">
                            {matchedOrder.terminDostawy ? formatDatePL(matchedOrder.terminDostawy) : 'Nieustalony'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Additional door specifications */}
                  <div className="pt-2 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Ilość kompletów</label>
                        <input
                          type="text"
                          value={details.ilosc || ''}
                          onChange={(e) => handleDetailChange('ilosc', e.target.value)}
                          placeholder="np. 3 kpl."
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Typ drzwi</label>
                        <input
                          type="text"
                          value={details.typ || ''}
                          onChange={(e) => handleDetailChange('typ', e.target.value)}
                          placeholder="np. Dwuskrzydłowe z żaluzjami wentylacyjnymi"
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Lokalizacja</label>
                        <input
                          type="text"
                          value={details.lokalizacja || ''}
                          onChange={(e) => handleDetailChange('lokalizacja', e.target.value)}
                          placeholder="np. Komora trafo, komora SN/nN"
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Dodatkowe wyposażenie (zamki/klamki)</label>
                        <input
                          type="text"
                          value={details.dodatkoweWyposazenie || ''}
                          onChange={(e) => handleDetailChange('dodatkoweWyposazenie', e.target.value)}
                          placeholder="np. Zamek MasterKey OSD, blokada 90°"
                          className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {(item.type === 'ZAP_SERWISPOL' || item.type === 'ZAP_JK') && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data zapytania</label>
                    <input
                      type="date"
                      value={details.dataZapytania || ''}
                      onChange={(e) => handleDetailChange('dataZapytania', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Informacje o wycenie</label>
                    <input
                      type="text"
                      value={details.informacjeOWycenie || ''}
                      onChange={(e) => handleDetailChange('informacjeOWycenie', e.target.value)}
                      placeholder="np. Wycena SERWISPOL nr 123 na kwotę 4500 zł"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Zakres usługi</label>
                  <input
                    type="text"
                    value={details.zakresUslugi || 'montaż Stacji/Złącza'}
                    onChange={(e) => handleDetailChange('zakresUslugi', e.target.value)}
                    placeholder="montaż Stacji/Złącza"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Domyślny zakres: montaż Stacji/Złącza</p>
                </div>
              </div>
            )}

            {(item.type === 'ZAM_SERWISPOL' || item.type === 'ZAM_JK') && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data zamówienia</label>
                    <input
                      type="date"
                      value={details.dataZamowienia || ''}
                      onChange={(e) => handleDetailChange('dataZamowienia', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Uzgodniony termin wykonania</label>
                    <input
                      type="date"
                      value={details.uzgodnionyTermin || ''}
                      onChange={(e) => handleDetailChange('uzgodnionyTermin', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Zakres zamówienia SERWISPOL</label>
                  <input
                    type="text"
                    value={details.zakresUslugi || 'montaż Stacji/Złącza'}
                    onChange={(e) => handleDetailChange('zakresUslugi', e.target.value)}
                    placeholder="montaż Stacji/Złącza"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Domyślny zakres: montaż Stacji/Złącza</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Informacje dot. wykonania</label>
                  <input
                    type="text"
                    value={details.informacjeDotyczaceWykonania || ''}
                    onChange={(e) => handleDetailChange('informacjeDotyczaceWykonania', e.target.value)}
                    placeholder="np. Montaż na obiekcie inwestora / hali produkcyjnej"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {item.type === 'ZLECENIE_MONTAZU' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data zlecenia</label>
                    <input
                      type="date"
                      value={details.dataZlecenia || ''}
                      onChange={(e) => handleDetailChange('dataZlecenia', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Zakres montażu</label>
                  <textarea
                    rows={2}
                    value={details.zakresMontazu || ''}
                    onChange={(e) => handleDetailChange('zakresMontazu', e.target.value)}
                    placeholder="np. Kompletny montaż aparatury SN, rozdzielnicy nN i instalacji uziemiającej"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {item.type === 'SZAFKA_TELEMECHANIKI' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Typ / model RTU</label>
                    <input
                      type="text"
                      value={details.typ || ''}
                      onChange={(e) => handleDetailChange('typ', e.target.value)}
                      placeholder="np. Mikronika SO-52v21"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Wyposażenie (zasilacz, modem)</label>
                    <input
                      type="text"
                      value={details.wyposazenie || ''}
                      onChange={(e) => handleDetailChange('wyposazenie', e.target.value)}
                      placeholder="np. Bufor 24V DC + akumulatory AGM"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Zakres i funkcjonalność</label>
                  <input
                    type="text"
                    value={details.zakres || ''}
                    onChange={(e) => handleDetailChange('zakres', e.target.value)}
                    placeholder="np. Telesygnalizacja, telesterowanie SN, pomiar prądów"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Informacje techniczne</label>
                  <input
                    type="text"
                    value={details.informacjeTechniczne || ''}
                    onChange={(e) => handleDetailChange('informacjeTechniczne', e.target.value)}
                    placeholder="np. Protokół DNP3 / IEC 60870-5-104"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}

            {item.type === 'POWYKONAWCZA' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Status dokumentacji</label>
                    <input
                      type="text"
                      value={details.statusDokumentacji || ''}
                      onChange={(e) => handleDetailChange('statusDokumentacji', e.target.value)}
                      placeholder="np. W przygotowaniu, Podpisana, Wydana"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data zakończenia</label>
                    <input
                      type="date"
                      value={details.dataZakonczenia || ''}
                      onChange={(e) => handleDetailChange('dataZakonczenia', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {item.type === 'DATA_WYJAZDU' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Data / godzina załadunku</label>
                    <input
                      type="text"
                      value={details.dataTransportu || ''}
                      onChange={(e) => handleDetailChange('dataTransportu', e.target.value)}
                      placeholder="np. 2026-10-22 06:00"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Przewoźnik / HDS</label>
                    <input
                      type="text"
                      value={details.przewoznik || ''}
                      onChange={(e) => handleDetailChange('przewoznik', e.target.value)}
                      placeholder="np. Trans-Dźwig Podlasie"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Adres dostawy</label>
                    <input
                      type="text"
                      value={details.adresDostawy || ''}
                      onChange={(e) => handleDetailChange('adresDostawy', e.target.value)}
                      placeholder="Plac budowy..."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Kontakt na budowie</label>
                    <input
                      type="text"
                      value={details.kontaktNaBudowie || ''}
                      onChange={(e) => handleDetailChange('kontaktNaBudowie', e.target.value)}
                      placeholder="Kierownik budowy tel."
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}

            {item.type === 'DODATKOWE' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Opis wyposażenia</label>
                  <input
                    type="text"
                    value={details.opis || ''}
                    onChange={(e) => handleDetailChange('opis', e.target.value)}
                    placeholder="np. Układ SZR, kompensacja mocy biernej..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Specyfikacja / uwagi</label>
                  <input
                    type="text"
                    value={details.specyfikacja || ''}
                    onChange={(e) => handleDetailChange('specyfikacja', e.target.value)}
                    placeholder="Szczegóły techniczne dodatkowego elementu"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </>
      )}

          {/* Notes */}
          <div className="border-t border-slate-200 pt-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Uwagi do elementu
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Wpisz uwagi, status zamówienia, ewentualne problemy..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
        </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onCancel || onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              {isReadOnly ? 'Zamknij' : 'Anuluj'}
            </button>
            {!isReadOnly && (
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
              >
                <Check className="w-4 h-4" />
                Zapisz zmiany
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
