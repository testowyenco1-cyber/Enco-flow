/**
 * ENCO FLOW — Core Data Models and Constants
 * System Kontroli Kompletności i Stanu Realizacji Stacji Transformatorowych
 */

export type ItemStatus = 'NOT_ORDERED' | 'ORDERED' | 'IN_PROGRESS' | 'READY' | 'PROBLEM' | 'NOT_APPLICABLE';

export type OrderStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'PROBLEM';

export interface Attachment {
  id: string;
  name: string;
  size?: string;
  uploadedAt: string;
  fileType?: string;
  url?: string;
  dataUrl?: string;
  folderCategory?: string; // e.g. '03_Rozdzielnica_SN'
  folderPath?: string;     // e.g. 'ENCO-2025-001/03_Rozdzielnica_SN'
  diskPath?: string;       // e.g. 'data_store/uploads/ENCO-2025-001/03_Rozdzielnica_SN/plik.pdf'
  uploadedBy?: string;     // e.g. 'Dział Handlowy', 'Admin'
}

export type StandardItemType =
  | 'OBUDOWA'
  | 'ROZDZIELNICA_SN'
  | 'ROZDZIELNICA_NN'
  | 'MOST'
  | 'RYS_AKCEPTACJA'
  | 'KOLORY'
  | 'OPISY'
  | 'DRZWI'
  | 'ZAP_SERWISPOL'
  | 'ZAM_SERWISPOL'
  | 'ZAP_JK'
  | 'ZAM_JK'
  | 'ZLECENIE_MONTAZU'
  | 'SZAFKA_TELEMECHANIKI'
  | 'TABLICA_POMIAROWA'
  | 'RPW'
  | 'TRANSFORMATOR_POTRZEB_WLASNYCH'
  | 'WSKAZNIKI_ZWARC'
  | 'POWYKONAWCZA'
  | 'DATA_WYJAZDU'
  | 'DODATKOWE';

export interface ItemTypeDefinition {
  type: StandardItemType | string;
  name: string;
  shortName: string;
  category: 'element' | 'dokumentacja' | 'logistyka' | 'podwykonawca';
  description: string;
}

