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
          producent: '',
          model: '',
          typRozdzielnicy: '',
          liczbaPol: '',
          iloscPol: '',
          konfiguracjaPol: '',
          parametryTechniczne: '',
          dataDostawyPlan: '',
          dataDostawyFakt: '',
          dataPlDostawyPyskowice: '',
          snWPyskowicach: false,
        };
        break;
      case 'ROZDZIELNICA_NN':
        details = {
          typRozdzielnicy: '',
          iloscPol: '',
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
          rodzajKabla: '',
          typPrzekroj: '',
          dlugosc: '',
          rodzajGlowic: '',
          iloscGlowic: '',
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
          informacjeOZmianach: '',
        };
        break;
      case 'KOLORY':
        details = {
          kolorObudowy: '',
          kolorDrzwi: '',
          koloryDodatkowe: '',
          numeryRal: '',
        };
        break;
      case 'OPISY':
        details = {
          wymaganeOpisy: '',
          sposobWykonania: '',
        };
        break;
      case 'DRZWI':
        details = {
          ilosc: '',
          typ: '',
          lokalizacja: '',
          dodatkoweWyposazenie: '',
        };
        break;
      case 'ZAP_SERWISPOL':
      case 'ZAP_JK':
        details = {
          dataZapytania: '',
          zakresUslugi: '',
          informacjeOWycenie: '',
        };
        break;
      case 'ZAM_SERWISPOL':
      case 'ZAM_JK':
        details = {
          dataZamowienia: '',
          zakresUslugi: '',
          uzgodnionyTermin: '',
          informacjeDotyczaceWykonania: '',
        };
        break;
      case 'ZLECENIE_MONTAZU':
        details = {
          zakresMontazu: '',
          dataZlecenia: '',
        };
        break;
      case 'SZAFKA_TELEMECHANIKI':
        details = {
          typ: '',
          wyposazenie: '',
          zakres: '',
          informacjeTechniczne: '',
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
          statusDokumentacji: '',
          dataZakonczenia: '',
          wagaDTRWyslana: false,
          dataPrzekazaniaDokumentacji: '',
        };
        break;
      case 'OBUDOWA': {
        const enclosureType = stationType || '';
        const defaultVariant = enclosureType ? getAllObudowaVariants().find((variant) =>
          variant.type === enclosureType && variant.name === (enclosureType === 'NZ' ? 'NZ 210/290' : 'BEK 250/350')
        ) : undefined;
        const hasParsedCustomSize = Boolean(stationMatch && !matchedVariant);
        details = {
          typObudowy: enclosureType,
          rozmiar: matchedVariant?.name || (hasParsedCustomSize ? normalizedStationSize : defaultVariant?.name || ''),
          ...(hasParsedCustomSize ? { isCustomSize: true } : {}),
          szerokosc: matchedVariant?.width ?? (hasParsedCustomSize ? stationWidth : defaultVariant?.width ?? ''),
          glebokosc: matchedVariant?.depth ?? (hasParsedCustomSize ? stationDepth : defaultVariant?.depth ?? ''),
          wysokosc: matchedVariant?.height ?? defaultVariant?.height ?? '',
          typWysokosci: enclosureType ? OBUDOWA_TYPES[enclosureType].heightTypeLabel : '',
          dataZlecenia: '',
          dataGotowosci: '',
        };
        break;
      }
      case 'DATA_WYJAZDU':
        details = {
          dataTransportu: '',
          przewoznik: '',
          adresDostawy: '',
          kontaktNaBudowie: '',
          kilometry: '',
          cenaTransportu: '',
          numerFaktury: '',
        };
        break;
      case 'DODATKOWE':
        details = {
          opis: '',
          specyfikacja: '',
        };
        break;
    }

    return {
      id: `${orderId}_${def.type.toLowerCase()}`,
      orderId,
      type: def.type,
      name: def.name,
      shortName: def.shortName,
      // These four equipment sections are optional; mark them N/A by default
      // so adding tracker fields does not reopen already completed station orders.
      status: ['TABLICA_POMIAROWA', 'RPW', 'TRANSFORMATOR_POTRZEB_WLASNYCH', 'WSKAZNIKI_ZWARC'].includes(def.type)
        ? 'NOT_APPLICABLE'
        : 'NOT_ORDERED',
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
