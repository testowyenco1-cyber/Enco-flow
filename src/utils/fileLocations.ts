import { StandardItemType } from '../types/enco';

export interface StationFolderDefinition {
  id: string;
  folderKey: string;
  code: string;
  title: string;
  fullTitle: string;
  description: string;
  matchingItemTypes: (StandardItemType | string)[];
  recommendedExtensions: string[];
  iconType:
    | 'folder'
    | 'file-text'
    | 'layers'
    | 'zap'
    | 'tool'
    | 'palette'
    | 'tag'
    | 'door'
    | 'truck'
    | 'shield'
    | 'award'
    | 'archive';
}

export const STATION_FOLDERS: StationFolderDefinition[] = [
  {
    id: 'f_dok_glowna',
    folderKey: '01_Dokumentacja_Glowna',
    code: '01',
    title: 'Dokumentacja Główna',
    fullTitle: '01 - Dokumentacja Główna Zlecenia',
    description: 'Umowy handlowe, zapytania ofertowe, specyfikacje techniczne, protokoły odbioru i schematy ideowe stacji.',
    matchingItemTypes: [],
    recommendedExtensions: ['pdf', 'doc', 'docx', 'xlsx'],
    iconType: 'file-text',
  },
  {
    id: 'f_obudowa',
    folderKey: '02_Obudowa_Betonowa',
    code: '02',
    title: 'Obudowa Betonowa BEK/NZ',
    fullTitle: '02 - Obudowa Betonowa BEK / NZ',
    description: 'Rysunki konstrukcyjne, rzuty fundamentów, obliczenia statyczne, atesty szczelności misy olejowej i betonu C35/45.',
    matchingItemTypes: ['OBUDOWA'],
    recommendedExtensions: ['pdf', 'dwg', 'dxf'],
    iconType: 'layers',
  },
  {
    id: 'f_sn',
    folderKey: '03_Rozdzielnica_SN',
    code: '03',
    title: 'Rozdzielnica SN',
    fullTitle: '03 - Rozdzielnica Średniego Napięcia SN',
    description: 'DTR rozdzielnic (AirSeT / Xiria / 8DJH), schematy jednokreskowe, konfiguracje pól L-L-T, protokoły prób napięciowych.',
    matchingItemTypes: ['ROZDZIELNICA_SN'],
    recommendedExtensions: ['pdf', 'dwg', 'dxf'],
    iconType: 'zap',
  },
  {
    id: 'f_nn',
    folderKey: '04_Rozdzielnica_NN',
    code: '04',
    title: 'Rozdzielnica nN',
    fullTitle: '04 - Rozdzielnica Niskiego Napięcia nN',
    description: 'Schematy montażowe i ideowe rozdzielnic nN (RTS-z / RN-w), zestawienia aparatury modułowej, atesty wyłączników.',
    matchingItemTypes: ['ROZDZIELNICA_NN'],
    recommendedExtensions: ['pdf', 'dwg', 'xlsx'],
    iconType: 'tool',
  },
  {
    id: 'f_mosty',
    folderKey: '05_Mosty_i_Szynoprzewody',
    code: '05',
    title: 'Mosty i Szynoprzewody',
    fullTitle: '05 - Mosty Szynowe i Połączenia Elastyczne',
    description: 'Rysunki tras szynoprzewodów SN/nN, kompensatory, połączenia elastyczne Cu/Al, przepusty dachowe i ścienne.',
    matchingItemTypes: ['MOST'],
    recommendedExtensions: ['pdf', 'dwg'],
    iconType: 'layers',
  },
  {
    id: 'f_akceptacja',
    folderKey: '06_Rysunki_i_Akceptacje',
    code: '06',
    title: 'Rysunki i Akceptacje OSD',
    fullTitle: '06 - Rysunki Zatwierdzone i Akceptacje ZE / OSD',
    description: 'Rysunki wykonawcze zatwierdzone przez Zakład Energetyczny (Tauron, PGE, Energa, Enea), pieczęcie akceptacji klienta.',
    matchingItemTypes: ['RYS_AKCEPTACJA'],
    recommendedExtensions: ['pdf', 'dwg', 'dxf', 'jpg', 'png'],
    iconType: 'shield',
  },
  {
    id: 'f_kolory',
    folderKey: '07_Kolory_i_Elewacja',
    code: '07',
    title: 'Kolory i Elewacja',
    fullTitle: '07 - Karty Kolorów RAL i Wykończenie Elewacji',
    description: 'Wzorniki kolorów RAL, specyfikacje tynków akrylowo-silikonowych, rodzaj dachu (dwuspadowy/płaski), detale architektoniczne.',
    matchingItemTypes: ['KOLORY'],
    recommendedExtensions: ['pdf', 'jpg', 'png'],
    iconType: 'palette',
  },
  {
    id: 'f_opisy',
    folderKey: '08_Opisy_i_Oznaczenia',
    code: '08',
    title: 'Opisy i Tabliczki BHP',
    fullTitle: '08 - Tabliczki Znamionowe i Oznaczenia BHP',
    description: 'Wzory grawerowanych tabliczek znamionowych, schematy piktogramowe, oznaczenia pól SN/nN, instrukcje pierwszej pomocy.',
    matchingItemTypes: ['OPISY'],
    recommendedExtensions: ['pdf', 'dwg', 'cdr'],
    iconType: 'tag',
  },
  {
    id: 'f_drzwi',
    folderKey: '09_Drzwi_i_Slusarka',
    code: '09',
    title: 'Drzwi i Ślusarka',
    fullTitle: '09 - Drzwi i Ślusarka Aluminiowa',
    description: 'Rysunki produkcyjne drzwi stacji, żaluzji nawiewno-wywiewnych, zamków master-key, atesty odporności na włamanie RC3/RC4.',
    matchingItemTypes: ['DRZWI'],
    recommendedExtensions: ['pdf', 'dwg', 'dxf'],
    iconType: 'door',
  },
  {
    id: 'f_montaz',
    folderKey: '10_Podwykonawcy_i_Montaz',
    code: '10',
    title: 'Podwykonawcy i Montaż',
    fullTitle: '10 - Podwykonawcy, Zlecenia Montażowe i Logistyka',
    description: 'Zlecenia i zamówienia dla Serwispol, JK, karty montażu na stacji, protokoły posadowienia i montażu transformatora.',
    matchingItemTypes: ['ZAP_SERWISPOL', 'ZAM_SERWISPOL', 'ZAP_JK', 'ZAM_JK', 'ZLECENIE_MONTAZU', 'DATA_WYJAZDU'],
    recommendedExtensions: ['pdf', 'docx', 'xlsx'],
    iconType: 'truck',
  },
  {
    id: 'f_telemechanika',
    folderKey: '11_Telemechanika_i_Lacznosc',
    code: '11',
    title: 'Telemechanika i Łączność',
    fullTitle: '11 - Szafki Telemechaniki i Automatyka Stacyjna',
    description: 'Schematy szafek telemechaniki, parametry modemów GSM/LTE, tabele adresów protokołów IEC 60870-5-104 / DNP3.',
    matchingItemTypes: ['SZAFKA_TELEMECHANIKI'],
    recommendedExtensions: ['pdf', 'dwg', 'xlsx'],
    iconType: 'zap',
  },
  {
    id: 'f_powykonawcza',
    folderKey: '12_Dokumentacja_Powykonawcza',
    code: '12',
    title: 'Dokumentacja Powykonawcza',
    fullTitle: '12 - Dokumentacja Powykonawcza i Certyfikaty CE',
    description: 'Deklaracje zgodności CE/UE, paszport stacji transformatorowej, protokoły prób pomontażowych, karty gwarancyjne.',
    matchingItemTypes: ['POWYKONAWCZA'],
    recommendedExtensions: ['pdf', 'doc', 'docx'],
    iconType: 'award',
  },
  {
    id: 'f_dodatkowe',
    folderKey: '13_Inne_i_Dodatkowe',
    code: '13',
    title: 'Inne Załączniki',
    fullTitle: '13 - Inne Załączniki i Dodatkowa Dokumentacja',
    description: 'Korespondencja z inwestorem, zdjęcia z odbiorów, notatki techniczne i pozostałe pliki pomocnicze.',
    matchingItemTypes: ['DODATKOWE'],
    recommendedExtensions: ['pdf', 'jpg', 'png', 'zip'],
    iconType: 'archive',
  },
];

