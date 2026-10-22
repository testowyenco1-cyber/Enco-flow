import React, { useState, useEffect } from 'react';
import {
  OrderItem,
  ItemStatus,
  SN_PRODUCERS,
  SN_MODELS_BY_PRODUCER,
  SNProducer,
  DEFAULT_SN_CONFIG,
  SN_CONFIG_EXAMPLES,
  DoorOrder,
  formatDatePL,
  checkDoorOrderOverdue,
} from '../types/enco';
import { X, Check, AlertCircle, CheckCircle2, Layers, Clock, AlertTriangle, Lock } from 'lucide-react';
import { StatusSwitcher } from './StatusSwitcher';
import { ObudowaForm, ObudowaFormData } from './ObudowaForm';
import { UserRoleProfile, USER_PROFILES, canEditItemType, getItemPermissionHint } from '../types/userRole';
import { DEPARTMENT_OWNERS, getDepartmentsForItemType, getFieldDepartment } from '../utils/departmentOwnership';

interface EditItemModalProps {
  item: OrderItem | null;
  orderItems?: OrderItem[];
  doorOrders?: DoorOrder[];
  isOpen: boolean;
  onClose: () => void;
  onCancel?: () => void;
  onSave: (updatedItem: OrderItem) => void;
  currentProfile?: UserRoleProfile;
}

