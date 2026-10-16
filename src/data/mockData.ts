import { Order, OrderItem, ITEM_DEFINITIONS, calculateOrderStatus } from '../types/enco';

export function createDefaultItemsForOrder(orderId: string): OrderItem[] {
  const now = new Date().toISOString();
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
        };
        break;
      case 'ROZDZIELNICA_NN':
        details = {
          typRozdzielnicy: 'RTS-z',
          iloscPol: '8',
          dataWystawieniaZlecenia: '',
          planowanaGotowoscTransportu: '',
          wyposazenieDodatkowe: '',
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
        };
        break;
      case 'POWYKONAWCZA':
        details = {
          statusDokumentacji: 'W przygotowaniu',
          dataZakonczenia: '',
        };
        break;
      case 'OBUDOWA':
        details = {
          typObudowy: 'BEK',
          rozmiar: 'BEK 250/350',
          szerokosc: 2.50,
          glebokosc: 3.50,
          wysokosc: 2.40,
          typWysokosci: 'Wysokość wewnętrzna pomieszczeń',
          dataGotowosci: '2026-10-25',
        };
        break;
      case 'DATA_WYJAZDU':
        details = {
          dataTransportu: '',
          przewoznik: 'Transport ponadgabarytowy HDS (Platforma 4-osiowa)',
          adresDostawy: 'Plac budowy inwestora',
          kontaktNaBudowie: 'Kierownik robót elektrycznych',
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