export interface OrderItem {
  id: string;
  orderId: string;
  type: StandardItemType | string;
  name: string;
  shortName: string;
  status: ItemStatus;
  orderDate?: string; // Data wystawienia zlecenia / data zamówienia etapu (YYYY-MM-DD)
  plannedDate?: string;
  completedDate?: string;
  notes?: string;
  details: Record<string, any>;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

// ENCO Rozdzielnica SN specifications
export const SN_PRODUCERS = [
  'Schneider Electric',
  'EATON',
  'Siemens',
] as const;

export type SNProducer = (typeof SN_PRODUCERS)[number];

export const SN_MODELS_BY_PRODUCER: Record<SNProducer, string[]> = {
  'Schneider Electric': ['AirSeT'],
  'EATON': ['Xiria'],
  'Siemens': ['8DJH 24 Blue GIS'],
};

export const DEFAULT_SN_CONFIG = 'L-L-L-T';

export const SN_CONFIG_EXAMPLES = ['L-T', 'L-L-T', 'L-L-L-T', 'L-L-L-L-T'] as const;

export function isValidSNProducer(producer: string): producer is SNProducer {
  return SN_PRODUCERS.includes(producer as SNProducer);
}

export function isValidSNModel(
  producer: string,
  model: string,
  modelsByProducer: Record<string, string[]> = SN_MODELS_BY_PRODUCER,
): boolean {
  const models = modelsByProducer[producer];
  return Boolean(producer && model && models && models.includes(model));
}

export function validateSNCombination(
  producer?: string,
  model?: string,
  modelsByProducer: Record<string, string[]> = SN_MODELS_BY_PRODUCER,
): {
  isValid: boolean;
  error?: string;
} {
  if (!producer && !model) {
    return { isValid: false, error: 'Wybierz producenta i model rozdzielnicy SN.' };
  }
  if (!producer) {
    return { isValid: false, error: 'Wybierz producenta rozdzielnicy SN.' };
  }
  if (!Object.prototype.hasOwnProperty.call(modelsByProducer, producer)) {
    return { isValid: false, error: `Nieznany producent: ${producer}. Wybierz producenta ze słownika SN.` };
  }
  if (!model) {
    return { isValid: false, error: `Wybierz model rozdzielnicy dla producenta ${producer}.` };
  }
  if (!isValidSNModel(producer, model, modelsByProducer)) {
    return {
      isValid: false,
      error: `Nieprawidłowy model "${model}" dla producenta ${producer}. Dostępne modele: ${modelsByProducer[producer]?.join(', ') || 'brak'}.`,
    };
  }
  return { isValid: true };
}

// ==========================================
// ENCO Obudowa Betonowa (BEK / NZ) Specifications
// ==========================================

export type ObudowaType = 'BEK' | 'NZ';

export interface ObudowaTypeInfo {
  code: ObudowaType;
  label: string;
  fullLabel: string;
  auxiliaryName: string;
  description: string;
  heightTypeLabel: string; // Rozróżnienie: wysokość zewnętrzna vs wewnętrzna pomieszczeń
  defaultHeight: number; // w metrach
  defaultHeightFormatted: string; // "2,40 m" lub "2,66 m"
}

export const OBUDOWA_TYPES: Record<ObudowaType, ObudowaTypeInfo> = {
  BEK: {
    code: 'BEK',
    label: 'BEK',
    fullLabel: 'BEK — obudowa wewnętrzna',
    auxiliaryName: 'Obudowa wewnętrzna (korytarz obsługi wewnątrz stacji)',
    description: 'Stacja z wewnętrznym korytarzem obsługowym',
    heightTypeLabel: 'Wysokość wewnętrzna pomieszczeń',
    defaultHeight: 2.40,
    defaultHeightFormatted: '2,40 m',
  },
  NZ: {
    code: 'NZ',
    label: 'NZ',
    fullLabel: 'NZ — obudowa zewnętrzna',
    auxiliaryName: 'Obudowa zewnętrzna (obsługa z zewnątrz stacji)',
    description: 'Stacja kompaktowa obsługiwana z zewnątrz',
    heightTypeLabel: 'Wysokość zewnętrzna obudowy',
    defaultHeight: 2.66,
    defaultHeightFormatted: '2,66 m',
  },
};

export interface ObudowaSizeVariant {
  id: string;
  type: ObudowaType;
  name: string; // np. "NZ 130/240", "NZ 210/290", "BEK 250/350", "BEK 250/400", "BEK 300/450"
  width?: number; // szerokość w metrach (np. 1.30, 2.50)
  depth?: number; // głębokość w metrach (np. 2.40, 3.50)
  height?: number; // wysokość w metrach (potwierdzona dla wariantu lub domyślna)
  heightTypeLabel: string; // 'Wysokość zewnętrzna obudowy' | 'Wysokość wewnętrzna pomieszczeń'
  isCustom?: boolean;
}

// Baza domyślnych wariantów obudów
export const DEFAULT_OBUDOWA_VARIANTS: ObudowaSizeVariant[] = [
  // NZ — obudowa zewnętrzna
  {
    id: 'nz_130_240',
    type: 'NZ',
    name: 'NZ 130/240',
    width: 1.30,
    depth: 2.40,
    height: 2.66,
    heightTypeLabel: 'Wysokość zewnętrzna obudowy',
  },
  {
    id: 'nz_210_290',
    type: 'NZ',
    name: 'NZ 210/290',
    width: 2.10,
    depth: 2.90,
    height: 2.66,
    heightTypeLabel: 'Wysokość zewnętrzna obudowy',
  },
  // BEK — obudowa wewnętrzna
  {
    id: 'bek_250_350',
    type: 'BEK',
    name: 'BEK 250/350',
    width: 2.50,
    depth: 3.50,
    height: 2.40,
    heightTypeLabel: 'Wysokość wewnętrzna pomieszczeń',
  },
  {
    id: 'bek_250_400',
    type: 'BEK',
    name: 'BEK 250/400',
    width: 2.50,
    depth: 4.00,
    height: 2.40,
    heightTypeLabel: 'Wysokość wewnętrzna pomieszczeń',
  },
  {
    id: 'bek_300_450',
    type: 'BEK',
    name: 'BEK 300/450',
    width: 3.00,
    depth: 4.50,
    height: 2.40,
    heightTypeLabel: 'Wysokość wewnętrzna pomieszczeń',
  },
];

export const CUSTOM_OBUDOWA_VARIANTS_UPDATED_EVENT = 'enco:custom-obudowa-variants-updated';

// This in-memory cache is refreshed only at app startup or by the explicit ODŚWIEŻ action.
let customObudowaVariantsCache: ObudowaSizeVariant[] = [];

export function setCustomObudowaVariants(variants: ObudowaSizeVariant[]): void {
  customObudowaVariantsCache = Array.isArray(variants)
    ? variants.map((variant) => ({ ...variant, isCustom: true }))
    : [];

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CUSTOM_OBUDOWA_VARIANTS_UPDATED_EVENT));
  }
}

