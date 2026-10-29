import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Order, OrderItem } from '../types/enco';
import { UserRoleProfile, USER_PROFILES, canEditItemType } from '../types/userRole';
import {
  ArrowDown, ArrowLeft, ArrowUp, Bold, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight,
  Code2, FileText, Heading1, Heading2, Italic, List, ListOrdered, Loader2, Plus, Printer,
  Save, Settings2, ShieldCheck, Strikethrough, Table2, Trash2, Underline, X, Eye, EyeOff
} from 'lucide-react';

type Row = {
  id: string;
  type: string;
  quantity: string;
  position: string;
  category?: string;
  wings?: string;
  openingSide?: string;
  width?: string;
  height?: string;
  ventilationGrille?: boolean;
  intakeFan?: boolean;
  exhaustFan?: boolean;
  _autoRuleId?: string;
  _manualDelivery?: boolean;
};
type FieldType = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox-list' | 'repeatable' | 'delivery-list' | 'doors' | 'quantity-toggle' | 'static';
type FormField = {
  id: string;
  label: string;
  valueKey: string;
  type: FieldType;
  options?: string[];
  sourcePath?: string;
  liveBinding?: boolean;
  readOnly?: boolean;
  defaultValue?: any;
  helpText?: string;
  required?: boolean;
  visible?: boolean;
  fullWidth?: boolean;
};
type FormSection = { id: string; title: string; fieldIds: string[]; columns?: 1 | 2 | 3; visible?: boolean };
type TemplateRule = {
  id: string;
  triggerFieldId: string;
  triggerValue: string;
  targetFieldId: string;
  targetValue: string;
  action: 'automatic' | 'suggestion' | 'warning';
};
type DocumentTemplate = {
  key: string;
  title: string;
  version: number;
  updatedAt?: string;
  updatedBy?: string;
  sections: FormSection[];
  fields: FormField[];
  contentHtml: string;
  rules: TemplateRule[];
};
type FormData = {
  typBudowli: string;
  typObudowy: string;
  rozmiar: string;
  nazwaObiektu: string;
  numerZL: string;
  dataWystawienia: string;
  terminRealizacji: string;
  dotExtra: string;
  opisObudowy: string;
  dlugosc: string;
  szerokosc: string;
  wysokosc: string;
  konstrukcja: string;
  scianyIlosc: string;
  scianyKlasa: string;
  dachTyp: string;
  dachKlasa: string;
  kolorObudowy: string;
  kolorSlusarki: string;
  kolorDachu: string;
  kolorDrzwiKraty: string;
  antygraffiti: string;
  tynk: string;
  dodatkoweWyposazenie: string[];
  przepusty: Row[];
  otwory: Row[];
  slusarka: Row[];
  dostawaPyskowice: Row[];
  dostawaWarszawa: Row[];
  uwagi: string;
  customFields: Record<string, any>;
  __templateSnapshot?: DocumentTemplate;
  __templateVersion?: number;
};

type Mode = 'form' | 'custom' | 'admin';
type DesignerTab = 'content' | 'structure' | 'bindings';

const localDate = () => {
  const date = new Date();
  return String(date.getFullYear()) + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
};
const uid = (prefix = 'field') => prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const DELIVERY_ITEM_OPTIONS = [
  'Obudowa / fundament',
  'Dach',
  'Drzwi i ślusarka',
  'Rozdzielnica SN',
  'Rozdzielnica NN',
  'Transformator stacyjny (TRAFO)',
  'Transformator potrzeb własnych (TPW)',
  'Szafka telemechaniki',
  'Tablica pomiarowa',
  'RPW',
  'Most kablowy',
  'Wskaźniki zwarcia',
  'Przepusty kablowe',
  'Uziemienie',
  'Instalacja oświetleniowa',
  'Dokumentacja',
] as const;
const MANUAL_DELIVERY_VALUE = '__manual_delivery_item__';

