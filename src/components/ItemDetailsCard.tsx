import React, { useState, useEffect } from 'react';
import {
  OrderItem,
  ItemStatus,
  Attachment,
  SN_PRODUCERS,
  SN_MODELS_BY_PRODUCER,
  SNProducer,
  SN_CONFIG_EXAMPLES,
  validateSNCombination,
  formatDimensionM,
  checkReadinessOverdue,
  findMatchingDoorOrder,
  formatDatePL,
  formatPLN,
  checkDoorOrderOverdue,
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
import { getSummaryFieldDepartment } from '../utils/departmentOwnership';

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
  const [isCompact, setIsCompact] = useState(item.status === 'NOT_APPLICABLE');
  const [snCatalog, setSnCatalog] = useState<{ producers: string[]; modelsByProducer: Record<string, string[]> }>({
    producers: [...SN_PRODUCERS],
    modelsByProducer: { ...SN_MODELS_BY_PRODUCER },
  });
  const [isSnCatalogOpen, setIsSnCatalogOpen] = useState(false);
  const [newSnProducer, setNewSnProducer] = useState('');
  const [newSnModel, setNewSnModel] = useState('');
  const [snCatalogError, setSnCatalogError] = useState('');
  const [snCatalogBusy, setSnCatalogBusy] = useState(false);

  useEffect(() => {
    if (item.type !== 'ROZDZIELNICA_SN') return;
    let cancelled = false;
    fetch('/api/sn-catalog')
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const body = await response.text();
          if (body.trimStart().toLowerCase().startsWith('<!doctype') || body.trimStart().startsWith('<html')) {
            throw new Error('Endpoint /api/sn-catalog zwrócił stronę HTML zamiast JSON. Zatrzymaj serwer i uruchom ponownie aktualną wersję ENCO FLOW poleceniem: npm run dev.');
          }
          throw new Error('Endpoint /api/sn-catalog nie zwrócił danych JSON.');
        }
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || 'Nie udało się pobrać słownika SN.');
        return data;
      })
      .then((data) => {
        if (!cancelled && data?.success && Array.isArray(data.producers) && data.modelsByProducer) {
          setSnCatalog({ producers: data.producers, modelsByProducer: data.modelsByProducer });
        }
      })
      .catch((error) => {
        if (!cancelled) setSnCatalogError(error instanceof Error ? error.message : 'Błąd odczytu słownika SN.');
      });
    return () => { cancelled = true; };
  }, [item.type]);

  useEffect(() => {
    setIsCompact(item.status === 'NOT_APPLICABLE');
  }, [item.status]);

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

  const saveSnCatalogAction = async (payload: Record<string, string>) => {
    setSnCatalogBusy(true);
    setSnCatalogError('');
    try {
      const response = await fetch('/api/sn-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const body = await response.text();
        if (body.trimStart().toLowerCase().startsWith('<!doctype') || body.trimStart().startsWith('<html')) {
          throw new Error('Endpoint /api/sn-catalog zwrócił stronę HTML zamiast JSON. Sprawdź, czy uruchomiony jest aktualny serwer ENCO FLOW (npm run dev).');
        }
        throw new Error('Endpoint /api/sn-catalog nie zwrócił danych JSON.');
      }
      const data = await response.json();
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Nie udało się zapisać słownika SN.');
      setSnCatalog({ producers: data.producers || [], modelsByProducer: data.modelsByProducer || {} });
      setNewSnProducer('');
      setNewSnModel('');
    } catch (error) {
      setSnCatalogError(error instanceof Error ? error.message : 'Błąd zapisu słownika SN.');
    } finally {
      setSnCatalogBusy(false);
    }
  };

  const handleAddSnProducer = () => {
    const producer = newSnProducer.trim();
    if (!producer) return setSnCatalogError('Wpisz nazwę producenta.');
    void saveSnCatalogAction({ action: 'addProducer', producer });
  };

  const handleAddSnModel = () => {
    const producer = item.details?.producent || '';
    const model = newSnModel.trim();
    if (!producer) return setSnCatalogError('Najpierw wybierz producenta.');
    if (!model) return setSnCatalogError('Wpisz nazwę modelu.');
    void saveSnCatalogAction({ action: 'addModel', producer, model });
  };

  const handleDeleteSnProducer = (producer: string) => {
    if (!window.confirm(`Usunąć producenta „${producer}” wraz ze wszystkimi przypisanymi modelami ze słownika? Dane zapisane w istniejących zleceniach nie zostaną usunięte.`)) return;
    void saveSnCatalogAction({ action: 'removeProducer', producer });
  };

  const handleDeleteSnModel = (producer: string, model: string) => {
    if (!window.confirm(`Usunąć model „${model}” producenta „${producer}” ze słownika? Dane zapisane w istniejących zleceniach nie zostaną usunięte.`)) return;
    void saveSnCatalogAction({ action: 'removeModel', producer, model });
  };

  const handleUpdateSNProducer = (newProducer: string) => {
    if (!onUpdateDetails) return;
    const currentModel = item.details?.model || item.details?.typRozdzielnicy || '';
    const allowed = newProducer ? (snCatalog.modelsByProducer[newProducer] || []) : [];
    const isModelValid = allowed.includes(currentModel);
    const nextModel = isModelValid ? currentModel : '';

    onUpdateDetails({
      ...item.details,
      producent: newProducer,
      model: nextModel,
      typRozdzielnicy: nextModel,
      konfiguracjaPol: item.details?.konfiguracjaPol || '',
    });
  };

  const handleUpdateSNModel = (newModel: string) => {
    if (!onUpdateDetails) return;
    onUpdateDetails({
      ...item.details,
      model: newModel,
      typRozdzielnicy: newModel,
      konfiguracjaPol: item.details?.konfiguracjaPol || '',
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
        entries.push({ label: 'Producent', value: d.producent ? d.producent : '—' });
        const snModel = d.model || d.typRozdzielnicy;
        if (snModel) entries.push({ label: 'Model rozdzielnicy', value: snModel });
        const polCount = d.liczbaPol ?? d.iloscPol;
        if (polCount !== undefined && polCount !== '') {
          entries.push({ label: 'Ilość pól', value: `${polCount} pola` });
        }
        const snConfig = d.konfiguracjaPol || '';
        entries.push({
          label: 'Konfiguracja pól',
          value: snConfig ? `${snConfig} (L: liniowe, T: transformatorowe)` : 'Nieuzupełniono',
        });
        entries.push({ label: 'Numer seryjny', value: d.numerSeryjny ? String(d.numerSeryjny) : '—' });
        const formatSNDate = (value: unknown) =>
          typeof value === 'string' && value ? value.split('-').reverse().join('.') : '';
        
        
        
        entries.push({ label: 'SN w Pyskowicach', value: d.snWPyskowicach ? 'Tak' : 'Nie' });
        if (d.parametryTechniczne) {
          entries.push({ label: 'Parametry techniczne', value: d.parametryTechniczne });
        }
        break;

      case 'ROZDZIELNICA_NN':
        const typVal = d.typRozdzielnicy || d.typ || '';
        const typFormatted = typVal.includes('RTS-z')
          ? 'RTS-z — zawieszana, obsługa zewnętrzna'
          : typVal.includes('RTS-w')
          ? 'RTS-w — wolnostojąca, obsługa wewnętrzna'
          : typVal;
        entries.push({ label: 'Typ rozdzielnicy', value: typFormatted });

        const polVal = d.iloscPol ?? d.liczbaPol ?? '';
        if (polVal !== '') entries.push({ label: 'Ilość pól', value: `${polVal} pól (odpływów)` });

        const zlecData = d.dataWystawieniaZlecenia || d.dataZlecenia;
        if (zlecData) {
          
        }

        const transpData = d.planowanaGotowoscTransportu || d.dataWydaniaDoTransportu;
        if (transpData) {
          
        }

        const wypVal = d.wyposazenieDodatkowe || d.wyposazenie || d.konfiguracja;
        if (wypVal) {
          entries.push({ label: 'Wyposażenie dodatkowe', value: wypVal });
        }
        entries.push({ label: 'Kategoria', value: d.kategoria ? String(d.kategoria) : '—' });
        entries.push({ label: 'Dostawca', value: d.dostawca ? String(d.dostawca) : '—' });
        
        
        entries.push({ label: 'NN w Pyskowicach', value: d.nnWPyskowicach ? 'Tak' : 'Nie' });
        break;

      case 'MOST':
        entries.push({ label: 'Rodzaj kabla', value: d.rodzajKabla ? d.rodzajKabla : '—' });
        entries.push({ label: 'Typ / przekrój', value: d.typPrzekroj ? d.typPrzekroj : '—' });
        entries.push({ label: 'Długość', value: d.dlugosc ? d.dlugosc : '—' });
        entries.push({ label: 'Rodzaj głowic', value: d.rodzajGlowic ? d.rodzajGlowic : '—' });
        entries.push({ label: 'Ilość głowic', value: d.iloscGlowic ? d.iloscGlowic : '—' });
        
        
        
        entries.push({ label: 'Mosty SN w Pyskowicach', value: d.mostSNPyskowicach ? 'Tak' : 'Nie' });
        break;

      case 'RYS_AKCEPTACJA':
        
        entries.push({ label: 'Informacje o zmianach', value: d.informacjeOZmianach ? d.informacjeOZmianach : '—' });
        break;

      case 'KOLORY':
        entries.push({ label: 'Kolor obudowy', value: d.kolorObudowy ? d.kolorObudowy : '—' });
        entries.push({ label: 'Kolor drzwi', value: d.kolorDrzwi ? d.kolorDrzwi : '—' });
        entries.push({ label: 'Kolory dodatkowe', value: d.koloryDodatkowe ? d.koloryDodatkowe : '—' });
        entries.push({ label: 'Numery RAL', value: d.numeryRal ? d.numeryRal : '—' });
        break;

      case 'OPISY':
        entries.push({ label: 'Wymagane opisy', value: d.wymaganeOpisy ? d.wymaganeOpisy : '—' });
        entries.push({ label: 'Sposób wykonania', value: d.sposobWykonania ? d.sposobWykonania : '—' });
        break;

      case 'DRZWI': {
        // Dane zamówienia pobieramy na bieżąco z modułu „Drzwi”,
        // bez kopiowania ich do details elementu głównego.
        const linkedDoorOrder = findMatchingDoorOrder(doorOrders, orderNumber, d.numerDokumentu);
        if (linkedDoorOrder) {
          const deliveryStatus = checkDoorOrderOverdue(
            linkedDoorOrder.terminZamowienia,
            linkedDoorOrder.terminDostawy,
          );
          entries.push(
            { label: 'Numer dokumentu PZD', value: linkedDoorOrder.numerDokumentu || '—' },
            { label: 'Kategoria / zamówienie', value: linkedDoorOrder.kategoria || '—' },
            { label: 'Kontrahent / realizacje', value: linkedDoorOrder.kontrahentRealizacje || '—' },
            { label: 'Data zamówienia', value: formatDatePL(linkedDoorOrder.dataZamowienia) },
            { label: 'Termin z zamówienia', value: formatDatePL(linkedDoorOrder.terminZamowienia) },
            { label: 'Termin dostawy', value: formatDatePL(linkedDoorOrder.terminDostawy) },
            { label: 'Status dostawy', value: deliveryStatus.label },
            { label: 'Wartość netto', value: formatPLN(linkedDoorOrder.wartoscNetto) },
            { label: 'Wartość brutto', value: formatPLN(linkedDoorOrder.wartoscBrutto) },
            { label: 'Uwagi z modułu Drzwi', value: linkedDoorOrder.uwagi?.trim() || '—' },
          );
        } else {
          entries.push({
            label: 'Powiązanie z modułem Drzwi',
            value: 'Nie znaleziono zamówienia PZD przypisanego do tego zlecenia',
          });
        }
        entries.push({ label: 'Ilość drzwi', value: d.ilosc ? d.ilosc : '—' });
        entries.push({ label: 'Typ drzwi', value: d.typ ? d.typ : '—' });
        entries.push({ label: 'Lokalizacja drzwi', value: d.lokalizacja ? d.lokalizacja : '—' });
        entries.push({ label: 'Dodatkowe wyposażenie drzwi', value: d.dodatkoweWyposazenie ? d.dodatkoweWyposazenie : '—' });
        break;
      }

      case 'ZAP_SERWISPOL':
      case 'ZAP_JK':
        
        entries.push({ label: 'Zakres usługi', value: d.zakresUslugi ? d.zakresUslugi : '—' });
        entries.push({ label: 'Informacje o wycenie', value: d.informacjeOWycenie ? d.informacjeOWycenie : '—' });
        break;

      case 'ZAM_SERWISPOL':
      case 'ZAM_JK':
        
        entries.push({ label: 'Zakres usługi', value: d.zakresUslugi || 'montaż Stacji/Złącza' });
        
        entries.push({ label: 'Informacje dot. wykonania', value: d.informacjeDotyczaceWykonania ? d.informacjeDotyczaceWykonania : '—' });
        break;

      case 'ZLECENIE_MONTAZU':
        entries.push({ label: 'Zakres montażu', value: d.zakresMontazu ? d.zakresMontazu : '—' });
        
        break;

      case 'SZAFKA_TELEMECHANIKI':
        entries.push({ label: 'Typ szafki RTU', value: d.typ ? d.typ : '—' });
        entries.push({ label: 'Wyposażenie', value: d.wyposazenie ? d.wyposazenie : '—' });
        entries.push({ label: 'Zakres', value: d.zakres ? d.zakres : '—' });
        entries.push({ label: 'Informacje techniczne', value: d.informacjeTechniczne ? d.informacjeTechniczne : '—' });
        
        entries.push({ label: 'Dokumentacja wysłana do uzgodnienia', value: d.dokumentacjaWyslanaDoUzgodnienia ? 'Tak' : 'Nie' });
        entries.push({ label: 'Typ sterownika', value: d.typSterownika ? d.typSterownika : '—' });
        
        
        
        
        entries.push({ label: 'Szafka w Pyskowicach', value: d.szafkaWPyskowicach ? 'Tak' : 'Nie' });
        entries.push({ label: 'Akumulator w Pyskowicach', value: d.akumulatorWPyskowicach ? 'Tak' : 'Nie' });
        entries.push({ label: 'Maszt i antena w Pyskowicach', value: d.masztAntenaWPyskowicach ? 'Tak' : 'Nie' });
        entries.push({ label: 'Sensory napięciowe', value: d.sensoryNapieciowe ? d.sensoryNapieciowe : '—' });
        
        entries.push({ label: 'Sensory napięciowe w Pyskowicach', value: d.sensoryNapiecioweWPyskowicach ? 'Tak' : 'Nie' });
        break;

      case 'TABLICA_POMIAROWA':
      case 'RPW':
        entries.push({ label: 'Kategoria', value: d.kategoria ? String(d.kategoria) : '—' });
        
        
        
        
        entries.push({ label: item.type === 'RPW' ? 'RPW w Pyskowicach' : 'Tablica pomiarowa w Pyskowicach', value: item.status === 'NOT_APPLICABLE' ? 'Nie dotyczy' : d.wPyskowicach ? 'Tak' : 'Nie' });
        break;

      case 'TRANSFORMATOR_POTRZEB_WLASNYCH':
        entries.push({ label: 'Moc / VA', value: d.va ? String(d.va) : '—' });
        
        entries.push({ label: 'Numer seryjny', value: d.numerSeryjny ? String(d.numerSeryjny) : '—' });
        
        entries.push({ label: 'Transformator potrzeb własnych w Pyskowicach', value: item.status === 'NOT_APPLICABLE' ? 'Nie dotyczy' : d.wPyskowicach ? 'Tak' : 'Nie' });
        break;

      case 'WSKAZNIKI_ZWARC':
        entries.push({ label: 'Typ wskaźników / centralki', value: d.typ ? String(d.typ) : '—' });
        if (d.ilosc !== undefined && d.ilosc !== '') entries.push({ label: 'Ilość', value: String(d.ilosc) });
        
        
        entries.push({ label: 'Wskaźniki zwarć w Pyskowicach', value: item.status === 'NOT_APPLICABLE' ? 'Nie dotyczy' : d.wPyskowicach ? 'Tak' : 'Nie' });
        break;

      case 'POWYKONAWCZA':
        entries.push({ label: 'Status dokumentacji', value: d.statusDokumentacji ? d.statusDokumentacji : '—' });
        
        
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
        entries.push({ label: 'Rozmiar obudowy', value: d.rozmiar ? d.rozmiar : '—' });
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
          
        }
        
        entries.push({ label: 'Przepusty NN', value: d.przepustyNN ? d.przepustyNN : '—' });
        entries.push({ label: 'Przepusty SN', value: d.przepustySN ? d.przepustySN : '—' });
        entries.push({ label: 'Pokrywy NN', value: d.pokrywyNN ? d.pokrywyNN : '—' });
        if (d.pokrywyNNSaWPyskowicach !== undefined) entries.push({ label: 'Pokrywy NN w Pyskowicach', value: d.pokrywyNNSaWPyskowicach ? 'Tak' : 'Nie' });
        entries.push({ label: 'Pokrywy SN', value: d.pokrywySN ? d.pokrywySN : '—' });
        if (d.pokrywySNSaWPyskowicach !== undefined) entries.push({ label: 'Pokrywy SN w Pyskowicach', value: d.pokrywySNSaWPyskowicach ? 'Tak' : 'Nie' });
        entries.push({ label: 'Wkładki SN', value: d.wkladkiSN ? d.wkladkiSN : '—' });
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
        
        entries.push({ label: 'Przewoźnik', value: d.przewoznik ? d.przewoznik : '—' });
        
        entries.push({ label: 'Kontakt na budowie', value: d.kontaktNaBudowie ? d.kontaktNaBudowie : '—' });
        if (d.kilometry !== undefined && d.kilometry !== '') entries.push({ label: 'Kilometry', value: String(d.kilometry) });
        if (d.cenaTransportu !== undefined && d.cenaTransportu !== '') entries.push({ label: 'Cena transportu (PLN)', value: String(d.cenaTransportu) });
        entries.push({ label: 'Numer faktury', value: d.numerFaktury ? String(d.numerFaktury) : '—' });
        entries.push({ label: 'Adres dostawy', value: d.adresDostawy ? d.adresDostawy : '—' });
        break;

      case 'DODATKOWE':
        entries.push({ label: 'Opis', value: d.opis ? d.opis : '—' });
        entries.push({ label: 'Specyfikacja', value: d.specyfikacja ? d.specyfikacja : '—' });
        break;

      default:
        Object.entries(d).forEach(([key, val]) => {
          if (val) entries.push({ label: key, value: String(val) });
        });
    }

    if (item.type === 'OBUDOWA') {
      const d = item.details || {};
      const koloryItem = orderItems.find((related) => related.type === 'KOLORY');
      const opisyItem = orderItems.find((related) => related.type === 'OPISY');
      const drawingApprovalDate = orderItems.find((related) => related.type === 'RYS_AKCEPTACJA')?.details?.dataAkceptacji;
      const kolory = koloryItem?.details || {};
      const opisy = opisyItem?.details || {};
      const typName =
        d.typObudowy === 'NZ'
          ? 'NZ — obudowa zewnętrzna'
          : d.typObudowy === 'BEK'
          ? 'BEK — obudowa wewnętrzna'
          : (d.typObudowy || 'BEK');
      const displayValue = (value: unknown) =>
        value === undefined || value === null || value === '' ? '—' : String(value);
      const yesNo = (value: unknown) =>
        value === undefined || value === null ? '—' : value ? 'Tak' : 'Nie';
      const formatDate = (value: unknown) => {
        if (typeof value !== 'string' || !value) return '—';
        const parts = value.split('-');
        return parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : value;
      };
      const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
        <div className="pt-3 first:pt-0">
          <h5 className="mb-2 border-b border-slate-200 pb-1.5 text-[11px] font-extrabold uppercase tracking-wider text-slate-700">
            {title}
          </h5>
          {children}
        </div>
      );
      const Field = ({ label, value }: { label: string; value: React.ReactNode }) => {
        const owner = getSummaryFieldDepartment(item.type, label);
        return (
          <div className="flex min-w-0 flex-col gap-1 border-b border-slate-100 py-2 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:w-1/2">
              <span className="text-xs font-medium text-slate-600">{label}</span>
              {owner?.key === 'pyskowice' && (
                <span
                  title={`Obszar prowadzący: ${owner.shortLabel}`}
                  className={`inline-flex max-w-full rounded border px-1.5 py-0.5 text-[9px] font-bold leading-tight ${owner.className}`}
                >
                  {owner.label}
                </span>
              )}
            </div>
            <span className="block min-w-0 break-words text-xs font-semibold text-slate-900 sm:w-1/2">{value}</span>
          </div>
        );
      };

      return (
        <div className="divide-y divide-slate-200 text-xs">
          <Section title="1. Rodzaj i rozmiar">
            <div className="space-y-0">
              <Field label="Rodzaj obudowy" value={typName} />
              <Field label="Rozmiar obudowy" value={displayValue(d.rozmiar)} />
              <Field
                label="Wymiary rzeczywiste"
                value={
                  d.szerokosc !== undefined && d.glebokosc !== undefined
                    ? `${formatDimensionM(d.szerokosc)} × ${formatDimensionM(d.glebokosc)} × ${formatDimensionM(d.wysokosc)} (${d.typWysokosci || (d.typObudowy === 'NZ' ? 'wysokość zewnętrzna' : 'wysokość wewnętrzna pomieszczeń')})`
                    : displayValue(d.wymiary)
                }
              />
              <Field label="Data zlecenia obudowy" value={formatDate(d.dataZlecenia)} />
              <Field label="Rysunki — data akceptacji" value={formatDate(drawingApprovalDate)} />
              <Field label="Data oczekiwana" value={formatDate(d.dataGotowosci)} />
            </div>
          </Section>

          <Section title="2. Przepusty i pokrywy">
            <div className="space-y-3">
              <div>
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-blue-800">NN</div>
                <div className="space-y-0">
                  <Field label="Przepusty NN" value={displayValue(d.przepustyNN)} />
                  <Field label="Pokrywy NN" value={displayValue(d.pokrywyNN)} />
                  <Field label="Pokrywy NN w Pyskowicach" value={yesNo(d.pokrywyNNSaWPyskowicach)} />
                </div>
              </div>
              <div className="border-t border-slate-200 pt-3">
                <div className="mb-2 text-[11px] font-extrabold uppercase tracking-wider text-amber-800">SN</div>
                <div className="space-y-0">
                  <Field label="Przepusty SN" value={displayValue(d.przepustySN)} />
                  <Field label="Pokrywy SN" value={displayValue(d.pokrywySN)} />
                  <Field label="Pokrywy SN w Pyskowicach" value={yesNo(d.pokrywySNSaWPyskowicach)} />
                </div>
              </div>
            </div>
          </Section>

          <Section title="3. Wkładki SN">
            <div className="space-y-0">
              <Field label="Wkładki SN" value={displayValue(d.wkladkiSN)} />
              <Field label="Wkładki SN w Pyskowicach" value={yesNo(d.wkladkiSNSaWPyskowicach)} />
            </div>
          </Section>

          <Section title="4. Kolory">
            <div className="space-y-0">
              <Field label="Kolor obudowy" value={displayValue(kolory.kolorObudowy)} />
              <Field label="Kolor drzwi" value={displayValue(kolory.kolorDrzwi)} />
              <Field label="Kolory dodatkowe" value={displayValue(kolory.koloryDodatkowe)} />
              <Field label="Numery RAL" value={displayValue(kolory.numeryRal)} />
            </div>
          </Section>

          <Section title="5. Opisy">
            <div className="space-y-0">
              <Field label="Wymagane opisy" value={displayValue(opisy.wymaganeOpisy)} />
              <Field label="Sposób wykonania opisów" value={displayValue(opisy.sposobWykonania)} />
            </div>
          </Section>
        </div>
      );
    }

    if (entries.length === 0) {
      return (
        <div className="text-xs text-slate-400 italic">
          Brak skonfigurowanych parametrów technicznych.
        </div>
      );
    }

    return (
      <div className="divide-y divide-slate-200 text-xs">
        {entries.map((entry, idx) => {
          const owner = getSummaryFieldDepartment(item.type, entry.label);
          return (
            <div key={idx} className="flex min-w-0 flex-col gap-1 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:w-1/2">
                <span className="font-medium text-slate-600">{entry.label}</span>
                {owner?.key === 'pyskowice' && (
                  <span
                    title={`Obszar prowadzący: ${owner.label}`}
                    className={`inline-flex max-w-full rounded border px-1.5 py-0.5 text-[9px] font-bold leading-tight ${owner.className}`}
                  >
                    {owner.shortLabel}
                  </span>
                )}
              </div>
              <span className="min-w-0 break-words font-semibold text-slate-900 sm:w-1/2">{entry.value || 'Nie uzupełniono'}</span>
            </div>
          );
        })}
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

  const handleValidatedStatusChange = (newStatus: ItemStatus) => {
    if (newStatus === 'READY') {
      const d = item.details || {};
      const requiredByType: Record<string, { key: string; label: string }[]> = {
        ROZDZIELNICA_SN: [
          { key: 'producent', label: 'Producent rozdzielnicy SN' },
          { key: 'model', label: 'Model rozdzielnicy SN' },
          { key: 'liczbaPol', label: 'Liczba pól rozdzielnicy SN' },
          { key: 'konfiguracjaPol', label: 'Konfiguracja pól SN' },
        ],
        ROZDZIELNICA_NN: [
          { key: 'typRozdzielnicy', label: 'Typ rozdzielnicy NN' },
          { key: 'iloscPol', label: 'Liczba pól rozdzielnicy NN' },
        ],
        MOST: [
          { key: 'rodzajKabla', label: 'Rodzaj kabla mostu' },
          { key: 'typPrzekroj', label: 'Typ i przekrój kabla' },
          { key: 'dlugosc', label: 'Długość mostu kablowego' },
          { key: 'rodzajGlowic', label: 'Rodzaj głowic kablowych' },
          { key: 'iloscGlowic', label: 'Liczba głowic kablowych' },
        ],
        RYS_AKCEPTACJA: [
          { key: 'dataWyslania', label: 'Data wysłania rysunków' },
          { key: 'dataAkceptacji', label: 'Data akceptacji rysunków' },
        ],
        KOLORY: [
          { key: 'kolorObudowy', label: 'Kolor obudowy' },
          { key: 'kolorDrzwi', label: 'Kolor drzwi' },
        ],
        OPISY: [
          { key: 'wymaganeOpisy', label: 'Wymagane opisy' },
          { key: 'sposobWykonania', label: 'Sposób wykonania opisów' },
        ],
        DRZWI: [
          { key: 'ilosc', label: 'Liczba drzwi' },
          { key: 'typ', label: 'Typ drzwi' },
          { key: 'lokalizacja', label: 'Lokalizacja drzwi' },
        ],
        ZAP_SERWISPOL: [
          { key: 'dataZapytania', label: 'Data zapytania SERWISPOL' },
          { key: 'zakresUslugi', label: 'Zakres usługi SERWISPOL' },
        ],
        ZAP_JK: [
          { key: 'dataZapytania', label: 'Data zapytania JK' },
          { key: 'zakresUslugi', label: 'Zakres usługi JK' },
        ],
        ZAM_SERWISPOL: [
          { key: 'dataZamowienia', label: 'Data zamówienia SERWISPOL' },
          { key: 'zakresUslugi', label: 'Zakres zamówionej usługi SERWISPOL' },
          { key: 'uzgodnionyTermin', label: 'Uzgodniony termin SERWISPOL' },
        ],
        ZAM_JK: [
          { key: 'dataZamowienia', label: 'Data zamówienia JK' },
          { key: 'zakresUslugi', label: 'Zakres zamówionej usługi JK' },
          { key: 'uzgodnionyTermin', label: 'Uzgodniony termin JK' },
        ],
        ZLECENIE_MONTAZU: [
          { key: 'zakresMontazu', label: 'Zakres montażu' },
          { key: 'dataZlecenia', label: 'Data zlecenia montażu' },
        ],
        SZAFKA_TELEMECHANIKI: [
          { key: 'typ', label: 'Typ szafki telemechaniki' },
          { key: 'wyposazenie', label: 'Wyposażenie szafki telemechaniki' },
          { key: 'typSterownika', label: 'Typ sterownika' },
        ],
        TABLICA_POMIAROWA: [
          { key: 'kategoria', label: 'Kategoria tablicy pomiarowej' },
        ],
        RPW: [
          { key: 'kategoria', label: 'Kategoria RPW' },
        ],
        TRANSFORMATOR_POTRZEB_WLASNYCH: [
          { key: 'va', label: 'Moc transformatora potrzeb własnych (VA)' },
        ],
        WSKAZNIKI_ZWARC: [
          { key: 'typ', label: 'Typ wskaźników zwarć' },
          { key: 'ilosc', label: 'Liczba wskaźników zwarć' },
        ],
        POWYKONAWCZA: [
          { key: 'statusDokumentacji', label: 'Status dokumentacji powykonawczej' },
          { key: 'dataZakonczenia', label: 'Data gotowości dokumentacji powykonawczej' },
        ],
        OBUDOWA: [
          { key: 'typObudowy', label: 'Typ obudowy (BEK/NZ)' },
          { key: 'rozmiar', label: 'Rozmiar stacji' },
          { key: 'szerokosc', label: 'Szerokość obudowy' },
          { key: 'glebokosc', label: 'Głębokość obudowy' },
          { key: 'wysokosc', label: 'Wysokość obudowy' },
        ],
        DATA_WYJAZDU: [
          { key: 'dataTransportu', label: 'Data transportu / załadunku' },
          { key: 'przewoznik', label: 'Przewoźnik' },
          { key: 'adresDostawy', label: 'Adres dostawy' },
        ],
        DODATKOWE: [
          { key: 'opis', label: 'Opis dodatkowego elementu' },
          { key: 'specyfikacja', label: 'Specyfikacja dodatkowego elementu' },
        ],
      };
      const required = requiredByType[item.type] || [];
      const valueForKey = (key: string): any => {
        switch (key) {
          case 'liczbaPol': return d.liczbaPol ?? d.iloscPol ?? '';
          case 'iloscPol': return d.iloscPol ?? d.liczbaPol ?? '';
          case 'model': return d.model || d.typRozdzielnicy || '';
          case 'typRozdzielnicy':
            return item.type === 'ROZDZIELNICA_NN'
              ? (d.typRozdzielnicy || d.typ || '')
              : (d.typRozdzielnicy || '');
          default: return d[key];
        }
      };
      const missing = required.filter(({ key }) => {
        const value = valueForKey(key);
        return typeof value === 'string'
          ? value.trim() === ''
          : value === null || value === undefined;
      });
      if (missing.length > 0) {
        window.alert(
          `Nie można potwierdzić gotowości elementu „${item.name}”. Uzupełnij wymagane pola:\n\n• ${missing.map(({ label }) => label).join('\n• ')}`
        );
        return;
      }

      const positiveNumberFields: Record<string, { key: string; label: string }[]> = {
        ROZDZIELNICA_SN: [{ key: 'liczbaPol', label: 'Liczba pól rozdzielnicy SN' }],
        ROZDZIELNICA_NN: [{ key: 'iloscPol', label: 'Liczba pól rozdzielnicy NN' }],
        MOST: [
          { key: 'dlugosc', label: 'Długość mostu kablowego' },
          { key: 'iloscGlowic', label: 'Liczba głowic kablowych' },
        ],
        DRZWI: [{ key: 'ilosc', label: 'Liczba drzwi' }],
        WSKAZNIKI_ZWARC: [{ key: 'ilosc', label: 'Liczba wskaźników zwarć' }],
        TRANSFORMATOR_POTRZEB_WLASNYCH: [{ key: 'va', label: 'Moc transformatora potrzeb własnych (VA)' }],
        OBUDOWA: [
          { key: 'szerokosc', label: 'Szerokość obudowy' },
          { key: 'glebokosc', label: 'Głębokość obudowy' },
          { key: 'wysokosc', label: 'Wysokość obudowy' },
        ],
      };
      const invalidNumbers = (positiveNumberFields[item.type] || []).filter(({ key }) => {
        const value = valueForKey(key);
        const number = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
        const mustBeInteger = ['liczbaPol', 'iloscPol', 'iloscGlowic', 'ilosc'].includes(key);
        return !Number.isFinite(number) || number <= 0 || (mustBeInteger && !Number.isInteger(number));
      });
      if (invalidNumbers.length > 0) {
        window.alert(
          `Nie można potwierdzić gotowości elementu „${item.name}”. Sprawdź poprawność pól liczbowych:\n\n• ${invalidNumbers.map(({ label }) => label).join('\n• ')}`
        );
        return;
      }
      if (item.type === 'ROZDZIELNICA_SN') {
        const combo = validateSNCombination(d.producent || '', d.model || d.typRozdzielnicy || '', snCatalog.modelsByProducer);
        if (!combo.isValid) {
          window.alert(combo.error || 'Wybierz poprawnego producenta i model rozdzielnicy SN.');
          return;
        }
      }
    }
    onStatusChange(newStatus);
  };

  const renderSNForm = () => {
    const d = item.details || {};
    const producerVal = d.producent || '';
    const modelVal = d.model || d.typRozdzielnicy || '';
    const polVal = d.liczbaPol ?? d.iloscPol ?? '';
    const configVal = d.konfiguracjaPol ?? '';
    const technicalVal = d.parametryTechniczne || '';

    const comboValidation = validateSNCombination(producerVal, modelVal, snCatalog.modelsByProducer);
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
              <strong>{producerVal}</strong> · {modelVal} · {polVal || '—'}p ({configVal || '—'})
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
              {snCatalog.producers.map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              Lista producentów jest pobierana ze wspólnego słownika ENCO FLOW.
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
                  {(snCatalog.modelsByProducer[producerVal] || []).map((mod) => (
                    <option key={mod} value={mod}>
                      {mod}
                    </option>
                  ))}
                </>
              )}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">
              {producerVal ? `Dostępne modele: ${(snCatalog.modelsByProducer[producerVal] || []).length}` : 'Wybierz producenta w kroku 1, aby odblokować model'}
            </p>
          </div>
        </div>

        {canEdit && (
          <div className="border border-slate-200 rounded-lg bg-white">
            <button
              type="button"
              onClick={() => setIsSnCatalogOpen((open) => !open)}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              <span>Zarządzaj słownikiem producentów i modeli</span>
              <span>{isSnCatalogOpen ? '−' : '+'}</span>
            </button>
            {isSnCatalogOpen && (
              <div className="p-3 border-t border-slate-200 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dodaj producenta</label>
                  <div className="flex gap-2">
                    <input value={newSnProducer} onChange={(e) => setNewSnProducer(e.target.value)} maxLength={120} placeholder="Nazwa producenta" className="min-w-0 flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg" />
                    <button type="button" disabled={snCatalogBusy || !newSnProducer.trim()} onClick={handleAddSnProducer} className="px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white disabled:opacity-50">Dodaj</button>
                  </div>
                </div>
                <div className="space-y-3">
                  {snCatalog.producers.map((producer) => (
                    <div key={producer} className="rounded-lg border border-slate-200 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-800">{producer}</span>
                        <button type="button" disabled={snCatalogBusy} onClick={() => handleDeleteSnProducer(producer)} className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-50">Usuń producenta</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(snCatalog.modelsByProducer[producer] || []).map((model) => (
                          <span key={model} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700">
                            {model}
                            <button type="button" disabled={snCatalogBusy} onClick={() => handleDeleteSnModel(producer, model)} aria-label={`Usuń model ${model}`} className="font-bold text-rose-700 hover:text-rose-900">×</button>
                          </span>
                        ))}
                        {!(snCatalog.modelsByProducer[producer] || []).length && <span className="text-[11px] text-slate-400">Brak modeli</span>}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Dodaj model do wybranego producenta</label>
                  <div className="flex gap-2">
                    <input value={newSnModel} onChange={(e) => setNewSnModel(e.target.value)} maxLength={120} placeholder="Nazwa modelu" className="min-w-0 flex-1 text-xs px-3 py-2 border border-slate-300 rounded-lg" />
                    <button type="button" disabled={snCatalogBusy || !producerVal || !newSnModel.trim()} onClick={handleAddSnModel} className="px-3 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white disabled:opacity-50">Dodaj model</button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">{producerVal ? `Model zostanie dodany do: ${producerVal}` : 'Najpierw wybierz producenta powyżej.'}</p>
                </div>
                {snCatalogError && <p role="alert" className="text-xs text-rose-700">{snCatalogError}</p>}
                {snCatalogBusy && <p className="text-xs text-slate-500">Zapisywanie słownika…</p>}
              </div>
            )}
          </div>
        )}

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
    const typVal = d.typRozdzielnicy || d.typ || '';
    const isRTSz = typVal.includes('RTS-z');
    const isRTSw = typVal.includes('RTS-w');
    const iloscVal = String(d.iloscPol ?? d.liczbaPol ?? '');
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
            placeholder="Wpisz wyposażenie dodatkowe lub aparaturę..."
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
        onAuxiliaryChange={(key, value) => {
          if (onUpdateDetails) {
            onUpdateDetails({
              ...item.details,
              [key]: value,
            });
          }
        }}
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
            {item.type === 'ROZDZIELNICA_NN' && (
              <span
                title="Produkcja rozdzielnicy NN — Płochocińska"
                className="rounded border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[9px] font-bold text-cyan-800"
              >
                PŁOCHOCIŃSKA
              </span>
            )}
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
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-slate-600 font-bold hidden sm:inline">Status:</span>
          <StatusSwitcher
            currentStatus={item.status}
            onChange={handleValidatedStatusChange}
            variant="segmented"
            readOnly={!canEdit}
            readOnlyNotice={permHint.reason}
            notApplicableLabel={
              ["OBUDOWA","ROZDZIELNICA_SN","ROZDZIELNICA_NN","TABLICA_POMIAROWA","RPW","MOST","SZAFKA_TELEMECHANIKI","TRANSFORMATOR_POTRZEB_WLASNYCH","WSKAZNIKI_ZWARC","RYS_AKCEPTACJA","KOLORY","OPISY","DRZWI","ZAP_SERWISPOL","ZAM_SERWISPOL","ZLECENIE_MONTAZU","ZLECENIE MONTAŻU","POWYKONAWCZA","DATA_WYJAZDU","DODATKOWE"].includes(item.type)
                ? '- Nie uwzględniono'
                : undefined
            }
          />
          {item.status === 'NOT_APPLICABLE' && (
            <button
              type="button"
              onClick={() => setIsCompact((compact) => !compact)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-expanded={!isCompact}
            >
              {isCompact ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
              {isCompact ? 'Rozwiń' : 'Zwiń'}
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      {!isCompact && <div className="p-5 space-y-4">
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

          <div className="bg-slate-50/80 rounded-lg p-3 border border-slate-100">
            {renderDetailsSummary()}
          </div>
        </div>

        {/* Terminy wyświetlane wyłącznie do odczytu */}
        <div className="space-y-3 py-4 border-y border-slate-200 text-xs">
          <div className="flex items-center justify-between gap-3">
            <h4 className="font-bold uppercase tracking-wider text-slate-700">Terminy</h4>
            <button type="button" onClick={onOpenEditModal} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              {canEdit ? 'Edytuj daty' : 'Podgląd'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(() => {
              const d = item.details || {};
              const formatDate = (value: unknown) => {
                if (typeof value !== 'string' || !value) return '';
                return /^\\d{4}-\\d{2}-\\d{2}$/.test(value) ? value.split('-').reverse().join('.') : value;
              };
              const acceptanceDate = orderItems.find((related) => related.type === 'RYS_AKCEPTACJA')?.details?.dataAkceptacji;
              const dates: [string, string | undefined][] = item.type === 'ROZDZIELNICA_NN'
                ? [
                    ['Data zlecenia / zamówienia', item.orderDate],
                    ['Planowana data gotowości', item.plannedDate],
                    ['Data gotowości - Płochocińska', d.dataGotowosciFakt],
                    ['Data dostawy do Pyskowic', d.dataPlDostawyPyskowice],
                  ]
                : item.type === 'MOST'
                ? [
                    ['Data zlecenia / zamówienia', item.orderDate],
                    ['Data dostawy do Pyskowic', d.dataPlDostawyPyskowice],
                  ]
                : item.type === 'RYS_AKCEPTACJA'
                ? [['Data akceptacji', d.dataAkceptacji]]
                : item.type === 'KOLORY' || item.type === 'OPISY'
                ? [['Data akceptacji', acceptanceDate]]
                : item.type === 'ZAP_SERWISPOL'
                ? [['Data zapytania', d.dataZapytania]]
                : item.type === 'ZAM_SERWISPOL'
                ? [
                    ['Data zlecenia', d.dataZamowienia],
                    ['Przewidywana data wykonania prac', d.uzgodnionyTermin],
                  ]
                : item.type === 'POWYKONAWCZA'
                ? [
                    ['Data wysyłki DTR', d.dataWysylkiDTR],
                    ['Data wysyłki dokumentacji Powykonawczej', d.dataPrzekazaniaDokumentacji],
                  ]
                : [
                    ...(item.type === 'DATA_WYJAZDU' ? [] : [['Data zlecenia / zamówienia', item.orderDate] as [string, string | undefined]]),
                    [item.type === 'DATA_WYJAZDU' ? 'Planowana data wyjazdu' : 'Planowana data gotowości', item.plannedDate],
                    [item.type === 'DATA_WYJAZDU' ? 'Rzeczywista data wyjazdu' : 'Rzeczywista data zakończenia', item.completedDate],
                  ];
              return dates.map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="font-semibold text-slate-500">{label}</div>
                  <div className="mt-1 font-mono font-bold text-slate-800">
                    {formatDate(value) || '—'}
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>

        {/* Uwagi — edycja wyłącznie w oknie elementu */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
              <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
              <span>Uwagi do elementu</span>
            </div>
            <button type="button" onClick={onOpenEditModal} className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              {canEdit ? 'Edytuj uwagi' : 'Podgląd'}
            </button>
          </div>
          <div className={`p-3 rounded-lg text-xs border whitespace-pre-wrap break-words ${
            item.notes
              ? isProblem ? 'bg-rose-100/60 border-rose-200 text-rose-900 font-medium' : 'bg-slate-50 border-slate-200 text-slate-800'
              : 'bg-slate-50/50 border-dashed border-slate-200 text-slate-400 italic'
          }`}>
            {item.notes || 'Brak wpisanych uwag.'}
          </div>
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
      </div>}
    </section>
  );
};
