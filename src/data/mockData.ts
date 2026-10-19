import { Order, OrderItem, ITEM_DEFINITIONS, calculateOrderStatus, getAllObudowaVariants, OBUDOWA_TYPES } from '../types/enco';

export function createDefaultItemsForOrder(orderId: string, stationSize = ''): OrderItem[] {
  const now = new Date().toISOString();
  const stationMatch = stationSize.trim().match(/^(BEK|NZ)\s*(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)/i);
  const stationType = stationMatch ? stationMatch[1].toUpperCase() as 'BEK' | 'NZ' : null;
  const stationWidth = stationMatch ? Number(stationMatch[2].replace(',', '.')) / 100 : undefined;
  const stationDepth = stationMatch ? Number(stationMatch[3].replace(',', '.')) / 100 : undefined;
  const normalizedStationSize = stationMatch
    ? stationType + ' ' + stationMatch[2].replace(',', '.') + '/' + stationMatch[3].replace(',', '.')
    : '';
  const matchedVariant = stationType
    ? getAllObudowaVariants().find((variant) =>
        variant.type === stationType &&
        variant.name.replace(/\s+/g, '').toUpperCase() === normalizedStationSize.replace(/\s+/g, '').toUpperCase()
      )
    : undefined;
  return ITEM_DEFINITIONS.map((def) => {
    let details: Record<string, any> = {};

    switch (def.type) {
      case 'ROZDZIELNICA_SN':
        details = {
          producent: 'Schneider Electric',
          model: 'AirSeT',
          typRozdzielnicy: 'AirSeT',
          liczbaPol: 3,
          iloscPol: 3,
          konfiguracjaPol: 'L-L-L-T',
          parametryTechniczne: 'Napięcie znamionowe 24 kV, prąd 630A, SF6-free',
          dataDostawyPlan: '',
          dataDostawyFakt: '',
          dataPlDostawyPyskowice: '',
          snWPyskowicach: false,
        };
        break;
      case 'ROZDZIELNICA_NN':
        details = {
          typRozdzielnicy: 'RTS-z',
          iloscPol: '8',
          dataWystawieniaZlecenia: '',
          planowanaGotowoscTransportu: '',
          wyposazenieDodatkowe: '',
          kategoria: '',
          dostawca: '',
          dataGotowosciFakt: '',
          dataDostawyPlan: '',
          dataPlDostawyPyskowice: '',
          nnWPyskowicach: false,
        };
        break;
      case 'MOST':
        details = {
          rodzajKabla: 'Kabel jednożyłowy SN',
          typPrzekroj: 'XRUHKXS 1x120 mm² Al',
          dlugosc: '3 x 6.5 m',
          rodzajGlowic: 'Konektorowe kątowe Raychem / TE Connectivity',
          iloscGlowic: '6 szt.',
          terminRealizacji: '',
          dataZlecenia: '',
          dataGotowosci: '',
          dataPlDostawyPyskowice: '',
          mostSNPyskowicach: false,
        };
        break;
      case 'RYS_AKCEPTACJA':
        details = {
          dataWyslania: '',
          dataAkceptacji: '',
          informacjeOZmianach: 'Brak uwag klienta, rewizja 01',
        };
        break;
      case 'KOLORY':
        details = {
          kolorObudowy: 'RAL 7035 (Jasnoszary)',
          kolorDrzwi: 'RAL 7016 (Antracyt)',
          koloryDodatkowe: 'Dach: RAL 7016',
          numeryRal: 'RAL 7035 / RAL 7016',
        };
        break;
      case 'OPISY':
        details = {
          wymaganeOpisy: 'Tablica znamionowa stacji, tabliczki ostrzegawcze "Nieupoważnionym wstęp wzbroniony", schemat SN/nN na drzwiach',
          sposobWykonania: 'Grawerowane tworzywo UV odporne + tablice alu nitowane',
        };
        break;
      case 'DRZWI':
        details = {
          ilosc: '3 kpl.',
          typ: 'Aluminiowe dwuskrzydłowe z żaluzjami nawiewnymi IP43',
          lokalizacja: 'Komora trafo, rozdzielnica SN, rozdzielnica nN',
          dodatkoweWyposazenie: 'Atestowany zamek MasterKey energetyki, ograniczniki otwarcia',
        };
        break;
      case 'ZAP_SERWISPOL':
      case 'ZAP_JK':
        details = {
          dataZapytania: '',
          zakresUslugi: 'montaż Stacji/Złącza',
          informacjeOWycenie: '',
        };
        break;
      case 'ZAM_SERWISPOL':
      case 'ZAM_JK':
        details = {
          dataZamowienia: '',
          zakresUslugi: 'montaż Stacji/Złącza',
          uzgodnionyTermin: '',
          informacjeDotyczaceWykonania: '',
        };
        break;
      case 'ZLECENIE_MONTAZU':
        details = {
          zakresMontazu: 'Kompletny montaż aparatury SN, rozdzielnicy nN, szynoprzewodów, oświetlenia stacji i instalacji uziemienia',
          dataZlecenia: '',
        };
        break;
      case 'SZAFKA_TELEMECHANIKI':
        details = {
          typ: 'Szafka RTU Telvent / Mikronika SO-52v21',
          wyposazenie: 'Zasilacz buforowy 24V DC + akumulatory AGM, modem 4G LTE/5G, switch przemysłowy Moxa',
          zakres: 'Sygnalizacja stanu łączników, pomiar napięć i prądów, sterowanie zdalne wyłącznikiem SN',
          informacjeTechniczne: 'Protokół IEC 60870-5-104 do dyspozycji OSD',
          dataGotowosciDokumentacji: '',
          dokumentacjaWyslanaDoUzgodnienia: false,
          typSterownika: '',
          dataZleceniaSzafy: '',
          dataOczekiwana: '',
          dataGotowosci: '',
          dataPlDostawyPyskowice: '',
          szafkaWPyskowicach: false,
          akumulatorWPyskowicach: false,
          masztAntenaWPyskowicach: false,
          sensoryNapieciowe: '',
          dataPlDostawySensorowPyskowice: '',
          sensoryNapiecioweWPyskowicach: false,
        };
        break;
      case 'TABLICA_POMIAROWA':
        details = {
          kategoria: '',
          dataZlecenia: '',
          dataDostawyPlan: '',
          dataGotowosciFakt: '',
          dataPlDostawyPyskowice: '',
          wPyskowicach: false,
        };
        break;
      case 'RPW':
        details = {
          kategoria: '',
          dataZlecenia: '',
          dataDostawyPlan: '',
          dataGotowosciFakt: '',
          dataPlDostawyPyskowice: '',
          wPyskowicach: false,
        };
        break;
      case 'TRANSFORMATOR_POTRZEB_WLASNYCH':
        details = {
          va: '',
          dataDostawyPlan: '',
          numerSeryjny: '',
          dataPlDostawyPyskowice: '',
          wPyskowicach: false,
        };
        break;
      case 'WSKAZNIKI_ZWARC':
        details = {
          typ: '',
          ilosc: '',
          dataZamowienia: '',
          dataPlDostawyPyskowice: '',
          wPyskowicach: false,
        };
        break;
      case 'POWYKONAWCZA':
        details = {
          statusDokumentacji: 'W przygotowaniu',
          dataZakonczenia: '',
          wagaDTRWyslana: false,
          dataPrzekazaniaDokumentacji: '',
        };
        break;
      case 'OBUDOWA': {
        const enclosureType = stationType || 'BEK';
        const defaultVariant = getAllObudowaVariants().find((variant) =>
          variant.type === enclosureType && variant.name === (enclosureType === 'NZ' ? 'NZ 210/290' : 'BEK 250/350')
        );
        const hasParsedCustomSize = Boolean(stationMatch && !matchedVariant);
        details = {
          typObudowy: enclosureType,
          rozmiar: matchedVariant?.name || (hasParsedCustomSize ? normalizedStationSize : defaultVariant?.name || (enclosureType === 'NZ' ? 'NZ 210/290' : 'BEK 250/350')),
          ...(hasParsedCustomSize ? { isCustomSize: true } : {}),
          szerokosc: matchedVariant?.width ?? (hasParsedCustomSize ? stationWidth : defaultVariant?.width ?? (enclosureType === 'NZ' ? 2.10 : 2.50)),
          glebokosc: matchedVariant?.depth ?? (hasParsedCustomSize ? stationDepth : defaultVariant?.depth ?? (enclosureType === 'NZ' ? 2.90 : 3.50)),
          wysokosc: matchedVariant?.height ?? defaultVariant?.height ?? OBUDOWA_TYPES[enclosureType].defaultHeight,
          typWysokosci: OBUDOWA_TYPES[enclosureType].heightTypeLabel,
          dataZlecenia: '',
          dataRysunkowAkceptacji: '',
          dataOczekiwana: '',
          dataGotowosci: '',
        };
        break;
      }
      case 'DATA_WYJAZDU':
        details = {
          dataTransportu: '',
          przewoznik: 'Transport ponadgabarytowy HDS (Platforma 4-osiowa)',
          adresDostawy: 'Plac budowy inwestora',
          kontaktNaBudowie: 'Kierownik robót elektrycznych',
          kilometry: '',
          cenaTransportu: '',
          numerFaktury: '',
        };
        break;
      case 'DODATKOWE':
        details = {
          opis: 'Standardowe wyposażenie bhp: pomost izolacyjny, drążek izolacyjny TDI-B, rękawice dielektryczne 20kV',
          specyfikacja: 'Zgodne ze standardami OSD',
        };
        break;
    }

    return {
      id: `${orderId}_${def.type.toLowerCase()}`,
      orderId,
      type: def.type,
      name: def.name,
      shortName: def.shortName,
      status: 'NOT_ORDERED',
      orderDate: '',
      plannedDate: '',
      completedDate: '',
      notes: '',
      details,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
  });
}

export const INITIAL_ORDERS: Order[] = [];