function normalizeDeliveryRows(value: unknown): Row[] {
  if (Array.isArray(value)) return value.map((row: any) => typeof row === 'string'
    ? { id: uid('delivery'), type: row, quantity: '1', position: '', _manualDelivery: !DELIVERY_ITEM_OPTIONS.includes(row as (typeof DELIVERY_ITEM_OPTIONS)[number]) }
    : { id: String(row?.id || uid('delivery')), type: String(row?.type || ''), quantity: String(row?.quantity || '1'), position: String(row?.position || ''), _manualDelivery: Boolean(row?._manualDelivery) });
  if (typeof value === 'string' && value.trim()) return value.split(/\r?\n/).map((v) => v.trim()).filter(Boolean).map((type) => ({ id: uid('delivery'), type, quantity: '1', position: '' }));
  return [];
}
function deliveryTableHtml(form: FormData): string {
  const rows = ([
    ['Warszawa', normalizeDeliveryRows(form.dostawaWarszawa)],
    ['Pyskowice', normalizeDeliveryRows(form.dostawaPyskowice)],
  ] as Array<[string, Row[]]>).flatMap(([source, items]) => items.filter((row) => row.type.trim()).map((row) =>
    '<tr><td>' + escapeHtml(source) + '</td><td>' + escapeHtml(row.type) + '</td><td style="text-align:center;">' + escapeHtml(row.quantity || '1') + '</td><td>' + escapeHtml(row.position || '') + '</td></tr>'));
  if (!rows.length) return '<p>Nie wskazano elementów dostawy.</p>';
  return '<table style="width:100%;border-collapse:collapse;font-size:9pt;margin:3px 0 5px;"><thead><tr>' +
    ['Dostawca', 'Element', 'Ilość', 'Uwagi'].map((name) => '<th style="background-color:#e9eff6;border:1px solid #cbd5e1;padding:3px;">' + name + '</th>').join('') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table>';
}
const TEMPLATE_FIELDS: FormField[] = [
  { id: 'typBudowli', label: 'Typ budowli', valueKey: 'typBudowli', type: 'text', sourcePath: 'item.details.typBudowli', required: true, helpText: 'Pobierany ze zlecenia, jeśli jest określony.' },
  { id: 'typObudowy', label: 'Typ obudowy', valueKey: 'typObudowy', type: 'select', options: ['BEK', 'NZ'], sourcePath: 'item.details.typObudowy', required: true },
  { id: 'rozmiar', label: 'Rozmiar obudowy', valueKey: 'rozmiar', type: 'text', sourcePath: 'item.details.rozmiar', required: true },
  { id: 'nazwaObiektu', label: 'Nazwa obiektu', valueKey: 'nazwaObiektu', type: 'text', sourcePath: 'order.projectName', required: true },
  { id: 'numerZL', label: 'Numer ZL', valueKey: 'numerZL', type: 'text', sourcePath: 'order.orderNumber', required: true },
  { id: 'dataWystawienia', label: 'Data wystawienia dokumentu', valueKey: 'dataWystawienia', type: 'date', sourcePath: 'system.today', required: true },
  { id: 'terminRealizacji', label: 'Termin realizacji', valueKey: 'terminRealizacji', type: 'date', sourcePath: 'item.plannedDate', liveBinding: true },
  { id: 'dotExtra', label: 'Dodatkowa wzmianka DOT.', valueKey: 'dotExtra', type: 'text', helpText: 'Treść podstawowa DOT. jest składana z tytułu; to pole dodaje osobną wzmiankę.' },
  { id: 'opisObudowy', label: 'Opis obudowy — pełne zdanie', valueKey: 'opisObudowy', type: 'textarea', required: true, fullWidth: true },
  { id: 'slusarka', label: 'Drzwi i ślusarka', valueKey: 'slusarka', type: 'doors', fullWidth: true, options: ['Drzwi SN i NN', 'Drzwi SN', 'Drzwi NN', 'Drzwi Trafo'] },
  { id: 'siatkaDrzwi', label: 'Siatka wygradzająca — drzwi i ślusarka', valueKey: 'customFields.siatkaDrzwi', type: 'quantity-toggle', defaultValue: { enabled: true, quantity: '1' } },
  { id: 'dachTyp', label: 'Rodzaj dachu', valueKey: 'dachTyp', type: 'select', options: ['Kopertowy', 'Dwuspadowy', 'Wannowy'], sourcePath: 'item.details.typDachu' },
  { id: 'dachMaterial', label: 'Materiał dachu', valueKey: 'customFields.dachMaterial', type: 'select', options: ['Betonowy', 'Stalowy', 'Inny'], sourcePath: 'item.details.dachMaterial', defaultValue: 'Betonowy' },
  { id: 'roofEquipment', label: 'Dach i wyposażenie — pozycje domyślne', valueKey: 'customFields.wyposazenieDachu', type: 'checkbox-list', fullWidth: true, options: ['Chłodnica gazów', 'Otwory do lampek wskaźnika zwarć', 'Otwór do wyprowadzenia kabla do anteny', '1 x kieszenie na schemat'], defaultValue: ['Chłodnica gazów', 'Otwory do lampek wskaźnika zwarć', 'Otwór do wyprowadzenia kabla do anteny', '1 x kieszenie na schemat'] },
  { id: 'siatkaDach', label: 'Siatka wygradzająca — dach i wyposażenie', valueKey: 'customFields.siatkaDach', type: 'quantity-toggle', defaultValue: { enabled: true, quantity: '1' } },
  { id: 'dodatkoweWyposazenie', label: 'Dodatkowe wyposażenie', valueKey: 'dodatkoweWyposazenie', type: 'checkbox-list', fullWidth: true, options: ['Oświetlenie wewnętrzne i zewnętrzne', 'Antena', 'Lampki ostrzegawcze'] },
  { id: 'przepusty', label: 'Przepusty kablowe', valueKey: 'przepusty', type: 'repeatable', fullWidth: true, options: ['Przepust HEA', 'BWS 100', 'BWS 150', 'HSI 90', 'HSI 150', 'Ø100', 'Inny przepust'] },
  { id: 'otwory', label: 'Otwory i przepusty — pozostałe', valueKey: 'otwory', type: 'repeatable', fullWidth: true, options: ['Przepust HEA', 'Otwór Ø100', 'Otwór kablowy', 'Otwór wentylacyjny', 'Otwór drzwiowy', 'Inny'] },
  { id: 'kolorObudowy', label: 'Kolor obudowy (RAL)', valueKey: 'kolorObudowy', type: 'text', sourcePath: 'order.itemByType.KOLORY.documentColorShell', liveBinding: true, readOnly: true, helpText: 'Pobierane z pozycji KOLORY w bieżącym zleceniu.' },
  { id: 'kolorSlusarki', label: 'Kolor ślusarki (RAL)', valueKey: 'kolorSlusarki', type: 'text', sourcePath: 'order.itemByType.KOLORY.documentColorMetalwork', liveBinding: true, readOnly: true, helpText: 'Pobierane z pozycji KOLORY; osobny kolor ślusarki jest używany, jeśli został zapisany.' },
  { id: 'kolorDachu', label: 'Kolor dachu (RAL)', valueKey: 'kolorDachu', type: 'text', sourcePath: 'order.itemByType.KOLORY.documentColorRoof', liveBinding: true, readOnly: true, helpText: 'Pobierane z pozycji KOLORY — kolor dachu lub kolory dodatkowe.' },
  { id: 'kolorDrzwiKraty', label: 'Kolor drzwi i krat (RAL)', valueKey: 'kolorDrzwiKraty', type: 'text', sourcePath: 'order.itemByType.KOLORY.documentColorDoorsAndGrilles', liveBinding: true, readOnly: true, helpText: 'Pobierane z pozycji KOLORY.' },
  { id: 'tynk', label: 'Tynk / wykończenie', valueKey: 'tynk', type: 'text', sourcePath: 'order.itemByType.OBUDOWA.documentFinish', liveBinding: true, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.' },
  { id: 'antygraffiti', label: 'Powłoka antygraffiti', valueKey: 'antygraffiti', type: 'select', options: ['Tak', 'Nie'], sourcePath: 'order.itemByType.OBUDOWA.documentAntigraffiti', liveBinding: true, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.' },
  { id: 'opisy', label: 'Kolory i opisy — dodatkowe uwagi', valueKey: 'customFields.opisy', type: 'textarea', fullWidth: true, sourcePath: 'order.itemByType.OPISY.documentSummary', liveBinding: true, readOnly: true, helpText: 'Pobierane z pozycji OPISY w bieżącym zleceniu.' },
  { id: 'rozdzielnicaSN', label: 'Rozdzielnica SN', valueKey: 'customFields.rozdzielnicaSN', type: 'textarea', fullWidth: true, sourcePath: 'order.itemByType.ROZDZIELNICA_SN.documentSummary', liveBinding: true, readOnly: true, helpText: 'Producent, rodzaj/model, liczba i konfiguracja pól są pobierane z pozycji ROZDZIELNICA SN.' },
  { id: 'rozdzielnicaNN', label: 'Rozdzielnica NN', valueKey: 'customFields.rozdzielnicaNN', type: 'textarea', fullWidth: true, sourcePath: 'order.itemByType.ROZDZIELNICA_NN.documentSummary', liveBinding: true, readOnly: true, helpText: 'Typ, liczba pól i wyposażenie są pobierane z pozycji ROZDZIELNICA NN.' },
  { id: 'telemechanika', label: 'Telemechanika', valueKey: 'customFields.telemechanika', type: 'textarea', fullWidth: true, sourcePath: 'order.itemByType.SZAFKA_TELEMECHANIKI.documentSummary', liveBinding: true, readOnly: true, helpText: 'Pobierane z pozycji SZAFKA TELEMECHANIKI.' },
  { id: 'transformator', label: 'Transformator stacyjny (TRAFO)', valueKey: 'customFields.transformator', type: 'textarea', fullWidth: true, sourcePath: 'order.itemByType.TRANSFORMATOR.documentSummary', liveBinding: true, readOnly: true, helpText: 'Typ/model, moc znamionowa w kVA i numer seryjny są pobierane z pozycji TRANSFORMATOR.' },
  { id: 'transformatorPotrzebWlasnych', label: 'Transformator potrzeb własnych (TPW)', valueKey: 'customFields.transformatorPotrzebWlasnych', type: 'textarea', fullWidth: true, sourcePath: 'order.itemByType.TRANSFORMATOR_POTRZEB_WLASNYCH.documentSummary', liveBinding: true, readOnly: true, helpText: 'Moc w VA i numer seryjny są pobierane wyłącznie z pozycji TRANSFORMATOR POTRZEB WŁASNYCH.' },
  { id: 'uziemienie', label: 'Rodzaj instalacji uziemiającej', valueKey: 'customFields.uziemienie', type: 'text', sourcePath: 'order.itemByType.OBUDOWA.documentGrounding', liveBinding: true, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.' },
  { id: 'instalacjaOswietleniowa', label: 'Informacja o instalacji oświetleniowej', valueKey: 'customFields.instalacjaOswietleniowa', type: 'text', sourcePath: 'order.itemByType.OBUDOWA.documentLighting', liveBinding: true, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.' },
  { id: 'inneUrzadzenia', label: 'Inne urządzenia / uwagi', valueKey: 'customFields.inneUrzadzenia', type: 'textarea', fullWidth: true, sourcePath: 'order.itemByType.DODATKOWE.documentSummary', liveBinding: true, readOnly: true, helpText: 'Pobierane z pozycji DODATKOWE w bieżącym zleceniu.' },
  { id: 'dostawaWarszawa', label: 'Elementy dostarczane przez Warszawę', valueKey: 'dostawaWarszawa', type: 'delivery-list', fullWidth: true },
  { id: 'dostawaPyskowice', label: 'Elementy dostarczane przez Pyskowice', valueKey: 'dostawaPyskowice', type: 'delivery-list', fullWidth: true },
  { id: 'uwagi', label: 'Uwagi i poprawki do dokumentu', valueKey: 'uwagi', type: 'textarea', fullWidth: true },
];

const ORDER_BOUND_FIELD_CONFIG: Record<string, { sourcePath: string; readOnly: boolean; helpText: string; legacyPaths: string[] }> = {
  kolorObudowy: { sourcePath: 'order.itemByType.KOLORY.documentColorShell', readOnly: true, helpText: 'Pobierane z pozycji KOLORY w bieżącym zleceniu.', legacyPaths: ['item.details.kolorObudowy'] },
  kolorSlusarki: { sourcePath: 'order.itemByType.KOLORY.documentColorMetalwork', readOnly: true, helpText: 'Pobierane z pozycji KOLORY; używany jest osobny kolor ślusarki, jeśli został zapisany.', legacyPaths: ['item.details.kolorSlusarki'] },
  kolorDachu: { sourcePath: 'order.itemByType.KOLORY.documentColorRoof', readOnly: true, helpText: 'Pobierane z pozycji KOLORY — kolor dachu lub kolory dodatkowe.', legacyPaths: ['item.details.kolorDachu'] },
  kolorDrzwiKraty: { sourcePath: 'order.itemByType.KOLORY.documentColorDoorsAndGrilles', readOnly: true, helpText: 'Pobierane z pozycji KOLORY.', legacyPaths: ['item.details.kolorDrzwiKraty'] },
  tynk: { sourcePath: 'order.itemByType.OBUDOWA.documentFinish', readOnly: false, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.', legacyPaths: ['item.details.tynk'] },
  antygraffiti: { sourcePath: 'order.itemByType.OBUDOWA.documentAntigraffiti', readOnly: false, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.', legacyPaths: ['item.details.antygraffitiStatus'] },
  opisy: { sourcePath: 'order.itemByType.OPISY.documentSummary', readOnly: true, helpText: 'Pobierane z pozycji OPISY w bieżącym zleceniu.', legacyPaths: ['item.details.opisy'] },
  rozdzielnicaSN: { sourcePath: 'order.itemByType.ROZDZIELNICA_SN.documentSummary', readOnly: true, helpText: 'Producent, rodzaj/model, liczba i konfiguracja pól są pobierane z pozycji ROZDZIELNICA SN.', legacyPaths: ['item.details.rozdzielnicaSN'] },
  rozdzielnicaNN: { sourcePath: 'order.itemByType.ROZDZIELNICA_NN.documentSummary', readOnly: true, helpText: 'Typ, liczba pól i wyposażenie są pobierane z pozycji ROZDZIELNICA NN.', legacyPaths: ['item.details.rozdzielnicaNN'] },
  telemechanika: { sourcePath: 'order.itemByType.SZAFKA_TELEMECHANIKI.documentSummary', readOnly: true, helpText: 'Pobierane z pozycji SZAFKA TELEMECHANIKI.', legacyPaths: ['item.details.telemechanika'] },
  transformator: { sourcePath: 'order.itemByType.TRANSFORMATOR.documentSummary', readOnly: true, helpText: 'Typ/model, moc znamionowa w kVA i numer seryjny są pobierane wyłącznie z pozycji TRANSFORMATOR.', legacyPaths: ['item.details.transformator'] },
  transformatorPotrzebWlasnych: { sourcePath: 'order.itemByType.TRANSFORMATOR_POTRZEB_WLASNYCH.documentSummary', readOnly: true, helpText: 'Moc w VA i numer seryjny są pobierane wyłącznie z pozycji TRANSFORMATOR POTRZEB WŁASNYCH.', legacyPaths: [] },
  uziemienie: { sourcePath: 'order.itemByType.OBUDOWA.documentGrounding', readOnly: false, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.', legacyPaths: ['item.details.uziemienie'] },
  instalacjaOswietleniowa: { sourcePath: 'order.itemByType.OBUDOWA.documentLighting', readOnly: false, helpText: 'Pobierane z danych pozycji Obudowa, jeśli zostało zapisane.', legacyPaths: ['item.details.instalacjaOswietleniowa'] },
  inneUrzadzenia: { sourcePath: 'order.itemByType.DODATKOWE.documentSummary', readOnly: true, helpText: 'Pobierane z pozycji DODATKOWE w bieżącym zleceniu.', legacyPaths: ['item.details.inneUrzadzenia'] },
};
function normalizeOrderBoundFields(template: DocumentTemplate): DocumentTemplate {
  // Starsze wersje standardowego wzorca zapisane na serwerze nie powinny
  // nadpisywać nowego, zwartego układu i tabeli dostaw.
  const oldStandard = template.contentHtml?.includes('7. ELEMENTY DOSTARCZANE</h2><p><strong>Warszawa:</strong> {{form.dostawaWarszawa}}');
  if (oldStandard) template = { ...template, contentHtml: DEFAULT_TEMPLATE.contentHtml };
  template = { ...template, fields: (template.fields || []).map((field) => ['dostawaWarszawa', 'dostawaPyskowice'].includes(field.id) ? { ...field, type: 'delivery-list' as FieldType } : field) };
  return {
    ...template,
    fields: (template.fields || []).map((field) => {
      const binding = ORDER_BOUND_FIELD_CONFIG[field.id];
      if (!binding) return field;
      const migrateBinding = !field.sourcePath || binding.legacyPaths.includes(field.sourcePath);
      return {
        ...field,
        sourcePath: migrateBinding ? binding.sourcePath : field.sourcePath,
        liveBinding: migrateBinding ? true : field.liveBinding,
        readOnly: field.readOnly ?? binding.readOnly,
        helpText: field.helpText || binding.helpText,
      };
    }),
  };
}

const DEFAULT_TEMPLATE: DocumentTemplate = {
  key: 'zlecenie-obudowy',
  title: 'Zlecenie obudowy',
  version: 1,
  sections: [
    { id: 'naglowek', title: 'Nagłówek', fieldIds: ['typBudowli', 'typObudowy', 'rozmiar', 'nazwaObiektu', 'numerZL', 'dataWystawienia', 'terminRealizacji', 'dotExtra'], columns: 2 },
    { id: 'opis', title: 'TYP OBUDOWY — opis', fieldIds: ['opisObudowy'], columns: 1 },
    { id: 'drzwi', title: 'Drzwi i ślusarka', fieldIds: ['slusarka', 'siatkaDrzwi'], columns: 2 },
    { id: 'dach', title: 'Dach i wyposażenie', fieldIds: ['dachTyp', 'dachMaterial', 'roofEquipment', 'siatkaDach', 'dodatkoweWyposazenie'], columns: 2 },
    { id: 'otwory', title: 'Otwory i przepusty kablowe', fieldIds: ['przepusty', 'otwory'], columns: 1 },
    { id: 'kolory', title: 'Kolory i opisy', fieldIds: ['kolorObudowy', 'kolorSlusarki', 'kolorDachu', 'kolorDrzwiKraty', 'tynk', 'antygraffiti', 'opisy'], columns: 2 },
    { id: 'urzadzenia', title: 'Ogólne urządzenia w stacji', fieldIds: ['rozdzielnicaSN', 'rozdzielnicaNN', 'telemechanika', 'transformator', 'transformatorPotrzebWlasnych', 'uziemienie', 'instalacjaOswietleniowa', 'inneUrzadzenia'], columns: 2 },
    { id: 'dostawy', title: 'Elementy dostarczane przez Warszawę i Pyskowice', fieldIds: ['dostawaWarszawa', 'dostawaPyskowice', 'uwagi'], columns: 2 },
  ],
  fields: TEMPLATE_FIELDS,
  contentHtml:
    '<div style="font-family:Arial,sans-serif;color:#172334;font-size:9pt;line-height:1.2;">' +
    '<p style="text-align:center;font-size:8pt;margin:0;"><strong>ENCO · ZLECENIE PRODUKCYJNE</strong></p>' +
    '<h1 style="text-align:center;font-size:15pt;margin:2px 0;">ZLECENIE OBUDOWY</h1>' +
    '<p style="text-align:center;font-size:10pt;margin:1px 0 5px;"><strong>{{derived.title}}</strong></p>' +
    '<table style="width:100%;border-collapse:collapse;margin:2px 0 5px;font-size:8pt;"><tbody>' +
    '<tr><td style="border:1px solid #cbd5e1;padding:3px;"><strong>NR ZL:</strong> {{form.numerZL}}</td><td style="border:1px solid #cbd5e1;padding:3px;"><strong>Wystawiono:</strong> {{form.dataWystawienia}}</td></tr>' +
    '<tr><td style="border:1px solid #cbd5e1;padding:3px;"><strong>Termin:</strong> {{form.terminRealizacji}}</td><td style="border:1px solid #cbd5e1;padding:3px;"><strong>DOT.:</strong> {{derived.dot}}</td></tr></tbody></table>' +
    '<h2>OBUDOWA</h2><p>{{form.opisObudowy}}</p>' +
    '<h2>DRZWI I ŚLUSARKA</h2><p>{{form.slusarka}}</p><p><strong>Siatka:</strong> {{form.customFields.siatkaDrzwi}}</p>' +
    '<h2>DACH I WYPOSAŻENIE</h2><p><strong>Dach:</strong> {{form.customFields.dachMaterial}} {{form.dachTyp}}</p><p>{{form.customFields.wyposazenieDachu}}</p><p>{{form.dodatkoweWyposazenie}}</p><p><strong>Siatka:</strong> {{form.customFields.siatkaDach}}</p>' +
    '<h2>OTWORY I PRZEPUSTY</h2><p><strong>Przepusty:</strong> {{form.przepusty}}</p><p><strong>Otwory:</strong> {{form.otwory}}</p>' +
    '<h2>KOLORY I OPISY</h2><p><strong>Obudowa:</strong> {{form.kolorObudowy}}; <strong>ślusarka:</strong> {{form.kolorSlusarki}}; <strong>dach:</strong> {{form.kolorDachu}}; <strong>drzwi i kraty:</strong> {{form.kolorDrzwiKraty}}.</p><p><strong>Wykończenie:</strong> {{form.tynk}}; <strong>antygraffiti:</strong> {{form.antygraffiti}}</p><p>{{form.customFields.opisy}}</p>' +
    '<h2>URZĄDZENIA W STACJI</h2><p><strong>SN:</strong> {{form.customFields.rozdzielnicaSN}}; <strong>NN:</strong> {{form.customFields.rozdzielnicaNN}}</p><p><strong>Telemechanika:</strong> {{form.customFields.telemechanika}}; <strong>TRAFO:</strong> {{form.customFields.transformator}}; <strong>TPW:</strong> {{form.customFields.transformatorPotrzebWlasnych}}</p><p><strong>Uziemienie:</strong> {{form.customFields.uziemienie}}; <strong>Oświetlenie:</strong> {{form.customFields.instalacjaOswietleniowa}}; <strong>Inne:</strong> {{form.customFields.inneUrzadzenia}}</p>' +
    '<h2>ELEMENTY DOSTARCZANE</h2>{{derived.deliveryTable}}<p><strong>Uwagi:</strong> {{form.uwagi}}</p>' +
    '</div>',
  rules: [
    { id: 'antena-otwor', triggerFieldId: 'dodatkoweWyposazenie', triggerValue: 'Antena', targetFieldId: 'roofEquipment', targetValue: 'Otwór do wyprowadzenia kabla do anteny', action: 'automatic' },
    { id: 'lampki-otwor', triggerFieldId: 'dodatkoweWyposazenie', triggerValue: 'Lampki ostrzegawcze', targetFieldId: 'roofEquipment', targetValue: 'Otwory do lampek wskaźnika zwarć', action: 'automatic' },
  ],
};

const blankForm = (item?: OrderItem, order?: Order): FormData => {
  const d = item?.details || {};
  const rozmiar = String(d.rozmiar || order?.stationSize || '');
  const parsedStationType = (rozmiar.match(/^(BEK|NZ)\b/i) || [])[1] || '';
  const typObudowy = String(d.typObudowy || parsedStationType);
  const savedDate = localDate();
  return {
    typBudowli: String(d.typBudowli || ''),
    typObudowy,
    rozmiar,
    nazwaObiektu: String(order?.projectName || ''),
    numerZL: String(order?.orderNumber || ''),
    dataWystawienia: savedDate || localDate(),
    terminRealizacji: String(item?.plannedDate || d.terminRealizacji || d.terminObudowy || ''),
    dotExtra: '',
    opisObudowy: 'Wykonanie obudowy ' + [typObudowy, rozmiar].filter(Boolean).join(' ') + ' wraz z fundamentem i przepustami kablowymi SN, nN i uziemiającymi, wraz z montażem ślusarki i rozdzielnicy SN i nN.',
    dlugosc: String(d.dlugoscObudowy || d.dlugosc || ''),
    szerokosc: String(d.szerokoscObudowy || d.szerokosc || ''),
    wysokosc: String(d.wysokoscObudowy || d.wysokosc || ''),
    konstrukcja: String(d.konstrukcjaBudynku || d.konstrukcja || ''),
    scianyIlosc: String(d.scianyREIIlosc || ''),
    scianyKlasa: String(d.scianyREIKlasa || ''),
    dachTyp: String(d.typDachu || 'Kopertowy'),
    dachKlasa: String(d.dachREIKlasa || ''),
    kolorObudowy: String(d.kolorObudowy || d.kolor || ''),
    kolorSlusarki: String(d.kolorSlusarki || ''),
    kolorDachu: String(d.kolorDachu || ''),
    kolorDrzwiKraty: String(d.kolorDrzwiKraty || ''),
    antygraffiti: d.antygraffiti === true ? 'Tak' : d.antygraffiti === false && d.antygraffiti !== undefined ? 'Nie' : String(d.antygraffitiStatus || ''),
    tynk: String(d.tynk || ''),
    dodatkoweWyposazenie: Array.isArray(d.dodatkoweWyposazenie) ? d.dodatkoweWyposazenie : [],
    przepusty: Array.isArray(d.przepusty) ? d.przepusty : [],
    otwory: Array.isArray(d.otwory) ? d.otwory : [],
    slusarka: Array.isArray(d.slusarka) && d.slusarka.length ? d.slusarka : [
      { id: uid('door'), type: 'Drzwi SN i NN', category: 'Drzwi SN i NN', quantity: '1', position: 'Do rozdzielnic SN i NN', wings: 'Jednoskrzydłowe', openingSide: 'Lewe', width: typObudowy.toUpperCase().startsWith('BEK') ? '950' : '', height: typObudowy.toUpperCase().startsWith('BEK') ? '2100' : '', ventilationGrille: true, intakeFan: false, exhaustFan: false },
      { id: uid('door'), type: 'Drzwi Trafo', category: 'Drzwi Trafo', quantity: '1', position: 'Do komory transformatora', wings: 'Jednoskrzydłowe', openingSide: 'Lewe', width: typObudowy.toUpperCase().startsWith('BEK') ? '1170' : '', height: typObudowy.toUpperCase().startsWith('BEK') ? '2100' : '', ventilationGrille: true, intakeFan: false, exhaustFan: false },
    ],
    dostawaPyskowice: normalizeDeliveryRows(d.dostawaPyskowice),
    dostawaWarszawa: normalizeDeliveryRows(d.dostawaWarszawa),
    uwagi: String(d.uwagiDoZleceniaObudowy || ''),
    customFields: {
      dachMaterial: String(d.dachMaterial || ''),
      wyposazenieDachu: Array.isArray(d.wyposazenieDachu) ? d.wyposazenieDachu : ['Chłodnica gazów', 'Siatka wygradzająca', 'Otwory do lampek wskaźnika zwarć', 'Otwór do wyprowadzenia kabla do anteny', '1 x kieszenie na schemat'],
      siatkaDrzwi: { enabled: true, quantity: '1' },
      siatkaDach: { enabled: true, quantity: '1' },
      opisy: String(d.opisy || ''),
      rozdzielnicaSN: String(d.rozdzielnicaSN || ''),
      rozdzielnicaNN: String(d.rozdzielnicaNN || ''),
      telemechanika: String(d.telemechanika || ''),
      transformator: String(d.transformator || ''),
      transformatorPotrzebWlasnych: String(d.transformatorPotrzebWlasnych || ''),
      uziemienie: String(d.uziemienie || ''),
      instalacjaOswietleniowa: String(d.instalacjaOswietleniowa || ''),
      inneUrzadzenia: String(d.inneUrzadzenia || ''),
    },
  };
};

function readForm(item?: OrderItem, order?: Order): FormData {
  const base = blankForm(item, order);
  const saved = item?.details?.formularze?.zlecenieObudowy;
  if (saved && typeof saved === 'object') {
    const result = { ...base, ...saved, customFields: { ...base.customFields, ...(saved.customFields || {}) } } as FormData;
    if (!result.dataWystawienia) result.dataWystawienia = String(item?.createdAt || order?.createdAt || localDate()).slice(0, 10);
    return result;
  }
  return base;
}

function firstSourceValue(...values: any[]): any {
  return values.find((value) =>
    value !== undefined &&
    value !== null &&
    !(typeof value === 'string' && value.trim() === '') &&
    !(Array.isArray(value) && value.length === 0)
  );
}
function sourceText(value: any): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'Tak' : 'Nie';
  if (Array.isArray(value)) return value.map(sourceText).filter(Boolean).join(', ');
  if (typeof value === 'object') {
    const text = displayValue(value);
    return text === '—' ? '' : text;
  }
  return String(value).trim();
}
function sourceSummary(...parts: any[]): string {
  return parts.map(sourceText).filter(Boolean).join(' · ');
}
function labelledSource(label: string, value: any): string {
  const text = sourceText(value);
  return text ? `${label}: ${text}` : '';
}
function getRelatedItemDocumentValue(order: Order, type: string, key: string): any {
  const related = order.items?.find((candidate) => candidate.type === type);
  const details = related?.details || {};
  const enclosure = order.items?.find((candidate) => candidate.type === 'OBUDOWA');
  const enclosureDetails = enclosure?.details || {};
  const colors = order.items?.find((candidate) => candidate.type === 'KOLORY')?.details || {};

  if (type === 'KOLORY' && key.startsWith('documentColor')) {
    if (!related && !enclosure) return undefined;
    const value = key === 'documentColorShell'
      ? firstSourceValue(colors.kolorObudowy, enclosureDetails.kolorObudowy)
      : key === 'documentColorMetalwork'
      ? firstSourceValue(colors.kolorSlusarki, enclosureDetails.kolorSlusarki, colors.kolorDrzwi, enclosureDetails.kolorDrzwi)
      : key === 'documentColorRoof'
      ? firstSourceValue(colors.kolorDachu, enclosureDetails.kolorDachu, colors.koloryDodatkowe, enclosureDetails.koloryDodatkowe)
      : key === 'documentColorDoorsAndGrilles'
      ? firstSourceValue(colors.kolorDrzwiKraty, enclosureDetails.kolorDrzwiKraty, colors.kolorDrzwi, enclosureDetails.kolorDrzwi)
      : undefined;
    return value === undefined ? undefined : sourceText(value);
  }

  if (key === 'documentFinish' && type === 'OBUDOWA') {
    if (!related) return undefined;
    const value = firstSourceValue(details.tynk, details.wykonczenie, details['wykończenie'], details.materialWykonczenia);
    return value === undefined ? undefined : sourceText(value);
  }
  if (key === 'documentAntigraffiti' && type === 'OBUDOWA') {
    if (!related) return undefined;
    const value = firstSourceValue(details.antygraffitiStatus, typeof details.antygraffiti === 'boolean' ? details.antygraffiti : undefined);
    return value === undefined ? undefined : typeof value === 'boolean' ? (value ? 'Tak' : 'Nie') : sourceText(value);
  }
  if (key === 'documentGrounding' && type === 'OBUDOWA') {
    if (!related) return undefined;
    const value = firstSourceValue(details.uziemienie, details.typUziemienia, details.instalacjaUziemiajaca, details.opisUziemienia, details.sposobUziemienia);
    return value === undefined ? undefined : sourceText(value);
  }
  if (key === 'documentLighting' && type === 'OBUDOWA') {
    if (!related) return undefined;
    const direct = firstSourceValue(details.instalacjaOswietleniowa, details.instalacjaOswietlenia, details.oswietlenie, details.oswietlenieWewnetrzneZewnetrzne, details.oswietlenieOpis);
    if (direct !== undefined) return sourceText(direct);
    const equipment = sourceText(firstSourceValue(details.dodatkoweWyposazenie, details.wyposazenieDodatkowe, details.wyposazenie));
    return /oświetlen|oswietlen/i.test(equipment) ? equipment : undefined;
  }

  if (key !== 'documentSummary') return undefined;
  if (!related) {
    if (type === 'OPISY' && enclosure) {
      const summary = sourceSummary(
        labelledSource('Wymagane opisy', enclosureDetails.wymaganeOpisy),
        labelledSource('Sposób wykonania', enclosureDetails.sposobWykonania),
      );
      return summary || undefined;
    }
    if (type === 'DODATKOWE' && enclosure) return sourceText(enclosureDetails.inneUrzadzenia) || undefined;
    return undefined;
  }

  switch (type) {
    case 'ROZDZIELNICA_SN': {
      const count = firstSourceValue(details.liczbaPol, details.iloscPol);
      return sourceSummary(
        details.producent,
        firstSourceValue(details.model, details.typRozdzielnicy),
        count !== undefined ? `${sourceText(count)} pól` : '',
        labelledSource('Konfiguracja pól', details.konfiguracjaPol),
        details.parametryTechniczne,
      ) || sourceText(related.notes) || undefined;
    }
    case 'ROZDZIELNICA_NN': {
      const count = firstSourceValue(details.iloscPol, details.liczbaPol);
      return sourceSummary(
        firstSourceValue(details.typRozdzielnicy, details.typ),
        count !== undefined ? `${sourceText(count)} pól` : '',
        firstSourceValue(details.wyposazenieDodatkowe, details.wyposazenie, details.konfiguracja),
      ) || sourceText(related.notes) || undefined;
    }
    case 'OPISY':
      return sourceSummary(
        labelledSource('Wymagane opisy', firstSourceValue(details.wymaganeOpisy, enclosureDetails.wymaganeOpisy)),
        labelledSource('Sposób wykonania', firstSourceValue(details.sposobWykonania, enclosureDetails.sposobWykonania)),
      ) || sourceText(related.notes) || undefined;
    case 'SZAFKA_TELEMECHANIKI':
      return sourceSummary(
        labelledSource('RTU', firstSourceValue(details.typ, details.typSterownika)),
        labelledSource('Wyposażenie', details.wyposazenie),
        labelledSource('Zakres', details.zakres),
        labelledSource('Informacje techniczne', details.informacjeTechniczne),
        labelledSource('Sensory napięciowe', details.sensoryNapieciowe),
      ) || sourceText(related.notes) || undefined;
    case 'TRANSFORMATOR':
      return sourceSummary(
        labelledSource('Producent', details.producent),
        labelledSource('Typ / model', details.typ),
        labelledSource('Moc znamionowa', details.mocKVA !== undefined && details.mocKVA !== '' ? `${sourceText(details.mocKVA)} kVA` : ''),
        labelledSource('Numer seryjny', details.numerSeryjny),
      ) || sourceText(related.notes) || '';
    case 'TRANSFORMATOR_POTRZEB_WLASNYCH': {
      const power = sourceText(details.va);
      const powerWithUnit = power
        ? (/VA\s*$/i.test(power) ? power : `${power} VA`)
        : '';
      return sourceSummary(
        labelledSource('Moc znamionowa transformatora potrzeb własnych', powerWithUnit),
        labelledSource('Numer seryjny', details.numerSeryjny),
      ) || sourceText(related.notes) || undefined;
    }
    case 'DODATKOWE':
      return sourceSummary(
        labelledSource('Opis', firstSourceValue(details.opis, related.notes, enclosureDetails.inneUrzadzenia)),
        labelledSource('Specyfikacja', details.specyfikacja),
      ) || sourceText(related.notes) || undefined;
    default:
      return sourceText(related.notes) || undefined;
  }
}
function getPathValue(path: string | undefined, order: Order, item: OrderItem | undefined, form: FormData): any {
  if (!path) return undefined;
  if (path === 'system.today') return localDate();
  let bits = path.split('.');
  const root = bits.shift();
  let value: any;
  if (root === 'order' && bits[0] === 'itemByType' && bits[1]) {
    const type = bits[1];
    const tail = bits.slice(2);
    if (tail.length === 1 && tail[0].startsWith('document')) {
      return getRelatedItemDocumentValue(order, type, tail[0]);
    }
    value = order.items?.find((candidate) => candidate.type === type);
    bits = tail;
  } else {
    value = root === 'order' ? order : root === 'item' ? item : root === 'form' ? form : undefined;
  }
  for (const bit of bits) {
    if (value == null) return undefined;
    value = value[bit];
  }
  return value;
}
function getValueByKey(form: FormData, key: string): any {
  if (key.startsWith('customFields.')) return form.customFields[key.slice('customFields.'.length)];
  return (form as any)[key];
}
function setValueByKey(form: FormData, key: string, value: any): FormData {
  if (key.startsWith('customFields.')) {
    return { ...form, customFields: { ...form.customFields, [key.slice('customFields.'.length)]: value } };
  }
  return { ...form, [key]: value };
}
function displayValue(value: any): string {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.map(displayValue).filter((x) => x !== '—').join('; ') || '—';
  if (typeof value === 'object') {
    if ('enabled' in value && 'quantity' in value) return value.enabled ? 'Tak, ilość: ' + String(value.quantity || '1') : 'Nie';
    if ('type' in value) {
      const row = value as Row;
      if (row.category || row.wings) {
        const pieces = [
          row.category || row.type,
          row.wings,
          row.openingSide ? 'otwierane ' + row.openingSide : '',
          row.width && row.height ? row.width + ' × ' + row.height + ' mm' : '',
          row.ventilationGrille ? 'krata wentylacyjna' : '',
          row.intakeFan ? 'wentylator nawiewny' : '',
          row.exhaustFan ? 'wentylator wyciągowy' : '',
          row.quantity ? 'ilość: ' + row.quantity : '',
          row.position,
        ].filter(Boolean);
        return pieces.join(', ');
      }
      return [row.type, row.quantity ? 'ilość: ' + row.quantity : '', row.position].filter(Boolean).join(' — ');
    }
    return Object.values(value).map(displayValue).join(' ');
  }
  return String(value);
}
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
async function readJsonResponse(response: Response, operation: string): Promise<any> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`${operation}: serwer zwrócił pustą odpowiedź (HTTP ${response.status} ${response.statusText}).`);
  }
  try {
    return JSON.parse(body);
  } catch {
    const contentType = response.headers.get('content-type') || 'brak nagłówka Content-Type';
    const preview = body.replace(/\s+/g, ' ').trim().slice(0, 180);
    throw new Error(`${operation}: odpowiedź serwera nie jest poprawnym JSON-em (HTTP ${response.status}; ${contentType}). Początek odpowiedzi: ${preview}`);
  }
}
function sanitizeHtml(html: string): string {
  if (typeof DOMParser === 'undefined') {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  }
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const allowedTags = new Set(['DIV', 'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'H1', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TH', 'TD', 'SPAN', 'HR']);
  const allowedStyles = new Set(['font-family', 'font-size', 'font-weight', 'font-style', 'color', 'background-color', 'text-align', 'text-decoration', 'line-height', 'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right', 'padding', 'border', 'border-bottom', 'width']);
  const cleanNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return escapeHtml(node.textContent || '');
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    if (['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'FORM', 'SVG', 'MATH'].includes(el.tagName)) return '';
    const children = Array.from(el.childNodes).map(cleanNode).join('');
    if (!allowedTags.has(el.tagName)) return children;
    let attributes = '';
    const style = el.getAttribute('style');
    if (style) {
      const safeStyle = style.split(';').map((entry) => entry.trim()).filter(Boolean).filter((entry) => {
        const colon = entry.indexOf(':');
        if (colon < 0) return false;
        const name = entry.slice(0, colon).trim().toLowerCase();
        const value = entry.slice(colon + 1).trim();
        return allowedStyles.has(name) && !/url\s*\(|expression|javascript:/i.test(value);
      }).join('; ');
      if (safeStyle) attributes += ' style="' + escapeHtml(safeStyle) + '"';
    }
    if (el.hasAttribute('colspan') && el.tagName === 'TD') attributes += ' colspan="' + escapeHtml(el.getAttribute('colspan') || '1') + '"';
    if (el.hasAttribute('rowspan') && el.tagName === 'TD') attributes += ' rowspan="' + escapeHtml(el.getAttribute('rowspan') || '1') + '"';
    return '<' + el.tagName.toLowerCase() + attributes + '>' + children + '</' + el.tagName.toLowerCase() + '>';
  };
  return Array.from(parsed.body.childNodes).map(cleanNode).join('');
}
function renderTemplateHtml(template: DocumentTemplate, form: FormData, order: Order, item?: OrderItem): string {
  const variant = form.rozmiar && form.typObudowy && form.rozmiar.toUpperCase().startsWith(form.typObudowy.toUpperCase()) ? form.rozmiar : [form.typObudowy, form.rozmiar].filter(Boolean).join(' ');
  const titleParts = [form.typBudowli, variant, form.nazwaObiektu].filter(Boolean);
  const title = titleParts.join(' ').replace(/\s+/g, ' ').trim();
  const dot = [title, form.dotExtra].filter(Boolean).join(' — ');
  const html = template.contentHtml.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
    if (path === 'derived.title') return escapeHtml(title || '—');
    if (path === 'derived.dot') return escapeHtml(dot || '—');
    if (path === 'derived.deliveryTable') return deliveryTableHtml(form);
    if (path === 'form.dostawaWarszawa' || path === 'form.dostawaPyskowice') {
      const rows = normalizeDeliveryRows(path.endsWith('Warszawa') ? form.dostawaWarszawa : form.dostawaPyskowice);
      return rows.map((row) => escapeHtml(row.type) + ' (' + escapeHtml(row.quantity || '1') + ')').join('<br>') || '—';
    }
    const staticField = template.fields.find((field) => field.type === 'static' && path === 'form.' + field.valueKey);
    if (staticField) return escapeHtml(displayValue(staticField.defaultValue ?? staticField.helpText ?? staticField.label));
    let value: any;
    if (path.startsWith('form.')) value = getPathValue(path, order, item, form);
    else if (path.startsWith('order.') || path.startsWith('item.')) value = getPathValue(path, order, item, form);
    else value = undefined;
    if (path === 'form.przepusty' || path === 'form.otwory' || path === 'form.slusarka' || path.startsWith('form.customFields.')) value = getPathValue(path, order, item, form);
    if ((path === 'form.dataWystawienia' || path === 'form.terminRealizacji') && typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) value = value.slice(8, 10) + '.' + value.slice(5, 7) + '.' + value.slice(0, 4);
    const toHtmlLines = (text: string) => escapeHtml(text).replace(/\r\n?|\n/g, '<br>');
    if (Array.isArray(value)) {
      const rows = value.map((entry) => displayValue(entry)).filter((entry) => entry !== '—');
      return rows.map(toHtmlLines).join('<br>') || '—';
    }
    return toHtmlLines(displayValue(value));
  });
  return sanitizeHtml(html);
}
const resolveFieldLabel = (template: DocumentTemplate, fieldId: string) => template.fields.find((field) => field.id === fieldId)?.label || fieldId;
const sourceExamples = [
  'order.orderNumber', 'order.projectName', 'order.client', 'order.stationSize', 'order.departureDate', 'order.createdAt',
  'item.details.typBudowli', 'item.plannedDate', 'item.orderDate', 'item.details.typObudowy', 'item.details.rozmiar',
  'item.details.typDachu', 'item.details.kolorObudowy', 'item.details.terminRealizacji', 'form.nazwaObiektu',
  'order.itemByType.ROZDZIELNICA_SN.documentSummary',
  'order.itemByType.ROZDZIELNICA_SN.details.model', 'order.itemByType.ROZDZIELNICA_SN.details.liczbaPol',
  'order.itemByType.ROZDZIELNICA_NN.documentSummary', 'order.itemByType.ROZDZIELNICA_NN.details.iloscPol',
  'order.itemByType.KOLORY.documentColorShell', 'order.itemByType.KOLORY.documentColorMetalwork',
  'order.itemByType.KOLORY.documentColorRoof', 'order.itemByType.KOLORY.documentColorDoorsAndGrilles',
  'order.itemByType.OPISY.documentSummary', 'order.itemByType.SZAFKA_TELEMECHANIKI.documentSummary',
  'order.itemByType.TRANSFORMATOR.documentSummary', 'order.itemByType.TRANSFORMATOR_POTRZEB_WLASNYCH.documentSummary',
  'order.itemByType.DODATKOWE.documentSummary',
  'order.itemByType.OBUDOWA.documentFinish', 'order.itemByType.OBUDOWA.documentAntigraffiti',
  'order.itemByType.OBUDOWA.documentGrounding', 'order.itemByType.OBUDOWA.documentLighting',
];
function doorDimensions(stationType: string, category: string): { width: string; height: string } {
  if (!String(stationType || '').toUpperCase().startsWith('BEK')) return { width: '', height: '' };
  if (category === 'Drzwi Trafo') return { width: '1170', height: '2100' };
  if (['Drzwi SN i NN', 'Drzwi SN', 'Drzwi NN'].includes(category)) return { width: '950', height: '2100' };
  return { width: '', height: '' };
}
function doorRowDescription(row: Row): string {
  return displayValue({ ...row, category: row.category || row.type });
}
function rowDefaults(key: string, form: FormData): Row {
  if (key === 'slusarka') {
    const category = 'Drzwi SN i NN';
    const dims = doorDimensions(form.typObudowy, category);
    return { id: uid('door'), type: category, category, quantity: '1', position: '', wings: 'Jednoskrzydłowe', openingSide: 'Lewe', width: dims.width, height: dims.height, ventilationGrille: true, intakeFan: false, exhaustFan: false };
  }
  return { id: uid('row'), type: '', quantity: '1', position: '' };
}
function hydrateFromBindings(form: FormData, template: DocumentTemplate, order: Order, item: OrderItem | undefined, hasSaved: boolean): FormData {
  let next = form;
  for (const field of template.fields) {
    if (!field.sourcePath || !field.valueKey || field.type === 'static') continue;
    const existing = getValueByKey(next, field.valueKey);
    const source = getPathValue(field.sourcePath, order, item, next);
    // A live binding (for example the Obudowa realisation deadline) always follows the current source.
    if (field.liveBinding) {
      if (source !== undefined && source !== null) next = setValueByKey(next, field.valueKey, source);
      continue;
    }
    if (hasSaved && existing !== undefined) continue;
    if (existing !== undefined && existing !== null && existing !== '' && !(Array.isArray(existing) && existing.length === 0)) continue;
    if (source !== undefined && source !== null && source !== '') next = setValueByKey(next, field.valueKey, source);
    else if (!hasSaved && field.defaultValue !== undefined && (existing === undefined || existing === '' || (Array.isArray(existing) && existing.length === 0))) next = setValueByKey(next, field.valueKey, clone(field.defaultValue));
  }
  if (!hasSaved) {
    const variant = next.rozmiar && next.typObudowy && next.rozmiar.toUpperCase().startsWith(next.typObudowy.toUpperCase())
      ? next.rozmiar
      : [next.typObudowy, next.rozmiar].filter(Boolean).join(' ');
    next = {
      ...next,
      opisObudowy: 'Wykonanie obudowy ' + variant + ' wraz z fundamentem i przepustami kablowymi SN, nN i uziemiającymi, wraz z montażem ślusarki i rozdzielnicy SN i nN.',
    };
  }
  return next;
}
function ruleMatches(value: any, triggerValue: string): boolean {
  return Array.isArray(value) ? value.includes(triggerValue) : String(value ?? '') === triggerValue;
}
function applyRuleChanges(form: FormData, template: DocumentTemplate, changedFieldId: string, value: any): { form: FormData; notices: string[] } {
  let next = form;
  const notices: string[] = [];
  for (const rule of template.rules || []) {
    if (rule.triggerFieldId !== changedFieldId) continue;
    const target = template.fields.find((field) => field.id === rule.targetFieldId);
    if (!target) continue;
    const matched = ruleMatches(value, rule.triggerValue);
    const current = getValueByKey(next, target.valueKey);
    if (rule.action === 'suggestion' && matched) {
      notices.push('Sugestia: ' + resolveFieldLabel(template, rule.targetFieldId) + ' — ' + rule.targetValue + '.');
      continue;
    }
    if (rule.action === 'warning' && matched) {
      notices.push('Uwaga: po wybraniu „' + rule.triggerValue + '” sprawdź pole „' + target.label + '”.');
      continue;
    }
    if (rule.action !== 'automatic') continue;
    if (matched) {
      if (Array.isArray(current)) {
        if (target.type === 'repeatable' || target.type === 'doors') {
          const exists = current.some((row: any) => row.type === rule.targetValue && row._autoRuleId === rule.id);
          if (!exists) next = setValueByKey(next, target.valueKey, [...current, { id: uid('auto'), type: rule.targetValue, quantity: '1', position: '', _autoRuleId: rule.id }]);
        } else if (!current.includes(rule.targetValue)) next = setValueByKey(next, target.valueKey, [...current, rule.targetValue]);
      } else if (current !== rule.targetValue) next = setValueByKey(next, target.valueKey, rule.targetValue);
    } else if (Array.isArray(current) && (target.type === 'repeatable' || target.type === 'doors')) {
      next = setValueByKey(next, target.valueKey, current.filter((row: any) => row._autoRuleId !== rule.id));
    } else if (Array.isArray(current)) {
      next = setValueByKey(next, target.valueKey, current.filter((item: any) => item !== rule.targetValue));
    } else if (current === rule.targetValue) {
      next = setValueByKey(next, target.valueKey, '');
    }
  }
  return { form: next, notices };
}

const FormFieldInput: React.FC<{
  field: FormField;
  value: any;
  onChange: (value: any) => void;
  form: FormData;
}> = ({ field, value, onChange, form }) => {
  const commonInput = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';
  if (field.type === 'static') return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">{field.helpText || field.defaultValue || field.label}</div>;
  if (field.readOnly) return <div aria-readonly="true" className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 whitespace-pre-wrap">{displayValue(value)}</div>;
  if (field.type === 'checkbox-list') {
    const selected = Array.isArray(value) ? value : [];
    return <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{(field.options || []).map((option) => (
      <label key={option} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50">
        <input type="checkbox" className="mt-0.5" checked={selected.includes(option)} onChange={(event) => onChange(event.target.checked ? [...selected, option] : selected.filter((x: string) => x !== option))}/>
        <span>{option}</span>
      </label>
    ))}</div>;
  }
  if (field.type === 'quantity-toggle') {
    const current = value && typeof value === 'object' ? value : { enabled: false, quantity: '1' };
    return <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 p-3">
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(current.enabled)} onChange={(event) => onChange({ ...current, enabled: event.target.checked })}/> Uwzględnij pozycję</label>
      <label className="flex items-center gap-2 text-sm text-slate-600">Ilość <input type="number" min="1" value={current.quantity || '1'} onChange={(event) => onChange({ ...current, quantity: event.target.value })} disabled={!current.enabled} className="w-20 rounded-lg border px-2 py-1.5 disabled:bg-slate-100"/></label>
    </div>;
  }
  if (field.type === 'repeatable') {
    const rows: Row[] = Array.isArray(value) ? value : [];
    return <div className="space-y-3">
      <div className="flex justify-end"><button type="button" onClick={() => onChange([...rows, { id: uid('row'), type: '', quantity: '1', position: '' }])} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Plus size={14}/> Dodaj pozycję</button></div>
      {!rows.length && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Brak pozycji. Użyj „Dodaj pozycję”, aby dodać przepust lub otwór.</p>}
      {rows.map((row) => <div key={row.id} className="grid grid-cols-1 gap-2 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(0,1.4fr)_80px_minmax(0,1fr)_34px]">
        <label className="block space-y-1 text-xs font-semibold text-slate-600">Typ<select value={row.type} onChange={(event) => onChange(rows.map((candidate) => candidate.id === row.id ? { ...candidate, type: event.target.value } : candidate))} className={commonInput}><option value="">— wybierz —</option>{(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}{row.type && !(field.options || []).includes(row.type) && <option value={row.type}>{row.type}</option>}</select></label>
        <label className="block space-y-1 text-xs font-semibold text-slate-600">Ilość<input type="number" min="1" value={row.quantity || '1'} onChange={(event) => onChange(rows.map((candidate) => candidate.id === row.id ? { ...candidate, quantity: event.target.value } : candidate))} className={commonInput}/></label>
        <label className="block space-y-1 text-xs font-semibold text-slate-600">Położenie / opis<input value={row.position || ''} onChange={(event) => onChange(rows.map((candidate) => candidate.id === row.id ? { ...candidate, position: event.target.value } : candidate))} className={commonInput}/></label>
        <button type="button" title="Usuń pozycję" onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))} className="self-end rounded-lg border border-red-200 p-2 text-red-600"><Trash2 size={15}/></button>
      </div>)}
    </div>;
  }
  if (field.type === 'delivery-list') {
    const rows = normalizeDeliveryRows(value);
    const updateRow = (rowId: string, patch: Partial<Row>) =>
      onChange(rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
    return <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={() => onChange([...rows, { id: uid('delivery'), type: '', quantity: '1', position: '' }])} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Plus size={14}/> Dodaj element</button>
      </div>
      {!rows.length && <p className="text-xs text-slate-500">Brak elementów. Kliknij „Dodaj element”, a następnie wybierz go z listy lub wpisz własną nazwę.</p>}
      {rows.map((row) => {
        const isPreset = DELIVERY_ITEM_OPTIONS.includes(row.type as (typeof DELIVERY_ITEM_OPTIONS)[number]);
        const manualMode = Boolean(row._manualDelivery || (!isPreset && row.type));
        const selectValue = manualMode ? MANUAL_DELIVERY_VALUE : isPreset ? row.type : '';
        return <div key={row.id} className="grid grid-cols-1 items-end gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[minmax(0,1.6fr)_70px_minmax(0,1fr)_32px]">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">Element</label>
            <select
              value={selectValue}
              onChange={(e) => {
                const selected = e.target.value;
                if (selected === MANUAL_DELIVERY_VALUE) {
                  updateRow(row.id, { type: isPreset ? '' : row.type, _manualDelivery: true });
                } else {
                  updateRow(row.id, { type: selected, _manualDelivery: false });
                }
              }}
              className={commonInput}
            >
              <option value="">— Wybierz element —</option>
              {DELIVERY_ITEM_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
              <option value={MANUAL_DELIVERY_VALUE}>Inny element — wpisz ręcznie…</option>
            </select>
            {manualMode && (
              <input
                value={row.type}
                onChange={(e) => updateRow(row.id, { type: e.target.value, _manualDelivery: true })}
                className={commonInput}
                placeholder="Wpisz własną nazwę elementu"
                aria-label="Własna nazwa elementu"
              />
            )}
          </div>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Ilość<input type="number" min="1" value={row.quantity || '1'} onChange={(e) => updateRow(row.id, { quantity: e.target.value })} className={commonInput}/></label>
          <label className="space-y-1 text-xs font-semibold text-slate-600">Uwagi<input value={row.position || ''} onChange={(e) => updateRow(row.id, { position: e.target.value })} className={commonInput} placeholder="Opcjonalnie"/></label>
          <button type="button" title="Usuń element" onClick={() => onChange(rows.filter((x) => x.id !== row.id))} className="self-end rounded border border-red-200 p-2 text-red-600"><Trash2 size={15}/></button>
        </div>;
      })}
    </div>;
  }
  if (field.type === 'doors') {
    const rows: Row[] = Array.isArray(value) ? value : [];
    const update = (rowId: string, patch: Partial<Row>) => onChange(rows.map((row) => row.id === rowId ? { ...row, ...patch } : row));
    const categories = field.options?.length ? field.options : ['Drzwi SN i NN', 'Drzwi SN', 'Drzwi NN', 'Drzwi Trafo'];
    return <div className="space-y-3">
      <div className="flex items-center justify-between gap-2"><p className="text-xs text-slate-500">Konfiguracja każdej pozycji jest zapisywana tylko w tym dokumencie.</p><button type="button" onClick={() => onChange([...rows, rowDefaults(field.valueKey === 'slusarka' ? 'slusarka' : field.valueKey, form)])} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold"><Plus size={14}/> Dodaj drzwi</button></div>
      {!rows.length && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Nie dodano drzwi ani ślusarki.</p>}
      {rows.map((row) => <div key={row.id} className="space-y-3 rounded-xl border border-slate-200 p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="block space-y-1 text-xs font-semibold text-slate-600">Kategoria<select value={row.category || row.type} onChange={(event) => { const category = event.target.value; const dims = doorDimensions(form.typObudowy, category); update(row.id, { category, type: category, width: dims.width, height: dims.height }); }} className={commonInput}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
          <label className="block space-y-1 text-xs font-semibold text-slate-600">Liczba skrzydeł<select value={row.wings || 'Jednoskrzydłowe'} onChange={(event) => update(row.id, { wings: event.target.value, openingSide: event.target.value === 'Jednoskrzydłowe' ? (row.openingSide || 'Lewe') : '' })} className={commonInput}><option>Jednoskrzydłowe</option><option>Dwuskrzydłowe</option></select></label>
          {(!row.wings || row.wings === 'Jednoskrzydłowe') && <label className="block space-y-1 text-xs font-semibold text-slate-600">Otwieranie<select value={row.openingSide || 'Lewe'} onChange={(event) => update(row.id, { openingSide: event.target.value })} className={commonInput}><option>Lewe</option><option>Prawe</option></select></label>}
          <div className="grid grid-cols-2 gap-2"><label className="block space-y-1 text-xs font-semibold text-slate-600">Szerokość (mm)<input value={row.width || ''} placeholder={form.typObudowy === 'NZ' ? 'wg wymiaru stacji' : '950'} onChange={(event) => update(row.id, { width: event.target.value })} className={commonInput}/></label><label className="block space-y-1 text-xs font-semibold text-slate-600">Wysokość (mm)<input value={row.height || ''} placeholder={form.typObudowy === 'NZ' ? 'wg wymiaru stacji' : '2100'} onChange={(event) => update(row.id, { height: event.target.value })} className={commonInput}/></label></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(row.ventilationGrille)} onChange={(event) => update(row.id, { ventilationGrille: event.target.checked })}/> Krata wentylacyjna</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(row.intakeFan)} onChange={(event) => update(row.id, { intakeFan: event.target.checked })}/> Wentylator nawiewny</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(row.exhaustFan)} onChange={(event) => update(row.id, { exhaustFan: event.target.checked })}/> Wentylator wyciągowy</label>
          <label className="block space-y-1 text-xs font-semibold text-slate-600">Ilość<input type="number" min="1" value={row.quantity || '1'} onChange={(event) => update(row.id, { quantity: event.target.value })} className={commonInput}/></label>
        </div>
        <div className="flex items-center justify-between gap-2 border-t pt-2"><p className="text-xs text-slate-500">{doorRowDescription(row)}</p><button type="button" onClick={() => onChange(rows.filter((candidate) => candidate.id !== row.id))} className="rounded-lg border border-red-200 p-2 text-red-600" title="Usuń drzwi"><Trash2 size={15}/></button></div>
      </div>)}
    </div>;
  }
  if (field.type === 'select') return <select required={field.required} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={commonInput}>
    <option value="">— Nie uzupełniono —</option>
    {(field.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
    {value && !(field.options || []).includes(String(value)) && <option value={String(value)}>{String(value)} (wartość zapisana)</option>}
  </select>;
  if (field.type === 'textarea') return <textarea required={field.required} rows={field.fullWidth ? 4 : 3} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={commonInput} />;
  return <input required={field.required} type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className={commonInput}/>;
};

interface Props {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  onSaveOrderChanges: (order: Order) => void;
  currentProfile?: UserRoleProfile;
  canDownload?: boolean;
}
export const OrderDocumentFormModal: React.FC<Props> = ({ order, isOpen, onClose, onSaveOrderChanges, currentProfile, canDownload = true }) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const item = order.items.find((candidate) => candidate.type === 'OBUDOWA');
  const canEdit = canEditItemType(profile, 'OBUDOWA');
  const isAdmin = profile.id === 'admin';
  const [form, setForm] = useState<FormData>(() => readForm(item, order));
  const [originalForm, setOriginalForm] = useState<FormData>(() => readForm(item, order));
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate>(() => clone(DEFAULT_TEMPLATE));
  const [globalTemplate, setGlobalTemplate] = useState<DocumentTemplate>(() => clone(DEFAULT_TEMPLATE));
  const [customDraft, setCustomDraft] = useState<DocumentTemplate>(() => clone(DEFAULT_TEMPLATE));
  const [adminDraft, setAdminDraft] = useState<DocumentTemplate>(() => clone(DEFAULT_TEMPLATE));
  const [templateHistory, setTemplateHistory] = useState<Array<{ version: number; updatedAt?: string; updatedBy?: string }>>([]);
  const [mode, setMode] = useState<Mode>('form');
  const [designerTab, setDesignerTab] = useState<DesignerTab>('content');
  const [selectedSectionId, setSelectedSectionId] = useState('naglowek');
  const [selectedFieldId, setSelectedFieldId] = useState('typBudowli');
  const [sourceHtmlMode, setSourceHtmlMode] = useState(false);
  const [review, setReview] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [ruleNotices, setRuleNotices] = useState<string[]>([]);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const saved = item?.details?.formularze?.zlecenieObudowy;
    const savedTemplate = saved && saved.__templateSnapshot
      ? normalizeOrderBoundFields(saved.__templateSnapshot as DocumentTemplate)
      : null;
    const base = readForm(item, order);
    setForm(base);
    setOriginalForm(clone(base));
    setReview(false);
    setMode('form');
    setDesignerTab('content');
    setRuleNotices([]);
    setMessage('');
    const initialTemplate = savedTemplate ? clone(savedTemplate) : normalizeOrderBoundFields(clone(DEFAULT_TEMPLATE));
    setActiveTemplate(initialTemplate);
    setGlobalTemplate(clone(DEFAULT_TEMPLATE));
    setCustomDraft(clone(initialTemplate));
    setAdminDraft(clone(DEFAULT_TEMPLATE));
    let mounted = true;
    setTemplateLoading(true);
    fetch('/api/document-form-templates/zlecenie-obudowy', { credentials: 'same-origin' })
      .then(async (response) => {
        const result = await readJsonResponse(response, 'Odczyt wzorca formularza');
        if (!response.ok || !result?.success) {
          throw new Error(result?.error || `Serwer nie udostępnił wzorca (HTTP ${response.status} ${response.statusText}).`);
        }
        return result;
      })
      .then((result) => {
        if (!mounted) return;
        const serverTemplate = result?.template && typeof result.template === 'object' ? result.template as DocumentTemplate : clone(DEFAULT_TEMPLATE);
        const safeTemplate = normalizeOrderBoundFields({
          ...clone(DEFAULT_TEMPLATE),
          ...serverTemplate,
          contentHtml: sanitizeHtml(String(serverTemplate.contentHtml || DEFAULT_TEMPLATE.contentHtml)),
        } as DocumentTemplate);
        setGlobalTemplate(safeTemplate);
        setAdminDraft(clone(safeTemplate));
        setTemplateHistory(Array.isArray(result?.versions) ? result.versions : []);
        if (!savedTemplate) {
          setActiveTemplate(safeTemplate);
          setCustomDraft(clone(safeTemplate));
        }
        const hydrated = hydrateFromBindings(base, savedTemplate || safeTemplate, order, item, Boolean(saved));
        hydrated.dostawaWarszawa = normalizeDeliveryRows(hydrated.dostawaWarszawa);
        hydrated.dostawaPyskowice = normalizeDeliveryRows(hydrated.dostawaPyskowice);
        setForm(hydrated);
        setOriginalForm(clone(hydrated));
      })
      .catch((error) => {
        if (!mounted) return;
        const cause = error instanceof Error ? error.message : 'nieznany błąd';
        setMessage('Nie udało się wczytać wzorca z serwera: ' + cause + '. Użyto lokalnego wzorca domyślnego.');
        const hydrated = hydrateFromBindings(base, savedTemplate || DEFAULT_TEMPLATE, order, item, Boolean(saved));
        hydrated.dostawaWarszawa = normalizeDeliveryRows(hydrated.dostawaWarszawa);
        hydrated.dostawaPyskowice = normalizeDeliveryRows(hydrated.dostawaPyskowice);
        setForm(hydrated);
        setOriginalForm(clone(hydrated));
      })
      .finally(() => { if (mounted) setTemplateLoading(false); });
    return () => { mounted = false; };
  }, [isOpen, order.id]);

  const workingTemplate = mode === 'custom' ? customDraft : mode === 'admin' ? adminDraft : activeTemplate;
  const setWorkingTemplate = (update: DocumentTemplate | ((previous: DocumentTemplate) => DocumentTemplate)) => {
    if (mode === 'custom') setCustomDraft((previous) => typeof update === 'function' ? update(previous) : update);
    else if (mode === 'admin') setAdminDraft((previous) => typeof update === 'function' ? update(previous) : update);
  };
  const selectedSection = workingTemplate.sections.find((section) => section.id === selectedSectionId) || workingTemplate.sections[0];
  const selectedField = workingTemplate.fields.find((field) => field.id === selectedFieldId) || workingTemplate.fields[0];

  // Keep the visual editor's DOM stable while typing; reinitialise only when switching editor modes/tabs.
  useEffect(() => {
    if (mode === 'form' || designerTab !== 'content' || sourceHtmlMode) return;
    if (editorRef.current) editorRef.current.innerHTML = sanitizeHtml(workingTemplate.contentHtml);
  }, [mode, designerTab, sourceHtmlMode]);

  const updateFormField = (field: FormField, value: any) => {
    if (field.readOnly) return;
    const previous = form;
    let next = setValueByKey(previous, field.valueKey, value);
    if (field.valueKey === 'typObudowy' || field.valueKey === 'rozmiar') {
      const oldVariant = previous.rozmiar && previous.typObudowy && previous.rozmiar.toUpperCase().startsWith(previous.typObudowy.toUpperCase()) ? previous.rozmiar : [previous.typObudowy, previous.rozmiar].filter(Boolean).join(' ');
      const newVariant = next.rozmiar && next.typObudowy && next.rozmiar.toUpperCase().startsWith(next.typObudowy.toUpperCase()) ? next.rozmiar : [next.typObudowy, next.rozmiar].filter(Boolean).join(' ');
      const oldExpected = 'Wykonanie obudowy ' + oldVariant + ' wraz z fundamentem i przepustami kablowymi SN, nN i uziemiającymi, wraz z montażem ślusarki i rozdzielnicy SN i nN.';
      const newExpected = 'Wykonanie obudowy ' + newVariant + ' wraz z fundamentem i przepustami kablowymi SN, nN i uziemiającymi, wraz z montażem ślusarki i rozdzielnicy SN i nN.';
      if (!previous.opisObudowy || previous.opisObudowy === oldExpected) next = { ...next, opisObudowy: newExpected };
      if (field.valueKey === 'typObudowy') {
        next = {
          ...next,
          slusarka: next.slusarka.map((row) => {
            const dims = doorDimensions(String(value || ''), row.category || row.type);
            const knownSizes = ['950', '1170', '2100', ''];
            const shouldUpdateWidth = !row.width || knownSizes.includes(row.width);
            const shouldUpdateHeight = !row.height || knownSizes.includes(row.height);
            return { ...row, width: shouldUpdateWidth ? dims.width : row.width, height: shouldUpdateHeight ? dims.height : row.height };
          }),
        };
      }
    }
    const evaluated = applyRuleChanges(next, activeTemplate, field.id, value);
    setRuleNotices(evaluated.notices);
    setForm(evaluated.form);
  };

  const updateTemplateField = (fieldId: string, patch: Partial<FormField>) => {
    setWorkingTemplate((template) => ({ ...template, fields: template.fields.map((field) => field.id === fieldId ? { ...field, ...patch } : field) }));
  };
  const updateSection = (sectionId: string, patch: Partial<FormSection>) => {
    setWorkingTemplate((template) => ({ ...template, sections: template.sections.map((section) => section.id === sectionId ? { ...section, ...patch } : section) }));
  };
  const moveSection = (sectionId: string, direction: -1 | 1) => {
    setWorkingTemplate((template) => {
      const index = template.sections.findIndex((section) => section.id === sectionId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= template.sections.length) return template;
      const sections = [...template.sections];
      [sections[index], sections[target]] = [sections[target], sections[index]];
      return { ...template, sections };
    });
  };
  const moveField = (sectionId: string, fieldId: string, direction: -1 | 1) => {
    setWorkingTemplate((template) => ({
      ...template,
      sections: template.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const ids = [...section.fieldIds];
        const index = ids.indexOf(fieldId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= ids.length) return section;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        return { ...section, fieldIds: ids };
      }),
    }));
  };
  const addSection = () => {
    const section: FormSection = { id: uid('section'), title: 'Nowa sekcja', fieldIds: [], columns: 2, visible: true };
    setWorkingTemplate((template) => ({ ...template, sections: [...template.sections, section] }));
    setSelectedSectionId(section.id);
    setDesignerTab('structure');
  };
  const addField = () => {
    const id = uid('wlasne-pole').replace(/[^a-zA-Z0-9_-]/g, '-');
    const field: FormField = { id, label: 'Nowe pole', valueKey: 'customFields.' + id, type: 'text', sourcePath: '', visible: true, required: false };
    const targetSectionId = selectedSection?.id || uid('section');
    const needsSection = !selectedSection;
    if (needsSection) setSelectedSectionId(targetSectionId);
    setWorkingTemplate((template) => {
      const sections = needsSection
        ? [...template.sections, { id: targetSectionId, title: 'Nowa sekcja', fieldIds: [], columns: 2 as const, visible: true }]
        : template.sections;
      return {
        ...template,
        fields: [...template.fields, field],
        sections: sections.map((section) => section.id === targetSectionId ? { ...section, fieldIds: [...section.fieldIds, field.id] } : section),
      };
    });
    setSelectedFieldId(id);
    setDesignerTab('structure');
  };
  const moveFieldToSection = (fieldId: string, targetSectionId: string) => {
    setWorkingTemplate((template) => {
      const sections = template.sections.map((section) => ({ ...section, fieldIds: section.fieldIds.filter((id) => id !== fieldId) }));
      const target = sections.find((section) => section.id === targetSectionId);
      if (target) target.fieldIds = [...target.fieldIds, fieldId];
      return { ...template, sections };
    });
  };
  const removeField = (fieldId: string) => {
    setWorkingTemplate((template) => ({
      ...template,
      fields: template.fields.filter((field) => field.id !== fieldId),
      sections: template.sections.map((section) => ({ ...section, fieldIds: section.fieldIds.filter((id) => id !== fieldId) })),
      rules: template.rules.filter((rule) => rule.triggerFieldId !== fieldId && rule.targetFieldId !== fieldId),
    }));
    if (selectedFieldId === fieldId) setSelectedFieldId('');
  };
  const removeSection = (sectionId: string) => {
    setWorkingTemplate((template) => {
      const section = template.sections.find((candidate) => candidate.id === sectionId);
      const removedFieldIds = new Set(section?.fieldIds || []);
      return {
        ...template,
        sections: template.sections.filter((candidate) => candidate.id !== sectionId),
        fields: template.fields.filter((field) => !removedFieldIds.has(field.id)),
        rules: template.rules.filter((rule) => !removedFieldIds.has(rule.triggerFieldId) && !removedFieldIds.has(rule.targetFieldId)),
      };
    });
    if (selectedSectionId === sectionId) setSelectedSectionId('');
  };
  const addRule = () => {
    if (workingTemplate.fields.length < 2) return;
    const source = workingTemplate.fields[0];
    const target = workingTemplate.fields.find((field) => field.id !== source.id);
    if (!target) return;
    const rule: TemplateRule = { id: uid('rule'), triggerFieldId: source.id, triggerValue: '', targetFieldId: target.id, targetValue: '', action: 'automatic' };
    setWorkingTemplate((template) => ({ ...template, rules: [...template.rules, rule] }));
  };
  const updateRule = (ruleId: string, patch: Partial<TemplateRule>) => {
    setWorkingTemplate((template) => ({ ...template, rules: template.rules.map((rule) => rule.id === ruleId ? { ...rule, ...patch } : rule) }));
  };
  const removeRule = (ruleId: string) => setWorkingTemplate((template) => ({ ...template, rules: template.rules.filter((rule) => rule.id !== ruleId) }));

  const openCustomEdit = () => {
    if (!canEdit) return;
    setCustomDraft(clone(activeTemplate));
    setMode('custom');
    setDesignerTab('content');
    setSourceHtmlMode(false);
    setMessage('');
  };
  const openAdminEdit = () => {
    if (!isAdmin) return;
    setAdminDraft(clone(globalTemplate));
    setMode('admin');
    setDesignerTab('content');
    setSourceHtmlMode(false);
    setMessage('');
  };
  const saveCustomEdit = () => {
    const next = { ...clone(customDraft), contentHtml: sanitizeHtml(customDraft.contentHtml) };
    setActiveTemplate(next);
    setCustomDraft(clone(next));
    setForm((current) => ({ ...current, __templateSnapshot: clone(next), __templateVersion: next.version }));
    setMode('form');
    setMessage('Zapisano zmiany tylko w tym dokumencie. Wzorzec współdzielony nie został zmieniony.');
  };
  const saveAdminTemplate = async () => {
    if (!isAdmin) return;
    const sanitized = { ...clone(adminDraft), contentHtml: sanitizeHtml(adminDraft.contentHtml) };
    setTemplateSaving(true);
    setMessage('');
    try {
      const response = await fetch('/api/document-form-templates/' + encodeURIComponent(sanitized.key), {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: sanitized }),
      });
      const result = await readJsonResponse(response, 'Publikacja wzorca formularza');
      if (!response.ok || !result?.success || !result?.template) {
        throw new Error(result?.error || `Serwer nie opublikował wzorca (HTTP ${response.status} ${response.statusText}).`);
      }
      const published = { ...sanitized, ...result.template, contentHtml: sanitizeHtml(String(result.template.contentHtml || sanitized.contentHtml)) } as DocumentTemplate;
      // Persist the baseline form values with the new layout. Unsaved edits to
      // ordinary form fields remain in local state until the review confirmation.
      const formWithPublishedTemplate: FormData = {
        ...originalForm,
        __templateSnapshot: clone(published),
        __templateVersion: published.version,
      };
      setGlobalTemplate(published);
      setAdminDraft(clone(published));
      setActiveTemplate(clone(published));
      setCustomDraft(clone(published));
      setForm((current) => ({ ...current, __templateSnapshot: clone(published), __templateVersion: published.version }));
      // The template snapshot is saved immediately to this document. Keep the
      // rest of the baseline intact so any ordinary form-field edits remain visible.
      setOriginalForm((current) => ({
        ...current,
        __templateSnapshot: clone(published),
        __templateVersion: published.version,
      }));
      setTemplateHistory(Array.isArray(result.versions) ? result.versions : templateHistory);

      if (item) {
        const savedAt = new Date().toISOString();
        const updatedOrder: Order = {
          ...order,
          items: order.items.map((candidate) => candidate.id !== item.id ? candidate : {
            ...candidate,
            details: {
              ...candidate.details,
              formularze: {
                ...(candidate.details?.formularze || {}),
                zlecenieObudowy: formWithPublishedTemplate,
              },
            },
            updatedAt: savedAt,
          }),
          updatedAt: savedAt,
        };
        // Save only this order's snapshot; saved forms in other orders are not touched.
        void onSaveOrderChanges(updatedOrder);
        setMessage('Opublikowano wersję wzorca ' + published.version + ' i od razu zastosowano ją do bieżącego formularza. Wcześniej zapisane formularze w innych zleceniach pozostają bez zmian.');
      } else {
        setMessage('Opublikowano wersję wzorca ' + published.version + '. Brak pozycji Obudowa — nie zapisano kopii wzorca w bieżącym zleceniu.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Błąd zapisu wzorca.');
    } finally {
      setTemplateSaving(false);
    }
  };

  const formatEditor = (command: string, value?: string) => {
    document.execCommand(command, false, value);
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setWorkingTemplate((template) => ({ ...template, contentHtml: html }));
    }
  };
  const insertToken = (token: string) => {
    if (editorRef.current) editorRef.current.focus();
    document.execCommand('insertText', false, token);
    if (editorRef.current) setWorkingTemplate((template) => ({ ...template, contentHtml: editorRef.current?.innerHTML || template.contentHtml }));
  };

  const changedLabels: Record<string, string> = {
    typBudowli: 'Typ budowli', typObudowy: 'Typ obudowy', rozmiar: 'Rozmiar obudowy', nazwaObiektu: 'Nazwa obiektu',
    numerZL: 'Numer ZL', dataWystawienia: 'Data wystawienia', terminRealizacji: 'Termin realizacji', dotExtra: 'Dodatkowa wzmianka DOT.',
    opisObudowy: 'Opis obudowy', dlugosc: 'Długość', szerokosc: 'Szerokość', wysokosc: 'Wysokość', konstrukcja: 'Konstrukcja',
    scianyIlosc: 'Liczba ścian REI', scianyKlasa: 'Klasa REI ścian', dachTyp: 'Typ dachu', dachKlasa: 'Klasa REI dachu',
    kolorObudowy: 'Kolor obudowy', kolorSlusarki: 'Kolor ślusarki', kolorDachu: 'Kolor dachu', kolorDrzwiKraty: 'Kolor drzwi i krat',
    antygraffiti: 'Antygraffiti', tynk: 'Tynk', dodatkoweWyposazenie: 'Dodatkowe wyposażenie', przepusty: 'Przepusty',
    otwory: 'Otwory', slusarka: 'Drzwi i ślusarka', dostawaPyskowice: 'Dostawa — Pyskowice',
    dostawaWarszawa: 'Dostawa — Warszawa', uwagi: 'Uwagi',
  };
  const isFormFieldChanged = (key: string) => JSON.stringify((form as any)[key]) !== JSON.stringify((originalForm as any)[key]);
  const isCustomFieldChanged = (key: string) => JSON.stringify(form.customFields?.[key]) !== JSON.stringify(originalForm.customFields?.[key]);
  const templateSnapshotChanged = JSON.stringify(form.__templateSnapshot || null) !== JSON.stringify(originalForm.__templateSnapshot || null);
  if (templateSnapshotChanged) changedLabels.__templateSnapshot = 'Własna struktura / tekst dokumentu';
  const changedKeys = Object.keys(changedLabels).filter((key) => key === '__templateSnapshot' ? templateSnapshotChanged : isFormFieldChanged(key));
  if (JSON.stringify(form.customFields) !== JSON.stringify(originalForm.customFields)) changedKeys.push('customFields');
  const showChangeValue = (key: string, value: any) => {
    if (key === 'customFields') return Object.keys(value || {}).map((fieldKey) => fieldKey + ': ' + displayValue(value[fieldKey])).join('; ') || '—';
    if (key === '__templateSnapshot') {
      if (!value) return 'Brak indywidualnej kopii wzorca';
      const template = value as DocumentTemplate;
      return 'Wersja ' + String(template.version || 1) + '; sekcje: ' + String(template.sections?.length || 0) + '; pola: ' + String(template.fields?.length || 0) + '; treść: ' + String(template.contentHtml?.length || 0) + ' znaków';
    }
    return displayValue(value);
  };

  const renderedHtml = renderTemplateHtml(mode === 'custom' ? customDraft : mode === 'admin' ? adminDraft : activeTemplate, form, order, item);
  const templateForPreview = mode === 'custom' ? customDraft : mode === 'admin' ? adminDraft : activeTemplate;

  if (!isOpen) return null;

  const openReview = () => {
    const visibleFieldIds = new Set(templateForPreview.sections.filter((section) => section.visible !== false).flatMap((section) => section.fieldIds));
    const requiredFields = templateForPreview.fields.filter((field) => visibleFieldIds.has(field.id) && field.visible !== false && field.required && field.type !== 'static' && !field.readOnly);
    const missing = requiredFields.filter((field) => {
      const value = getValueByKey(form, field.valueKey);
      if (value === undefined || value === null) return true;
      if (typeof value === 'string') return value.trim().length === 0;
      if (Array.isArray(value)) {
        if (value.length === 0) return true;
        if (field.type === 'repeatable' || field.type === 'doors') return value.some((row: any) => !row.type);
        return false;
      }
      if (field.type === 'quantity-toggle' && typeof value === 'object') return !value.enabled;
      return false;
    });
    if (missing.length) {
      setMessage('Uzupełnij wymagane pola: ' + missing.map((field) => field.label).join(', ') + '.');
      setReview(false);
      return;
    }
    setMessage('');
    setReview(true);
  };

  const renderFormFields = () => (
    <div className="space-y-4">
      {templateLoading && <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800"><Loader2 size={16} className="animate-spin"/> Wczytywanie wzorca formularza…</div>}
      {ruleNotices.map((notice, index) => <div key={notice + index} className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{notice}</div>)}
      {activeTemplate.sections.filter((section) => section.visible !== false).map((section) => (
        <section key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold text-slate-900">{section.title}</h3>
          <div className={'grid grid-cols-1 gap-3 ' + (section.columns === 3 ? 'md:grid-cols-2 xl:grid-cols-3' : section.columns === 2 ? 'md:grid-cols-2' : '')}>
            {section.fieldIds.map((id) => activeTemplate.fields.find((field) => field.id === id)).filter((field): field is FormField => Boolean(field && field.visible !== false)).map((field) => (
              <div key={field.id} className={'block min-w-0 space-y-1 ' + (field.fullWidth || ['textarea', 'checkbox-list', 'repeatable', 'doors', 'static'].includes(field.type) ? 'col-span-full' : '')}>
                <span className="block text-xs font-semibold text-slate-600">{field.label}{field.required ? ' *' : ''}</span>
                <FormFieldInput field={field} value={getValueByKey(form, field.valueKey)} form={form} onChange={(value) => updateFormField(field, value)}/>
                {field.helpText && <span className="block text-[11px] leading-4 text-slate-500">{field.helpText}</span>}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );

  const renderDesigner = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        {([{ id: 'content', label: 'Treść dokumentu', icon: <FileText size={14}/> }, { id: 'structure', label: 'Sekcje i pola', icon: <Settings2 size={14}/> }, { id: 'bindings', label: 'Powiązania i reguły', icon: <Code2 size={14}/> }] as Array<{ id: DesignerTab; label: string; icon: React.ReactNode }>).map((tab) => (
          <button key={tab.id} type="button" onClick={() => setDesignerTab(tab.id)} className={'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ' + (designerTab === tab.id ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-600 hover:bg-white/70')}>{tab.icon}{tab.label}</button>
        ))}
      </div>
      {designerTab === 'content' && <section className="overflow-hidden rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-1 border-b bg-slate-50 p-2">
          <button type="button" title="Pogrubienie" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('bold')} className="rounded border bg-white p-2"><Bold size={15}/></button>
          <button type="button" title="Kursywa" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('italic')} className="rounded border bg-white p-2"><Italic size={15}/></button>
          <button type="button" title="Podkreślenie" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('underline')} className="rounded border bg-white p-2"><Underline size={15}/></button>
          <button type="button" title="Przekreślenie" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('strikeThrough')} className="rounded border bg-white p-2"><Strikethrough size={15}/></button>
          <button type="button" title="Nagłówek 1" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('formatBlock', 'H1')} className="rounded border bg-white p-2"><Heading1 size={15}/></button>
          <button type="button" title="Nagłówek 2" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('formatBlock', 'H2')} className="rounded border bg-white p-2"><Heading2 size={15}/></button>
          <button type="button" title="Lista punktowana" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('insertUnorderedList')} className="rounded border bg-white p-2"><List size={15}/></button>
          <button type="button" title="Lista numerowana" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('insertOrderedList')} className="rounded border bg-white p-2"><ListOrdered size={15}/></button>
          <button type="button" title="Tabela" onMouseDown={(event) => event.preventDefault()} onClick={() => formatEditor('insertHTML', '<table style="width:100%;border-collapse:collapse;"><tbody><tr><td style="border:1px solid #cbd5e1;padding:6px;">Tekst</td><td style="border:1px solid #cbd5e1;padding:6px;">Wartość</td></tr></tbody></table>')} className="rounded border bg-white p-2"><Table2 size={15}/></button>
          <button type="button" onClick={() => setSourceHtmlMode((shown) => !shown)} className={'ml-auto inline-flex items-center gap-1 rounded border px-2 py-2 text-xs font-semibold ' + (sourceHtmlMode ? 'bg-blue-50 text-blue-800' : 'bg-white')}><Code2 size={14}/>{sourceHtmlMode ? 'Edytor wizualny' : 'Kod HTML'}</button>
        </div>
        <div className="border-b bg-white px-3 py-3">
          <p className="mb-2 text-xs font-semibold text-slate-600">Wstaw dynamiczne pole w miejscu kursora</p>
          <div className="flex flex-wrap gap-1.5">
            {[
              ['Tytuł', '{{derived.title}}'],
              ['DOT.', '{{derived.dot}}'],
            ].map(([label, token]) => <button key={token} type="button" disabled={sourceHtmlMode} onMouseDown={(event) => event.preventDefault()} onClick={() => insertToken(token)} className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800 disabled:cursor-not-allowed disabled:opacity-40">{label}</button>)}
            {workingTemplate.fields.map((field) => {
              const token = '{{form.' + field.valueKey + '}}';
              return <button key={field.id} type="button" disabled={sourceHtmlMode} title={token} onMouseDown={(event) => event.preventDefault()} onClick={() => insertToken(token)} className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">{field.label}</button>;
            })}
          </div>
        </div>
        {sourceHtmlMode ? <textarea aria-label="Kod HTML wzorca dokumentu" value={workingTemplate.contentHtml} onChange={(event) => setWorkingTemplate((template) => ({ ...template, contentHtml: event.target.value }))} rows={24} className="w-full resize-y border-0 p-4 font-mono text-xs leading-5 outline-none"/> :
          <div ref={editorRef} contentEditable suppressContentEditableWarning onInput={(event) => { const contentHtml = event.currentTarget.innerHTML; setWorkingTemplate((template) => ({ ...template, contentHtml })); }} className="min-h-[420px] w-full bg-white p-5 text-sm leading-6 outline-none [&_h1]:my-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:my-3 [&_h2]:text-lg [&_h2]:font-bold [&_p]:my-2 [&_table]:my-3 [&_td]:border [&_td]:border-slate-300 [&_td]:p-1.5"/>}
        <p className="border-t bg-slate-50 px-3 py-2 text-[11px] text-slate-500">Możesz wpisywać treść jak w edytorze tekstu i wklejać sformatowany tekst z Worda. Pola w nawiasach klamrowych podstawiają dane na podglądzie i wydruku.</p>
      </section>}
      {designerTab === 'structure' && <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(220px,0.85fr)_minmax(0,1.25fr)]">
        <section className="rounded-xl border border-slate-200 p-3">
          <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Sekcje</h3><button type="button" onClick={addSection} className="inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-semibold"><Plus size={13}/> Dodaj</button></div>
          <div className="space-y-1">
            {workingTemplate.sections.map((section, index) => <div key={section.id} className={'rounded-lg border p-2 ' + (selectedSectionId === section.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200')}>
              <div className="flex items-center gap-1"><button type="button" onClick={() => { setSelectedSectionId(section.id); if (section.fieldIds[0]) setSelectedFieldId(section.fieldIds[0]); }} className="min-w-0 flex-1 text-left text-xs font-semibold">{section.title || 'Sekcja bez nazwy'}<span className="ml-1 text-slate-400">({section.fieldIds.length})</span></button><button type="button" title="Przesuń sekcję w górę" disabled={index === 0} onClick={() => moveSection(section.id, -1)} className="rounded p-1 disabled:opacity-30"><ArrowUp size={13}/></button><button type="button" title="Przesuń sekcję w dół" disabled={index === workingTemplate.sections.length - 1} onClick={() => moveSection(section.id, 1)} className="rounded p-1 disabled:opacity-30"><ArrowDown size={13}/></button><button type="button" title="Usuń sekcję" onClick={() => removeSection(section.id)} className="rounded p-1 text-red-600"><Trash2 size={13}/></button></div>
              <div className="mt-2 flex items-center gap-2"><input value={section.title} onChange={(event) => updateSection(section.id, { title: event.target.value })} aria-label="Nazwa sekcji" className="min-w-0 flex-1 rounded border bg-white px-2 py-1 text-xs"/><select value={section.columns || 2} onChange={(event) => updateSection(section.id, { columns: Number(event.target.value) as 1 | 2 | 3 })} className="rounded border bg-white px-2 py-1 text-xs"><option value={1}>1 kolumna</option><option value={2}>2 kolumny</option><option value={3}>3 kolumny</option></select><button type="button" onClick={() => updateSection(section.id, { visible: section.visible === false })} title={section.visible === false ? 'Pokaż sekcję' : 'Ukryj sekcję'} className="rounded p-1">{section.visible === false ? <EyeOff size={13}/> : <Eye size={13}/>}</button></div>
            </div>)}
          </div>
        </section>
        <section className="min-w-0 rounded-xl border border-slate-200 p-3">
          <div className="mb-3 flex items-center justify-between gap-2"><h3 className="text-sm font-bold">Pola w wybranej sekcji</h3><button type="button" onClick={addField} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-bold text-white"><Plus size={13}/> Dodaj pole</button></div>
          {selectedSection ? <div className="space-y-2">
            {selectedSection.fieldIds.map((fieldId, index) => {
              const field = workingTemplate.fields.find((candidate) => candidate.id === fieldId);
              if (!field) return null;
              return <div key={fieldId} className={'rounded-lg border p-2 ' + (selectedFieldId === fieldId ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200')}>
                <div className="flex flex-wrap items-center gap-1"><button type="button" onClick={() => setSelectedFieldId(fieldId)} className="min-w-0 flex-1 text-left text-xs font-semibold">{field.label} <span className="font-normal text-slate-400">({field.type})</span></button><button type="button" title="Przesuń w górę" disabled={index === 0} onClick={() => moveField(selectedSection.id, field.id, -1)} className="rounded p-1 disabled:opacity-30"><ArrowUp size={13}/></button><button type="button" title="Przesuń w dół" disabled={index === selectedSection.fieldIds.length - 1} onClick={() => moveField(selectedSection.id, field.id, 1)} className="rounded p-1 disabled:opacity-30"><ArrowDown size={13}/></button><button type="button" onClick={() => updateTemplateField(field.id, { visible: field.visible === false })} title={field.visible === false ? 'Pokaż pole' : 'Ukryj pole'} className="rounded p-1">{field.visible === false ? <EyeOff size={13}/> : <Eye size={13}/>}</button><button type="button" onClick={() => removeField(field.id)} title="Usuń z tego wzorca" className="rounded p-1 text-red-600"><Trash2 size={13}/></button></div>
                <div className="mt-2"><label className="block space-y-1 text-[11px] text-slate-500">Sekcja<select value={selectedSection.id} onChange={(event) => moveFieldToSection(field.id, event.target.value)} className="w-full rounded border bg-white px-2 py-1.5 text-xs">{workingTemplate.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></div>
              </div>;
            })}
            {!selectedSection.fieldIds.length && <p className="rounded bg-slate-50 p-3 text-sm text-slate-500">Ta sekcja nie zawiera pól.</p>}
          </div> : <p className="text-sm text-slate-500">Wybierz sekcję z listy albo dodaj nową.</p>}
          {selectedField && <div className="mt-4 space-y-3 border-t pt-4">
            <h4 className="text-sm font-bold">Edycja pola</h4>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block space-y-1 text-xs font-semibold text-slate-600">Nazwa pola<input value={selectedField.label} onChange={(event) => updateTemplateField(selectedField.id, { label: event.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm font-normal"/></label>
              <label className="block space-y-1 text-xs font-semibold text-slate-600">Typ pola<select value={selectedField.type} onChange={(event) => updateTemplateField(selectedField.id, { type: event.target.value as FieldType })} className="w-full rounded-lg border px-3 py-2 text-sm font-normal"><option value="text">Tekst</option><option value="textarea">Długi tekst</option><option value="number">Liczba</option><option value="date">Data</option><option value="select">Lista wyboru</option><option value="checkbox-list">Lista checkboxów</option><option value="repeatable">Lista pozycji</option><option value="delivery-list">Lista elementów dostawy</option><option value="doors">Konfigurator drzwi</option><option value="quantity-toggle">Obecność + ilość</option><option value="static">Tekst stały</option></select></label>
              <label className="block space-y-1 text-xs font-semibold text-slate-600">Klucz danych<input value={selectedField.valueKey} onChange={(event) => updateTemplateField(selectedField.id, { valueKey: event.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm font-normal"/></label>
              <label className="flex items-center gap-2 pt-6 text-xs font-semibold text-slate-600"><input type="checkbox" checked={Boolean(selectedField.required)} onChange={(event) => updateTemplateField(selectedField.id, { required: event.target.checked })}/> Pole wymagane</label>
              <label className="flex items-center gap-2 pt-6 text-xs font-semibold text-slate-600"><input type="checkbox" checked={Boolean(selectedField.fullWidth)} onChange={(event) => updateTemplateField(selectedField.id, { fullWidth: event.target.checked })}/> Pole na całą szerokość</label>
              <label className="block space-y-1 text-xs font-semibold text-slate-600 md:col-span-2">Opis / podpowiedź<input value={selectedField.helpText || ''} onChange={(event) => updateTemplateField(selectedField.id, { helpText: event.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm font-normal"/></label>
              <label className="block space-y-1 text-xs font-semibold text-slate-600 md:col-span-2">Opcje listy — każda w osobnej linii<textarea rows={3} value={(selectedField.options || []).join('\n')} onChange={(event) => updateTemplateField(selectedField.id, { options: event.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} className="w-full rounded-lg border px-3 py-2 text-sm font-normal"/></label>
              <label className="block space-y-1 text-xs font-semibold text-slate-600 md:col-span-2">Wartość domyślna (JSON lub tekst)<input value={selectedField.defaultValue === undefined ? '' : typeof selectedField.defaultValue === 'string' ? selectedField.defaultValue : JSON.stringify(selectedField.defaultValue)} onChange={(event) => { let next: any = event.target.value; try { next = JSON.parse(event.target.value); } catch {} updateTemplateField(selectedField.id, { defaultValue: next }); }} className="w-full rounded-lg border px-3 py-2 text-sm font-normal"/></label>
            </div>
          </div>}
        </section>
      </div>}
      {designerTab === 'bindings' && <div className="space-y-4">
        <section className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-bold">Źródła danych pól</h3><p className="mt-1 text-xs text-slate-500">Wartość jest pobierana z podanej ścieżki tylko wtedy, gdy dokument nie ma jeszcze zapisanej własnej wartości. Późniejsza edycja dokumentu pozostaje niezależna od zlecenia, aż do osobnego zatwierdzenia.</p>
          <div className="mt-3 space-y-3">
            {workingTemplate.fields.map((field) => <div key={field.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 md:grid-cols-[minmax(140px,0.7fr)_minmax(0,1.4fr)]">
              <div><p className="text-sm font-semibold">{field.label}</p><p className="text-[11px] text-slate-400">{field.valueKey}</p></div>
              <div><input list="document-source-examples" value={field.sourcePath || ''} onChange={(event) => updateTemplateField(field.id, { sourcePath: event.target.value })} placeholder="np. order.projectName" className="w-full rounded-lg border px-3 py-2 text-sm"/><p className="mt-1 text-[11px] text-slate-500">Obecna wartość: {displayValue(getPathValue(field.sourcePath, order, item, form))}</p><label className="mt-2 flex items-start gap-2 text-[11px] font-normal text-slate-600"><input type="checkbox" checked={Boolean(field.liveBinding)} onChange={(event) => updateTemplateField(field.id, { liveBinding: event.target.checked })} className="mt-0.5"/> Odświeżaj przy każdym otwarciu z aktualnego źródła (nie zachowuj lokalnego nadpisania)</label></div>
            </div>)}
          </div>
          <datalist id="document-source-examples">{sourceExamples.map((path) => <option key={path} value={path}/>)}</datalist>
        </section>
        <section className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-bold">Reguły między polami</h3><p className="text-xs text-slate-500">Automatyczne dodawanie, sugestie lub ostrzeżenia dla zależnych pozycji.</p></div><button type="button" onClick={addRule} className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold"><Plus size={13}/> Dodaj regułę</button></div>
          <div className="mt-3 space-y-3">
            {workingTemplate.rules.map((rule) => <div key={rule.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 xl:grid-cols-[1fr_1fr_1fr_1fr_auto]">
              <label className="space-y-1 text-[11px] font-semibold text-slate-600">Gdy zmieni się pole<select value={rule.triggerFieldId} onChange={(event) => updateRule(rule.id, { triggerFieldId: event.target.value })} className="w-full rounded border px-2 py-2 text-xs font-normal">{workingTemplate.fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-600">Wybrana wartość<input value={rule.triggerValue} onChange={(event) => updateRule(rule.id, { triggerValue: event.target.value })} className="w-full rounded border px-2 py-2 text-xs font-normal"/></label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-600">Pole docelowe<select value={rule.targetFieldId} onChange={(event) => updateRule(rule.id, { targetFieldId: event.target.value })} className="w-full rounded border px-2 py-2 text-xs font-normal">{workingTemplate.fields.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select></label>
              <label className="space-y-1 text-[11px] font-semibold text-slate-600">Wartość / pozycja<input value={rule.targetValue} onChange={(event) => updateRule(rule.id, { targetValue: event.target.value })} className="w-full rounded border px-2 py-2 text-xs font-normal"/></label>
              <div className="flex items-end gap-1"><select value={rule.action} onChange={(event) => updateRule(rule.id, { action: event.target.value as TemplateRule['action'] })} className="min-w-0 rounded border px-2 py-2 text-xs"><option value="automatic">Automatycznie</option><option value="suggestion">Sugestia</option><option value="warning">Ostrzeżenie</option></select><button type="button" onClick={() => removeRule(rule.id)} className="rounded border border-red-200 p-2 text-red-600" title="Usuń regułę"><Trash2 size={14}/></button></div>
            </div>)}
            {!workingTemplate.rules.length && <p className="text-sm text-slate-500">Brak dodatkowych reguł.</p>}
          </div>
        </section>
        {mode === 'admin' && <section className="rounded-xl border border-slate-200 p-3">
          <h3 className="text-sm font-bold">Historia opublikowanych wzorców</h3>
          <div className="mt-2 space-y-1">{templateHistory.length ? templateHistory.map((entry) => <div key={entry.version} className="flex flex-wrap justify-between gap-2 rounded border p-2 text-xs"><span>Wersja {entry.version}</span><span className="text-slate-500">{entry.updatedAt ? new Date(entry.updatedAt).toLocaleString('pl-PL') : ''} {entry.updatedBy ? '· ' + entry.updatedBy : ''}</span></div>) : <p className="text-xs text-slate-500">Brak wcześniejszych wersji.</p>}</div>
        </section>}
      </div>}
    </div>
  );

  const currentTemplateName = mode === 'custom' ? 'Custom Edit — tylko ten dokument' : mode === 'admin' ? 'Admin Edit — wzorzec wspólny' : 'Formularz dokumentu';
  const previewEmpty = renderedHtml.trim().length === 0;
  const titleVariant = form.rozmiar && form.typObudowy && form.rozmiar.toUpperCase().startsWith(form.typObudowy.toUpperCase()) ? form.rozmiar : [form.typObudowy, form.rozmiar].filter(Boolean).join(' ');
  const titleText = [form.typBudowli, titleVariant, form.nazwaObiektu].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();

  return <div className="fixed inset-0 z-[80] flex min-h-0 flex-col bg-slate-100 print:static print:block print:overflow-visible print:bg-white">
    <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white print:hidden sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600"><FileText size={20}/></div><div className="min-w-0"><h1 className="truncate text-sm font-bold sm:text-base">Centrum formularzy · {order.orderNumber}</h1><p className="truncate text-xs text-slate-300">{order.projectName} · {currentTemplateName}</p></div></div>
      <div className="flex shrink-0 items-center gap-2"><span className="hidden rounded-full border border-slate-600 px-2.5 py-1 text-[10px] font-semibold text-slate-300 sm:inline">{profile.name}</span><button type="button" onClick={onClose} aria-label="Zamknij formularz" className="rounded-lg p-2 hover:bg-slate-800"><X size={19}/></button></div>
    </header>
    <div className="flex min-h-0 flex-1 flex-col xl:flex-row print:block">
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-5 xl:w-[48%] xl:flex-none print:hidden">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="text-lg font-bold text-slate-900">{mode === 'form' ? 'Uzupełnij dokument' : mode === 'custom' ? 'Dopasuj bieżący dokument' : 'Edytuj wzorzec dokumentu'}</h2><p className="mt-1 text-xs text-slate-500">{mode === 'custom' ? 'Zmiany struktury i treści pozostają tylko w tym formularzu.' : mode === 'admin' ? 'Publikacja zastosuje wzorzec także do bieżącego formularza. Wcześniej zapisane formularze w innych zleceniach pozostaną bez zmian.' : 'Edytuj pola formularza; podgląd po prawej aktualizuje się na bieżąco.'}</p></div>
            {mode === 'form' ? <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!canEdit} onClick={openCustomEdit} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-bold text-blue-800 disabled:cursor-not-allowed disabled:opacity-40"><FileText size={14}/> Custom Edit</button>
              {isAdmin && <button type="button" onClick={openAdminEdit} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"><ShieldCheck size={14}/> Admin Edit</button>}
            </div> : <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setMode('form'); setMessage(''); }} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><X size={14}/> Anuluj</button>
              {mode === 'custom' ? <button type="button" onClick={saveCustomEdit} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white"><Save size={14}/> Zapisz w tym dokumencie</button> : <button type="button" disabled={templateSaving} onClick={saveAdminTemplate} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{templateSaving ? <Loader2 size={14} className="animate-spin"/> : <ShieldCheck size={14}/>} Opublikuj i zastosuj</button>}
            </div>}
          </div>
          {!canEdit && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Ten profil ma dostęp tylko do podglądu i nie może zatwierdzić zmian w obudowie.</div>}
          {message && <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-900">{message}</div>}
          {mode === 'form' ? renderFormFields() : renderDesigner()}
          {mode === 'form' && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div className="text-[11px] leading-4 text-slate-500">{canEdit ? 'Zatwierdzenie danych następuje dopiero na ekranie podsumowania.' : 'Możesz obejrzeć i wydrukować dokument, ale nie zapisywać zmian.'}</div>
            <button type="button" onClick={openReview} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><CheckCircle2 size={16}/> Sprawdź zmiany i dokument</button>
          </div>}
          {mode !== 'form' && <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">{mode === 'custom' ? 'Custom Edit może zmienić tekst, sekcje, pola, kolejność i ich układ. Nic nie zmienia się we wzorcu dla innych dokumentów.' : 'Admin Edit pozwala zmieniać treść, sekcje, pola, źródła i reguły. Publikacja zapisuje nowy wzorzec oraz stosuje go do bieżącego formularza; wcześniejsze formularze w innych zleceniach pozostają bez zmian.'}</div>}
        </div>
      </main>
      <aside className={'flex min-h-[45vh] min-w-0 flex-1 flex-col border-t border-slate-200 bg-slate-200/70 xl:w-[52%] xl:border-l xl:border-t-0 ' + (review ? 'print:hidden' : 'print:block')}>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-white px-3 py-2.5 sm:px-5">
          <div><h2 className="text-sm font-bold text-slate-900">Podgląd live</h2><p className="text-[10px] text-slate-500">Wzorzec v{templateForPreview.version} · {mode === 'admin' ? 'wersja robocza administratora' : 'dokument bieżący'}</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={openReview} className="inline-flex items-center gap-1.5 rounded-lg border bg-white px-3 py-2 text-xs font-semibold"><Eye size={14}/> Sprawdź i drukuj</button></div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-5">
          <article className="document-print-target mx-auto min-h-[700px] w-full max-w-[850px] bg-white p-6 text-slate-900 shadow-md sm:p-10 print:min-h-0 print:max-w-none print:p-0 print:shadow-none">
            {previewEmpty ? <p className="text-sm text-slate-400">Treść dokumentu jest pusta.</p> : <div className="document-live-preview text-[10px] leading-[1.2] [&_h1]:my-1 [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:my-1 [&_h2]:border-l-2 [&_h2]:border-blue-800 [&_h2]:bg-slate-100 [&_h2]:px-2 [&_h2]:py-0.5 [&_h2]:text-[11px] [&_h2]:font-bold [&_p]:my-0.5 [&_table]:my-1 [&_table]:w-full [&_td]:border [&_td]:border-slate-300 [&_td]:p-1 [&_th]:border [&_th]:border-slate-300 [&_th]:p-1" dangerouslySetInnerHTML={{ __html: renderedHtml }}/>}
          </article>
          {mode === 'admin' && <div className="mx-auto mt-3 max-w-[850px] rounded-lg border border-blue-200 bg-white p-3 text-xs text-blue-900">Po kliknięciu „Opublikuj i zastosuj” nowy układ zostanie zapisany również w aktualnie otwartym formularzu. Kopie formularzy w pozostałych zleceniach pozostaną bez zmian.</div>}
        </div>
      </aside>
    </div>

    {review && <div className="fixed inset-0 z-[95] flex flex-col bg-slate-100 print:static print:block print:bg-white">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white print:hidden"><div><h2 className="font-bold">Podsumowanie zmian przed zatwierdzeniem</h2><p className="text-xs text-slate-300">{order.orderNumber} · {order.projectName}</p></div><button type="button" onClick={() => setReview(false)} className="rounded-lg p-2 hover:bg-slate-800"><X size={18}/></button></header>
      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] print:block">
        <section className="min-h-0 overflow-y-auto border-b border-slate-200 bg-white p-4 sm:p-6 xl:border-b-0 xl:border-r print:hidden">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="font-bold">Zmiany w danych zlecenia</h3><p className="text-xs text-slate-500">Porównanie z wersją otwartą na początku edycji.</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold">{changedKeys.length}</span></div>
          {changedKeys.length ? <div className="space-y-2">{changedKeys.map((key) => <div key={key} className="rounded-lg border border-slate-200 p-3"><h4 className="text-xs font-bold">{changedLabels[key] || 'Dodatkowe pola'}</h4><div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2"><div className="rounded bg-slate-50 p-2"><span className="block text-[10px] font-bold uppercase text-slate-500">Było</span><p className="mt-1 break-words text-xs">{showChangeValue(key, (originalForm as any)[key])}</p></div><div className="rounded bg-blue-50 p-2"><span className="block text-[10px] font-bold uppercase text-blue-700">Będzie</span><p className="mt-1 break-words text-xs">{showChangeValue(key, (form as any)[key])}</p></div></div></div>)}</div> : <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">Nie wykryto zmian względem danych zapisanych w zleceniu.</div>}
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Wydruk / PDF nie aktualizuje danych w zleceniu. Dopiero „Zatwierdź zmiany w zleceniu” zapisuje edytowane wartości. Zmiana wzorca przez Admin Edit jest osobną operacją.</p>
        </section>
        <section className="min-h-0 overflow-y-auto bg-slate-200/60 p-3 sm:p-5 print:bg-white print:p-0">
          <div className="mb-2 flex items-center justify-between gap-2 print:hidden"><h3 className="text-xs font-bold text-slate-700">Końcowy podgląd dokumentu</h3><button type="button" disabled={!canDownload} onClick={() => window.print()} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-1.5 text-xs font-semibold disabled:opacity-40"><Printer size={13}/> Drukuj / PDF</button></div>
          <article className="document-print-target mx-auto min-h-[600px] w-full max-w-[850px] bg-white p-6 text-slate-900 shadow print:min-h-0 print:max-w-none print:p-0 print:shadow-none"><div className="document-live-preview text-[10px] leading-[1.2] [&_h1]:my-1 [&_h1]:text-[15px] [&_h1]:font-bold [&_h2]:my-1 [&_h2]:border-l-2 [&_h2]:border-blue-800 [&_h2]:bg-slate-100 [&_h2]:px-2 [&_h2]:py-0.5 [&_h2]:text-[11px] [&_h2]:font-bold [&_p]:my-0.5 [&_table]:my-1 [&_table]:w-full [&_td]:border [&_td]:border-slate-300 [&_td]:p-1 [&_th]:border [&_th]:border-slate-300 [&_th]:p-1" dangerouslySetInnerHTML={{ __html: renderedHtml }}/></article>
        </section>
      </div>
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 print:hidden">
        <button type="button" onClick={() => setReview(false)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><ArrowLeft size={15}/> Wróć do edycji</button>
        <div className="flex flex-wrap gap-2"><button type="button" disabled={!canDownload} onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-40"><Printer size={15}/> Drukuj / PDF</button>{mode === 'form' ? <button type="button" disabled={!canEdit || !item} onClick={() => {
          if (!canEdit || !item) return;
          const persistedForm = { ...form, __templateSnapshot: clone(activeTemplate), __templateVersion: activeTemplate.version };
          const terminChanged = isFormFieldChanged('terminRealizacji');
          const detailPatch: Record<string, any> = {};
          const detailFieldMap: Array<[string, string]> = [
            ['typBudowli', 'typBudowli'],
            ['opisObudowy', 'opisObudowy'],
            ['typObudowy', 'typObudowy'],
            ['rozmiar', 'rozmiar'],
            ['dlugosc', 'dlugoscObudowy'],
            ['szerokosc', 'szerokoscObudowy'],
            ['wysokosc', 'wysokoscObudowy'],
            ['konstrukcja', 'konstrukcjaBudynku'],
            ['scianyIlosc', 'scianyREIIlosc'],
            ['scianyKlasa', 'scianyREIKlasa'],
            ['dachTyp', 'typDachu'],
            ['dachKlasa', 'dachREIKlasa'],
            ['kolorObudowy', 'kolorObudowy'],
            ['kolorSlusarki', 'kolorSlusarki'],
            ['kolorDachu', 'kolorDachu'],
            ['kolorDrzwiKraty', 'kolorDrzwiKraty'],
            ['tynk', 'tynk'],
            ['dodatkoweWyposazenie', 'dodatkoweWyposazenie'],
            ['przepusty', 'przepusty'],
            ['otwory', 'otwory'],
            ['slusarka', 'slusarka'],
            ['dostawaPyskowice', 'dostawaPyskowice'],
            ['dostawaWarszawa', 'dostawaWarszawa'],
            ['uwagi', 'uwagiDoZleceniaObudowy'],
          ];
          for (const [formKey, detailKey] of detailFieldMap) {
            if (isFormFieldChanged(formKey)) detailPatch[detailKey] = (form as any)[formKey];
          }
          if (terminChanged) detailPatch.terminRealizacji = form.terminRealizacji;
          if (isFormFieldChanged('antygraffiti')) {
            detailPatch.antygraffiti = form.antygraffiti === 'Tak' ? true : form.antygraffiti === 'Nie' ? false : null;
            detailPatch.antygraffitiStatus = form.antygraffiti;
          }
          const customFieldMap: Array<[string, string]> = [
            ['dachMaterial', 'dachMaterial'],
            ['wyposazenieDachu', 'wyposazenieDachu'],
            ['siatkaDrzwi', 'siatkaDrzwi'],
            ['siatkaDach', 'siatkaDach'],
            ['opisy', 'opisy'],
            ['rozdzielnicaSN', 'rozdzielnicaSN'],
            ['rozdzielnicaNN', 'rozdzielnicaNN'],
            ['telemechanika', 'telemechanika'],
            ['transformator', 'transformator'],
            ['uziemienie', 'uziemienie'],
            ['instalacjaOswietleniowa', 'instalacjaOswietleniowa'],
            ['inneUrzadzenia', 'inneUrzadzenia'],
          ];
          for (const [customKey, detailKey] of customFieldMap) {
            if (isCustomFieldChanged(customKey)) detailPatch[detailKey] = form.customFields[customKey];
          }
          const updatedOrder: Order = {
            ...order,
            items: order.items.map((candidate) => {
              if (candidate.id !== item.id) return candidate;
              return {
                ...candidate,
                ...(terminChanged ? { plannedDate: form.terminRealizacji } : {}),
                details: {
                  ...candidate.details,
                  ...detailPatch,
                  formularze: { ...(candidate.details?.formularze || {}), zlecenieObudowy: persistedForm },
                },
                updatedAt: new Date().toISOString(),
              };
            }),
            updatedAt: new Date().toISOString(),
          };
          onSaveOrderChanges(updatedOrder);
          setReview(false);
          setMode('form');
          onClose();
        }} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={16}/> Zatwierdź zmiany w zleceniu</button> : <p className="self-center max-w-md text-xs text-slate-500">To podgląd roboczy edytora. Nie zapisuje zmian w zleceniu; wróć do edytora i zapisz zmiany Custom Edit lub opublikuj wzorzec Admin Edit.</p>}</div>
      </footer>
    </div>}
  </div>;
};
