/**
 * Ownership labels adapted from the ENCO production tracking table.
 * DH and MW are intentionally represented together as Dział Handlowy.
 * This is informational workflow ownership, not assignment to individual employees.
 */
export type DepartmentOwnerKey = 'sales' | 'pyskowice' | 'plochocinska' | 'logistics' | 'technical';

export interface DepartmentOwner {
  key: DepartmentOwnerKey;
  label: string;
  shortLabel: string;
  className: string;
}

export const DEPARTMENT_OWNERS: Record<DepartmentOwnerKey, DepartmentOwner> = {
  sales: { key: 'sales', label: 'Dział Handlowy (DH/MW)', shortLabel: 'DH / MW', className: 'border-blue-200 bg-blue-50 text-blue-800' },
  pyskowice: { key: 'pyskowice', label: 'Fabryka Pyskowice', shortLabel: 'PYSKOWICE', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  plochocinska: { key: 'plochocinska', label: 'Produkcja Płochocińska', shortLabel: 'PŁOCHOCIŃSKA', className: 'border-cyan-200 bg-cyan-50 text-cyan-800' },
  logistics: { key: 'logistics', label: 'Dział Logistyki', shortLabel: 'LOGISTYKA', className: 'border-amber-200 bg-amber-50 text-amber-800' },
  technical: { key: 'technical', label: 'Techniczny · projektant DH', shortLabel: 'TECHNICZNY', className: 'border-violet-200 bg-violet-50 text-violet-800' },
};

const FIELD_OWNERS: Record<string, Record<string, DepartmentOwnerKey>> = {
  order: {
    client: 'sales',
    orderNumber: 'pyskowice',
    projectName: 'sales',
    departureDate: 'logistics',
  },
  OBUDOWA: {
    typObudowy: 'sales', rozmiar: 'sales', szerokosc: 'sales', glebokosc: 'sales', wysokosc: 'sales',
    dataZlecenia: 'sales', dataRysunkowAkceptacji: 'sales', dataGotowosci: 'sales',
    przepustyNN: 'sales', przepustySN: 'sales',
    pokrywyNN: 'pyskowice', pokrywySN: 'pyskowice', wkladkiSN: 'pyskowice',
    pokrywyNNSaWPyskowicach: 'sales', pokrywySNSaWPyskowicach: 'sales', wkladkiSNSaWPyskowicach: 'sales',
    kolorObudowy: 'sales', kolorDrzwi: 'sales', koloryDodatkowe: 'sales', numeryRal: 'sales',
    wymaganeOpisy: 'sales', sposobWykonania: 'sales',
  },
  KOLORY: { kolorObudowy: 'sales', kolorDrzwi: 'sales', koloryDodatkowe: 'sales', numeryRal: 'sales' },
  OPISY: { wymaganeOpisy: 'sales', sposobWykonania: 'sales' },
  RYS_AKCEPTACJA: { dataWyslania: 'sales', dataAkceptacji: 'sales', informacjeOZmianach: 'sales' },
  ROZDZIELNICA_SN: {
    producent: 'sales', model: 'sales', typRozdzielnicy: 'sales', liczbaPol: 'sales', iloscPol: 'sales', konfiguracjaPol: 'sales',
    numerSeryjny: 'logistics', dataDostawyPlan: 'logistics', dataDostawyFakt: 'logistics',
    dataPlDostawyPyskowice: 'logistics', snWPyskowicach: 'pyskowice',
  },
  ROZDZIELNICA_NN: {
    kategoria: 'sales', typRozdzielnicy: 'sales', typ: 'sales', iloscPol: 'sales', liczbaPol: 'sales',
    dataWystawieniaZlecenia: 'sales', dataZlecenia: 'sales', dostawca: 'sales', dataGotowosciFakt: 'sales',
    dataDostawyPlan: 'sales', planowanaGotowoscTransportu: 'sales',
    dataPlDostawyPyskowice: 'logistics', nnWPyskowicach: 'pyskowice',
  },
  TABLICA_POMIAROWA: {
    kategoria: 'sales', dataZlecenia: 'sales', dataDostawyPlan: 'sales', dataGotowosciFakt: 'sales',
    dataPlDostawyPyskowice: 'logistics', wPyskowicach: 'pyskowice',
  },
  RPW: {
    kategoria: 'sales', dataZlecenia: 'sales', dataDostawyPlan: 'sales', dataGotowosciFakt: 'sales',
    dataPlDostawyPyskowice: 'logistics', wPyskowicach: 'pyskowice',
  },
  MOST: {
    dataZlecenia: 'sales', dataGotowosci: 'logistics', dataPlDostawyPyskowice: 'logistics',
    mostSNPyskowicach: 'pyskowice', terminRealizacji: 'logistics',
  },
  SZAFKA_TELEMECHANIKI: {
    typ: 'sales', wyposazenie: 'sales', zakres: 'sales', informacjeTechniczne: 'sales',
    dataGotowosciDokumentacji: 'technical', dokumentacjaWyslanaDoUzgodnienia: 'sales',
    typSterownika: 'sales', dataZleceniaSzafy: 'sales', dataOczekiwana: 'sales', dataGotowosci: 'sales',
    dataPlDostawyPyskowice: 'logistics', szafkaWPyskowicach: 'pyskowice',
    akumulatorWPyskowicach: 'pyskowice', masztAntenaWPyskowicach: 'pyskowice',
    sensoryNapieciowe: 'sales', dataPlDostawySensorowPyskowice: 'logistics', sensoryNapiecioweWPyskowicach: 'pyskowice',
  },
  TRANSFORMATOR_POTRZEB_WLASNYCH: {
    va: 'sales', dataDostawyPlan: 'logistics', numerSeryjny: 'logistics',
    dataPlDostawyPyskowice: 'logistics', wPyskowicach: 'pyskowice',
  },
  WSKAZNIKI_ZWARC: {
    typ: 'sales', ilosc: 'sales', dataZamowienia: 'logistics',
    dataPlDostawyPyskowice: 'logistics', wPyskowicach: 'pyskowice',
  },
  POWYKONAWCZA: {
    statusDokumentacji: 'technical', dataZakonczenia: 'technical',
    wagaDTRWyslana: 'sales', dataPrzekazaniaDokumentacji: 'sales',
  },
  DATA_WYJAZDU: {
    dataTransportu: 'logistics', adresDostawy: 'logistics', przewoznik: 'logistics',
    kilometry: 'logistics', cenaTransportu: 'logistics', kontaktNaBudowie: 'logistics',
    numerFaktury: 'sales',
  },
};

const SUMMARY_LABEL_KEYS: Record<string, Record<string, string>> = {
  OBUDOWA: {
    'Rodzaj obudowy': 'typObudowy', 'Typ obudowy': 'typObudowy',
    'Rozmiar obudowy': 'rozmiar', 'Wymiary rzeczywiste': 'szerokosc',
    'Data gotowości': 'dataGotowosci', 'Data oczekiwana': 'dataGotowosci',
    'Data zlecenia obudowy': 'dataZlecenia', 'Rysunki — data akceptacji': 'dataRysunkowAkceptacji',
    'Data akceptacji rysunków': 'dataRysunkowAkceptacji',
    'Przepusty NN': 'przepustyNN', 'Przepusty SN': 'przepustySN',
    'Pokrywy NN': 'pokrywyNN', 'Pokrywy NN w Pyskowicach': 'pokrywyNNSaWPyskowicach',
    'Pokrywy SN': 'pokrywySN', 'Pokrywy SN w Pyskowicach': 'pokrywySNSaWPyskowicach',
    'Wkładki SN': 'wkladkiSN', 'Wkładki SN w Pyskowicach': 'wkladkiSNSaWPyskowicach',
    'Kolor obudowy': 'kolorObudowy', 'Kolor drzwi': 'kolorDrzwi', 'Kolory dodatkowe': 'koloryDodatkowe',
    'Numery RAL': 'numeryRal', 'Wymagane opisy': 'wymaganeOpisy', 'Sposób wykonania opisów': 'sposobWykonania',
  },
  KOLORY: { 'Kolor obudowy': 'kolorObudowy', 'Kolor drzwi': 'kolorDrzwi', 'Kolory dodatkowe': 'koloryDodatkowe', 'Numery RAL': 'numeryRal' },
  OPISY: { 'Wymagane opisy': 'wymaganeOpisy', 'Sposób wykonania': 'sposobWykonania' },
  RYS_AKCEPTACJA: { 'Data wysłania': 'dataWyslania', 'Data akceptacji': 'dataAkceptacji', 'Informacje o zmianach': 'informacjeOZmianach' },
  ROZDZIELNICA_SN: {
    'Producent': 'producent', 'Model rozdzielnicy': 'model', 'Ilość pól': 'liczbaPol', 'Konfiguracja pól': 'konfiguracjaPol',
    'Numer seryjny': 'numerSeryjny', 'Data dostawy plan.': 'dataDostawyPlan', 'Data dostawy fakt.': 'dataDostawyFakt',
    'Data pl. dos. do Pyskowic': 'dataPlDostawyPyskowice', 'SN w Pyskowicach': 'snWPyskowicach',
  },
  ROZDZIELNICA_NN: {
    'Typ rozdzielnicy': 'typRozdzielnicy', 'Ilość pól': 'iloscPol', 'Data wystawienia zlecenia': 'dataWystawieniaZlecenia',
    'Kategoria': 'kategoria', 'Dostawca': 'dostawca', 'Faktyczna data gotowości': 'dataGotowosciFakt',
    'Planowana data dostawy': 'dataDostawyPlan', 'Planowana dostawa do Pyskowic': 'dataPlDostawyPyskowice',
    'Planowana gotowość do transportu': 'planowanaGotowoscTransportu',
    'NN w Pyskowicach': 'nnWPyskowicach',
  },
  TABLICA_POMIAROWA: {
    'Kategoria': 'kategoria', 'Data zlecenia': 'dataZlecenia', 'Planowana data dostawy': 'dataDostawyPlan',
    'Faktyczna data gotowości': 'dataGotowosciFakt', 'Planowana dostawa do Pyskowic': 'dataPlDostawyPyskowice',
    'Tablica pomiarowa w Pyskowicach': 'wPyskowicach',
  },
  RPW: {
    'Kategoria': 'kategoria', 'Data zlecenia': 'dataZlecenia', 'Planowana data dostawy': 'dataDostawyPlan',
    'Faktyczna data gotowości': 'dataGotowosciFakt', 'Planowana dostawa do Pyskowic': 'dataPlDostawyPyskowice',
    'RPW w Pyskowicach': 'wPyskowicach',
  },
  MOST: {
    'Data zlecenia': 'dataZlecenia', 'Data gotowości': 'dataGotowosci',
    'Planowana dostawa do Pyskowic': 'dataPlDostawyPyskowice', 'Mosty SN w Pyskowicach': 'mostSNPyskowicach',
  },
  SZAFKA_TELEMECHANIKI: {
    'Typ szafki RTU': 'typ', 'Wyposażenie': 'wyposazenie', 'Zakres': 'zakres', 'Informacje techniczne': 'informacjeTechniczne',
    'Gotowość dokumentacji telemechaniki': 'dataGotowosciDokumentacji',
    'Dokumentacja wysłana do uzgodnienia': 'dokumentacjaWyslanaDoUzgodnienia', 'Typ sterownika': 'typSterownika',
    'Data zlecenia szafy': 'dataZleceniaSzafy', 'Oczekiwana gotowość szafy': 'dataOczekiwana',
    'Gotowość szafy': 'dataGotowosci', 'Planowana dostawa telemechaniki': 'dataPlDostawyPyskowice',
    'Szafka w Pyskowicach': 'szafkaWPyskowicach', 'Akumulator w Pyskowicach': 'akumulatorWPyskowicach',
    'Maszt i antena w Pyskowicach': 'masztAntenaWPyskowicach', 'Sensory napięciowe': 'sensoryNapieciowe',
    'Planowana dostawa sensorów': 'dataPlDostawySensorowPyskowice', 'Sensory napięciowe w Pyskowicach': 'sensoryNapiecioweWPyskowicach',
  },
  TRANSFORMATOR_POTRZEB_WLASNYCH: {
    'Moc / VA': 'va', 'Planowana data dostawy': 'dataDostawyPlan', 'Numer seryjny': 'numerSeryjny',
    'Planowana dostawa do Pyskowic': 'dataPlDostawyPyskowice',
    'Transformator potrzeb własnych w Pyskowicach': 'wPyskowicach',
  },
  WSKAZNIKI_ZWARC: {
    'Typ wskaźników / centralki': 'typ', 'Ilość': 'ilosc', 'Data zamówienia': 'dataZamowienia',
    'Planowana dostawa do Pyskowic': 'dataPlDostawyPyskowice',
    'Wskaźniki zwarć w Pyskowicach': 'wPyskowicach',
  },
  POWYKONAWCZA: {
    'Status dokumentacji': 'statusDokumentacji', 'Data gotowości dokumentacji': 'dataZakonczenia',
    'Waga i DTR wysłane': 'wagaDTRWyslana', 'Data przekazania dokumentacji': 'dataPrzekazaniaDokumentacji',
  },
  DATA_WYJAZDU: {
    'Data załadunku': 'dataTransportu', 'Przewoźnik': 'przewoznik', 'Adres dostawy': 'adresDostawy',
    'Kontakt na budowie': 'kontaktNaBudowie', 'Kilometry': 'kilometry',
    'Cena transportu (PLN)': 'cenaTransportu', 'Numer faktury': 'numerFaktury',
  },
};

export function getFieldDepartment(itemType: string, fieldKey: string): DepartmentOwner | null {
  const key = FIELD_OWNERS[itemType]?.[fieldKey];
  return key ? DEPARTMENT_OWNERS[key] : null;
}

export function getDepartmentsForItemType(itemType: string): DepartmentOwner[] {
  const uniqueKeys = [...new Set(Object.values(FIELD_OWNERS[itemType] || {}))];
  return uniqueKeys.map((key) => DEPARTMENT_OWNERS[key]);
}

export function getSummaryFieldDepartment(itemType: string, label: string): DepartmentOwner | null {
  const fieldKey = SUMMARY_LABEL_KEYS[itemType]?.[label];
  return fieldKey ? getFieldDepartment(itemType, fieldKey) : null;
}

export function getOrderFieldDepartment(fieldKey: string): DepartmentOwner | null {
  return getFieldDepartment('order', fieldKey);
}