export function getCustomObudowaVariants(): ObudowaSizeVariant[] {
  return [...customObudowaVariantsCache];
}

export async function fetchCustomObudowaVariantsFromServer(): Promise<ObudowaSizeVariant[] | null> {
  try {
    const res = await fetch('/api/obudowa-variants');
    if (!res.ok) return null;
    const json = await res.json();
    return json.success && Array.isArray(json.variants) ? json.variants : null;
  } catch (err) {
    console.warn('Could not fetch custom enclosure sizes from server:', err);
    return null;
  }
}

export async function saveCustomObudowaVariant(variant: ObudowaSizeVariant): Promise<boolean> {
  try {
    const res = await fetch('/api/obudowa-variants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant }),
    });
    if (!res.ok) return false;

    const json = await res.json();
    if (!json.success || !Array.isArray(json.variants)) return false;
    setCustomObudowaVariants(json.variants);
    return true;
  } catch (err) {
    console.error('Failed to save custom enclosure size to the server:', err);
    return false;
  }
}

export function getAllObudowaVariants(): ObudowaSizeVariant[] {
  const custom = getCustomObudowaVariants();
  return [...DEFAULT_OBUDOWA_VARIANTS, ...custom];
}

export function getObudowaVariantsForType(type: ObudowaType): ObudowaSizeVariant[] {
  const all = getAllObudowaVariants();
  return all.filter((v) => v.type === type);
}

/**
 * Formats dimension into Polish meter string (e.g. 2.66 -> "2,66 m")
 */
export function formatDimensionM(val: number | string | undefined): string {
  if (val === undefined || val === null || val === '') return '—';
  if (typeof val === 'string') {
    // If already contains 'm' or formatted
    if (val.includes('m')) return val;
    const parsed = parseFloat(val.replace(',', '.'));
    if (isNaN(parsed)) return val;
    return `${parsed.toFixed(2).replace('.', ',')} m`;
  }
  return `${val.toFixed(2).replace('.', ',')} m`;
}

/**
 * Checks if deadline is exceeded for readiness date
 */
export function checkReadinessOverdue(
  deadlineDate?: string,
  isReady?: boolean | ItemStatus
): {
  isOverdue: boolean;
  daysOverdue: number;
  formattedDate: string;
} {
  if (!deadlineDate) {
    return { isOverdue: false, daysOverdue: 0, formattedDate: '' };
  }

  // Format DD.MM.RRRR
  const parts = deadlineDate.split('-');
  const formattedDate = parts.length === 3 ? `${parts[2]}.${parts[1]}.${parts[0]}` : deadlineDate;

  // If item is already marked as READY, it is not overdue
  if (isReady === true || isReady === 'READY' || isReady === 'NOT_APPLICABLE') {
    return { isOverdue: false, daysOverdue: 0, formattedDate };
  }

  const deadline = new Date(`${deadlineDate}T23:59:59`);
  const now = new Date();

  if (isNaN(deadline.getTime())) {
    return { isOverdue: false, daysOverdue: 0, formattedDate };
  }

  const diffMs = now.getTime() - deadline.getTime();
  if (diffMs > 0) {
    const daysOverdue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return { isOverdue: true, daysOverdue, formattedDate };
  }

  return { isOverdue: false, daysOverdue: 0, formattedDate };
}

