import React, { useEffect, useMemo, useState } from 'react';
import { Order } from '../types/enco';
import {
  Plus, Trash2, ChevronUp, ChevronDown, Settings2, FileText, Layers3,
  Save, RotateCcw, Check, GripVertical, Eye, CircleHelp,
} from 'lucide-react';

type FieldType = 'text' | 'number' | 'date' | 'select' | 'textarea' | 'checkbox';
type FormBinding = { scope: 'order' | 'item'; key: string; itemType?: string };
type FormField = {
  id: string;
  binding?: FormBinding | null;
  label: string;
  type: FieldType;
  placeholder?: string;
  defaultValue?: string;
  options?: string[];
  required?: boolean;
};
type FormSection = { id: string; title: string; description?: string; fields: FormField[] };
type FormTemplate = { sections: FormSection[] };
type FormValues = Record<string, string | boolean>;

const DEFAULT_TEMPLATE: FormTemplate = {
  sections: [
    { id: 'order', title: 'Dane zlecenia', description: 'Podstawowe informacje identyfikujące zamówienie.', fields: [
      { id: 'zd', label: 'Numer ZD', type: 'text', placeholder: 'Np. 69' },
      { id: 'zd-date', label: 'Data ZD', type: 'date' },
      { id: 'zl', label: 'Numer ZL', type: 'text', required: true },
      { id: 'project', label: 'Projekt / obiekt', type: 'text', required: true },
      { id: 'client', label: 'Klient', type: 'text' },
      { id: 'delivery', label: 'Termin dostawy', type: 'date' },
      { id: 'install-date', label: 'Termin montażu', type: 'date' },
      { id: 'documentation', label: 'Dokumentacja / rysunek', type: 'text', placeholder: 'Numer lub rewizja' },
    ]},
    { id: 'shell', title: 'Obudowa i konstrukcja', description: 'Wymiary, ściany, odporność ogniowa i dach.', fields: [
      { id: 'shell-type', label: 'Typ obudowy', type: 'select', options: ['BEK', 'NZ', 'Inny'], required: true },
      { id: 'shell-size', label: 'Rozmiar obudowy', type: 'text', placeholder: 'Np. 250/420', required: true },
      { id: 'shell-dimensions', label: 'Wymiary / wariant', type: 'text', placeholder: 'Szerokość × głębokość × wysokość' },
      { id: 'fire-walls', label: 'Liczba ścian o odporności ogniowej', type: 'number', placeholder: 'Liczba ścian' },
      { id: 'fire-rating', label: 'Klasa odporności ogniowej', type: 'select', options: ['Bez odporności ogniowej', 'REI 60', 'REI 120', 'REI 240', 'Do ustalenia'] },
      { id: 'roof', label: 'Rodzaj dachu', type: 'select', options: ['Betonowy dwuspadowy', 'Betonowy czterospadowy', 'Płaski', 'Inny', 'Do ustalenia'] },
      { id: 'foundation', label: 'Fundament / metaloplastyka', type: 'text', placeholder: 'Według projektu / rysunku' },
    ]},
    { id: 'joinery', title: 'Ślusarka, wentylacja i otwory', description: 'Każdy element dodawaj jako osobne pole lub wiersz; ilość i lokalizację zapisuj w szczegółach.', fields: [
      { id: 'doors', label: 'Drzwi', type: 'textarea', placeholder: 'Typ, wymiar, strona otwierania, pomieszczenie, ilość' },
      { id: 'hatches', label: 'Włazy', type: 'textarea', placeholder: 'Typ, wymiar, ilość i lokalizacja' },
      { id: 'grilles', label: 'Kraty wentylacyjne', type: 'textarea', placeholder: 'Wymiar, ilość, lokalizacja' },
      { id: 'transformer-mesh', label: 'Siatka wygrodzeniowa transformatora', type: 'textarea', placeholder: 'Wymiar, ilość, lokalizacja' },
      { id: 'barrier', label: 'Barierka ochronna', type: 'textarea', placeholder: 'Typ, wymiar, ilość i lokalizacja' },
      { id: 'signal-hole', label: 'Otwory pod lampki sygnalizacyjne', type: 'text', placeholder: 'Ilość i lokalizacja' },
      { id: 'antenna-hole', label: 'Otwór pod antenę', type: 'text', placeholder: 'Średnica i lokalizacja' },
    ]},
    { id: 'finish', title: 'Kolorystyka i wykończenie', fields: [
      { id: 'facade-color', label: 'Kolor elewacji (RAL)', type: 'text', placeholder: 'Np. RAL 7044' },
      { id: 'roof-color', label: 'Kolor dachu i obróbek (RAL)', type: 'text', placeholder: 'Kod RAL' },
      { id: 'door-color', label: 'Kolor drzwi (RAL)', type: 'text', placeholder: 'Kod RAL' },
      { id: 'anti-graffiti', label: 'Antygraffiti', type: 'select', options: ['Do potwierdzenia', 'Tak', 'Nie'], defaultValue: 'Do potwierdzenia' },
      { id: 'plaster', label: 'Rodzaj tynku', type: 'select', options: ['Baranek', 'Gładki', 'Inny', 'Nie dotyczy'], defaultValue: 'Baranek' },
    ]},
    { id: 'penetrations', title: 'Przepusty i uziemienie', description: 'Dla każdego przepustu określ typ, ilość, średnicę, pozycję na obudowie i wkład uszczelniający.', fields: [
      { id: 'penetration-bws', label: 'Przepusty BWS', type: 'textarea', placeholder: 'Ilość, średnica, pozycja na obudowie, wkład' },
      { id: 'penetration-hsi', label: 'Przepusty HSI', type: 'textarea', placeholder: 'Ilość, średnica, pozycja na obudowie, wkład' },
      { id: 'penetration-hea', label: 'Przepusty HEA', type: 'textarea', placeholder: 'Ilość i dokładna pozycja' },
      { id: 'penetration-100', label: 'Przepusty Ø100 mm', type: 'textarea', placeholder: 'Ilość, pozycja i uszczelnienie' },
      { id: 'penetration-other', label: 'Pozostałe przepusty', type: 'textarea', placeholder: 'Typ, ilość, średnica, pozycja, wkład' },
      { id: 'earthing', label: 'Rodzaj instalacji uziemiającej', type: 'select', options: ['Linka', 'Bednarka', 'Linka i bednarka', 'Inne', 'Do ustalenia'] },
    ]},
    { id: 'equipment', title: 'Wyposażenie stacji', fields: [
      { id: 'sn', label: 'Rozdzielnica SN', type: 'textarea', placeholder: 'Producent, typ, konfiguracja, uwagi' },
      { id: 'nn', label: 'Rozdzielnica NN', type: 'textarea', placeholder: 'Typ, konfiguracja, uwagi' },
      { id: 'telemechanics', label: 'Telemechanika', type: 'textarea', placeholder: 'Typ sterownika, szafa, konfiguracja' },
      { id: 'transformer', label: 'Transformator', type: 'textarea', placeholder: 'Typ, moc, parametry' },
      { id: 'extra-equipment', label: 'Pozostałe wyposażenie', type: 'textarea', placeholder: 'Wskaźniki, oświetlenie, wentylacja i inne' },
    ]},
    { id: 'deliveries-pyskowice', title: 'Dostawy — Pyskowice', fields: [
      { id: 'pysk-anti-vibration', label: 'Podkładki antywibracyjne', type: 'text', defaultValue: '1 kpl.' },
      { id: 'pysk-cross-clamps', label: 'Zaciski krzyżowe', type: 'text', placeholder: 'Sprawdzić zgodność gwintów z przepustami' },
      { id: 'pysk-nn-bridges', label: 'Mosty nN', type: 'text', defaultValue: 'Wg ustaleń' },
      { id: 'pysk-nn-coupling', label: 'Sprzęgło między rozdzielnicami nN', type: 'text', defaultValue: '3x(4YKY(1x240 mm²))' },
    ]},
    { id: 'deliveries-warsaw', title: 'Dostawy — Warszawa', fields: [
      { id: 'warsaw-masking', label: 'Blachy maskujące na połączeniu budynków', type: 'text' },
      { id: 'warsaw-sn-bridge', label: 'Most kablowy SN z głowicami POLT 24C/1XI', type: 'text', defaultValue: '2 kpl.' },
      { id: 'warsaw-hsd', label: 'Wkłady uszczelniające HSD 100-SSG', type: 'text', defaultValue: '48 szt.' },
      { id: 'warsaw-hrd', label: 'Wkłady uszczelniające HRD 150-SG-3', type: 'text', defaultValue: '10 szt.' },
      { id: 'warsaw-phase', label: 'Uzgadniacz faz', type: 'text' },
      { id: 'warsaw-sensors', label: 'Sensory prądowe', type: 'text' },
      { id: 'warsaw-sn-coupling', label: 'Sprzęgło SN z głowicami POLT 24C/1XI 3xYHAKXS', type: 'text', defaultValue: '1x120 mm' },
      { id: 'warsaw-nn-coupling', label: 'Sprzęgło między rozdzielnicami nN', type: 'text', defaultValue: '3x(4YKY(1x240 mm²))' },
    ]},
    { id: 'confirmations', title: 'Potwierdzenia i uwagi', fields: [
      { id: 'installer', label: 'Firma montażowa', type: 'text' },
      { id: 'mounting-date', label: 'Termin montażu', type: 'date' },
      { id: 'descriptions', label: 'Opisy / dane do potwierdzenia', type: 'textarea', placeholder: 'Ustalenia wymagające potwierdzenia' },
      { id: 'photo-docs', label: 'Dokumentacja zdjęciowa', type: 'textarea', placeholder: 'Zakres dokumentacji' },
      { id: 'notes', label: 'Uwagi, braki i kwestie do wyjaśnienia', type: 'textarea', placeholder: 'Dodatkowe ustalenia' },
    ]},
  ],
};

