import React, { useState, useEffect } from 'react';
import {
  OrderItem,
  ItemStatus,
  Attachment,
  SN_PRODUCERS,
  SN_MODELS_BY_PRODUCER,
  SNProducer,
  DEFAULT_SN_CONFIG,
  SN_CONFIG_EXAMPLES,
  validateSNCombination,
  formatDimensionM,
  checkReadinessOverdue,
  DoorOrder,
} from '../types/enco';
import { StatusSwitcher } from './StatusSwitcher';
import { AttachmentList } from './AttachmentList';
import { ObudowaForm } from './ObudowaForm';
import { DoorForm } from './DoorForm';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Edit2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Send,
  Lock,
} from 'lucide-react';
import { UserRoleProfile, USER_PROFILES, canEditItemType, getItemPermissionHint } from '../types/userRole';

interface ItemDetailsCardProps {
  item: OrderItem;
  orderItems?: OrderItem[];
  orderNumber: string;
  doorOrders?: DoorOrder[];
  onStatusChange: (newStatus: ItemStatus) => void;
  onUpdateNotes: (notes: string) => void;
  onUpdateDates: (orderDate: string, plannedDate: string, completedDate: string) => void;
  onUpdateDetails?: (details: Record<string, any>) => void;
  onOpenEditModal: () => void;
  onAddAttachment: (attachment: Attachment) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onNavigateToDoorModule?: (numerDokumentu?: string) => void;
  onCreateDoorOrderForStation?: () => void;
  currentProfile?: UserRoleProfile;
  onOpenFolderManager?: (folderKey?: string) => void;
}