export interface Order {
  customerId?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  archivedAt?: string | null;
  id: string;
  orderNumber: string;
  client: string;
  projectName: string;
  stationSize: string;
  departureDate: string; // Aktualnie planowany wyjazd (YYYY-MM-DD)
  originalDepartureDate?: string; // Pierwotny termin z oferty, zachowywany przy zmianach planu (YYYY-MM-DD)
  generalNotes: string;
  additionalInfo?: string;
  status: OrderStatus;
  items: OrderItem[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export const ITEM_DEFINITIONS: ItemTypeDefinition[] = [
  {
    type: 'OBUDOWA',
    name: 'OBUDOWA',
    shortName: 'OBUDOWA',
    category: 'element',
    description: 'Korpus betonowy / prefabrykowany stacji transformatorowej, fundament i dach',
  },
  {
    type: 'ROZDZIELNICA_SN',
    name: 'ROZDZIELNICA SN',
    shortName: 'SN',
    category: 'element',
    description: 'Rozdzielnica średniego napięcia (np. 15kV / 24kV), pola liniowe i transformatorowe',
  },
  {
    type: 'ROZDZIELNICA_NN',
    name: 'ROZDZIELNICA NN',
    shortName: 'NN',
    category: 'element',
    description: 'Rozdzielnica niskiego napięcia (np. 0.4kV), listwy bezpiecznikowe, odpływy',
  },
  {
    type: 'TABLICA_POMIAROWA',
    name: 'TABLICA POMIAROWA',
    shortName: 'TABLICA POM.',
    category: 'element',
    description: 'Kategoria, zamówienie, dostawa i potwierdzenie przyjęcia tablicy pomiarowej w Pyskowicach',
  },
  {
    type: 'RPW',
    name: 'RPW',
    shortName: 'RPW',
    category: 'element',
    description: 'Śledzenie zamówienia, gotowości, dostawy i przyjęcia RPW w Pyskowicach',
  },
  {
    type: 'MOST',
    name: 'MOST',
    shortName: 'MOST',
    category: 'element',
    description: 'Most kablowy SN/nN, typ kabla, długość i głowice kablowe',
  },
  {
    type: 'SZAFKA_TELEMECHANIKI',
    name: 'SZAFKA TELEMECHANIKI',
    shortName: 'TELEMECH.',
    category: 'element',
    description: 'Szafka telemechaniki, sterownik RTU, modem GSM/światłowód, zasilacz buforowy',
  },
  {
    type: 'TRANSFORMATOR_POTRZEB_WLASNYCH',
    name: 'TRANSFORMATOR POTRZEB WŁASNYCH',
    shortName: 'TRAFO POTRZ. WŁ.',
    category: 'element',
    description: 'Parametry VA, numer seryjny, termin dostawy i przyjęcie w Pyskowicach',
  },
  {
    type: 'WSKAZNIKI_ZWARC',
    name: 'WSKAŹNIKI ZWARCIA',
    shortName: 'WSKAŹNIKI',
    category: 'element',
    description: 'Typ, ilość, zamówienie, dostawa i potwierdzenie przyjęcia wskaźników zwarć',
  },
  {
    type: 'RYS_AKCEPTACJA',
    name: 'RYS. AKCEPTACJA',
    shortName: 'AKCEPT.',
    category: 'dokumentacja',
    description: 'Rysunki wykonawcze / zatwierdzenie dokumentacji technicznej przez klienta',
  },
  {
    type: 'KOLORY',
    name: 'KOLORY',
    shortName: 'KOLORY',
    category: 'element',
    description: 'Kolorystyka obudowy, drzwi, żaluzji i numery farb palety RAL',
  },
  {
    type: 'OPISY',
    name: 'OPISY',
    shortName: 'OPISY',
    category: 'element',
    description: 'Tabliczki znamionowe, ostrzegawcze, schematy ideowe i oznaczenia pól',
  },
  {
    type: 'DRZWI',
    name: 'DRZWI',
    shortName: 'DRZWI',
    category: 'element',
    description: 'Drzwi komory transformatora, rozdzielnic SN/nN, żaluzje i zamki',
  },
  {
    type: 'ZAP_SERWISPOL',
    name: 'ZAP SERWISPOL',
    shortName: 'ZAP SERWISPOL',
    category: 'podwykonawca',
    description: 'Zapytanie o wycenę usługi u zewnętrznego wykonawcy SERWISPOL',
  },
  {
    type: 'ZAM_SERWISPOL',
    name: 'ZAM SERWISPOL',
    shortName: 'ZAM SERWISPOL',
    category: 'podwykonawca',
    description: 'Zamówienie usługi u zewnętrznego wykonawcy SERWISPOL',
  },
  {
    type: 'ZLECENIE_MONTAŻU',
    name: 'ZLECENIE MONTAŻU',
    shortName: 'MONTAŻ',
    category: 'element',
    description: 'Zlecenie prac montażowych i uzbrajania stacji na hali produkcyjnej',
  },
  {
    type: 'POWYKONAWCZA',
    name: 'POWYKONAWCZA',
    shortName: 'POWYKON.',
    category: 'dokumentacja',
    description: 'Kompletna dokumentacja powykonawcza, protokoły pomiarów i deklaracje zgodności',
  },
  {
    type: 'DATA_WYJAZDU',
    name: 'DATA WYJAZDU',
    shortName: 'WYJAZD',
    category: 'logistyka',
    description: 'Organizacja transportu HDS / niskopodwoziowego, termin wyjazdu stacji na budowę',
  },
  {
    type: 'DODATKOWE',
    name: 'DODATKOWE',
    shortName: 'DODATKOWE',
    category: 'element',
    description: 'Dodatkowe specyficzne wyposażenie (np. układ SZR, UPS, pomiar energii, kompensacja mocy)',
  },
];

export const STATUS_META: Record<
  ItemStatus,
  {
    label: string;
    shortLabel: string;
    icon: string;
    color: string;
    bgBadge: string;
    textBadge: string;
    borderBadge: string;
    dotColor: string;
    nextStatus: ItemStatus;
    cardBorder: string;
    cardBg: string;
    accentBorder: string;
  }
> = {
  NOT_ORDERED: {
    label: 'Nie zlecone',
    shortLabel: 'Nie zlecone',
    icon: '⚪',
    color: 'text-slate-600',
    bgBadge: 'bg-slate-100',
    textBadge: 'text-slate-700 font-bold',
    borderBadge: 'border-slate-300',
    dotColor: 'bg-slate-400 ring-2 ring-slate-200',
    nextStatus: 'ORDERED',
    cardBorder: 'border-slate-300',
    cardBg: 'bg-white',
    accentBorder: 'border-l-slate-400',
  },
  ORDERED: {
    label: 'Zlecone / zamówione',
    shortLabel: 'Zlecone',
    icon: '🔵',
    color: 'text-blue-700',
    bgBadge: 'bg-blue-600',
    textBadge: 'text-white font-black',
    borderBadge: 'border-blue-700 shadow-xs',
    dotColor: 'bg-white ring-2 ring-blue-300',
    nextStatus: 'IN_PROGRESS',
    cardBorder: 'border-blue-400',
    cardBg: 'bg-blue-50/70',
    accentBorder: 'border-l-blue-600',
  },
  IN_PROGRESS: {
    label: 'W realizacji',
    shortLabel: 'W realizacji',
    icon: '🟡',
    color: 'text-amber-900',
    bgBadge: 'bg-amber-500',
    textBadge: 'text-slate-950 font-black',
    borderBadge: 'border-amber-600 font-bold shadow-xs',
    dotColor: 'bg-slate-950 ring-2 ring-amber-200',
    nextStatus: 'READY',
    cardBorder: 'border-amber-400',
    cardBg: 'bg-amber-50/80',
    accentBorder: 'border-l-amber-500',
  },
  READY: {
    label: 'Gotowe',
    shortLabel: 'Gotowe',
    icon: '🟢',
    color: 'text-emerald-700',
    bgBadge: 'bg-emerald-600',
    textBadge: 'text-white font-black',
    borderBadge: 'border-emerald-700 shadow-xs',
    dotColor: 'bg-white ring-2 ring-emerald-300',
    nextStatus: 'NOT_ORDERED',
    cardBorder: 'border-emerald-400',
    cardBg: 'bg-emerald-50/70',
    accentBorder: 'border-l-emerald-600',
  },
  NOT_APPLICABLE: {
    label: 'BRAK / niepotrzebne',
    shortLabel: 'BRAK',
    icon: '⚪',
    color: 'text-slate-500',
    bgBadge: 'bg-slate-100',
    textBadge: 'text-slate-600 font-bold',
    borderBadge: 'border-slate-300 border-dashed',
    dotColor: 'bg-slate-300 ring-2 ring-slate-100',
    nextStatus: 'NOT_ORDERED',
    cardBorder: 'border-slate-300',
    cardBg: 'bg-slate-50',
    accentBorder: 'border-l-slate-300',
  },
  PROBLEM: {
    label: 'Problem',
    shortLabel: 'Problem',
    icon: '🔴',
    color: 'text-rose-700',
    bgBadge: 'bg-rose-600',
    textBadge: 'text-white font-black',
    borderBadge: 'border-rose-700 shadow-xs animate-pulse',
    dotColor: 'bg-white ring-2 ring-rose-300',
    nextStatus: 'ORDERED',
    cardBorder: 'border-rose-400',
    cardBg: 'bg-rose-50/90',
    accentBorder: 'border-l-rose-600',
  },
};

export const ORDER_STATUS_META: Record<
  OrderStatus,
  {
    label: string;
    icon: string;
    bgBadge: string;
    textBadge: string;
    borderBadge: string;
    dotColor: string;
  }
> = {
  NOT_STARTED: {
    label: 'Nie rozpoczęte',
    icon: '⚪',
    bgBadge: 'bg-slate-100',
    textBadge: 'text-slate-700 font-bold',
    borderBadge: 'border-slate-300 font-semibold',
    dotColor: 'bg-slate-400',
  },
  IN_PROGRESS: {
    label: 'W realizacji',
    icon: '🟡',
    bgBadge: 'bg-amber-500',
    textBadge: 'text-slate-950 font-black',
    borderBadge: 'border-amber-600 font-bold shadow-xs',
    dotColor: 'bg-slate-950 ring-2 ring-amber-200',
  },
  READY: {
    label: 'Gotowe',
    icon: '🟢',
    bgBadge: 'bg-emerald-600',
    textBadge: 'text-white font-black',
    borderBadge: 'border-emerald-700 font-bold shadow-xs',
    dotColor: 'bg-white ring-2 ring-emerald-300',
  },
  PROBLEM: {
    label: 'Problem',
    icon: '🔴',
    bgBadge: 'bg-rose-600',
    textBadge: 'text-white font-black',
    borderBadge: 'border-rose-700 font-bold shadow-xs animate-pulse',
    dotColor: 'bg-white ring-2 ring-rose-300',
  },
};

/**
 * Automatyczne wyliczanie ogólnego statusu zlecenia:
 * 1. Dowolny element 'PROBLEM' -> 'PROBLEM'
 * 2. Wszystkie elementy 'READY' lub 'NOT_APPLICABLE' -> 'READY'
 * 3. Jakikolwiek element 'ORDERED' lub część 'READY' -> 'IN_PROGRESS'
 * 4. Wszystkie 'NOT_ORDERED' -> 'NOT_STARTED'
 */
export function calculateOrderStatus(items: OrderItem[]): OrderStatus {
  if (!items || items.length === 0) return 'NOT_STARTED';
  if (items.some((item) => item.status === 'PROBLEM')) {
    return 'PROBLEM';
  }
  if (items.every((item) => item.status === 'READY' || item.status === 'NOT_APPLICABLE')) {
    return 'READY';
  }
  if (items.some((item) => item.status === 'ORDERED' || item.status === 'IN_PROGRESS' || item.status === 'READY')) {
    return 'IN_PROGRESS';
  }
  return 'NOT_STARTED';
}

/**
 * Sprawdza stan terminu wyjazdu
 */
export function getDepartureDateUrgency(dateStr: string, isOrderReady: boolean): {
  status: 'overdue' | 'urgent' | 'upcoming' | 'ready' | 'invalid';
  daysDiff: number;
  label: string;
} {
  if (isOrderReady) {
    return { status: 'ready', daysDiff: 0, label: 'Zrealizowano' };
  }
  if (!dateStr) {
    return { status: 'invalid', daysDiff: 0, label: 'Brak terminu' };
  }

  const target = new Date(dateStr);
  if (isNaN(target.getTime())) {
    return { status: 'invalid', daysDiff: 0, label: 'Nieprawidłowa data' };
  }

  // Używamy bieżącej daty systemowej (2026-10-08)
  const now = new Date('2026-10-08T00:00:00');
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffTime = targetMidnight.getTime() - now.getTime();
  const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return {
      status: 'overdue',
      daysDiff,
      label: `Po terminie (${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? 'dzień' : 'dni'})`,
    };
  }
  if (daysDiff === 0) {
    return { status: 'urgent', daysDiff, label: 'DZISIAJ' };
  }
  if (daysDiff <= 7) {
    return {
      status: 'urgent',
      daysDiff,
      label: `Za ${daysDiff} ${daysDiff === 1 ? 'dzień' : 'dni'}`,
    };
  }
  return {
    status: 'upcoming',
    daysDiff,
    label: `Za ${daysDiff} dni`,
  };
}

export const DEFAULT_SERWISPOL_ZAKRES_USLUGI = 'montaż Stacji/Złącza';

export interface DoorOrderHistoryEntry {
  id: string;
  timestamp: string; // ISO string
  field: 'terminZamowienia' | 'terminDostawy' | 'uwagi' | 'ogolne';
  fieldName: string; // np. "Termin z zamówienia", "Termin dostawy", "Uwagi"
  oldValue: string;
  newValue: string;
  note?: string;
}

export interface DoorOrder {
  id: string;
  numerDokumentu: string; // np. "PZD/363/2026"
  dataZamowienia: string; // YYYY-MM-DD, np. "2026-09-07"
  terminZamowienia: string; // YYYY-MM-DD, np. "2026-10-07"
  kategoria: string; // np. "27/2026/PARAUM/ST"
  numeryZl: string[]; // np. ["ZL/58/2026", "ZL/59/2026"]
  kontrahentRealizacje: string; // np. "BEK 250/420 Plichy, NZ 130/290 Lisuny – El-system"
  terminDostawy?: string; // YYYY-MM-DD, puste lub nieustalony
  uwagi?: string;
  wartoscNetto?: number | null; // np. 12824.00
  wartoscBrutto?: number | null; // np. 15773.52
  history: DoorOrderHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export function formatPLN(amount?: number | null): string {
  if (amount === undefined || amount === null || isNaN(amount)) {
    return '—';
  }
  return new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDatePL(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return 'Nieustalony';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

export function checkDoorOrderOverdue(terminZamowienia: string, terminDostawy?: string): {
  isOverdue: boolean;
  daysDiff: number;
  label: string;
} {
  if (terminDostawy && terminDostawy.trim() !== '') {
    return { isOverdue: false, daysDiff: 0, label: 'Dostarczono' };
  }

  if (!terminZamowienia) {
    return { isOverdue: false, daysDiff: 0, label: 'Brak terminu' };
  }

  const target = new Date(terminZamowienia);
  if (isNaN(target.getTime())) {
    return { isOverdue: false, daysDiff: 0, label: 'Nieprawidłowa data' };
  }

  const now = new Date('2026-10-09T00:00:00');
  const targetMidnight = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffTime = targetMidnight.getTime() - now.getTime();
  const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (daysDiff < 0) {
    return {
      isOverdue: true,
      daysDiff: Math.abs(daysDiff),
      label: `Przekroczony termin (${Math.abs(daysDiff)} ${Math.abs(daysDiff) === 1 ? 'dzień' : 'dni'})`,
    };
  }
  if (daysDiff === 0) {
    return { isOverdue: false, daysDiff: 0, label: 'Termin dzisiaj' };
  }
  return {
    isOverdue: false,
    daysDiff,
    label: `Pozostało ${daysDiff} ${daysDiff === 1 ? 'dzień' : 'dni'}`,
  };
}

/**
 * Searches door orders matching a specific station order number (e.g. ZL1, ZL/58/2026)
 * or matching an explicit door order document number (e.g. PZD/363/2026).
 */
export function findMatchingDoorOrder(
  doorOrders: DoorOrder[],
  orderNumber?: string,
  numerDokumentu?: string
): DoorOrder | undefined {
  if (!doorOrders || doorOrders.length === 0) return undefined;

  // 1. Direct match by document number (PZD)
  if (numerDokumentu && numerDokumentu.trim()) {
    const cleanDoc = numerDokumentu.trim().toLowerCase();
    const docMatch = doorOrders.find((d) => d.numerDokumentu.trim().toLowerCase() === cleanDoc);
    if (docMatch) return docMatch;
  }

  // 2. Match by ZL number
  if (orderNumber && orderNumber.trim()) {
    const cleanOrd = orderNumber.trim().toUpperCase();
    const zlMatch = doorOrders.find((d) =>
      d.numeryZl.some((zl) => {
        const cleanZl = zl.trim().toUpperCase();
        if (cleanZl === cleanOrd) return true;
        // Compare ZL1 with ZL/1 or ZL/1/2026
        const numOrd = cleanOrd.replace(/[^0-9]/g, '');
        const numZl = cleanZl.replace(/[^0-9]/g, '');
        return numOrd && numZl && (numOrd === numZl || cleanZl.includes(cleanOrd));
      })
    );
    if (zlMatch) return zlMatch;
  }

  return undefined;
}