/**
 * Sanitize order number or file name to be safe for directory names
 */
export function sanitizePathSegment(val: string): string {
  if (!val) return 'NIEZNANY';
  return val
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 80);
}

/**
 * Get folder definition for a given station item type
 */
export function getFolderDefinitionForType(itemType?: string | null): StationFolderDefinition {
  if (!itemType) {
    return STATION_FOLDERS[0]; // 01_Dokumentacja_Glowna
  }

  const found = STATION_FOLDERS.find((f) => f.matchingItemTypes.includes(itemType as any));
  return found || STATION_FOLDERS[STATION_FOLDERS.length - 1]; // Fallback to 13_Inne_i_Dodatkowe
}

/**
 * Get folder definition by folderKey (e.g. '03_Rozdzielnica_SN')
 */
export function getFolderDefinitionByKey(folderKey?: string | null): StationFolderDefinition {
  if (!folderKey) return STATION_FOLDERS[0];
  const found = STATION_FOLDERS.find((f) => f.folderKey === folderKey);
  return found || STATION_FOLDERS[0];
}

/**
 * Computes logical relative path for displaying to user
 * e.g. "ENCO-2025-001 / 03_Rozdzielnica_SN"
 */
export function formatLocationDisplay(orderNumber: string, folderCategory?: string): string {
  const safeOrder = sanitizePathSegment(orderNumber);
  const folder = getFolderDefinitionByKey(folderCategory);
  return `${safeOrder} / ${folder.folderKey}`;
}

/**
 * Computes full disk storage location path
 * e.g. "data_store/uploads/ENCO-2025-001/03_Rozdzielnica_SN/"
 */
export function getFullDiskDirectoryPath(orderNumber: string, folderCategory?: string): string {
  const safeOrder = sanitizePathSegment(orderNumber);
  const folder = getFolderDefinitionByKey(folderCategory);
  return `data_store/uploads/${safeOrder}/${folder.folderKey}/`;
}