export const ItemDetailsCard: React.FC<ItemDetailsCardProps> = ({
  item,
  orderItems = [],
  orderNumber,
  doorOrders = [],
  onStatusChange,
  onUpdateNotes,
  onUpdateDates,
  onUpdateDetails,
  onOpenEditModal,
  onAddAttachment,
  onDeleteAttachment,
  onNavigateToDoorModule,
  onCreateDoorOrderForStation,
  currentProfile,
  onOpenFolderManager,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const canEdit = canEditItemType(profile, item.type);
  const permHint = getItemPermissionHint(profile, item.type, item.name);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesInput, setNotesInput] = useState(item.notes || '');
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [orderDateInput, setOrderDateInput] = useState(item.orderDate || '');
  const [plannedDateInput, setPlannedDateInput] = useState(item.plannedDate || '');
  const [completedDateInput, setCompletedDateInput] = useState(item.completedDate || '');

  useEffect(() => {
    setNotesInput(item.notes || '');
    setOrderDateInput(item.orderDate || '');
    setPlannedDateInput(item.plannedDate || '');
    setCompletedDateInput(item.completedDate || '');
  }, [item.notes, item.orderDate, item.plannedDate, item.completedDate]);

  const handleSaveNotes = () => {
    onUpdateNotes(notesInput);
    setIsEditingNotes(false);
  };

  const handleSaveDates = () => {
    onUpdateDates(orderDateInput, plannedDateInput, completedDateInput);
    setIsEditingDate(false);
  };

  const handleUpdateNN = (key: string, value: string) => {
    if (onUpdateDetails) {
      onUpdateDetails({
        ...item.details,
        [key]: value,
      });
    }
  };

  const handleUpdateSNProducer = (newProducer: string) => {
    if (!onUpdateDetails) return;
    const currentModel = item.details?.model || item.details?.typRozdzielnicy || '';
    const allowed = newProducer ? (SN_MODELS_BY_PRODUCER[newProducer as SNProducer] || []) : [];
    const isModelValid = allowed.includes(currentModel);
    const nextModel = isModelValid ? currentModel : '';

    onUpdateDetails({
      ...item.details,
      producent: newProducer,
      model: nextModel,
      typRozdzielnicy: nextModel,
      konfiguracjaPol: item.details?.konfiguracjaPol || DEFAULT_SN_CONFIG,
    });
  };

  const handleUpdateSNModel = (newModel: string) => {
    if (!onUpdateDetails) return;
    onUpdateDetails({
      ...item.details,
      model: newModel,
      typRozdzielnicy: newModel,
      konfiguracjaPol: item.details?.konfiguracjaPol || DEFAULT_SN_CONFIG,
    });
  };

  const handleUpdateSNField = (key: string, value: any) => {
    if (!onUpdateDetails) return;
    onUpdateDetails({
      ...item.details,
      [key]: value,
    });
  };

  // Render element-specific details list
  const renderDetailsSummary = () => {
    const d = item.details || {};
    const entries: { label: string; value: string }[] = [];

    switch (item.type) {
      case 'ROZDZIELNICA_SN':
        if (d.producent) entries.push({ label: 'Producent', value: d.producent });
        const snModel = d.model || d.typRozdzielnicy;
        if (snModel) entries.push({ label: 'Model rozdzielnicy', value: snModel });
        const polCount = d.liczbaPol ?? d.iloscPol;
        if (polCount !== undefined && polCount !== '') {
          entries.push({ label: 'Ilość pól', value: `${polCount} pola` });
        }
        const snConfig = d.konfiguracjaPol || DEFAULT_SN_CONFIG;
        entries.push({
          label: 'Konfiguracja pól',
          value: `${snConfig} (L: liniowe, T: transformatorowe)`,
        });
        if (d.numerSeryjny) entries.push({ label: 'Numer seryjny', value: String(d.numerSeryjny) });
        const formatSNDate = (value: unknown) =>
          typeof value === 'string' && value ? value.split('-').reverse().join('.') : '';
        if (d.dataDostawyPlan) entries.push({ label: 'Data dostawy plan.', value: formatSNDate(d.dataDostawyPlan) });
        if (d.dataDostawyFakt) entries.push({ label: 'Data dostawy fakt.', value: formatSNDate(d.dataDostawyFakt) });
        if (d.dataPlDostawyPyskowice) entries.push({ label: 'Data pl. dos. do Pyskowic', value: formatSNDate(d.dataPlDostawyPyskowice) });
        entries.push({ label: 'SN w Pyskowicach', value: d.snWPyskowicach ? 'Tak' : 'Nie' });
        if (d.parametryTechniczne) {
          entries.push({ label: 'Parametry techniczne', value: d.parametryTechniczne });
        }
        break;

      case 'ROZDZIELNICA_NN':
        const typVal = d.typRozdzielnicy || d.typ || 'RTS-z';
        const typFormatted = typVal.includes('RTS-z')
          ? 'RTS-z — zawieszana, obsługa zewnętrzna'
          : typVal.includes('RTS-w')
          ? 'RTS-w — wolnostojąca, obsługa wewnętrzna'
          : typVal;
        entries.push({ label: 'Typ rozdzielnicy', value: typFormatted });

        const polVal = d.iloscPol || d.liczbaPol || '8';
        entries.push({ label: 'Ilość pól', value: `${polVal} pól (odpływów)` });

        const zlecData = d.dataWystawieniaZlecenia || d.dataZlecenia;
        if (zlecData) {
          entries.push({
            label: 'Data wystawienia zlecenia',
            value: zlecData.split('-').reverse().join('.'),
          });
        }

        const transpData = d.planowanaGotowoscTransportu || d.dataWydaniaDoTransportu;
        if (transpData) {
          entries.push({
            label: 'Planowana gotowość do transportu',
            value: transpData.split('-').reverse().join('.'),
          });
        }

        const wypVal = d.wyposazenieDodatkowe || d.wyposazenie || d.konfiguracja;
        if (wypVal) {
          entries.push({ label: 'Wyposażenie dodatkowe', value: wypVal });
        }
        break;

      case 'MOST':
        if (d.rodzajKabla) entries.push({ label: 'Rodzaj kabla', value: d.rodzajKabla });
        if (d.typPrzekroj) entries.push({ label: 'Typ / przekrój', value: d.typPrzekroj });
        if (d.dlugosc) entries.push({ label: 'Długość', value: d.dlugosc });
        if (d.rodzajGlowic) entries.push({ label: 'Rodzaj głowic', value: d.rodzajGlowic });
        if (d.iloscGlowic) entries.push({ label: 'Ilość głowic', value: d.iloscGlowic });
        if (d.terminRealizacji) entries.push({ label: 'Termin realizacji', value: d.terminRealizacji });
        break;

      case 'RYS_AKCEPTACJA':
        if (d.dataWyslania) entries.push({ label: 'Data wysłania', value: d.dataWyslania });
        if (d.dataAkceptacji) entries.push({ label: 'Data akceptacji', value: d.dataAkceptacji });
        if (d.informacjeOZmianach) entries.push({ label: 'Informacje o zmianach', value: d.informacjeOZmianach });
        break;

      case 'KOLORY':
        if (d.kolorObudowy) entries.push({ label: 'Kolor obudowy', value: d.kolorObudowy });
        if (d.kolorDrzwi) entries.push({ label: 'Kolor drzwi', value: d.kolorDrzwi });
        if (d.koloryDodatkowe) entries.push({ label: 'Kolory dodatkowe', value: d.koloryDodatkowe });
        if (d.numeryRal) entries.push({ label: 'Numery RAL', value: d.numeryRal });
        break;

      case 'OPISY':
        if (d.wymaganeOpisy) entries.push({ label: 'Wymagane opisy', value: d.wymaganeOpisy });
        if (d.sposobWykonania) entries.push({ label: 'Sposób wykonania', value: d.sposobWykonania });
        break;

      case 'DRZWI':
        if (d.numerDokumentu) entries.push({ label: 'Dokument zamówienia (PZD)', value: d.numerDokumentu });
        if (d.ilosc) entries.push({ label: 'Ilość', value: d.ilosc });
        if (d.typ) entries.push({ label: 'Typ', value: d.typ });
        if (d.lokalizacja) entries.push({ label: 'Lokalizacja', value: d.lokalizacja });
        if (d.dodatkoweWyposazenie) entries.push({ label: 'Dodatkowe wyposażenie', value: d.dodatkoweWyposazenie });
        break;

      case 'ZAP_SERWISPOL':
      case 'ZAP_JK':
        if (d.dataZapytania) entries.push({ label: 'Data zapytania', value: d.dataZapytania });
        entries.push({ label: 'Zakres usługi', value: d.zakresUslugi || 'montaż Stacji/Złącza' });
        if (d.informacjeOWycenie) entries.push({ label: 'Informacje o wycenie', value: d.informacjeOWycenie });
        break;

      case 'ZAM_SERWISPOL':
      case 'ZAM_JK':
        if (d.dataZamowienia) entries.push({ label: 'Data zamówienia', value: d.dataZamowienia });
        entries.push({ label: 'Zakres usługi', value: d.zakresUslugi || 'montaż Stacji/Złącza' });
        if (d.uzgodnionyTermin) entries.push({ label: 'Uzgodniony termin', value: d.uzgodnionyTermin });
        if (d.informacjeDotyczaceWykonania) entries.push({ label: 'Informacje dot. wykonania', value: d.informacjeDotyczaceWykonania });
        break;

      case 'ZLECENIE_MONTAZU':
        if (d.zakresMontazu) entries.push({ label: 'Zakres montażu', value: d.zakresMontazu });
        if (d.dataZlecenia) entries.push({ label: 'Data zlecenia', value: d.dataZlecenia });
        break;

      case 'SZAFKA_TELEMECHANIKI':
        if (d.typ) entries.push({ label: 'Typ szafki RTU', value: d.typ });
        if (d.wyposazenie) entries.push({ label: 'Wyposażenie', value: d.wyposazenie });
        if (d.zakres) entries.push({ label: 'Zakres', value: d.zakres });
        if (d.informacjeTechniczne) entries.push({ label: 'Informacje techniczne', value: d.informacjeTechniczne });
        break;

      case 'POWYKONAWCZA':
        if (d.statusDokumentacji) entries.push({ label: 'Status dokumentacji', value: d.statusDokumentacji });
        if (d.dataZakonczenia) entries.push({ label: 'Data zakończenia', value: d.dataZakonczenia });
        break;

      case 'OBUDOWA': {
        const koloryItem = orderItems.find((related) => related.type === 'KOLORY');
        const opisyItem = orderItems.find((related) => related.type === 'OPISY');
        const kolory = koloryItem?.details || {};
        const opisy = opisyItem?.details || {};
        const typName =
          d.typObudowy === 'NZ'
            ? 'NZ — obudowa zewnętrzna'
            : d.typObudowy === 'BEK'
            ? 'BEK — obudowa wewnętrzna'
            : (d.typObudowy || 'BEK');
        entries.push({ label: 'Typ obudowy', value: typName });
        if (d.rozmiar) entries.push({ label: 'Rozmiar obudowy', value: d.rozmiar });
        if (d.szerokosc !== undefined && d.glebokosc !== undefined) {
          const w = formatDimensionM(d.szerokosc);
          const dep = formatDimensionM(d.glebokosc);
          const h = formatDimensionM(d.wysokosc);
          const hLabel =
            d.typWysokosci ||
            (d.typObudowy === 'NZ'
              ? 'wysokość zewnętrzna'
              : 'wysokość wewnętrzna pomieszczeń');
          entries.push({
            label: 'Wymiary rzeczywiste',
            value: `${w} × ${dep} × ${h} (${hLabel})`,
          });
        } else if (d.wymiary) {
          entries.push({ label: 'Wymiary', value: d.wymiary });
        }
        if (d.dataGotowosci) {
          const parts = d.dataGotowosci.split('-');
          const fDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : d.dataGotowosci;
          entries.push({ label: 'Data gotowości', value: fDate });
        }
        if (d.przepustyNN) entries.push({ label: 'Przepusty NN', value: d.przepustyNN });
        if (d.przepustySN) entries.push({ label: 'Przepusty SN', value: d.przepustySN });
        if (d.pokrywyNN) entries.push({ label: 'Pokrywy NN', value: d.pokrywyNN });
        if (d.pokrywyNNSaWPyskowicach !== undefined) entries.push({ label: 'Pokrywy NN w Pyskowicach', value: d.pokrywyNNSaWPyskowicach ? 'Tak' : 'Nie' });
        if (d.pokrywySN) entries.push({ label: 'Pokrywy SN', value: d.pokrywySN });
        if (d.pokrywySNSaWPyskowicach !== undefined) entries.push({ label: 'Pokrywy SN w Pyskowicach', value: d.pokrywySNSaWPyskowicach ? 'Tak' : 'Nie' });
        if (d.wkladkiSN) entries.push({ label: 'Wkładki SN', value: d.wkladkiSN });
        if (d.wkladkiSNSaWPyskowicach !== undefined) entries.push({ label: 'Wkładki SN w Pyskowicach', value: d.wkladkiSNSaWPyskowicach ? 'Tak' : 'Nie' });
        if (kolory.kolorObudowy) entries.push({ label: 'Kolor obudowy', value: kolory.kolorObudowy });
        if (kolory.kolorDrzwi) entries.push({ label: 'Kolor drzwi', value: kolory.kolorDrzwi });
        if (kolory.koloryDodatkowe) entries.push({ label: 'Kolory dodatkowe', value: kolory.koloryDodatkowe });
        if (kolory.numeryRal) entries.push({ label: 'Numery RAL', value: kolory.numeryRal });
        if (opisy.wymaganeOpisy) entries.push({ label: 'Wymagane opisy', value: opisy.wymaganeOpisy });
        if (opisy.sposobWykonania) entries.push({ label: 'Sposób wykonania opisów', value: opisy.sposobWykonania });
        break;
      }

      case 'DATA_WYJAZDU':
        if (d.dataTransportu) entries.push({ label: 'Godzina/data załadunku', value: d.dataTransportu });
        if (d.przewoznik) entries.push({ label: 'Przewoźnik / HDS', value: d.przewoznik });
        if (d.adresDostawy) entries.push({ label: 'Adres dostawy', value: d.adresDostawy });
        if (d.kontaktNaBudowie) entries.push({ label: 'Kontakt na budowie', value: d.kontaktNaBudowie });
        break;

      case 'DODATKOWE':
        if (d.opis) entries.push({ label: 'Opis', value: d.opis });
        if (d.specyfikacja) entries.push({ label: 'Specyfikacja', value: d.specyfikacja });
        break;

      default:
        Object.entries(d).forEach(([key, val]) => {
          if (val) entries.push({ label: key, value: String(val) });
        });
    }

    if (entries.length === 0) {
      return (
        <div className="text-xs text-slate-400 italic">
          Brak skonfigurowanych parametrów technicznych.
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-y-2 gap-x-4">
        {entries.map((entry, idx) => (
          <div key={idx} className="text-xs">
            <span className="text-slate-500 font-medium block">{entry.label}:</span>
            <span className="text-slate-900 font-semibold">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const isProblem = item.status === 'PROBLEM';
  const isReady = item.status === 'READY';
  const isInProgress = item.status === 'IN_PROGRESS';
  const isOrdered = item.status === 'ORDERED';

  let cardContainerClass = 'bg-white border-slate-200 border-l-4 border-l-slate-400 shadow-2xs';
  let headerBgClass = 'bg-slate-50/80 border-b border-slate-200';
  let shortNameBadgeClass = 'bg-slate-200 text-slate-800 border-slate-300';

  if (isProblem) {
    cardContainerClass = 'bg-white border-rose-300 border-l-4 border-l-rose-600 shadow-xs ring-1 ring-rose-200';
    headerBgClass = 'bg-rose-50/70 border-b border-rose-200';
    shortNameBadgeClass = 'bg-rose-600 text-white border-rose-700 font-black shadow-2xs';
  } else if (isReady) {
    cardContainerClass = 'bg-white border-emerald-300 border-l-4 border-l-emerald-600 shadow-2xs';
    headerBgClass = 'bg-emerald-50/70 border-b border-emerald-200';
    shortNameBadgeClass = 'bg-emerald-600 text-white border-emerald-700 font-black shadow-2xs';
  } else if (isInProgress) {
    cardContainerClass = 'bg-white border-amber-300 border-l-4 border-l-amber-500 shadow-2xs';
    headerBgClass = 'bg-amber-50/70 border-b border-amber-200';
    shortNameBadgeClass = 'bg-amber-500 text-slate-950 border-amber-600 font-black shadow-2xs';
  } else if (isOrdered) {
    cardContainerClass = 'bg-white border-blue-300 border-l-4 border-l-blue-600 shadow-2xs';
    headerBgClass = 'bg-blue-50/70 border-b border-blue-200';
    shortNameBadgeClass = 'bg-blue-600 text-white border-blue-700 font-black shadow-2xs';
  }

  const renderSNForm = () => {
    const d = item.details || {};
    const producerVal = d.producent || '';
    const modelVal = d.model || d.typRozdzielnicy || '';
    const polVal = d.liczbaPol ?? d.iloscPol ?? '';
    const configVal = d.konfiguracjaPol ?? DEFAULT_SN_CONFIG;
    const technicalVal = d.parametryTechniczne || '';

    const comboValidation = validateSNCombination(producerVal, modelVal);
    const isComboValid = comboValidation.isValid;

    return (
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
        {/* Header summary of SN switchgear */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Parametry rozdzielnicy SN
            </span>
            <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
              SN (Średnie Napięcie)
            </span>
          </div>

          {producerVal && modelVal && isComboValid ? (
            <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1.5 shadow-2xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <strong>{producerVal}</strong> · {modelVal} · {polVal || 3}p ({configVal})
            </span>
          ) : (
            <span className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              Wybierz producenta i kompatybilny model
            </span>
          )}
        </div>

        {/* 1. Producent & 2. Model (Dwa proste kroki) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Krok 1: Producent */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                1. Producent SN <span className="text-rose-600">*</span>
              </label>
              {producerVal && (
                <span className="text-[11px] font-mono text-blue-700 font-bold">
                  {producerVal}
                </span>
              )}
            </div>

            <select
              value={producerVal}
              onChange={(e) => handleUpdateSNProducer(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold text-slate-900 cursor-pointer shadow-2xs"
            >
              <option value="">— Wybierz producenta —</option>
              {SN_PRODUCERS.map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Dostępni producenci: Schneider Electric, EATON, Siemens
            </p>
          </div>

          {/* Krok 2: Model */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                2. Model rozdzielnicy <span className="text-rose-600">*</span>
              </label>
              {modelVal && (
                <span className="text-[11px] font-mono text-blue-700 font-bold">
                  {modelVal}
                </span>
              )}
            </div>

            <select
              value={modelVal}
              onChange={(e) => handleUpdateSNModel(e.target.value)}
              disabled={!producerVal}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-semibold cursor-pointer shadow-2xs ${
                !producerVal
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-300 text-slate-900'
              }`}
            >
              {!producerVal ? (
                <option value="">Najpierw wybierz producenta...</option>
              ) : (
                <>
                  <option value="">— Wybierz model ({producerVal}) —</option>
                  {(SN_MODELS_BY_PRODUCER[producerVal as SNProducer] || []).map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </>
              )}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {producerVal === 'Schneider Electric' && 'Schneider Electric → AirSeT'}
              {producerVal === 'EATON' && 'EATON → Xiria'}
              {producerVal === 'Siemens' && 'Siemens → 8DJH 24 Blue GIS'}
              {!producerVal && 'Wybierz producenta w kroku 1, aby odblokować model'}
            </p>
          </div>
        </div>

        {/* 3. Ilość pól (pole liczbowe) & 4. Konfiguracja pól */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-200">
          {/* 3. Ilość pól */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                3. Ilość pól <span className="text-rose-600">*</span>
              </label>
              <span className="text-[11px] text-slate-400">pole liczbowe</span>
            </div>
            <input
              type="number"
              min={1}
              step={1}
              value={polVal}
              onChange={(e) => {
                const val = e.target.value;
                handleUpdateSNField('liczbaPol', val);
                handleUpdateSNField('iloscPol', val);
              }}
              placeholder="np. 3 lub 4"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono font-bold text-slate-900 shadow-2xs"
            />
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-400">Wybierz:</span>
              {[2, 3, 4, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    handleUpdateSNField('liczbaPol', cnt);
                    handleUpdateSNField('iloscPol', cnt);
                  }}
                  className={`px-2 py-0.5 text-xs font-mono rounded border cursor-pointer ${
                    Number(polVal) === cnt
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
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                4. Konfiguracja pól
              </label>
              <span className="text-[11px] text-slate-500 font-mono">
                Domyślna: <strong className="text-blue-700">L-L-L-T</strong>
              </span>
            </div>

            <input
              type="text"
              value={configVal}
              onChange={(e) => handleUpdateSNField('konfiguracjaPol', e.target.value)}
              placeholder="Wpisz konfigurację (np. L-L-T, L-L-L-T, L-L-L-L-T, L-T)..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono font-bold text-blue-950 tracking-wider shadow-2xs"
            />

            {/* Szybkie przykłady konfiguracji */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[11px] text-slate-500">Przykłady:</span>
              {SN_CONFIG_EXAMPLES.map((cfg) => (
                <button
                  key={cfg}
                  type="button"
                  onClick={() => handleUpdateSNField('konfiguracjaPol', cfg)}
                  className={`px-2 py-0.5 text-xs font-mono rounded border transition-colors cursor-pointer ${
                    configVal === cfg
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
              value={d.numerSeryjny || ''}
              onChange={(e) => handleUpdateSNField('numerSeryjny', e.target.value)}
              placeholder="Numer seryjny producenta"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Data dostawy plan.</label>
            <input
              type="date"
              value={d.dataDostawyPlan || ''}
              onChange={(e) => handleUpdateSNField('dataDostawyPlan', e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Data dostawy fakt.</label>
            <input
              type="date"
              value={d.dataDostawyFakt || ''}
              onChange={(e) => handleUpdateSNField('dataDostawyFakt', e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Data pl. dos. do Pyskowic</label>
            <input
              type="date"
              value={d.dataPlDostawyPyskowice || ''}
              onChange={(e) => handleUpdateSNField('dataPlDostawyPyskowice', e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">SN w Pyskowicach</label>
            <select
              value={String(Boolean(d.snWPyskowicach))}
              onChange={(e) => handleUpdateSNField('snWPyskowicach', e.target.value === 'true')}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-semibold"
            >
              <option value="false">Nie</option>
              <option value="true">Tak</option>
            </select>
          </div>
        </div>

        {/* Parametry techniczne / wyposażenie dodatkowe SN */}
        <div className="pt-2 border-t border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Parametry techniczne / wyposażenie (opcjonalnie)
          </label>
          <input
            type="text"
            value={technicalVal}
            onChange={(e) => handleUpdateSNField('parametryTechniczne', e.target.value)}
            placeholder="np. 24 kV, 630A, 16kA/1s, SF6-free, zabezpieczenie SEPAM..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>
    );
  };

  const renderNNForm = () => {
    const d = item.details || {};
    const typVal = d.typRozdzielnicy || d.typ || 'RTS-z';
    const isRTSz = typVal.includes('RTS-z');
    const isRTSw = typVal.includes('RTS-w');
    const iloscVal = String(d.iloscPol || d.liczbaPol || '8');
    const dataWystawienia = d.dataWystawieniaZlecenia || d.dataZlecenia || '';
    const gotowoscTransportu = d.planowanaGotowoscTransportu || d.dataWydaniaDoTransportu || '';
    const wyposazenieVal = d.wyposazenieDodatkowe || d.wyposazenie || d.konfiguracja || '';

    return (
      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
        {/* 1. Typ rozdzielnicy */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              1. Typ rozdzielnicy NN
            </label>
            <span className="text-[11px] text-slate-500 font-mono">
              Wybrany: <strong className="text-blue-700">{isRTSw ? 'RTS-w' : 'RTS-z'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleUpdateNN('typRozdzielnicy', 'RTS-z')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                isRTSz
                  ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500 shadow-xs'
                  : 'border-slate-300 bg-white hover:border-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-black text-blue-900 tracking-wide">
                  RTS-z
                </span>
                {isRTSz && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    Wybrana
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-800 mt-1">Zawieszana</p>
              <p className="text-[11px] text-slate-500 mt-0.5">obsługa zewnętrzna</p>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateNN('typRozdzielnicy', 'RTS-w')}
              className={`p-3 rounded-lg border text-left transition-all cursor-pointer ${
                isRTSw
                  ? 'border-blue-600 bg-blue-50/90 ring-2 ring-blue-500 shadow-xs'
                  : 'border-slate-300 bg-white hover:border-slate-400'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-black text-blue-900 tracking-wide">
                  RTS-w
                </span>
                {isRTSw && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    Wybrana
                  </span>
                )}
              </div>
              <p className="text-xs font-bold text-slate-800 mt-1">Wolnostojąca</p>
              <p className="text-[11px] text-slate-500 mt-0.5">obsługa wewnętrzna</p>
            </button>
          </div>
        </div>

        {/* 2. Ilość pól 8, 10, 20 wedle uznania */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              2. Ilość pól (odpływów bezpiecznikowych)
            </label>
            <span className="text-[11px] text-slate-500">
              8, 10, 20 lub wedle uznania
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            {['8', '10', '20'].map((qty) => (
              <button
                key={qty}
                type="button"
                onClick={() => handleUpdateNN('iloscPol', qty)}
                className={`px-3 py-1.5 text-xs font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                  iloscVal === qty
                    ? 'bg-blue-600 text-white border-blue-700 shadow-xs ring-1 ring-blue-500'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {qty} pól
              </button>
            ))}
          </div>

          <input
            type="text"
            value={iloscVal}
            onChange={(e) => handleUpdateNN('iloscPol', e.target.value)}
            placeholder="Wpisz inną ilość pól wedle uznania (np. 12, 16, 24)..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
          />
        </div>

        {/* 3 & 4. Data wystawienia zlecenia & Planowana gotowość do transportu */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Data wystawienia zlecenia
            </label>
            <input
              type="date"
              value={dataWystawienia}
              onChange={(e) => handleUpdateNN('dataWystawieniaZlecenia', e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
              <span>Data rejestracji zlecenia nN</span>
              {dataWystawienia && (
                <span className="font-mono text-slate-700 font-bold">
                  {dataWystawienia.split('-').reverse().join('.')}
                </span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-blue-900 mb-1">
              Planowana gotowość do transportu
            </label>
            <input
              type="date"
              value={gotowoscTransportu}
              onChange={(e) => handleUpdateNN('planowanaGotowoscTransportu', e.target.value)}
              className="w-full text-xs px-3 py-2 border border-blue-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden font-mono text-blue-950 font-bold"
            />
            <div className="flex items-center justify-between text-[11px] text-blue-700 mt-1">
              <span>Data oczekiwania na wydanie do transportu</span>
              {gotowoscTransportu && (
                <span className="font-mono text-blue-900 font-bold">
                  {gotowoscTransportu.split('-').reverse().join('.')}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 5. Wyposażenie dodatkowe */}
        <div className="pt-2 border-t border-slate-200">
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Wyposażenie dodatkowe / aparatura (opcjonalnie)
          </label>
          <input
            type="text"
            value={wyposazenieVal}
            onChange={(e) => handleUpdateNN('wyposazenieDodatkowe', e.target.value)}
            placeholder="np. Rozłącznik główny 1000A, 8 odpływów listwowych NH2, pomiar półpośredni..."
            className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
          />
        </div>
      </div>
    );
  };

  const renderObudowaForm = () => {
    return (
      <ObudowaForm
        initialData={item.details}
        itemStatus={item.status}
        orderPlannedDate={item.plannedDate}
        onChange={(data) => {
          if (onUpdateDetails) {
            onUpdateDetails({
              ...item.details,
              ...data,
            });
          }
          if (data.dataGotowosci && data.dataGotowosci !== item.plannedDate) {
            onUpdateDates(item.orderDate || '', data.dataGotowosci, item.completedDate || '');
          }
        }}
      />
    );
  };

  const renderDoorForm = () => {
    return (
      <DoorForm
        initialData={item.details}
        orderNumber={orderNumber}
        doorOrders={doorOrders}
        onChange={(data) => {
          if (onUpdateDetails) {
            onUpdateDetails({
              ...item.details,
              ...data,
            });
          }
        }}
        onNavigateToDoorModule={onNavigateToDoorModule}
        onCreateDoorOrderForStation={onCreateDoorOrderForStation}
      />
    );
  };

  return (
    <section
      id={`item-section-${item.type}`}
      className={`rounded-xl border transition-all ${cardContainerClass}`}
    >
      {/* Header bar */}
      <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-t-xl ${headerBgClass}`}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`font-mono text-xs px-2.5 py-0.5 rounded border ${shortNameBadgeClass}`}>
              {item.shortName}
            </span>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {item.name}
            </h3>
            {canEdit ? (
              <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-2 py-0.5 rounded shadow-2xs hidden sm:inline-flex items-center gap-1">
                ✏️ Dostęp do edycji
              </span>
            ) : (
              <span
                className="text-[10px] font-medium bg-slate-200 text-slate-700 border border-slate-300 px-2 py-0.5 rounded hidden sm:inline-flex items-center gap-1"
                title={permHint.reason}
              >
                <Lock className="w-2.5 h-2.5 text-slate-500" />
                Tylko podgląd ({profile.shortName})
              </span>
            )}
          </div>
        </div>

        {/* Status switcher right in header */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-600 font-bold hidden sm:inline">Status:</span>
          <StatusSwitcher
            currentStatus={item.status}
            onChange={onStatusChange}
            variant="segmented"
            readOnly={!canEdit}
            readOnlyNotice={permHint.reason}
          />
        </div>
      </div>

      {/* Body */}
      <div className="p-5 space-y-4">
        {/* Technical Details Section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Szczegóły techniczne
              </h4>
              {item.type === 'ROZDZIELNICA_SN' && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                  Formularz konfiguracji SN
                </span>
              )}
              {item.type === 'ROZDZIELNICA_NN' && (
                <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                  Formularz parametrów nN
                </span>
              )}
              {item.type === 'OBUDOWA' && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">
                  Formularz obudowy betonowej (BEK / NZ)
                </span>
              )}
              {item.type === 'DRZWI' && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-2 py-0.5 rounded border border-amber-200">
                  Moduł Drzwi / Zamówienie PZD
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={onOpenEditModal}
              className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
            >
              <Edit2 className="w-3 h-3" />
              {canEdit
                ? item.type === 'OBUDOWA'
                  ? 'Edytuj'
                  : item.type === 'ROZDZIELNICA_SN' || item.type === 'ROZDZIELNICA_NN' || item.type === 'DRZWI'
                  ? 'Otwórz w oknie'
                  : 'Edytuj parametry'
                : 'Podgląd w oknie'}
            </button>
          </div>

          {!canEdit && (
            <div className="mb-2.5 p-2 rounded-lg bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                <span>Parametry techniczne w trybie podglądu (edycja zablokowana dla konta: <strong>{profile.name}</strong>).</span>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">Tylko odczyt</span>
            </div>
          )}

          <div className={!canEdit ? 'pointer-events-none select-none opacity-90' : ''}>
            {item.type === 'ROZDZIELNICA_SN' ? (
              renderSNForm()
            ) : item.type === 'ROZDZIELNICA_NN' ? (
              renderNNForm()
            ) : item.type === 'OBUDOWA' ? (
              <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-100">
                {renderDetailsSummary()}
              </div>
            ) : item.type === 'DRZWI' ? (
              renderDoorForm()
            ) : (
              <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-100">
                {renderDetailsSummary()}
              </div>
            )}
          </div>
        </div>

        {/* Dates Section */}
        <div className="space-y-3 py-4 border-y border-slate-200 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* 1. Data wystawienia zlecenia / kiedy zamówiono */}
            <div className="min-w-0 flex flex-col items-start gap-1.5 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <div className="flex flex-wrap items-center gap-2">
              <Send className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="text-slate-600 font-semibold">Data zlecenia / zamówienia:</span>
              {isEditingDate ? (
                <input
                  type="date"
                  value={orderDateInput}
                  onChange={(e) => setOrderDateInput(e.target.value)}
                  className="px-2 py-0.5 border border-blue-300 rounded text-xs bg-blue-50/50 font-mono text-blue-950 font-bold"
                />
              ) : item.orderDate ? (
                <span className="font-mono tabular-nums font-bold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                  {item.orderDate.split('-').reverse().join('.')}
                </span>
              ) : (
                <span className="font-mono text-slate-400 italic">Brak daty</span>
              )}
              </div>
            </div>

            {/* 2. Planowany termin / Data gotowości */}
            <div className="min-w-0 flex flex-col items-start gap-1.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="text-slate-500">
                'Planowana data gotowości:'
              </span>
              {isEditingDate ? (
                <input
                  type="date"
                  value={plannedDateInput}
                  onChange={(e) => setPlannedDateInput(e.target.value)}
                  className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white font-mono"
                />
              ) : (
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {item.plannedDate
                    ? item.plannedDate.split('-').reverse().join('.')
                    : 'Brak terminu'}
                </span>
              )}

              {/* Informacja o przekroczeniu terminu gotowości dla obudowy */}
              {item.type === 'OBUDOWA' &&
                checkReadinessOverdue(
                  item.details?.dataGotowosci || item.plannedDate,
                  item.status
                ).isOverdue && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200 animate-pulse">
                    <AlertTriangle className="w-3 h-3 text-rose-600" />
                    Przekroczono termin gotowości!
                  </span>
                )}
              </div>
            </div>

            {/* 3. Rzeczywista data zakończenia */}
            <div className="min-w-0 flex flex-col items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
              <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-slate-500">Rzeczywista data zakończenia:</span>
              {isEditingDate ? (
                <input
                  type="date"
                  value={completedDateInput}
                  onChange={(e) => setCompletedDateInput(e.target.value)}
                  className="px-2 py-0.5 border border-slate-300 rounded text-xs bg-white font-mono"
                />
              ) : (
                <span className="font-mono tabular-nums font-semibold text-slate-800">
                  {item.completedDate
                    ? item.completedDate.split('-').reverse().join('.')
                    : '—'}
                </span>
              )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            {canEdit ? (
              isEditingDate ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDates}
                    className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer"
                  >
                    Zapisz daty
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingDate(false)}
                    className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Anuluj
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setOrderDateInput(item.orderDate || '');
                    setPlannedDateInput(item.plannedDate || '');
                    setCompletedDateInput(item.completedDate || '');
                    setIsEditingDate(true);
                  }}
                  className="text-xs text-slate-500 hover:text-blue-600 hover:underline cursor-pointer"
                >
                  Zmień daty
                </button>
              )
            ) : null}
          </div>
        </div>

        {/* Notes Section */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Uwagi do elementu</span>
            </div>

            {canEdit && !isEditingNotes && (
              <button
                type="button"
                onClick={() => {
                  setNotesInput(item.notes || '');
                  setIsEditingNotes(true);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
              >
                {item.notes ? 'Edytuj uwagę' : '+ Dodaj uwagę'}
              </button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-2">
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Wpisz bieżące uwagi, status dostawy, ustalenia telefoniczne..."
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden bg-white"
                autoFocus
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
                >
                  Zapisz uwagę
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingNotes(false)}
                  className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Anuluj
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`p-3 rounded-lg text-xs border ${
                item.notes
                  ? isProblem
                    ? 'bg-rose-100/60 border-rose-200 text-rose-900 font-medium'
                    : 'bg-slate-50 border-slate-200 text-slate-800'
                  : 'bg-slate-50/50 border-dashed border-slate-200 text-slate-400 italic'
              }`}
            >
              {item.notes || 'Brak wpisanych uwag.'}
            </div>
          )}
        </div>

        {/* Attachments Section */}
        <div className="pt-2">
          <AttachmentList
            attachments={item.attachments || []}
            onAddAttachment={onAddAttachment}
            onDeleteAttachment={onDeleteAttachment}
            title={`Załączniki (${item.shortName})`}
            readOnly={!canEdit || !profile.canDownload}
            canDownload={profile.canDownload}
            orderNumber={orderNumber}
            itemType={item.type}
            currentProfile={profile}
            onOpenFolderManager={onOpenFolderManager}
          />
        </div>
      </div>
    </section>
  );
};