export const EditItemModal: React.FC<EditItemModalProps> = ({
  item,
  orderItems = [],
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
  const [customSnProducer, setCustomSnProducer] = useState(false);
  const [customSnModel, setCustomSnModel] = useState(false);
  const [snCatalog, setSnCatalog] = useState<{ producers: string[]; modelsByProducer: Record<string, string[]> }>({
    producers: [...SN_PRODUCERS],
    modelsByProducer: { ...SN_MODELS_BY_PRODUCER },
  });
  const [snCatalogMessage, setSnCatalogMessage] = useState<string | null>(null);
  const [snCatalogError, setSnCatalogError] = useState<string | null>(null);

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
        // Persist the default "Nie" explicitly and normalize legacy string values.
        initialDetails.snWPyskowicach =
          initialDetails.snWPyskowicach === true || initialDetails.snWPyskowicach === 'true';
        if (!initialDetails.model && initialDetails.typRozdzielnicy) {
          initialDetails.model = initialDetails.typRozdzielnicy;
        }
        const initialModel = initialDetails.model || initialDetails.typRozdzielnicy || '';
        const initialProducer = initialDetails.producent || '';
        setCustomSnProducer(Boolean(initialProducer && !SN_PRODUCERS.includes(initialProducer as SNProducer)));
        setCustomSnModel(Boolean(initialModel && (!initialProducer || !SN_PRODUCERS.includes(initialProducer as SNProducer) || !(SN_MODELS_BY_PRODUCER[initialProducer as SNProducer] || []).includes(initialModel))));
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

  useEffect(() => {
    if (!isOpen || item?.type !== 'ROZDZIELNICA_SN') return;
    let cancelled = false;
    fetch('/api/sn-catalog')
      .then(async response => {
        if (!response.ok) throw new Error('Nie udało się pobrać katalogu producentów i modeli SN.');
        const data = await response.json();
        if (!data.success || !Array.isArray(data.producers) || !data.modelsByProducer) throw new Error('Nieprawidłowa odpowiedź katalogu SN.');
        if (!cancelled) setSnCatalog({ producers: data.producers, modelsByProducer: data.modelsByProducer });
      })
      .catch(error => {
        if (!cancelled) setSnCatalogError(error instanceof Error ? error.message : 'Błąd pobierania katalogu SN.');
      });
    return () => { cancelled = true; };
  }, [isOpen, item?.id, item?.type]);

  useEffect(() => {
    if (!isOpen || item?.type !== 'ROZDZIELNICA_SN') return;
    const producer = String(details.producent || '');
    const model = String(details.model || details.typRozdzielnicy || '');
    setCustomSnProducer(Boolean(producer && !snCatalog.producers.includes(producer)));
    setCustomSnModel(Boolean(model && (!producer || !(snCatalog.modelsByProducer[producer] || []).includes(model))));
  }, [snCatalog, isOpen, item?.id]);

  // Wszystkie hooki muszą wykonać się przed warunkowym zakończeniem renderowania.
  if (!isOpen || !item) return null;

  const profile = currentProfile || USER_PROFILES.admin;
  const isReadOnly = !canEditItemType(profile, item.type);
  const permHint = getItemPermissionHint(profile, item.type, item.name);
  const departmentOwners = [
    ...getDepartmentsForItemType(item.type).filter((owner) => owner.key === 'pyskowice'),
    ...(item.type === 'ROZDZIELNICA_NN' ? [DEPARTMENT_OWNERS.plochocinska] : []),
  ];

  type TrackingField = { key: string; label: string; type: 'text' | 'date' | 'number' | 'checkbox'; placeholder?: string };
  const extendedTrackingFields: TrackingField[] = (() => {
    switch (item.type) {
      case 'ROZDZIELNICA_NN':
        return [
          { key: 'kategoria', label: 'Kategoria / nr zamówienia NN', type: 'text' },
          { key: 'dostawca', label: 'Dostawca NN', type: 'text' },
          { key: 'dataGotowosciFakt', label: 'Data gotowości - Płochocińska', type: 'date' },
          { key: 'dataPlDostawyPyskowice', label: 'Data dostawy do Pyskowic', type: 'date' },
          { key: 'nnWPyskowicach', label: 'Rozdzielnica NN jest w Pyskowicach', type: 'checkbox' },
        ];
      case 'MOST':
        return [
          { key: 'dataPlDostawyPyskowice', label: 'Data dostawy do Pyskowic', type: 'date' },
          { key: 'mostSNPyskowicach', label: 'Mosty SN są w Pyskowicach', type: 'checkbox' },
        ];
      case 'SZAFKA_TELEMECHANIKI':
        return [
          { key: 'dataGotowosciDokumentacji', label: 'Gotowość dokumentacji telemechaniki', type: 'date' },
          { key: 'dokumentacjaWyslanaDoUzgodnienia', label: 'Dokumentacja wysłana do uzgodnienia', type: 'checkbox' },
          { key: 'typSterownika', label: 'Typ sterownika', type: 'text' },
          { key: 'dataZleceniaSzafy', label: 'Data zlecenia szafy', type: 'date' },
          { key: 'dataOczekiwana', label: 'Oczekiwana data gotowości szafy', type: 'date' },
          { key: 'dataGotowosci', label: 'Faktyczna data gotowości szafy', type: 'date' },
          { key: 'dataPlDostawyPyskowice', label: 'Planowana dostawa telemechaniki do Pyskowic', type: 'date' },
          { key: 'szafkaWPyskowicach', label: 'Szafka telemechaniki w Pyskowicach', type: 'checkbox' },
          { key: 'akumulatorWPyskowicach', label: 'Akumulator w Pyskowicach', type: 'checkbox' },
          { key: 'masztAntenaWPyskowicach', label: 'Maszt i antena w Pyskowicach', type: 'checkbox' },
          { key: 'sensoryNapieciowe', label: 'Sensory napięciowe — typ / ilość', type: 'text' },
          { key: 'dataPlDostawySensorowPyskowice', label: 'Planowana dostawa sensorów do Pyskowic', type: 'date' },
          { key: 'sensoryNapiecioweWPyskowicach', label: 'Sensory napięciowe w Pyskowicach', type: 'checkbox' },
        ];
      case 'TABLICA_POMIAROWA':
      case 'RPW':
        return [
          { key: 'kategoria', label: 'Kategoria', type: 'text' },
          { key: 'dataZlecenia', label: 'Data zlecenia', type: 'date' },
          { key: 'dataDostawyPlan', label: 'Planowana data dostawy', type: 'date' },
          { key: 'dataGotowosciFakt', label: 'Faktyczna data gotowości', type: 'date' },
          { key: 'dataPlDostawyPyskowice', label: 'Planowana dostawa do Pyskowic', type: 'date' },
          { key: 'wPyskowicach', label: 'Element jest w Pyskowicach', type: 'checkbox' },
        ];
      case 'TRANSFORMATOR_POTRZEB_WLASNYCH':
        return [
          { key: 'va', label: 'Moc / VA', type: 'text', placeholder: 'np. 5000 VA' },
          { key: 'dataDostawyPlan', label: 'Planowana data dostawy', type: 'date' },
          { key: 'numerSeryjny', label: 'Numer seryjny', type: 'text' },
          { key: 'dataPlDostawyPyskowice', label: 'Planowana dostawa do Pyskowic', type: 'date' },
          { key: 'wPyskowicach', label: 'Transformator jest w Pyskowicach', type: 'checkbox' },
        ];
      case 'WSKAZNIKI_ZWARC':
        return [
          { key: 'typ', label: 'Typ wskaźników / centralki', type: 'text' },
          { key: 'ilosc', label: 'Ilość', type: 'number' },
          { key: 'dataZamowienia', label: 'Data zamówienia', type: 'date' },
          { key: 'dataPlDostawyPyskowice', label: 'Planowana dostawa do Pyskowic', type: 'date' },
          { key: 'wPyskowicach', label: 'Wskaźniki zwarć są w Pyskowicach', type: 'checkbox' },
        ];
      case 'POWYKONAWCZA':
        return [
          { key: 'dataWysylkiDTR', label: 'Data wysyłki DTR', type: 'date' },
          { key: 'dataPrzekazaniaDokumentacji', label: 'Data wysyłki dokumentacji Powykonawczej', type: 'date' },
        ];
      case 'DATA_WYJAZDU':
        return [
          { key: 'kilometry', label: 'Kilometry transportu', type: 'number' },
          { key: 'cenaTransportu', label: 'Cena transportu (PLN)', type: 'number' },
          { key: 'numerFaktury', label: 'Numer faktury', type: 'text' },
        ];
      default:
        return [];
    }
  })();

  const handleDetailChange = (key: string, val: any) => {
    setDetails((prev) => ({
      ...prev,
      [key]: val,
    }));
  };

  const handleSnProducerChange = (newProducer: string) => {
    if (newProducer === '__CUSTOM__') {
      setCustomSnProducer(true);
      setCustomSnModel(true);
      setDetails((prev) => ({ ...prev, producent: '', model: '', typRozdzielnicy: '', konfiguracjaPol: prev.konfiguracjaPol || DEFAULT_SN_CONFIG }));
      setSnError(null);
      return;
    }
    setCustomSnProducer(false);
    const currentModel = details.model || details.typRozdzielnicy || '';
    const allowed = newProducer ? (snCatalog.modelsByProducer[newProducer] || []) : [];
    const isModelStillValid = allowed.includes(currentModel);
    const nextModel = isModelStillValid && !customSnModel ? currentModel : '';
    setCustomSnModel(false);
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
    if (newModel === '__CUSTOM__') {
      setCustomSnModel(true);
      setDetails((prev) => ({ ...prev, model: '', typRozdzielnicy: '', konfiguracjaPol: prev.konfiguracjaPol || DEFAULT_SN_CONFIG }));
      setSnError(null);
      return;
    }
    setCustomSnModel(false);
    setDetails((prev) => ({
      ...prev,
      model: newModel,
      typRozdzielnicy: newModel,
      konfiguracjaPol: prev.konfiguracjaPol || DEFAULT_SN_CONFIG,
    }));
    setSnError(null);
  };

  const saveSnProducer = async () => {
    const producer = String(details.producent || '').trim();
    if (!producer) return;
    setSnCatalogError(null);
    setSnCatalogMessage(null);
    try {
      const response = await fetch('/api/sn-catalog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ producer }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Nie udało się zapisać producenta.');
      setSnCatalog({ producers: data.producers, modelsByProducer: data.modelsByProducer });
      setDetails(prev => ({ ...prev, producent: data.canonicalProducer || producer, model: '', typRozdzielnicy: '' }));
      setCustomSnProducer(false);
      setCustomSnModel(true);
      setSnCatalogMessage('Producent został zapisany na stałe i będzie dostępny dla wszystkich użytkowników.');
    } catch (error) {
      setSnCatalogError(error instanceof Error ? error.message : 'Błąd zapisu producenta.');
    }
  };

  const saveSnModel = async () => {
    const producer = String(details.producent || '').trim();
    const model = String(details.model || details.typRozdzielnicy || '').trim();
    if (!producer || !model) return;
    setSnCatalogError(null);
    setSnCatalogMessage(null);
    try {
      const response = await fetch('/api/sn-catalog', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ producer, model }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Nie udało się zapisać modelu.');
      const canonicalProducer = data.canonicalProducer || producer;
      setSnCatalog({ producers: data.producers, modelsByProducer: data.modelsByProducer });
      setDetails(prev => ({ ...prev, producent: canonicalProducer, model, typRozdzielnicy: model }));
      setCustomSnProducer(false);
      setCustomSnModel(false);
      setSnCatalogMessage('Model został zapisany na stałe i będzie dostępny przy kolejnych zleceniach.');
    } catch (error) {
      setSnCatalogError(error instanceof Error ? error.message : 'Błąd zapisu modelu.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (item.type === 'ROZDZIELNICA_SN') {
      const activeModel = details.model || details.typRozdzielnicy || '';
      const selectedProducer = String(details.producent || '').trim();
      const selectedModel = String(activeModel || '').trim();
      const isSavedCombination = snCatalog.producers.includes(selectedProducer)
        && (snCatalog.modelsByProducer[selectedProducer] || []).includes(selectedModel);
      const customCombinationValid = isSavedCombination || (
        (customSnProducer || customSnModel) && Boolean(selectedProducer && selectedModel)
      );
      if (!customCombinationValid) {
        setSnError('Wybierz zapisanego producenta i jego model albo najpierw zapisz własne wartości na stałe.');
        return;
      }

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
        // Always save an actual boolean, including false when the switchgear is not yet in Pyskowice.
        snWPyskowicach: details.snWPyskowicach === true || details.snWPyskowicach === 'true',
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

          {departmentOwners.length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Podział procesu — działy</div>
              <div className="flex flex-wrap gap-1.5">
                {departmentOwners.map((owner) => (
                  <span key={owner.key} className={`rounded border px-2 py-1 text-[10px] font-bold ${owner.className}`}>
                    {owner.label}
                  </span>
                ))}
              </div>
              <p className="mt-1.5 text-[10px] text-slate-500">Oznaczenia wskazują obszar procesu, a nie konkretną osobę.</p>
            </div>
          )}

          <div className={isReadOnly ? 'pointer-events-none opacity-85 select-none' : ''}>

          {item.type === 'OBUDOWA' ? (
            <div className="space-y-4 pt-1">
              <ObudowaForm
                initialData={details}
                relatedItems={orderItems}
                onAuxiliaryChange={handleDetailChange}
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
              <div className={`grid grid-cols-1 gap-4 ${item?.type === 'DATA_WYJAZDU' ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                {item?.type !== 'DATA_WYJAZDU' && <div>
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
                </div>}
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {item?.type === 'DATA_WYJAZDU' ? 'Planowana data wyjazdu' : 'Planowany termin zakończenia'}
                  </label>
                  <input
                    type="date"
                    value={plannedDate}
                    onChange={(e) => setPlannedDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {item?.type === 'DATA_WYJAZDU' ? 'Planowany termin wyjazdu' : 'Oczekiwana realizacja'}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    {item?.type === 'DATA_WYJAZDU' ? 'Rzeczywista data wyjazdu' : 'Rzeczywista data zakończenia'}
                  </label>
                  <input
                    type="date"
                    value={completedDate}
                    onChange={(e) => setCompletedDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
                  />
                  <span className="text-[11px] text-slate-400 mt-0.5 block">
                    {item?.type === 'DATA_WYJAZDU' ? 'Data faktycznego wyjazdu' : 'Faktyczna gotowość'}
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

                {/* 1. Producent & 2. Model (w dwóch prostych krokach) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {snCatalogMessage && <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">{snCatalogMessage}</div>}
                  {snCatalogError && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">{snCatalogError}</div>}
                  {/* Krok 1: Producent */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      1. Producent <span className="text-rose-600">*</span>
                    </label>
                    {!customSnProducer ? (
                      <select
                        value={details.producent || ''}
                        onChange={(e) => handleSnProducerChange(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold text-slate-900 cursor-pointer"
                      >
                        <option value="">— Wybierz producenta SN —</option>
                        {snCatalog.producers.map((prod) => <option key={prod} value={prod}>{prod}</option>)}
                        <option value="__CUSTOM__">+ Wpisz własnego producenta</option>
                      </select>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          autoFocus
                          value={details.producent || ''}
                          onChange={(e) => handleDetailChange('producent', e.target.value)}
                          placeholder="Wpisz nazwę producenta"
                          className="w-full text-xs px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold text-slate-900"
                        />
                        <button type="button" onClick={() => void saveSnProducer()} disabled={!String(details.producent || '').trim()} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Zapisz producenta na stałe</button>
                        <button type="button" onClick={() => { setCustomSnProducer(false); setCustomSnModel(false); setDetails(prev => ({ ...prev, producent: '', model: '', typRozdzielnicy: '' })); }} className="text-[11px] text-blue-700 hover:underline">Wybierz z listy producentów</button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1">
                      Możesz wybrać z listy lub wpisać własnego producenta.
                    </p>
                  </div>

                  {/* Krok 2: Model (zależny od wybranego producenta) */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      2. Model <span className="text-rose-600">*</span>
                    </label>
                    {!customSnModel ? (
                      <select
                        value={details.model || details.typRozdzielnicy || ''}
                        onChange={(e) => handleSnModelChange(e.target.value)}
                        disabled={!details.producent}
                        className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold cursor-pointer ${
                          !details.producent
                            ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-white border-slate-300 text-slate-900'
                        }`}
                      >
                        {!details.producent ? <option value="">Najpierw wybierz producenta...</option> : (
                          <>
                            <option value="">— Wybierz model ({details.producent}) —</option>
                            {(snCatalog.modelsByProducer[details.producent] || []).map((mod) => <option key={mod} value={mod}>{mod}</option>)}
                            <option value="__CUSTOM__">+ Wpisz własny model</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <div className="space-y-1.5">
                        <input
                          value={details.model || details.typRozdzielnicy || ''}
                          onChange={(e) => {
                            const value = e.target.value;
                            setDetails((prev) => ({ ...prev, model: value, typRozdzielnicy: value, konfiguracjaPol: prev.konfiguracjaPol || DEFAULT_SN_CONFIG }));
                            setSnError(null);
                          }}
                          placeholder="Wpisz nazwę modelu"
                          className="w-full text-xs px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold text-slate-900"
                        />
                        <button type="button" onClick={() => void saveSnModel()} disabled={!String(details.producent || '').trim() || !String(details.model || details.typRozdzielnicy || '').trim()} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">Zapisz model na stałe</button>
                        <button type="button" onClick={() => { setCustomSnModel(false); setDetails(prev => ({ ...prev, model: '', typRozdzielnicy: '' })); }} className="text-[11px] text-blue-700 hover:underline">Wybierz model z listy</button>
                      </div>
                    )}
                    <p className="text-[11px] text-slate-500 mt-1">
                      {details.producent === 'Schneider Electric' && 'Schneider Electric → AirSeT'}
                      {details.producent === 'EATON' && 'EATON → Xiria'}
                      {details.producent === 'Siemens' && 'Siemens → 8DJH 24 Blue GIS'}
                      {!details.producent && 'Lista modeli zależna od producenta'}
                    </p>
                  </div>
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

                {/* Dane logistyczne rozdzielnicy SN */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Numer seryjny</label>
                    <input
                      type="text"
                      value={details.numerSeryjny || ''}
                      onChange={(e) => handleDetailChange('numerSeryjny', e.target.value)}
                      placeholder="Numer seryjny producenta"
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Data dostawy plan.</label>
                    <input
                      type="date"
                      value={details.dataDostawyPlan || ''}
                      onChange={(e) => handleDetailChange('dataDostawyPlan', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Data dostawy fakt.</label>
                    <input
                      type="date"
                      value={details.dataDostawyFakt || ''}
                      onChange={(e) => handleDetailChange('dataDostawyFakt', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Data pl. dos. do Pyskowic</label>
                    <input
                      type="date"
                      value={details.dataPlDostawyPyskowice || ''}
                      onChange={(e) => handleDetailChange('dataPlDostawyPyskowice', e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">SN w Pyskowicach</label>
                    <select
                      value={details.snWPyskowicach === true || details.snWPyskowicach === 'true' ? 'true' : 'false'}
                      onChange={(e) => handleDetailChange('snWPyskowicach', e.target.value === 'true')}
                      className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-semibold"
                    >
                      <option value="false">Nie</option>
                      <option value="true">Tak</option>
                    </select>
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

            {extendedTrackingFields.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Dodatkowe dane procesu i dostawy</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {extendedTrackingFields.map((field) => {
                    const owner = getFieldDepartment(item.type, field.key);
                    return (
                      <div key={field.key} className={field.type === 'checkbox' ? 'flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5' : 'min-w-0'}>
                        {field.type === 'checkbox' ? (
                          <>
                            <input
                              type="checkbox"
                              checked={Boolean(details[field.key])}
                              disabled={isReadOnly}
                              onChange={(e) => handleDetailChange(field.key, e.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="min-w-0">
                              <label className="text-xs font-medium text-slate-700">{field.label}</label>
                              {owner?.key === 'pyskowice' && <span className={`ml-2 inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold ${owner.className}`}>{owner.shortLabel}</span>}
                            </div>
                          </>
                        ) : (
                          <>
                            <label className="mb-1 flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-700">
                              <span>{field.label}</span>
                              {owner?.key === 'pyskowice' && <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-bold ${owner.className}`}>{owner.shortLabel}</span>}
                            </label>
                            <input
                              type={field.type}
                              value={details[field.key] ?? ''}
                              disabled={isReadOnly}
                              onChange={(e) => handleDetailChange(field.key, e.target.value)}
                              placeholder={field.placeholder || ''}
                              min={field.type === 'number' ? '0' : undefined}
                              className="w-full min-w-0 text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </>
                        )}
                      </div>
                    );
                  })}
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