const STORAGE_TEMPLATE_KEY = 'enco-form-template-v2';
const storageDraftKey = (orderNumber: string) => 'enco-form-draft-v2:' + (orderNumber || 'bez-numeru');

function safeRead<T,>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? JSON.parse(value) as T : fallback;
  } catch { return fallback; }
}

function createId() {
  return 'field-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

interface FormsModuleViewProps {
  order: Order;
  onUpdateOrderStatus: (orderId: string, updatedOrder: Order) => void;
}

const DEFAULT_BINDINGS: Record<string, FormBinding> = {
  project:{scope:'order',key:'projectName'}, client:{scope:'order',key:'client'},
  delivery:{scope:'item',itemType:'OBUDOWA',key:'terminDostawy'},
  'shell-type':{scope:'item',itemType:'OBUDOWA',key:'typObudowy'},
  'shell-size':{scope:'item',itemType:'OBUDOWA',key:'rozmiar'},
  'shell-dimensions':{scope:'item',itemType:'OBUDOWA',key:'wymiary'},
  'fire-walls':{scope:'item',itemType:'OBUDOWA',key:'liczbaScianOdpornosciOgniowej'},
  'fire-rating':{scope:'item',itemType:'OBUDOWA',key:'klasaOdpornosciOgniowej'},
  roof:{scope:'item',itemType:'OBUDOWA',key:'rodzajDachu'}, foundation:{scope:'item',itemType:'OBUDOWA',key:'fundamentMetaloplastyka'},
  doors:{scope:'item',itemType:'OBUDOWA',key:'slusarka.drzwi'}, hatches:{scope:'item',itemType:'OBUDOWA',key:'slusarka.wlazy'},
  grilles:{scope:'item',itemType:'OBUDOWA',key:'slusarka.kratyWentylacyjne'},
  'transformer-mesh':{scope:'item',itemType:'OBUDOWA',key:'slusarka.siatkaTransformatora'},
  barrier:{scope:'item',itemType:'OBUDOWA',key:'slusarka.barierkaOchronna'},
  'signal-hole':{scope:'item',itemType:'OBUDOWA',key:'otwory.lampkiSygnalizacyjne'},
  'antenna-hole':{scope:'item',itemType:'OBUDOWA',key:'otwory.antenna'},
  'facade-color':{scope:'item',itemType:'OBUDOWA',key:'kolorystyka.elewacjaRAL'},
  'roof-color':{scope:'item',itemType:'OBUDOWA',key:'kolorystyka.dachRAL'},
  'door-color':{scope:'item',itemType:'OBUDOWA',key:'kolorystyka.drzwiRAL'},
  'anti-graffiti':{scope:'item',itemType:'OBUDOWA',key:'antygraffiti'}, plaster:{scope:'item',itemType:'OBUDOWA',key:'rodzajTynku'},
  'penetration-bws':{scope:'item',itemType:'OBUDOWA',key:'przepusty.bws'},
  'penetration-hsi':{scope:'item',itemType:'OBUDOWA',key:'przepusty.hsi'},
  'penetration-hea':{scope:'item',itemType:'OBUDOWA',key:'przepusty.hea'},
  'penetration-100':{scope:'item',itemType:'OBUDOWA',key:'przepusty.fi100'},
  'penetration-other':{scope:'item',itemType:'OBUDOWA',key:'przepusty.pozostale'},
  earthing:{scope:'item',itemType:'OBUDOWA',key:'rodzajUziemienia'},
  sn:{scope:'item',itemType:'ROZDZIELNICA_SN',key:'daneFormularzaObudowy'},
  nn:{scope:'item',itemType:'ROZDZIELNICA_NN',key:'daneFormularzaObudowy'},
  telemechanics:{scope:'item',itemType:'SZAFKA_TELEMECHANIKI',key:'daneFormularzaObudowy'},
  transformer:{scope:'item',itemType:'TRANSFORMATOR_POTRZEB_WLASNYCH',key:'daneFormularzaObudowy'},
  'extra-equipment':{scope:'item',itemType:'OBUDOWA',key:'pozostaleWyposazenie'},
  'pysk-anti-vibration':{scope:'item',itemType:'OBUDOWA',key:'dostawy.pyskowice.podkladkiAntywibracyjne'},
  'pysk-cross-clamps':{scope:'item',itemType:'OBUDOWA',key:'dostawy.pyskowice.zaciskiKrzyzowe'},
  'pysk-nn-bridges':{scope:'item',itemType:'OBUDOWA',key:'dostawy.pyskowice.mostyNN'},
  'pysk-nn-coupling':{scope:'item',itemType:'OBUDOWA',key:'dostawy.pyskowice.sprzegloNN'},
  'warsaw-masking':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.blachyMaskujace'},
  'warsaw-sn-bridge':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.mostKablowySN'},
  'warsaw-hsd':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.wkladyHSD'},
  'warsaw-hrd':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.wkladyHRD'},
  'warsaw-phase':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.uzgadniaczFaz'},
  'warsaw-sensors':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.sensoryPradowe'},
  'warsaw-sn-coupling':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.sprzegloSN'},
  'warsaw-nn-coupling':{scope:'item',itemType:'OBUDOWA',key:'dostawy.warszawa.sprzegloNN'},
  installer:{scope:'order',key:'additionalInfo'}, descriptions:{scope:'item',itemType:'OBUDOWA',key:'potwierdzenia.opisy'},
  'photo-docs':{scope:'item',itemType:'OBUDOWA',key:'potwierdzenia.dokumentacjaZdjecia'},
  notes:{scope:'order',key:'generalNotes'}
};
const getFieldBinding = (field: FormField): FormBinding | null =>
  field.binding !== undefined ? field.binding : DEFAULT_BINDINGS[field.id] || null;
const readPath = (source: Record<string, any> | undefined, path: string): any =>
  path.split('.').reduce((value, key) => value == null ? undefined : value[key], source);
const writePath = (source: Record<string, any>, path: string, value: any): Record<string, any> => {
  const keys = path.split('.');
  const result = { ...source };
  let cursor: Record<string, any> = result;
  let original: Record<string, any> = source;
  keys.slice(0, -1).forEach(key => {
    const child = original?.[key];
    const next = child && typeof child === 'object' && !Array.isArray(child) ? child : {};
    cursor[key] = { ...next }; cursor = cursor[key]; original = next;
  });
  cursor[keys[keys.length - 1]] = value;
  return result;
};
const ORDER_BINDABLE_KEYS = ['projectName','client','stationSize','departureDate','generalNotes','additionalInfo'];

export const FormsModuleView: React.FC<FormsModuleViewProps> = ({ order, onUpdateOrderStatus }) => {
  const orderNumber = order.orderNumber;
  const projectName = order.projectName || '';
  const client = order.client || '';
  const [template, setTemplate] = useState<FormTemplate>(() => safeRead(STORAGE_TEMPLATE_KEY, DEFAULT_TEMPLATE));
  const [templateReady, setTemplateReady] = useState(false);
  const [templateSyncMessage, setTemplateSyncMessage] = useState('');
  const [values, setValues] = useState<FormValues>(() => safeRead(storageDraftKey(orderNumber), {}));
  const [activeSection, setActiveSection] = useState('order');
  const [mode, setMode] = useState<'fill' | 'manage' | 'preview'>('fill');
  const [newFieldSection, setNewFieldSection] = useState('shell');
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<FieldType>('text');
  const [savedMessage, setSavedMessage] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [applyError, setApplyError] = useState('');

  useEffect(() => {
    const draft = safeRead<FormValues>(storageDraftKey(orderNumber), {});
    const linkedValues: FormValues = {};
    template.sections.forEach(section => section.fields.forEach(field => {
      const binding = getFieldBinding(field);
      if (!binding) return;
      let linked: any;
      if (binding.scope === 'order') linked = (order as any)[binding.key];
      else {
        const item = order.items.find(candidate => candidate.type === binding.itemType);
        linked = item ? readPath(item.details || {}, binding.key) : undefined;
      }
      if (linked !== undefined && linked !== null) linkedValues[field.id] = typeof linked === 'object' ? JSON.stringify(linked, null, 2) : linked;
    }));
    setValues({ ...linkedValues, ...draft });
  }, [orderNumber]);

  useEffect(() => {
    let active = true;
    fetch('/api/form-template', { headers: { Accept: 'application/json' }, cache: 'no-store' })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Nie udało się pobrać szablonu.');
        if (active && result.template && Array.isArray(result.template.sections)) {
          setTemplate(result.template as FormTemplate);
        }
      })
      .catch(() => {
        if (active) setTemplateSyncMessage('Nie udało się pobrać wspólnego szablonu — używany jest zapis lokalny.');
      })
      .finally(() => { if (active) setTemplateReady(true); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_TEMPLATE_KEY, JSON.stringify(template)); } catch { /* storage can be disabled */ }
    if (!templateReady) return;
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/form-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ template }),
        });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Nie udało się zapisać szablonu.');
        setTemplateSyncMessage('Wspólny szablon zapisany');
      } catch (error) {
        setTemplateSyncMessage(error instanceof Error ? error.message : 'Nie udało się zsynchronizować szablonu.');
      }
    }, 700);
    return () => window.clearTimeout(timeout);
  }, [template, templateReady]);

  useEffect(() => {
    try { window.localStorage.setItem(storageDraftKey(orderNumber), JSON.stringify(values)); } catch { /* storage can be disabled */ }
  }, [values, orderNumber]);

  const linkedChanges = useMemo(() => allFields.filter(field => {
    const binding = getFieldBinding(field);
    if (!binding) return false;
    const value = String(values[field.id] ?? field.defaultValue ?? '');
    let existing: any;
    if (binding.scope === 'order') existing = (order as any)[binding.key];
    else {
      const item = order.items.find(candidate => candidate.type === binding.itemType);
      existing = item ? readPath(item.details || {}, binding.key) : undefined;
    }
    return value !== String(existing ?? '');
  }), [allFields, values, order]);
  const missingLinkedItems = useMemo(() => linkedChanges.filter(field => {
    const binding = getFieldBinding(field);
    return binding?.scope === 'item' && !order.items.some(item => item.type === binding.itemType);
  }), [linkedChanges, order.items]);
  const applyLinkedChanges = () => {
    setApplyError('');
    if (missingLinkedItems.length) {
      setApplyError('Brakuje pozycji w zleceniu dla części powiązań: ' + [...new Set(missingLinkedItems.map(field => getFieldBinding(field)?.itemType || ''))].join(', ') + '. Najpierw dodaj te pozycje do zlecenia.');
      return;
    }
    let updated: Order = { ...order, items: order.items.map(item => ({ ...item, details: { ...(item.details || {}) } })), updatedAt: new Date().toISOString() };
    linkedChanges.forEach(field => {
      const binding = getFieldBinding(field);
      if (!binding) return;
      const raw = values[field.id] ?? field.defaultValue ?? '';
      const value: any = field.type === 'number' && String(raw).trim() !== '' ? Number(raw) : raw;
      if (binding.scope === 'order') {
        if (ORDER_BINDABLE_KEYS.includes(binding.key)) (updated as any)[binding.key] = value;
        return;
      }
      const itemIndex = updated.items.findIndex(item => item.type === binding.itemType);
      if (itemIndex < 0) return;
      const target = updated.items[itemIndex];
      updated.items[itemIndex] = { ...target, details: writePath(target.details || {}, binding.key, value), updatedAt: new Date().toISOString() };
    });
    onUpdateOrderStatus(order.id, updated);
    try { window.localStorage.removeItem(storageDraftKey(orderNumber)); } catch {}
    setReviewOpen(false);
    setSavedMessage('Zatwierdzone zmiany przekazano do zlecenia');
    window.setTimeout(() => setSavedMessage(''), 3000);
  };
  const currentSection = template.sections.find(section => section.id === activeSection) || template.sections[0];
  const allFields = useMemo(() => template.sections.flatMap(section => section.fields), [template]);
  const requiredMissing = allFields.filter(field => field.required && !String(values[field.id] ?? '').trim());
  const filledCount = allFields.filter(field => String(values[field.id] ?? field.defaultValue ?? '').trim()).length;

  useEffect(() => {
    if (orderNumber && !values.zl) setValues(current => ({ ...current, zl: orderNumber }));
    if (projectName && !values.project) setValues(current => ({ ...current, project: projectName }));
    if (client && !values.client) setValues(current => ({ ...current, client }));
  }, [orderNumber, projectName, client]);

  const updateField = (fieldId: string, patch: Partial<FormField>) => {
    setTemplate(current => ({ ...current, sections: current.sections.map(section => ({
      ...section, fields: section.fields.map(field => field.id === fieldId ? { ...field, ...patch } : field),
    })) }));
  };
  const removeField = (sectionId: string, fieldId: string) => {
    setTemplate(current => ({ ...current, sections: current.sections.map(section => section.id === sectionId
      ? { ...section, fields: section.fields.filter(field => field.id !== fieldId) } : section) }));
  };
  const moveField = (sectionId: string, fieldId: string, direction: -1 | 1) => {
    setTemplate(current => ({ ...current, sections: current.sections.map(section => {
      if (section.id !== sectionId) return section;
      const fields = [...section.fields];
      const index = fields.findIndex(field => field.id === fieldId);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= fields.length) return section;
      [fields[index], fields[next]] = [fields[next], fields[index]];
      return { ...section, fields };
    }) }));
  };
  const addField = () => {
    const label = newFieldLabel.trim();
    if (!label) return;
    const id = createId();
    setTemplate(current => ({ ...current, sections: current.sections.map(section => section.id === newFieldSection
      ? { ...section, fields: [...section.fields, { id, label, type: newFieldType, ...(newFieldType === 'select' ? { options: ['Tak', 'Nie', 'Do ustalenia'] } : {}) }] }
      : section) }));
    setValues(current => ({ ...current, [id]: '' }));
    setNewFieldLabel('');
    setMode('manage');
    setActiveSection(newFieldSection);
  };
  const saveDraft = () => {
    try {
      window.localStorage.setItem(storageDraftKey(orderNumber), JSON.stringify(values));
      setSavedMessage('Szkic zapisany');
      window.setTimeout(() => setSavedMessage(''), 2200);
    } catch {
      setSavedMessage('Nie udało się zapisać w tej przeglądarce');
    }
  };
  const resetTemplate = () => {
    setTemplate(DEFAULT_TEMPLATE);
    setShowResetConfirm(false);
    setSavedMessage('Przywrócono domyślny układ pól');
    window.setTimeout(() => setSavedMessage(''), 2200);
  };
  const updateValue = (id: string, value: string | boolean) => setValues(current => ({ ...current, [id]: value }));

  const renderInput = (field: FormField, compact = false) => {
    const common = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
    const value = values[field.id] ?? field.defaultValue ?? '';
    if (field.type === 'checkbox') return <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><input type="checkbox" checked={Boolean(value)} onChange={event => updateValue(field.id, event.target.checked)} className="h-4 w-4 accent-blue-600" />{field.placeholder || 'Tak'}</label>;
    if (field.type === 'textarea') return <textarea rows={compact ? 2 : 3} value={String(value)} onChange={event => updateValue(field.id, event.target.value)} placeholder={field.placeholder || 'Wpisz dane…'} className={common + ' resize-y'} />;
    if (field.type === 'select') return <select value={String(value)} onChange={event => updateValue(field.id, event.target.value)} className={common}><option value="">Wybierz…</option>{(field.options || []).map(option => <option key={option} value={option}>{option}</option>)}</select>;
    return <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={String(value)} onChange={event => updateValue(field.id, event.target.value)} placeholder={field.placeholder || 'Wpisz wartość…'} className={common} />;
  };

  return (
    <div className="min-h-[70vh] bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-7">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-blue-600 p-3 text-white shadow-sm"><FileText className="h-6 w-6" /></div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">Enco-flow · kreator dokumentów</div>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Zlecenie obudowy</h2>
              <p className="mt-1 text-sm text-slate-500">Formularz konfigurowalny — pola, kolejność i wartości domyślne możesz dopasować do procesu.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Zlecenie</div>
              <div className="font-mono text-sm font-bold text-slate-900">{orderNumber || 'Nie przypisano'}</div>
              {projectName && <div className="max-w-56 truncate text-xs text-slate-500">{projectName}</div>}
            </div>
            <button type="button" onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700"><Save className="h-4 w-4" /> Zapisz szkic</button>
          </div>
        </div>
        <div className="mx-auto mt-5 flex max-w-[1500px] flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            <button type="button" onClick={() => setMode('fill')} className={'rounded-lg px-4 py-2 text-sm font-semibold ' + (mode === 'fill' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}>Wypełnianie</button>
            <button type="button" onClick={() => setMode('manage')} className={'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ' + (mode === 'manage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}><Settings2 className="h-4 w-4" /> Konfiguracja pól</button>
            <button type="button" onClick={() => setMode('preview')} className={'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ' + (mode === 'preview' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}><Eye className="h-4 w-4" /> Podgląd</button>
            <button type="button" onClick={() => setReviewOpen(true)} disabled={linkedChanges.length === 0} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">Sprawdź i zastosuj ({linkedChanges.length})</button>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {templateSyncMessage && <span className="max-w-72 text-right">{templateSyncMessage}</span>}
            <span className="rounded-full bg-blue-50 px-3 py-1.5 font-semibold text-blue-700">{filledCount} / {allFields.length} pól uzupełnionych</span>
            {requiredMissing.length > 0 && <span className="font-semibold text-amber-700">{requiredMissing.length} wymaganych pól do uzupełnienia</span>}
            {savedMessage && <span className="inline-flex items-center gap-1 font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" />{savedMessage}</span>}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-5 p-4 sm:p-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm xl:sticky xl:top-4">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <div className="text-xs font-black uppercase tracking-wider text-slate-500">Sekcje formularza</div>
            <Layers3 className="h-4 w-4 text-slate-400" />
          </div>
          <nav className="space-y-1">
            {template.sections.map((section, index) => (
              <button key={section.id} type="button" onClick={() => setActiveSection(section.id)} className={'flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ' + (activeSection === section.id ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-100' : 'text-slate-600 hover:bg-slate-50')}>
                <span className={'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-black ' + (activeSection === section.id ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500')}>{index + 1}</span>
                <span className="min-w-0 flex-1"><span className="block text-xs font-bold leading-5">{section.title}</span><span className="mt-0.5 block text-[10px] text-slate-400">{section.fields.length} pól</span></span>
              </button>
            ))}
          </nav>
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-[11px] leading-5 text-slate-500"><CircleHelp className="mb-1 h-4 w-4" />W konfiguracji możesz usuwać pola, przestawiać ich kolejność i dodawać nowe. Wartości domyślne nie blokują edycji.</div>
        </aside>

        <main className="min-w-0">
          {mode === 'manage' && (
            <section className="mb-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h3 className="text-base font-black text-slate-900">Konfiguracja pól</h3><p className="mt-1 max-w-3xl text-sm text-slate-600">Zmieniaj etykiety, typy, wartości domyślne i kolejność. Usunięcie pola z szablonu nie kasuje jego wcześniej zapisanej wartości ze szkicu.</p></div>
                <button type="button" onClick={() => setShowResetConfirm(true)} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"><RotateCcw className="h-3.5 w-3.5" /> Przywróć domyślne</button>
              </div>
              <p className="mt-2 text-xs text-slate-600">Powiązanie pola można zmienić poniżej. Dla pozycji zlecenia wskazuj typ pozycji oraz klucz danych; zmiany trafiają do zlecenia dopiero po sprawdzeniu i zatwierdzeniu.</p>
              {showResetConfirm && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><span className="text-amber-900">Przywrócić początkowy układ wszystkich pól? Obecne wartości szkicu pozostaną zapisane.</span><div className="flex gap-2"><button type="button" onClick={() => setShowResetConfirm(false)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold">Anuluj</button><button type="button" onClick={resetTemplate} className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white">Przywróć</button></div></div>}
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[1.3fr_1fr_160px_auto]">
                <input value={newFieldLabel} onChange={event => setNewFieldLabel(event.target.value)} placeholder="Nazwa nowego pola" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500" />
                <select value={newFieldSection} onChange={event => setNewFieldSection(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">{template.sections.map(section => <option key={section.id} value={section.id}>{section.title}</option>)}</select>
                <select value={newFieldType} onChange={event => setNewFieldType(event.target.value as FieldType)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="text">Tekst</option><option value="textarea">Dłuższy opis</option><option value="number">Liczba</option><option value="date">Data</option><option value="select">Lista wyboru</option><option value="checkbox">Pole wyboru</option></select>
                <button type="button" onClick={addField} disabled={!newFieldLabel.trim()} className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" /> Dodaj pole</button>
              </div>
            </section>
          )}

          {!currentSection ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">Brak sekcji. Przywróć domyślny układ.</div> : (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-5 sm:px-7">
                <div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">Sekcja {template.sections.findIndex(section => section.id === currentSection.id) + 1}</div><h3 className="mt-1 text-xl font-black text-slate-900">{currentSection.title}</h3>{currentSection.description && <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">{currentSection.description}</p>}</div>
                <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">{currentSection.fields.length} pól</span>
              </div>

              {mode === 'preview' ? (
                <div className="space-y-5 p-5 sm:p-7">
                  {template.sections.map(section => <div key={section.id}><h4 className="border-b border-slate-200 pb-2 text-sm font-black text-slate-800">{section.title}</h4><div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">{section.fields.map(field => <div key={field.id} className="border-b border-dashed border-slate-200 pb-2"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{field.label}</div><div className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{String(values[field.id] ?? field.defaultValue ?? '') || '—'}</div></div>)}</div></div>)}
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">To jest podgląd szkicu. Nie aktualizuje jeszcze danych w zleceniu. Aktualizacja nastąpi dopiero w docelowym etapie sprawdzenia i akceptacji zmian.</div>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {currentSection.fields.length === 0 && <div className="p-8 text-center text-sm text-slate-500">Ta sekcja nie ma pól. Przejdź do konfiguracji, aby dodać nowe.</div>}
                  {currentSection.fields.map((field, index) => (
                    <div key={field.id} className="group grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-slate-50/70 sm:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.4fr)] sm:px-7">
                      <div className="min-w-0">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 flex flex-col gap-0.5 text-slate-300">
                            <GripVertical className="h-4 w-4" />
                            {mode === 'manage' && <><button type="button" title="Przenieś wyżej" disabled={index === 0} onClick={() => moveField(currentSection.id, field.id, -1)} className="rounded p-0.5 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20"><ChevronUp className="h-3.5 w-3.5" /></button><button type="button" title="Przenieś niżej" disabled={index === currentSection.fields.length - 1} onClick={() => moveField(currentSection.id, field.id, 1)} className="rounded p-0.5 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-20"><ChevronDown className="h-3.5 w-3.5" /></button></>}
                          </div>
                          <div className="min-w-0 flex-1">
                            {mode !== 'manage' && getFieldBinding(field) && <div className="mb-1 text-[10px] font-semibold text-emerald-700">Powiązane: {getFieldBinding(field)?.scope === 'order' ? 'zlecenie.' : getFieldBinding(field)?.itemType + '.'}{getFieldBinding(field)?.key}</div>}
                            {mode === 'manage' ? <input value={field.label} onChange={event => updateField(field.id, { label: event.target.value })} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm font-bold text-slate-800 outline-none focus:border-blue-500" /> : <label className="block text-sm font-bold text-slate-800">{field.label}{field.required && <span className="ml-1 text-rose-600">*</span>}</label>}
                            {mode === 'manage' && <div className="mt-2 rounded-lg border border-blue-100 bg-blue-50/60 p-2">
                              <div className="mb-1 text-[10px] font-black uppercase tracking-wide text-blue-800">Powiązanie ze zleceniem</div>
                              <select value={getFieldBinding(field)?.scope || 'none'} onChange={event => {
                                if (event.target.value === 'none') updateField(field.id, { binding: null });
                                else if (event.target.value === 'order') updateField(field.id, { binding: { scope: 'order', key: 'projectName' } });
                                else updateField(field.id, { binding: { scope: 'item', itemType: 'OBUDOWA', key: 'formularzObudowy.' + field.id } });
                              }} className="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                <option value="none">Bez powiązania</option><option value="order">Pole główne zlecenia</option><option value="item">Pozycja zlecenia</option>
                              </select>
                              {getFieldBinding(field) && <div className="grid grid-cols-1 gap-2">
                                {getFieldBinding(field)?.scope === 'item' && <select value={getFieldBinding(field)?.itemType || 'OBUDOWA'} onChange={event => updateField(field.id, { binding: { ...(getFieldBinding(field) as FormBinding), itemType: event.target.value } })} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs">
                                  {['OBUDOWA','ROZDZIELNICA_SN','ROZDZIELNICA_NN','SZAFKA_TELEMECHANIKI','TRANSFORMATOR_POTRZEB_WLASNYCH','KOLORY','DRZWI','MOST','DODATKOWE'].map(type => <option key={type} value={type}>{type}</option>)}
                                </select>}
                                <input value={getFieldBinding(field)?.key || ''} onChange={event => updateField(field.id, { binding: { ...(getFieldBinding(field) as FormBinding), key: event.target.value } })} placeholder="Klucz pola, np. rozmiar lub przepusty.bws" className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" />
                                {getFieldBinding(field)?.scope === 'order' && <p className="text-[10px] text-slate-500">Dostępne pola główne: {ORDER_BINDABLE_KEYS.join(', ')}</p>}
                              </div>}
                            </div>}
                            {mode === 'manage' && <div className="mt-2 grid grid-cols-1 gap-2"><select value={field.type} onChange={event => updateField(field.id, { type: event.target.value as FieldType, ...(event.target.value === 'select' && !field.options?.length ? { options: ['Tak', 'Nie', 'Do ustalenia'] } : {}) })} className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"><option value="text">Tekst</option><option value="textarea">Dłuższy opis</option><option value="number">Liczba</option><option value="date">Data</option><option value="select">Lista wyboru</option><option value="checkbox">Pole wyboru</option></select><input value={field.defaultValue || ''} onChange={event => updateField(field.id, { defaultValue: event.target.value })} placeholder="Wartość domyślna (opcjonalnie)" className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" /><input value={field.placeholder || ''} onChange={event => updateField(field.id, { placeholder: event.target.value })} placeholder="Podpowiedź w polu (opcjonalnie)" className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" />{field.type === 'select' && <input value={(field.options || []).join(', ')} onChange={event => updateField(field.id, { options: event.target.value.split(',').map(option => option.trim()).filter(Boolean) })} placeholder="Opcje rozdziel przecinkami" className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs" />}<label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={Boolean(field.required)} onChange={event => updateField(field.id, { required: event.target.checked })} className="accent-blue-600" /> Pole wymagane</label></div>}
                          </div>
                        </div>
                      </div>
                      <div className="min-w-0">
                        {mode === 'preview' ? <div className="min-h-10 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{String(values[field.id] ?? field.defaultValue ?? '') || '—'}</div> : renderInput(field)}
                        {mode === 'manage' && <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[10px] text-slate-400">ID pola: {field.id}</span><button type="button" onClick={() => removeField(currentSection.id, field.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-50"><Trash2 className="h-3.5 w-3.5" /> Usuń pole</button></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50 px-5 py-3 sm:px-7">
                <div className="text-xs text-slate-500">Pola z gwiazdką są wymagane w tym szkicu.</div>
                <div className="flex gap-2"><button type="button" disabled={template.sections.findIndex(section => section.id === currentSection.id) === 0} onClick={() => setActiveSection(template.sections[template.sections.findIndex(section => section.id === currentSection.id) - 1].id)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 disabled:opacity-30">Poprzednia sekcja</button><button type="button" disabled={template.sections.findIndex(section => section.id === currentSection.id) === template.sections.length - 1} onClick={() => setActiveSection(template.sections[template.sections.findIndex(section => section.id === currentSection.id) + 1].id)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-30">Następna sekcja</button></div>
              </div>
            </section>
          )}
          {reviewOpen && <section className="mb-4 rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">Sprawdzenie zmian przed aktualizacją</h3><p className="mt-1 text-sm text-slate-600">Poniższe wartości zostaną zapisane w odpowiednich polach zlecenia. Nic nie zmieni się, dopóki nie zatwierdzisz tej listy.</p></div><button type="button" onClick={() => setReviewOpen(false)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Wróć do formularza</button></div>
            {linkedChanges.length === 0 ? <p className="mt-4 text-sm text-slate-500">Brak zmian do zastosowania.</p> : <div className="mt-4 space-y-2">{linkedChanges.map(field => { const binding = getFieldBinding(field); const item = binding?.scope === 'item' ? order.items.find(candidate => candidate.type === binding.itemType) : undefined; const before = binding?.scope === 'order' ? (order as any)[binding.key] : item ? readPath(item.details || {}, binding?.key || '') : undefined; return <div key={field.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_1fr_1fr]"><div><div className="text-sm font-bold text-slate-800">{field.label}</div><div className="mt-1 text-[10px] text-slate-500">{binding?.scope === 'order' ? 'Zlecenie' : binding?.itemType} · {binding?.key}</div></div><div><div className="text-[10px] font-bold uppercase text-slate-400">Obecnie</div><div className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-600">{before == null || before === '' ? '—' : String(before)}</div></div><div><div className="text-[10px] font-bold uppercase text-emerald-700">Po zatwierdzeniu</div><div className="mt-1 whitespace-pre-wrap break-words text-sm font-semibold text-slate-900">{String(values[field.id] ?? field.defaultValue ?? '') || '—'}</div></div></div>})}</div>}
            {applyError && <div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{applyError}</div>}
            {missingLinkedItems.length > 0 && <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">Nie znaleziono pozycji: {[...new Set(missingLinkedItems.map(field => getFieldBinding(field)?.itemType || ''))].join(', ')}. Te pola nie zostaną zapisane, dopóki odpowiednie pozycje nie istnieją w zleceniu.</div>}
            <div className="mt-4 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setReviewOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold">Anuluj</button><button type="button" disabled={linkedChanges.length === 0} onClick={applyLinkedChanges} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Zatwierdź i aktualizuj zlecenie</button></div>
          </section>}
          <div className="mt-4 flex flex-wrap items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-500"><div className="rounded-lg bg-amber-50 p-2 text-amber-700"><CircleHelp className="h-4 w-4" /></div><p className="flex-1">Konfiguracja pól jest zapisywana na serwerze i współdzielona z innymi użytkownikami. Wypełniony szkic jest obecnie przechowywany w tej przeglądarce. Formularz nie aktualizuje bezpośrednio danych zlecenia. Ten etap jest oddzielony od przyszłego procesu: uwagi i poprawki → sprawdzenie różnic → akceptacja aktualizacji.</p></div>
        </main>
      </div>
    </div>
  );
};
