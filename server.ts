import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_ORDERS } from './src/data/mockData';
import { INITIAL_DOOR_ORDERS } from './src/data/mockDoorOrders';
import { calculateOrderStatus } from './src/types/enco';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import type { AuthDepartmentId, AuthUser } from './src/types/auth';
import { canEditItemType, type UserRoleProfile } from './src/types/userRole';
import { profileForAuthUser } from './src/utils/authUserProfile';

interface StoredAuthUser extends AuthUser {
  passwordSalt: string;
  passwordHash: string;
}
interface LoginSession {
  userId: string;
  expiresAt: number;
}


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Standard Station Subfolders
const STANDARD_STATION_FOLDERS = [
  { key: '01_Dokumentacja_Glowna', label: '01 - Dokumentacja Główna Zlecenia' },
  { key: '02_Obudowa_Betonowa', label: '02 - Obudowa Betonowa BEK / NZ' },
  { key: '03_Rozdzielnica_SN', label: '03 - Rozdzielnica Średniego Napięcia SN' },
  { key: '04_Rozdzielnica_NN', label: '04 - Rozdzielnica Niskiego Napięcia nN' },
  { key: '05_Mosty_i_Szynoprzewody', label: '05 - Mosty Szynowe i Połączenia' },
  { key: '06_Rysunki_i_Akceptacje', label: '06 - Rysunki Zatwierdzone i Akceptacje OSD' },
  { key: '07_Kolory_i_Elewacja', label: '07 - Karty Kolorów RAL i Elewacja' },
  { key: '08_Opisy_i_Oznaczenia', label: '08 - Tabliczki Znamionowe i Opisy BHP' },
  { key: '09_Drzwi_i_Slusarka', label: '09 - Drzwi i Ślusarka Aluminiowa' },
  { key: '10_Podwykonawcy_i_Montaz', label: '10 - Podwykonawcy i Montaż' },
  { key: '11_Telemechanika_i_Lacznosc', label: '11 - Szafki Telemechaniki i Łączność' },
  { key: '12_Dokumentacja_Powykonawcza', label: '12 - Dokumentacja Powykonawcza i Certyfikaty' },
  { key: '13_Inne_i_Dodatkowe', label: '13 - Inne Załączniki' },
];

function sanitizePath(segment: string): string {
  if (!segment) return 'OGOLNE';
  return segment
    .trim()
    .replace(/[<>:"/\\|?*]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 100);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '50mb' }));

  // Ensure persistent data directory and uploads root exist
  // Configure DATA_DIR to a persistent mounted directory in hosted deployments.
  const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data_store'));
  const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const USERS_FILE = path.join(DATA_DIR, 'users.json');
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, '[]', 'utf-8');
  }
  const authSessions = new Map<string, LoginSession>();
  const failedLoginAttempts = new Map<string, { count: number; resetAt: number }>();
  const AUTH_COOKIE_NAME = 'enco_flow_session';
  const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
  const ALLOWED_DEPARTMENTS: AuthDepartmentId[] = [
    'dzial_handlowy', 'logistyka', 'pyskowice', 'plochocinska',
  ];

  const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
  const DOORS_FILE = path.join(DATA_DIR, 'door_orders.json');
  const OBUDOWA_VARIANTS_FILE = path.join(DATA_DIR, 'obudowa_variants.json');
  const SN_SWITCHGEAR_FILE = path.join(DATA_DIR, 'sn_switchgear.json');
  const SN_CATALOG_FILE = path.join(DATA_DIR, 'sn_catalog.json');
  const DOOR_CATALOG_FILE = path.join(DATA_DIR, 'door_catalog.json');
  const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');
  if (!fs.existsSync(TASKS_FILE)) fs.writeFileSync(TASKS_FILE, '[]', 'utf-8');

  // Seed initial data if files do not exist
  let currentOrders = INITIAL_ORDERS;
  if (!fs.existsSync(ORDERS_FILE)) {
    try {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(INITIAL_ORDERS, null, 2), 'utf-8');
      console.log('Seeded initial orders into data_store/orders.json');
    } catch (e) {
      console.error('Failed to seed orders file:', e);
    }
  } else {
    try {
      const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
      currentOrders = JSON.parse(raw);
    } catch (e) {
      currentOrders = INITIAL_ORDERS;
    }
  }

  if (!fs.existsSync(DOORS_FILE)) {
    try {
      fs.writeFileSync(DOORS_FILE, JSON.stringify(INITIAL_DOOR_ORDERS, null, 2), 'utf-8');
      console.log('Seeded initial door orders into data_store/door_orders.json');
    } catch (e) {
      console.error('Failed to seed door orders file:', e);
    }
  }

  // Shared SN switchgear inventory, stored separately from order records.
  if (!fs.existsSync(SN_SWITCHGEAR_FILE)) {
    const initialSNSwitchgear = [
      { id: 'sn_rm_001', type: 'RM_AIRSET', category: 'DELIVERED', rodzaj: 'RM AirSet 24kV20kA NE-IIQ + napędy; wys. 1,625', ilosc: 1, terminDostawy: 'dostarczono', nrZamowienia: 'ZD/88/2025', projekt: 'Rozdzielnica na targi, przyjechała bez napędu w polu Q (Bakałarzewska)', lokalizacja: 'BAKAŁARZEWSKA' },
      { id: 'sn_rm_002', type: 'RM_AIRSET', category: 'DELIVERED', rodzaj: 'RM AirSet 24kV20kA NE-IIQ + napędy; wys. 1,625', ilosc: 1, terminDostawy: 'dostarczono', nrZamowienia: 'ZD/88/2025', projekt: 'GRABÓWKA - będzie demontaż', lokalizacja: 'GRABÓWKA' },
      { id: 'sn_rm_003', type: 'RM_AIRSET', category: 'DELIVERED', rodzaj: 'RM AirSet 24kV20kA NE-IIQ + napędy; wys. 1,625', ilosc: 1, terminDostawy: 'dostarczono', nrZamowienia: 'ZD/88/2025', projekt: 'UTRATA SUWAŁKI', lokalizacja: 'SUWAŁKI' },
      { id: 'sn_rm_004', type: 'RM_AIRSET', category: 'DELIVERED', rodzaj: 'RM AirSet 24kV20kA NE-IIQ + napędy; wys. 1,625', ilosc: 1, terminDostawy: 'dostarczono', nrZamowienia: 'ZD/88/2025', projekt: 'UTRATA SUWAŁKI', lokalizacja: 'SUWAŁKI' },
      { id: 'sn_rm_005', type: 'RM_AIRSET', category: 'DELIVERED', rodzaj: 'RM AirSet 24kV20kA NE-IIQ + napędy; wys. 1,625', ilosc: 1, terminDostawy: 'dostarczono', nrZamowienia: 'ZD/88/2025', projekt: 'HOŻA AUGUSTÓW', lokalizacja: 'AUGUSTÓW' },
      { id: 'sn_rm_006', type: 'RM_AIRSET', category: 'DELIVERED', rodzaj: 'RM AirSet 24kV20kA NE-IIQ + napędy; wys. 1,625', ilosc: 1, terminDostawy: 'dostarczono', nrZamowienia: 'ZD/88/2025', projekt: 'RAJGRODZKA AUGUSTÓW', lokalizacja: 'AUGUSTÓW' },
      { id: 'sn_rm_007', type: 'RM_AIRSET', category: 'DELIVERED', rodzaj: 'RM AirSet 24kV20kA NE-IIIQ + napędy; wys. 1,625', ilosc: 1, terminDostawy: 'dostarczono', nrZamowienia: 'ZD/88/2025', projekt: 'RAJSK HAĆKI', lokalizacja: 'RAJSK' },
    ];
    try {
      fs.writeFileSync(SN_SWITCHGEAR_FILE, JSON.stringify(initialSNSwitchgear, null, 2), 'utf-8');
      console.log('Initialized SN switchgear inventory in data_store/sn_switchgear.json');
    } catch (e) {
      console.error('Failed to initialize SN switchgear inventory:', e);
    }
  }

  // Shared SN manufacturer/model catalogue. Stored on the server so all users share additions.
  const INITIAL_SN_CATALOG = {
    producers: ['Schneider Electric', 'EATON', 'Siemens'],
    modelsByProducer: {
      'Schneider Electric': ['AirSeT'],
      'EATON': ['Xiria'],
      'Siemens': ['8DJH 24 Blue GIS'],
    } as Record<string, string[]>,
  };
  if (!fs.existsSync(SN_CATALOG_FILE)) {
    try {
      fs.writeFileSync(SN_CATALOG_FILE, JSON.stringify(INITIAL_SN_CATALOG, null, 2), 'utf-8');
      console.log('Initialized shared SN manufacturer/model catalogue in data_store/sn_catalog.json');
    } catch (e) {
      console.error('Failed to initialize SN catalogue:', e);
    }
  }

  // Shared custom enclosure sizes are configuration data, not browser-local data.
  if (!fs.existsSync(OBUDOWA_VARIANTS_FILE)) {
    try {
      fs.writeFileSync(OBUDOWA_VARIANTS_FILE, JSON.stringify([], null, 2), 'utf-8');
      console.log('Initialized shared custom enclosure sizes in data_store/obudowa_variants.json');
    } catch (e) {
      console.error('Failed to initialize shared enclosure sizes file:', e);
    }
  }

  // Shared door-hardware catalogue, seeded from the provided ENCO combination list.
  const INITIAL_DOOR_CATALOG = [
    { id: 'door_nz_1', grupa: 'NZ', numer: '1', wymiarZewnetrzny: '1775x1640', swiatloOtworu: '1660x1530', kolor: 'Białe', kraty: '2xkrata', opis: 'Zewnętrzne zawiasy' },
    { id: 'door_nz_2', grupa: 'NZ', numer: '2', wymiarZewnetrzny: '1830x1315', swiatloOtworu: '1770x1185', kolor: '8014?', kraty: 'pełne', opis: 'Zewnętrzne plastikowe zawiasy, dziwny zamek' },
    { id: 'door_nz_3', grupa: 'NZ', numer: '3', wymiarZewnetrzny: '1280x1230', swiatloOtworu: '1130x1080', kolor: '8017?', kraty: 'pełne', opis: 'Brak blokady otwarcia skrzydła drzwiowego' },
    { id: 'door_nz_4', grupa: 'NZ', numer: '4', wymiarZewnetrzny: '2795x1335', swiatloOtworu: '2647x1180', kolor: 'Niebieskie', kraty: '2xkrata', opis: '' },
    { id: 'door_nz_5', grupa: 'NZ', numer: '5', wymiarZewnetrzny: '2285x1680', swiatloOtworu: '2134x1528', kolor: 'Niebieskie', kraty: 'pełne', opis: '' },
    { id: 'door_nz_6', grupa: 'NZ', numer: '6', wymiarZewnetrzny: '2130x1335', swiatloOtworu: '2063x1185', kolor: '8014?', kraty: 'pełne', opis: '' },
    { id: 'door_nz_7', grupa: 'NZ', numer: '7', wymiarZewnetrzny: '2285x1335', swiatloOtworu: '2225x1185', kolor: '8014?', kraty: 'pełne', opis: '' },
    { id: 'door_nz_8', grupa: 'NZ', numer: '8', wymiarZewnetrzny: '1825x1335', swiatloOtworu: '1765x1185', kolor: '8014?', kraty: '1xpełne - lew.; 1x krata - praw.', opis: '' },
    { id: 'door_nz_bek_1', grupa: 'NZ — rama BEK', numer: '1', wymiarZewnetrzny: '2090x1395', swiatloOtworu: '1975x1283', kolor: '8014?', kraty: 'pełne', opis: 'Zewnętrzne zawiasy' },
    { id: 'door_nz_bek_2', grupa: 'NZ — rama BEK', numer: '2', wymiarZewnetrzny: '1785x1395', swiatloOtworu: '1675x1283', kolor: '8014?', kraty: '1xpełne - lew.; 1x krata - praw.', opis: 'Zewnętrzne zawiasy' },
    { id: 'door_bek_1', grupa: 'BEK', numer: '1', wymiarZewnetrzny: '2197x1066', swiatloOtworu: '2100x950', kolor: '8014?', kraty: '2xkrata', opis: 'Prawe' },
    { id: 'door_bek_2', grupa: 'BEK', numer: '2', wymiarZewnetrzny: '2197x1285', swiatloOtworu: '2100x1170', kolor: '8014?', kraty: '2xkrata', opis: 'Lewe, brak zamku' },
    { id: 'door_bek_3', grupa: 'BEK', numer: '3', wymiarZewnetrzny: '2197x1285', swiatloOtworu: '2100x1170', kolor: '8014?', kraty: '2xkrata', opis: 'Lewe' },
    { id: 'door_bek_4', grupa: 'BEK', numer: '4', wymiarZewnetrzny: '2197x1066', swiatloOtworu: '2100x950', kolor: '8014?', kraty: '2xkrata', opis: 'Prawe' },
    { id: 'door_bek_8', grupa: 'BEK', numer: '8', wymiarZewnetrzny: '', swiatloOtworu: '950x2100', kolor: '8014', kraty: '2xkrata', opis: 'Lewe' },
  ];

  if (!fs.existsSync(DOOR_CATALOG_FILE)) {
    try {
      fs.writeFileSync(DOOR_CATALOG_FILE, JSON.stringify(INITIAL_DOOR_CATALOG, null, 2), 'utf-8');
      console.log('Initialized shared door hardware catalogue in data_store/door_catalog.json');
    } catch (e) {
      console.error('Failed to initialize door hardware catalogue:', e);
    }
  }

  // Pre-create structured folders for all orders on the server
  function ensureOrderFolders(orderNumber: string, projectName?: string) {
    const safeOrder = sanitizePath(orderNumber);
    const orderDir = path.join(UPLOADS_DIR, safeOrder);
    if (!fs.existsSync(orderDir)) {
      fs.mkdirSync(orderDir, { recursive: true });
    }

    // Create readme/metadata in order root
    const infoFile = path.join(orderDir, '_informacje_o_zleceniu.txt');
    if (!fs.existsSync(infoFile)) {
      fs.writeFileSync(
        infoFile,
        `ENCO FLOW — REPOZYTORIUM ZAŁĄCZNIKÓW I DOKUMENTACJI\nZlecenie: ${orderNumber}\nProjekt: ${
          projectName || ''
        }\nUtworzono: ${new Date().toISOString()}\n\nStruktura folderów została automatycznie zainicjowana zgodnie ze standardem technologicznym stacji transformatorowych ENCO.`,
        'utf-8'
      );
    }

    // Ensure all 13 standard subfolders exist
    STANDARD_STATION_FOLDERS.forEach((folder) => {
      const folderPath = path.join(orderDir, folder.key);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }
    });

    return orderDir;
  }

  // Pre-seed folders and sample files for existing orders
  function initAllFoldersAndSeedFiles() {
    try {
      // Setup door module folder
      const doorsDir = path.join(UPLOADS_DIR, 'MODUL_DRZWI');
      if (!fs.existsSync(doorsDir)) {
        fs.mkdirSync(doorsDir, { recursive: true });
        ['01_Rysunki_Wykonawcze', '02_Potwierdzenia_Zamowien', '03_Certyfikaty_RC'].forEach((f) => {
          fs.mkdirSync(path.join(doorsDir, f), { recursive: true });
        });
      }

      currentOrders.forEach((ord: any) => {
        const orderDir = ensureOrderFolders(ord.orderNumber, ord.projectName);

        // Map item attachments to their folders and create sample files if missing
        if (Array.isArray(ord.items)) {
          ord.items.forEach((item: any) => {
            let targetFolder = '13_Inne_i_Dodatkowe';
            if (item.type === 'OBUDOWA') targetFolder = '02_Obudowa_Betonowa';
            else if (item.type === 'ROZDZIELNICA_SN') targetFolder = '03_Rozdzielnica_SN';
            else if (item.type === 'ROZDZIELNICA_NN') targetFolder = '04_Rozdzielnica_NN';
            else if (item.type === 'MOST') targetFolder = '05_Mosty_i_Szynoprzewody';
            else if (item.type === 'RYS_AKCEPTACJA') targetFolder = '06_Rysunki_i_Akceptacje';
            else if (item.type === 'KOLORY') targetFolder = '07_Kolory_i_Elewacja';
            else if (item.type === 'OPISY') targetFolder = '08_Opisy_i_Oznaczenia';
            else if (item.type === 'DRZWI') targetFolder = '09_Drzwi_i_Slusarka';
            else if (
              item.type === 'ZAP_SERWISPOL' ||
              item.type === 'ZAM_SERWISPOL' ||
              item.type === 'ZAP_JK' ||
              item.type === 'ZAM_JK' ||
              item.type === 'ZLECENIE_MONTAZU' ||
              item.type === 'ZLECENIE MONTAŻU' ||
              item.type === 'ZLECENIE_MONTAŻU' ||
              item.type === 'POWYKONAWCZA' ||
              item.type === 'DATA_WYJAZDU' ||
              item.type === 'DODATKOWE'
            ) {
              targetFolder = '10_Podwykonawcy_i_Montaz';
            } else if (item.type === 'SZAFKA_TELEMECHANIKI') targetFolder = '11_Telemechanika_i_Lacznosc';
            else if (item.type === 'POWYKONAWCZA') targetFolder = '12_Dokumentacja_Powykonawcza';

            if (Array.isArray(item.attachments)) {
              item.attachments.forEach((att: any) => {
                att.folderCategory = att.folderCategory || targetFolder;
                att.folderPath = `${sanitizePath(ord.orderNumber)}/${att.folderCategory}`;
                att.diskPath = `data_store/uploads/${att.folderPath}/${att.name}`;

                const filePath = path.join(orderDir, att.folderCategory, sanitizePath(att.name));
                if (!fs.existsSync(filePath)) {
                  fs.writeFileSync(
                    filePath,
                    `%PDF-1.4\nENCO FLOW SYSTEM KONTROLI STACJI TRANSFORMATOROWYCH\n` +
                      `Zlecenie: ${ord.orderNumber}\nElement: ${item.name} (${item.type})\n` +
                      `Plik: ${att.name}\nData utworzenia: ${att.uploadedAt || new Date().toISOString()}\n` +
                      `Lokalizacja serwera: data_store/uploads/${sanitizePath(ord.orderNumber)}/${att.folderCategory}/${att.name}\n` +
                      `Rozmiar: ${att.size || '1.0 MB'}\n\nDokumentacja zatwierdzona technicznie dla stacji ${ord.projectName}.\n`,
                    'utf-8'
                  );
                }
              });
            }
          });
        }

        // Order-level attachments
        if (Array.isArray(ord.attachments)) {
          ord.attachments.forEach((att: any) => {
            att.folderCategory = att.folderCategory || '01_Dokumentacja_Glowna';
            att.folderPath = `${sanitizePath(ord.orderNumber)}/${att.folderCategory}`;
            att.diskPath = `data_store/uploads/${att.folderPath}/${att.name}`;

            const filePath = path.join(orderDir, att.folderCategory, sanitizePath(att.name));
            if (!fs.existsSync(filePath)) {
              fs.writeFileSync(
                filePath,
                `%PDF-1.4\nENCO FLOW — GŁÓWNA DOKUMENTACJA ZLECENIA\nZlecenie: ${ord.orderNumber}\nProjekt: ${ord.projectName}\nKlient: ${ord.client}\nPlik: ${att.name}\n`,
                'utf-8'
              );
            }
          });
        }
      });

      console.log('[ENCO FLOW] Successfully initialized and verified all order folder structures.');
    } catch (err) {
      console.error('[ENCO FLOW] Error initializing folder structure:', err);
    }
  }

  initAllFoldersAndSeedFiles();

  // Static route to serve uploaded files directly
  app.use('/uploads', requireApiAuth, requireCapability('canDownload'), express.static(UPLOADS_DIR));

  // Three-way merge: apply only fields changed relative to the client's baseline.
  // Concurrent edits to the same field are reported instead of silently overwritten.
  function mergeConcurrentValue(base: any, incoming: any, current: any, fieldPath: string, conflicts: string[]): any {
    const equal = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
    if (equal(incoming, base)) return current;
    if (equal(current, base)) return incoming;
    if (equal(incoming, current)) return current;

    const isObject = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (isObject(base) && isObject(incoming) && isObject(current)) {
      const merged: Record<string, any> = { ...current };
      const keys = new Set([...Object.keys(base), ...Object.keys(incoming), ...Object.keys(current)]);
      for (const key of keys) {
        const path = fieldPath ? fieldPath + '.' + key : key;
        const hasBase = Object.prototype.hasOwnProperty.call(base, key);
        const hasIncoming = Object.prototype.hasOwnProperty.call(incoming, key);
        const hasCurrent = Object.prototype.hasOwnProperty.call(current, key);
        // Timestamps are metadata, not user-editable fields; concurrent saves must not conflict on them.
        if ((key === 'updatedAt' || (key === 'status' && fieldPath === '')) && hasIncoming) {
          merged[key] = incoming[key];
          continue;
        }
        if (hasBase && !hasIncoming) {
          if (!hasCurrent || equal(current[key], base[key])) delete merged[key];
          else conflicts.push(path);
        } else if (!hasBase && hasIncoming) {
          if (!hasCurrent) merged[key] = incoming[key];
          else if (!equal(current[key], incoming[key])) conflicts.push(path);
        } else if (hasBase && hasIncoming) {
          if (!hasCurrent) {
            if (!equal(incoming[key], base[key])) conflicts.push(path);
          } else {
            merged[key] = mergeConcurrentValue(base[key], incoming[key], current[key], path, conflicts);
          }
        }
      }
      return merged;
    }

    const keyedArray = (value: any) => Array.isArray(value) && value.every((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string');
    if (keyedArray(base) && keyedArray(incoming) && keyedArray(current)) {
      const baseMap = new Map<string, any>(base.map((entry: any) => [entry.id, entry] as [string, any]));
      const incomingMap = new Map<string, any>(incoming.map((entry: any) => [entry.id, entry] as [string, any]));
      const currentMap = new Map<string, any>(current.map((entry: any) => [entry.id, entry] as [string, any]));
      const mergedMap = new Map(currentMap);
      for (const id of new Set([...baseMap.keys(), ...incomingMap.keys(), ...currentMap.keys()])) {
        const b: any = baseMap.get(id), n: any = incomingMap.get(id), cur: any = currentMap.get(id);
        const path = fieldPath + '[' + id + ']';
        if (b && !n) {
          if (!cur || equal(cur, b)) mergedMap.delete(id);
          else conflicts.push(path);
        } else if (!b && n) {
          if (!cur) mergedMap.set(id, n);
          else if (!equal(cur, n)) conflicts.push(path);
        } else if (b && n && cur) {
          mergedMap.set(id, mergeConcurrentValue(b, n, cur, path, conflicts));
        } else if (b && n && !cur && !equal(b, n)) {
          conflicts.push(path);
        }
      }
      return Array.from(mergedMap.values());
    }

    conflicts.push(fieldPath || '(rekord)');
    return current;
  }

  // Zapis atomowy: awaria procesu podczas zapisu nie zostawi uciętego pliku JSON.
  function writeJsonAtomically(filePath: string, data: unknown) {
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  }

  function loadAuthUsers(): StoredAuthUser[] {
    const parsed = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    if (!Array.isArray(parsed)) throw new Error('Nieprawidłowy format bazy kont użytkowników.');
    return parsed as StoredAuthUser[];
  }

  function saveAuthUsers(users: StoredAuthUser[]) {
    writeJsonAtomically(USERS_FILE, users);
  }

  function publicAuthUser(user: StoredAuthUser): AuthUser {
    const { passwordSalt: _salt, passwordHash: _hash, ...publicRecord } = user;
    return publicRecord;
  }

  function normalizeUsername(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  function normalizeDepartments(value: unknown): AuthDepartmentId[] | null {
    if (!Array.isArray(value)) return null;
    const result: AuthDepartmentId[] = [];
    for (const department of value) {
      if (typeof department !== 'string' || !ALLOWED_DEPARTMENTS.includes(department as AuthDepartmentId)) return null;
      if (!result.includes(department as AuthDepartmentId)) result.push(department as AuthDepartmentId);
    }
    return result;
  }

  function isValidUsername(username: string): boolean {
    return /^[a-z0-9._-]{3,40}$/.test(username);
  }

  function makePasswordRecord(password: string): { passwordSalt: string; passwordHash: string } {
    const passwordSalt = randomBytes(16).toString('hex');
    const passwordHash = scryptSync(password, passwordSalt, 64).toString('hex');
    return { passwordSalt, passwordHash };
  }

  function passwordMatches(user: StoredAuthUser, password: string): boolean {
    const expected = Buffer.from(user.passwordHash, 'hex');
    const actual = Buffer.from(scryptSync(password, user.passwordSalt, 64).toString('hex'), 'hex');
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }

  function getCookie(req: any, name: string): string | null {
    const raw = String(req.headers?.cookie || '');
    for (const part of raw.split(';')) {
      const separator = part.indexOf('=');
      if (separator < 0) continue;
      if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
    }
    return null;
  }

  function getAuthenticatedUser(req: any): AuthUser | null {
    const token = getCookie(req, AUTH_COOKIE_NAME);
    if (!token) return null;
    const session = authSessions.get(token);
    if (!session) return null;
    if (session.expiresAt <= Date.now()) {
      authSessions.delete(token);
      return null;
    }
    const user = loadAuthUsers().find((entry) => entry.id === session.userId);
    if (!user || !user.active) {
      authSessions.delete(token);
      return null;
    }
    return publicAuthUser(user);
  }

  function startSession(req: any, res: any, user: StoredAuthUser) {
    const token = randomBytes(32).toString('hex');
    authSessions.set(token, { userId: user.id, expiresAt: Date.now() + SESSION_TTL_MS });
    const forwardedProto = String(req.headers?.['x-forwarded-proto'] || '');
    const secure = req.secure || forwardedProto.split(',')[0].trim() === 'https' ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
  }

  function endSessionsForUser(userId: string) {
    for (const [token, session] of authSessions.entries()) {
      if (session.userId === userId) authSessions.delete(token);
    }
  }

  function requireApiAuth(req: any, res: any, next: any) {
    if (req.path === '/health') return next();
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: 'Sesja wygasła lub brak logowania. Zaloguj się ponownie.' });
    }
    req.authUser = user;
    return next();
  }

  function requireAdmin(req: any, res: any, next: any) {
    const user = req.authUser as AuthUser | undefined;
    if (!user?.isAdmin) return res.status(403).json({ success: false, error: 'Ta operacja wymaga uprawnień administratora.' });
    return next();
  }

  function requestProfile(req: any): UserRoleProfile | null {
    const user = req.authUser as AuthUser | undefined;
    return user ? profileForAuthUser(user) : null;
  }

  function requireCapability(capability: keyof UserRoleProfile) {
    return (req: any, res: any, next: any) => {
      const profile = requestProfile(req);
      if (!profile || !Boolean(profile[capability])) {
        return res.status(403).json({ success: false, error: 'Twoje konto nie ma uprawnień do wykonania tej operacji.' });
      }
      return next();
    };
  }

  function requireItemPermission(itemType: string) {
    return (req: any, res: any, next: any) => {
      const profile = requestProfile(req);
      if (!profile || !canEditItemType(profile, itemType)) {
        return res.status(403).json({ success: false, error: `Twoje konto nie ma uprawnień do edycji elementu: ${itemType}.` });
      }
      return next();
    };
  }

  function requireFileFolderPermission(req: any, res: any, next: any) {
    const profile = requestProfile(req);
    if (!profile?.canDownload) return res.status(403).json({ success: false, error: 'Twoje konto nie ma uprawnień do obsługi plików.' });
    const folder = sanitizePath(String(req.body?.folderKey || req.query?.folderKey || ''));
    const folderTypes: Record<string, string[]> = {
      '02_Obudowa_Betonowa': ['OBUDOWA'],
      '03_Rozdzielnica_SN': ['ROZDZIELNICA_SN'],
      '04_Rozdzielnica_NN': ['ROZDZIELNICA_NN'],
      '05_Mosty_i_Szynoprzewody': ['MOST'],
      '06_Rysunki_i_Akceptacje': ['RYS_AKCEPTACJA'],
      '07_Kolory_i_Elewacja': ['KOLORY'],
      '08_Opisy_i_Oznaczenia': ['OPISY'],
      '09_Drzwi_i_Slusarka': ['DRZWI'],
      '10_Podwykonawcy_i_Montaz': ['ZAP_SERWISPOL', 'ZAM_SERWISPOL', 'ZAP_JK', 'ZAM_JK', 'ZLECENIE_MONTAZU'],
      '11_Telemechanika_i_Lacznosc': ['SZAFKA_TELEMECHANIKI'],
      '12_Dokumentacja_Powykonawcza': ['POWYKONAWCZA'],
      '13_Inne_i_Dodatkowe': ['DODATKOWE'],
    };
    const requiredTypes = folderTypes[folder];
    if (requiredTypes && !requiredTypes.some((type) => canEditItemType(profile, type))) {
      return res.status(403).json({ success: false, error: 'Nie masz uprawnień do zmiany plików w tym folderze.' });
    }
    if (folder === '01_Dokumentacja_Glowna' && !profile.canEditOrderMetadata) {
      return res.status(403).json({ success: false, error: 'Nie masz uprawnień do zmiany dokumentacji głównej zlecenia.' });
    }
    return next();
  }

  function orderUpdatePermissionError(existing: any, incoming: any, profile: UserRoleProfile): string | null {
    const normalizeForComparison = (value: any): any => {
      if (Array.isArray(value)) return value.map(normalizeForComparison);
      if (value && typeof value === 'object') {
        return Object.keys(value).sort().reduce((result: Record<string, unknown>, key) => {
          result[key] = normalizeForComparison(value[key]);
          return result;
        }, {});
      }
      return value ?? null;
    };
    const changed = (left: unknown, right: unknown) =>
      JSON.stringify(normalizeForComparison(left)) !== JSON.stringify(normalizeForComparison(right));
    const metadataFields = ['customerId', 'contactId', 'contactName', 'contactEmail', 'contactPhone', 'orderNumber', 'client', 'projectName', 'stationSize', 'originalDepartureDate'];
    for (const key of metadataFields) {
      if (changed(existing[key], incoming[key]) && !profile.canEditOrderMetadata) {
        return 'Nie masz uprawnień do zmiany podstawowych danych zlecenia.';
      }
    }
    if (changed(existing.departureDate, incoming.departureDate) && !profile.canEditDepartureDate) {
      return 'Nie masz uprawnień do zmiany terminu wyjazdu.';
    }
    if (changed(existing.generalNotes, incoming.generalNotes) && !profile.canEditGeneralNotes) {
      return 'Nie masz uprawnień do zmiany uwag ogólnych.';
    }
    if (changed(existing.additionalInfo, incoming.additionalInfo) && !profile.canEditAdditionalInfo) {
      return 'Nie masz uprawnień do zmiany informacji dodatkowych.';
    }
    if (changed(existing.archivedAt, incoming.archivedAt) && !profile.canDeleteOrders) {
      return 'Nie masz uprawnień do archiwizowania lub przywracania zleceń.';
    }
    if (changed(existing.attachments, incoming.attachments) && !profile.canEditOrderMetadata) {
      return 'Nie masz uprawnień do zmiany załączników głównych zlecenia.';
    }

    const previousItems: any[] = Array.isArray(existing.items) ? existing.items : [];
    const incomingItems: any[] = Array.isArray(incoming.items) ? incoming.items : [];
    const previousById = new Map(previousItems.map((item) => [String(item.id), item]));
    const incomingById = new Map(incomingItems.map((item) => [String(item.id), item]));
    for (const item of previousItems) {
      if (!incomingById.has(String(item.id)) && !canEditItemType(profile, String(item.type || ''))) {
        return `Nie masz uprawnień do usuwania elementu: ${item.name || item.type}.`;
      }
    }
    for (const item of incomingItems) {
      const previous = previousById.get(String(item.id));
      if (!previous || changed(previous, item)) {
        if (!canEditItemType(profile, String(item.type || '')) ||
            (previous && !canEditItemType(profile, String(previous.type || '')))) {
          return `Nie masz uprawnień do dodawania lub edycji elementu: ${item.name || item.type}.`;
        }
      }
    }

    const handledFields = new Set([
      'id', 'createdAt', 'updatedAt', 'status', 'items', 'attachments',
      'customerId', 'contactId', 'contactName', 'contactEmail', 'contactPhone',
      'orderNumber', 'client', 'projectName', 'stationSize', 'originalDepartureDate',
      'departureDate', 'generalNotes', 'additionalInfo', 'archivedAt',
    ]);
    const keys = new Set([...Object.keys(existing || {}), ...Object.keys(incoming || {})]);
    for (const key of keys) {
      if (!handledFields.has(key) && changed(existing[key], incoming[key]) && !profile.canEditOrderMetadata) {
        return 'Nie masz uprawnień do zmiany pozostałych danych zlecenia.';
      }
    }
    if (changed(existing.status, incoming.status) && !changed(existing.items, incoming.items) && !profile.canEditOrderMetadata) {
      return 'Status zlecenia musi wynikać ze zmiany dozwolonych elementów.';
    }
    return null;
  }

  // Public authentication routes are the only API routes that do not require an existing session.
  app.use('/api', (req: any, res: any, next: any) => {
    const publicPaths = new Set([
      '/auth/bootstrap-status', '/auth/bootstrap', '/auth/login', '/auth/me', '/auth/logout', '/health',
    ]);
    if (publicPaths.has(req.path)) return next();
    return requireApiAuth(req, res, next);
  });

  app.get('/api/auth/bootstrap-status', (_req, res) => {
    try {
      return res.json({ needsSetup: loadAuthUsers().length === 0 });
    } catch {
      return res.status(500).json({ error: 'Nie można odczytać bazy kont użytkowników.' });
    }
  });

  app.post('/api/auth/bootstrap', (req, res) => {
    try {
      if (loadAuthUsers().length !== 0) {
        return res.status(409).json({ error: 'Konto administratora jest już skonfigurowane. Odśwież stronę i zaloguj się.' });
      }
      const username = normalizeUsername(req.body?.username);
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!isValidUsername(username)) return res.status(400).json({ error: 'Login może zawierać małe litery, cyfry, kropkę, myślnik i podkreślenie (3–40 znaków).' });
      if (displayName.length < 2 || displayName.length > 100) return res.status(400).json({ error: 'Podaj poprawną nazwę administratora.' });
      if (password.length < 10 || password.length > 200) return res.status(400).json({ error: 'Hasło administratora musi mieć od 10 do 200 znaków.' });

      const now = new Date().toISOString();
      const admin: StoredAuthUser = {
        id: `usr_${randomBytes(12).toString('hex')}`,
        username, displayName, departments: [], isAdmin: true, active: true,
        createdAt: now, updatedAt: now,
        ...makePasswordRecord(password),
      };
      saveAuthUsers([admin]);
      startSession(req, res, admin);
      return res.status(201).json({ success: true, user: publicAuthUser(admin) });
    } catch (err) {
      console.error('Auth bootstrap failed:', err);
      return res.status(500).json({ error: 'Nie udało się skonfigurować konta administratora.' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const username = normalizeUsername(req.body?.username);
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const attemptKey = `${req.ip || 'unknown'}:${username}`;
      const prior = failedLoginAttempts.get(attemptKey);
      if (prior && prior.resetAt > Date.now() && prior.count >= 8) {
        return res.status(429).json({ error: 'Zbyt wiele nieudanych prób logowania. Spróbuj ponownie za 15 minut.' });
      }
      if (!username || !password || password.length > 200) {
        return res.status(400).json({ error: 'Wprowadź login i hasło.' });
      }
      const user = loadAuthUsers().find((entry) => entry.username === username);
      const matches = user ? passwordMatches(user, password) : (scryptSync(password, randomBytes(16).toString('hex'), 64), false);
      if (!user || !user.active || !matches) {
        const count = prior && prior.resetAt > Date.now() ? prior.count + 1 : 1;
        failedLoginAttempts.set(attemptKey, { count, resetAt: Date.now() + 15 * 60 * 1000 });
        return res.status(401).json({ error: 'Nieprawidłowy login lub hasło.' });
      }
      failedLoginAttempts.delete(attemptKey);
      startSession(req, res, user);
      return res.json({ success: true, user: publicAuthUser(user) });
    } catch (err) {
      console.error('Login failed:', err);
      return res.status(500).json({ error: 'Nie udało się zalogować.' });
    }
  });

  app.get('/api/auth/me', (req: any, res) => {
    try {
      const user = getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ error: 'Brak aktywnej sesji.' });
      return res.json({ user });
    } catch (err) {
      console.error('Reading current user failed:', err);
      return res.status(500).json({ error: 'Nie można odczytać aktywnej sesji.' });
    }
  });

  app.post('/api/auth/logout', (req: any, res) => {
    const token = getCookie(req, AUTH_COOKIE_NAME);
    if (token) authSessions.delete(token);
    res.setHeader('Set-Cookie', `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return res.json({ success: true });
  });

  // Every remaining API route requires a valid session; account management additionally requires an admin.
  app.get('/api/admin/users', requireApiAuth, requireAdmin, (_req, res) => {
    try {
      const users = loadAuthUsers()
        .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pl'))
        .map(publicAuthUser);
      return res.json({ users });
    } catch (err) {
      console.error('Reading user accounts failed:', err);
      return res.status(500).json({ error: 'Nie udało się pobrać kont użytkowników.' });
    }
  });

  app.post('/api/admin/users', requireApiAuth, requireAdmin, (req, res) => {
    try {
      const username = normalizeUsername(req.body?.username);
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : '';
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      const departments = normalizeDepartments(req.body?.departments);
      const isAdmin = req.body?.isAdmin === true;
      if (!isValidUsername(username)) return res.status(400).json({ error: 'Login musi mieć 3–40 znaków i może zawierać litery, cyfry, kropkę, myślnik lub podkreślenie.' });
      if (displayName.length < 2 || displayName.length > 100) return res.status(400).json({ error: 'Podaj poprawną nazwę użytkownika.' });
      if (password.length < 10 || password.length > 200) return res.status(400).json({ error: 'Hasło początkowe musi mieć od 10 do 200 znaków.' });
      if (!departments) return res.status(400).json({ error: 'Wybrano nieprawidłowy dział.' });
      const users = loadAuthUsers();
      if (users.some((user) => user.username === username)) return res.status(409).json({ error: 'Taki login jest już zajęty.' });
      const now = new Date().toISOString();
      const user: StoredAuthUser = {
        id: `usr_${randomBytes(12).toString('hex')}`,
        username, displayName, departments: isAdmin ? [] : departments, isAdmin, active: true,
        createdAt: now, updatedAt: now,
        ...makePasswordRecord(password),
      };
      users.push(user);
      saveAuthUsers(users);
      return res.status(201).json({ success: true, user: publicAuthUser(user) });
    } catch (err) {
      console.error('Creating user account failed:', err);
      return res.status(500).json({ error: 'Nie udało się utworzyć konta użytkownika.' });
    }
  });

  app.patch('/api/admin/users/:userId', requireApiAuth, requireAdmin, (req: any, res) => {
    try {
      const users = loadAuthUsers();
      const index = users.findIndex((user) => user.id === req.params.userId);
      if (index < 0) return res.status(404).json({ error: 'Nie znaleziono konta użytkownika.' });
      const original = users[index];
      const actor = req.authUser as AuthUser;
      const displayName = typeof req.body?.displayName === 'string' ? req.body.displayName.trim() : original.displayName;
      const departments = req.body?.departments === undefined ? original.departments : normalizeDepartments(req.body.departments);
      const isAdmin = typeof req.body?.isAdmin === 'boolean' ? req.body.isAdmin : original.isAdmin;
      const active = typeof req.body?.active === 'boolean' ? req.body.active : original.active;
      if (displayName.length < 2 || displayName.length > 100) return res.status(400).json({ error: 'Podaj poprawną nazwę użytkownika.' });
      if (!departments) return res.status(400).json({ error: 'Wybrano nieprawidłowy dział.' });
      if (original.id === actor.id && (!isAdmin || !active)) return res.status(400).json({ error: 'Nie możesz odebrać sobie uprawnień administratora ani dezaktywować własnego konta.' });
      const activeAdmins = users.filter((user) => user.active && user.isAdmin);
      if (original.active && original.isAdmin && (!active || !isAdmin) && activeAdmins.length <= 1) {
        return res.status(400).json({ error: 'System musi mieć co najmniej jednego aktywnego administratora.' });
      }
      const updated: StoredAuthUser = {
        ...original,
        displayName,
        departments: isAdmin ? [] : departments,
        isAdmin,
        active,
        updatedAt: new Date().toISOString(),
      };
      users[index] = updated;
      saveAuthUsers(users);
      if (!active) endSessionsForUser(updated.id);
      return res.json({ success: true, user: publicAuthUser(updated) });
    } catch (err) {
      console.error('Updating user account failed:', err);
      return res.status(500).json({ error: 'Nie udało się zapisać zmian konta.' });
    }
  });

  app.post('/api/admin/users/:userId/reset-password', requireApiAuth, requireAdmin, (req: any, res) => {
    try {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (password.length < 10 || password.length > 200) return res.status(400).json({ error: 'Nowe hasło musi mieć od 10 do 200 znaków.' });
      const users = loadAuthUsers();
      const index = users.findIndex((user) => user.id === req.params.userId);
      if (index < 0) return res.status(404).json({ error: 'Nie znaleziono konta użytkownika.' });
      users[index] = { ...users[index], ...makePasswordRecord(password), updatedAt: new Date().toISOString() };
      saveAuthUsers(users);
      endSessionsForUser(users[index].id);
      return res.json({ success: true });
    } catch (err) {
      console.error('Resetting user password failed:', err);
      return res.status(500).json({ error: 'Nie udało się zresetować hasła.' });
    }
  });

  // Shared JSON storage API. Clients read on startup or explicit manual refresh only.
  // Wspólna baza firm i osób kontaktowych.
  const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
  if (!fs.existsSync(CUSTOMERS_FILE)) writeJsonAtomically(CUSTOMERS_FILE, []);

  app.get('/api/customers', (_req, res) => {
    try { const parsed = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8')); return res.json({ success: true, customers: Array.isArray(parsed) ? parsed : [] }); }
    catch (err) { console.error('Error reading customer database:', err); return res.status(500).json({ success: false, error: 'Błąd odczytu bazy klientów' }); }
  });
  app.post('/api/customers', requireCapability('canEditOrderMetadata'), (req, res) => {
    try {
      const incoming = req.body?.customer;
      if (!incoming || !incoming.id || !String(incoming.name || '').trim()) return res.status(400).json({ success: false, error: 'Wymagane jest ID i nazwa firmy' });
      const parsed = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
      const customers: any[] = Array.isArray(parsed) ? parsed : [];
      const index = customers.findIndex((item: any) => String(item.id) === String(incoming.id));
      if (index < 0) customers.push({ ...incoming, contacts: Array.isArray(incoming.contacts) ? incoming.contacts : [] });
      else {
        const existing = customers[index]; const contacts = Array.isArray(existing.contacts) ? [...existing.contacts] : [];
        (Array.isArray(incoming.contacts) ? incoming.contacts : []).forEach((contact: any) => {
          if (!contact?.id || !String(contact.name || '').trim()) return;
          const ci = contacts.findIndex((entry: any) => String(entry.id) === String(contact.id));
          if (ci < 0) contacts.push(contact); else contacts[ci] = contact;
        });
        customers[index] = { ...existing, ...incoming, contacts };
      }
      writeJsonAtomically(CUSTOMERS_FILE, customers);
      return res.json({ success: true, customers, timestamp: Date.now() });
    } catch (err) { console.error('Error saving customer database:', err); return res.status(500).json({ success: false, error: 'Błąd zapisu bazy klientów' }); }
  });

  app.put('/api/customers/:customerId', requireCapability('canEditOrderMetadata'), (req, res) => {
    try {
      const incoming = req.body?.customer;
      if (!incoming || String(incoming.id) !== String(req.params.customerId) || !String(incoming.name || '').trim()) return res.status(400).json({ success: false, error: 'Nieprawidłowe dane firmy' });
      const parsed = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
      const customers: any[] = Array.isArray(parsed) ? parsed : [];
      const index = customers.findIndex((item: any) => String(item.id) === String(req.params.customerId));
      if (index < 0) return res.status(404).json({ success: false, error: 'Nie znaleziono firmy' });
      customers[index] = { ...incoming, contacts: Array.isArray(incoming.contacts) ? incoming.contacts : [] };
      writeJsonAtomically(CUSTOMERS_FILE, customers);
      return res.json({ success: true, customers, timestamp: Date.now() });
    } catch (err) { console.error('Error updating customer:', err); return res.status(500).json({ success: false, error: 'Błąd aktualizacji firmy' }); }
  });
  app.delete('/api/customers/:customerId', requireCapability('canEditOrderMetadata'), (req, res) => {
    try {
      const parsed = JSON.parse(fs.readFileSync(CUSTOMERS_FILE, 'utf-8'));
      const customers: any[] = Array.isArray(parsed) ? parsed : [];
      const updated = customers.filter((item: any) => String(item.id) !== String(req.params.customerId));
      if (updated.length === customers.length) return res.status(404).json({ success: false, error: 'Nie znaleziono firmy' });
      writeJsonAtomically(CUSTOMERS_FILE, updated);
      return res.json({ success: true, customers: updated, timestamp: Date.now() });
    } catch (err) { console.error('Error deleting customer:', err); return res.status(500).json({ success: false, error: 'Błąd usuwania firmy' }); }
  });


  // Shared task register used by both the order-side panel and the Action Plan.
  function readTasks(): any[] {
    const parsed = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  }
  function saveTasks(tasks: any[]) {
    writeJsonAtomically(TASKS_FILE, tasks);
  }
  function taskDepartmentLabel(id: string): string {
    const labels: Record<string, string> = {
      dzial_handlowy: 'Dział Handlowy',
      logistyka: 'Logistyka',
      pyskowice: 'Produkcja – Pyskowice',
      plochocinska: 'Produkcja – Płochocińska',
    };
    return labels[id] || id;
  }
  function taskPublicRecord(task: any) {
    return task;
  }
  app.get('/api/tasks/meta', (req: any, res) => {
    try {
      const users = loadAuthUsers()
        .filter((user) => user.active)
        .map((user) => ({
          id: user.id, username: user.username, displayName: user.displayName,
          departments: user.departments, isAdmin: user.isAdmin,
        }));
      return res.json({ success: true, users });
    } catch (err) {
      console.error('Reading task assignees failed:', err);
      return res.status(500).json({ success: false, error: 'Nie udało się pobrać listy osób.' });
    }
  });

  app.get('/api/tasks', (_req, res) => {
    try {
      return res.json({ success: true, tasks: readTasks().map(taskPublicRecord), timestamp: Date.now() });
    } catch (err) {
      console.error('Reading tasks failed:', err);
      return res.status(500).json({ success: false, error: 'Nie udało się pobrać zadań.' });
    }
  });

  app.post('/api/tasks', (req: any, res) => {
    try {
      const actor = req.authUser as AuthUser;
      if (actor.departments.length === 0 && !actor.isAdmin) {
        return res.status(403).json({ success: false, error: 'Konto tylko do podglądu nie może tworzyć zadań.' });
      }
      const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId : '';
      const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
      const dueDate = typeof req.body?.dueDate === 'string' ? req.body.dueDate : '';
      const assigneeType = req.body?.assigneeType;
      const orders = fs.existsSync(ORDERS_FILE) ? JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf-8')) : INITIAL_ORDERS;
      const order = Array.isArray(orders) ? orders.find((item: any) => String(item.id) === orderId) : null;
      if (!order) return res.status(404).json({ success: false, error: 'Nie znaleziono zlecenia powiązanego z zadaniem.' });
      if (!description || description.length > 500) return res.status(400).json({ success: false, error: 'Opis zadania jest wymagany (maksymalnie 500 znaków).' });
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(new Date(dueDate + 'T00:00:00').getTime())) {
        return res.status(400).json({ success: false, error: 'Wybierz prawidłowy termin wykonania.' });
      }
      const users = loadAuthUsers().filter((user) => user.active);
      let assigneeDepartment: string | undefined;
      let assigneeUserId: string | undefined;
      let assigneeName = '';
      if (assigneeType === 'department') {
        assigneeDepartment = req.body?.assigneeDepartment;
        if (!ALLOWED_DEPARTMENTS.includes(assigneeDepartment as AuthDepartmentId)) {
          return res.status(400).json({ success: false, error: 'Wybierz prawidłowy dział odpowiedzialny.' });
        }
        assigneeName = taskDepartmentLabel(assigneeDepartment!);
      } else if (assigneeType === 'person') {
        assigneeUserId = typeof req.body?.assigneeUserId === 'string' ? req.body.assigneeUserId : '';
        const assignee = users.find((user) => user.id === assigneeUserId);
        if (!assignee) return res.status(400).json({ success: false, error: 'Wybierz aktywną osobę odpowiedzialną.' });
        assigneeName = assignee.displayName;
        assigneeDepartment = assignee.departments[0];
      } else {
        return res.status(400).json({ success: false, error: 'Wybierz osobę albo dział odpowiedzialny.' });
      }
      const now = new Date().toISOString();
      const task = {
        id: 'task_' + randomBytes(12).toString('hex'),
        orderId, orderNumber: String(order.orderNumber || ''), projectName: String(order.projectName || ''),
        client: String(order.client || ''), description, assigneeType, assigneeDepartment, assigneeUserId,
        assigneeName, dueDate, status: 'todo', createdByUserId: actor.id, createdByName: actor.displayName,
        createdAt: now, updatedAt: now,
      };
      const tasks = readTasks();
      tasks.push(task);
      saveTasks(tasks);
      return res.status(201).json({ success: true, task });
    } catch (err) {
      console.error('Creating task failed:', err);
      return res.status(500).json({ success: false, error: 'Nie udało się utworzyć zadania.' });
    }
  });

  app.patch('/api/tasks/:taskId', (req: any, res) => {
    try {
      const actor = req.authUser as AuthUser;
      if (!actor.isAdmin && actor.departments.length === 0) {
        return res.status(403).json({ success: false, error: 'Konto tylko do podglądu nie może zmieniać zadań.' });
      }
      const status = req.body?.status;
      if (!['todo', 'in_progress', 'done'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowy status zadania.' });
      }
      const tasks = readTasks();
      const index = tasks.findIndex((task) => task.id === req.params.taskId);
      if (index < 0) return res.status(404).json({ success: false, error: 'Nie znaleziono zadania.' });
      tasks[index] = { ...tasks[index], status, updatedAt: new Date().toISOString() };
      saveTasks(tasks);
      return res.json({ success: true, task: tasks[index] });
    } catch (err) {
      console.error('Updating task failed:', err);
      return res.status(500).json({ success: false, error: 'Nie udało się zmienić statusu zadania.' });
    }
  });

  app.delete('/api/tasks/:taskId', (req: any, res) => {
    try {
      const actor = req.authUser as AuthUser;
      if (!actor.isAdmin && actor.departments.length === 0) {
        return res.status(403).json({ success: false, error: 'Konto tylko do podglądu nie może usuwać zadań.' });
      }
      const tasks = readTasks();
      const task = tasks.find((item) => item.id === req.params.taskId);
      if (!task) return res.status(404).json({ success: false, error: 'Nie znaleziono zadania.' });
      const remaining = tasks.filter((item) => item.id !== task.id);
      saveTasks(remaining);

      return res.json({ success: true });
    } catch (err) {
      console.error('Deleting task failed:', err);
      return res.status(500).json({ success: false, error: 'Nie udało się usunąć zadania.' });
    }
  });

  // 1. Orders API
  app.get('/api/orders', (req, res) => {
    try {
      if (fs.existsSync(ORDERS_FILE)) {
        const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
        const orders = JSON.parse(raw);
        return res.json({ success: true, orders, timestamp: Date.now() });
      }
      return res.json({ success: true, orders: INITIAL_ORDERS, timestamp: Date.now() });
    } catch (err) {
      console.error('Error reading orders file:', err);
      return res.status(500).json({ success: false, error: 'Błąd odczytu zleceń z serwera' });
    }
  });

  app.post('/api/orders', (req, res) => {
    try {
      const { orders, merge, deletedIds, baseOrders } = req.body;
      if (!Array.isArray(orders)) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowy format listy zleceń' });
      }

      // Always merge into the latest server state, including requests from an
      // older frontend. Legacy requests can upsert records, but cannot erase
      // records absent from their stale local snapshot.
      let serverOrders: any[] = INITIAL_ORDERS;
      if (fs.existsSync(ORDERS_FILE)) {
        const raw = fs.readFileSync(ORDERS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) serverOrders = parsed;
      }

      // The server independently checks permissions instead of trusting UI controls.
      const actor = (req as any).authUser as AuthUser;
      const profile = profileForAuthUser(actor);
      const requestedDeletes = merge === true && Array.isArray(deletedIds) ? deletedIds.map((id: any) => String(id)) : [];
      if (requestedDeletes.length > 0 && !profile.canDeleteOrders) {
        return res.status(403).json({ success: false, error: 'Twoje konto nie ma uprawnień do usuwania zleceń.' });
      }
      const bases = new Map<string, any>((Array.isArray(baseOrders) ? baseOrders : []).filter((entry: any) => entry && typeof entry.id === 'string').map((entry: any) => [String(entry.id), entry] as [string, any]));
      const mergedIncoming: any[] = [];
      for (const incoming of orders) {
        if (!incoming || typeof incoming.id !== 'string') {
          return res.status(400).json({ success: false, error: 'Każde zlecenie musi mieć identyfikator.' });
        }
        const existing = serverOrders.find((entry: any) => String(entry.id) === String(incoming.id));
        if (!existing) {
          if (!profile.canCreateOrders) {
            return res.status(403).json({ success: false, error: 'Twoje konto nie ma uprawnień do tworzenia zleceń.' });
          }
          mergedIncoming.push(incoming);
          continue;
        }
        const base = bases.get(String(incoming.id));
        let candidate = incoming;
        if (base) {
          const conflicts: string[] = [];
          candidate = mergeConcurrentValue(base, incoming, existing, '', conflicts);
          if (conflicts.length) {
            return res.status(409).json({ success: false, conflict: true, error: 'Inny użytkownik zmienił te same pola. Odśwież zlecenie i przenieś swoje zmiany ponownie.', orderId: incoming.id, fields: conflicts });
          }
        }
        candidate.updatedAt = new Date().toISOString();
        if (Array.isArray(candidate.items)) candidate.status = calculateOrderStatus(candidate.items);
        const permissionError = orderUpdatePermissionError(existing, candidate, profile);
        if (permissionError) return res.status(403).json({ success: false, error: permissionError });
        mergedIncoming.push(candidate);
      }
      const deleted = new Set(requestedDeletes);
      const ordersToSave = serverOrders.filter((ord: any) => !deleted.has(String(ord.id)));
      mergedIncoming.forEach((incoming: any) => {
        const index = ordersToSave.findIndex((existing: any) => String(existing.id) === String(incoming.id));
        if (index >= 0) ordersToSave[index] = incoming;
        else ordersToSave.push(incoming);
      });

      // Ensure folders exist for changed/new orders.
      mergedIncoming.forEach((ord: any) => {
        if (ord.orderNumber) ensureOrderFolders(ord.orderNumber, ord.projectName);
      });

      writeJsonAtomically(ORDERS_FILE, ordersToSave);
      currentOrders = ordersToSave;


      return res.json({ success: true, count: ordersToSave.length, orders: ordersToSave, timestamp: Date.now() });
    } catch (err) {
      console.error('Error writing orders file:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu zleceń na serwerze' });
    }
  });

  // 2.5. Shared SN switchgear inventory API. Records are independent stock/inventory rows,
  // while order links are entered in the Nr zamówienia / Projekt fields.
  app.get('/api/sn-switchgear', (_req, res) => {
    try {
      const raw = fs.readFileSync(SN_SWITCHGEAR_FILE, 'utf-8');
      const records = JSON.parse(raw);
      if (!Array.isArray(records)) return res.status(500).json({ success: false, error: 'Nieprawidłowy format zestawienia rozdzielnic SN' });
      return res.json({ success: true, records, timestamp: Date.now() });
    } catch (err) {
      console.error('Error reading SN switchgear inventory:', err);
      return res.status(500).json({ success: false, error: 'Błąd odczytu zestawienia rozdzielnic SN' });
    }
  });

  app.post('/api/sn-switchgear', requireItemPermission('ROZDZIELNICA_SN'), (req, res) => {
    try {
      const incoming = req.body?.records;
      const deletedIds = Array.isArray(req.body?.deletedIds) ? req.body.deletedIds.map((id: any) => String(id)) : [];
      if (!Array.isArray(incoming)) return res.status(400).json({ success: false, error: 'Nieprawidłowy format rekordów SN' });
      const raw = fs.readFileSync(SN_SWITCHGEAR_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const current: any[] = Array.isArray(parsed) ? parsed : [];
      const deleted = new Set(deletedIds);
      const merged = current.filter((record: any) => !deleted.has(String(record.id)));
      incoming.forEach((record: any) => {
        if (!record || !record.id) return;
        const normalized = {
          ...record,
          id: String(record.id),
          type: ['SIEMENS', 'XIRIA', 'RM_AIRSET', 'RM_AIRSET_STOEN'].includes(record.type) ? record.type : 'RM_AIRSET',
          category: ['DELIVERED', 'TO_DELIVER', 'WAREHOUSE'].includes(record.category) ? record.category : 'TO_DELIVER',
          ilosc: Math.max(0, Number(record.ilosc) || 0),
        };
        const index = merged.findIndex((existing: any) => String(existing.id) === normalized.id);
        if (index >= 0) merged[index] = normalized;
        else merged.push(normalized);
      });
      writeJsonAtomically(SN_SWITCHGEAR_FILE, merged);
      return res.json({ success: true, records: merged, timestamp: Date.now() });
    } catch (err) {
      console.error('Error saving SN switchgear inventory:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu zestawienia rozdzielnic SN' });
    }
  });

  // 3. Door Orders API
  app.get('/api/door-orders', (req, res) => {
    try {
      if (fs.existsSync(DOORS_FILE)) {
        const raw = fs.readFileSync(DOORS_FILE, 'utf-8');
        const doorOrders = JSON.parse(raw);
        return res.json({ success: true, doorOrders, timestamp: Date.now() });
      }
      return res.json({ success: true, doorOrders: INITIAL_DOOR_ORDERS, timestamp: Date.now() });
    } catch (err) {
      console.error('Error reading door orders file:', err);
      return res.status(500).json({ success: false, error: 'Błąd odczytu zamówień drzwi z serwera' });
    }
  });

  app.post('/api/door-orders', requireCapability('canManageDoors'), (req, res) => {
    try {
      const { doorOrders, merge, deletedIds, baseDoorOrders } = req.body;
      if (!Array.isArray(doorOrders)) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowy format zamówień drzwi' });
      }

      // Merge into the latest server state so stale clients cannot erase other
      // users' records merely by posting an older full list.
      let serverDoorOrders: any[] = INITIAL_DOOR_ORDERS;
      if (fs.existsSync(DOORS_FILE)) {
        const raw = fs.readFileSync(DOORS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) serverDoorOrders = parsed;
      }
      const bases = new Map<string, any>((Array.isArray(baseDoorOrders) ? baseDoorOrders : []).filter((entry: any) => entry && typeof entry.id === 'string').map((entry: any) => [String(entry.id), entry] as [string, any]));
      const mergedIncoming: any[] = [];
      for (const incoming of doorOrders) {
        if (!incoming || typeof incoming.id !== 'string') return res.status(400).json({ success: false, error: 'Każde zamówienie drzwi musi mieć identyfikator.' });
        const existing = serverDoorOrders.find((entry: any) => String(entry.id) === String(incoming.id));
        if (!existing) { mergedIncoming.push(incoming); continue; }
        const base = bases.get(String(incoming.id));
        if (base) {
          const conflicts: string[] = [];
          const candidate = mergeConcurrentValue(base, incoming, existing, 'doorOrder', conflicts);
          if (conflicts.length) return res.status(409).json({ success: false, conflict: true, error: 'Inny użytkownik zmienił te same pola w zamówieniu drzwi. Odśwież rekord i przenieś swoje zmiany ponownie.', orderId: incoming.id, fields: conflicts });
          candidate.updatedAt = new Date().toISOString();
          mergedIncoming.push(candidate);
        } else mergedIncoming.push(incoming);
      }
      const deleted = new Set(merge === true && Array.isArray(deletedIds) ? deletedIds.map((id: any) => String(id)) : []);
      const doorOrdersToSave = serverDoorOrders.filter((ord: any) => !deleted.has(String(ord.id)));
      mergedIncoming.forEach((incoming: any) => {
        const index = doorOrdersToSave.findIndex((existing: any) => String(existing.id) === String(incoming.id));
        if (index >= 0) doorOrdersToSave[index] = incoming;
        else doorOrdersToSave.push(incoming);
      });

      writeJsonAtomically(DOORS_FILE, doorOrdersToSave);

      return res.json({ success: true, count: doorOrdersToSave.length, doorOrders: doorOrdersToSave, timestamp: Date.now() });
    } catch (err) {
      console.error('Error writing door orders file:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu zamówień drzwi na serwerze' });
    }
  });

  // Shared door hardware catalogue. Saving replaces the current catalogue with the edited list.
  app.get('/api/door-catalog', (_req, res) => {
    try {
      const raw = fs.readFileSync(DOOR_CATALOG_FILE, 'utf-8');
      const variants = JSON.parse(raw);
      if (!Array.isArray(variants)) return res.status(500).json({ success: false, error: 'Nieprawidłowy format katalogu ślusarki' });
      return res.json({ success: true, variants, timestamp: Date.now() });
    } catch (err) {
      console.error('Error reading door hardware catalogue:', err);
      return res.status(500).json({ success: false, error: 'Błąd odczytu katalogu ślusarki' });
    }
  });

  app.post('/api/door-catalog', requireCapability('canManageDoors'), (req, res) => {
    try {
      const { variants } = req.body || {};
      if (!Array.isArray(variants) || variants.some((item: any) =>
        !item || typeof item.id !== 'string' || typeof item.grupa !== 'string' ||
        !['NZ', 'NZ — rama BEK', 'BEK'].includes(item.grupa)
      )) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowe dane katalogu ślusarki' });
      }
      const ids = new Set<string>();
      for (const item of variants) {
        if (ids.has(item.id)) return res.status(400).json({ success: false, error: 'Każda kombinacja musi mieć unikalny identyfikator' });
        ids.add(item.id);
      }
      writeJsonAtomically(DOOR_CATALOG_FILE, variants);
      return res.json({ success: true, variants, timestamp: Date.now() });
    } catch (err) {
      console.error('Error saving door hardware catalogue:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu katalogu ślusarki' });
    }
  });

  // Shared SN manufacturer/model catalogue. Additions persist in DATA_DIR/sn_catalog.json.
  app.get('/api/sn-catalog', (_req, res) => {
    try {
      const parsed = JSON.parse(fs.readFileSync(SN_CATALOG_FILE, 'utf-8'));
      const producers = Array.isArray(parsed?.producers) ? parsed.producers.filter((value: unknown) => typeof value === 'string') : INITIAL_SN_CATALOG.producers;
      const modelsByProducer = parsed?.modelsByProducer && typeof parsed.modelsByProducer === 'object' ? parsed.modelsByProducer : INITIAL_SN_CATALOG.modelsByProducer;
      return res.json({ success: true, producers, modelsByProducer, timestamp: Date.now() });
    } catch (err) {
      console.error('Error reading SN catalogue:', err);
      return res.status(500).json({ success: false, error: 'Błąd odczytu katalogu producentów i modeli SN' });
    }
  });

  app.post('/api/sn-catalog', requireItemPermission('ROZDZIELNICA_SN'), (req, res) => {
    try {
      const action = typeof req.body?.action === 'string' ? req.body.action : 'add';
      const producer = typeof req.body?.producer === 'string' ? req.body.producer.trim() : '';
      const model = typeof req.body?.model === 'string' ? req.body.model.trim() : '';
      if (action === 'replaceCatalog') {
        const incoming = req.body?.catalog;
        if (!incoming || !Array.isArray(incoming.producers) || !incoming.modelsByProducer || typeof incoming.modelsByProducer !== 'object' || Array.isArray(incoming.modelsByProducer)) {
          return res.status(400).json({ success: false, error: 'Słownik SN musi zawierać listę producers oraz obiekt modelsByProducer.' });
        }
        const producers = incoming.producers.map((value: unknown) => typeof value === 'string' ? value.trim() : '').filter((value: string) => value.length > 0);
        if (producers.length !== incoming.producers.length || producers.some((value: string) => value.length > 120) ||
            new Set(producers.map((value: string) => value.toLocaleLowerCase('pl'))).size !== producers.length) {
          return res.status(400).json({ success: false, error: 'Nazwy producentów muszą być niepuste i unikalne (maks. 120 znaków).' });
        }
        const modelsByProducer: Record<string, string[]> = {};
        for (const name of producers) {
          const models = incoming.modelsByProducer[name];
          if (models !== undefined && !Array.isArray(models)) return res.status(400).json({ success: false, error: `Modele producenta ${name} muszą być listą.` });
          const cleaned = (Array.isArray(models) ? models : []).map((value: unknown) => typeof value === 'string' ? value.trim() : '');
          if (cleaned.some((value: string) => !value || value.length > 120) ||
              new Set(cleaned.map((value: string) => value.toLocaleLowerCase('pl'))).size !== cleaned.length) {
            return res.status(400).json({ success: false, error: `Modele producenta ${name} muszą być niepuste i unikalne (maks. 120 znaków).` });
          }
          modelsByProducer[name] = cleaned;
        }
        const catalog = { producers: [...producers].sort((a: string, b: string) => a.localeCompare(b, 'pl', { sensitivity: 'base' })), modelsByProducer };
        writeJsonAtomically(SN_CATALOG_FILE, catalog);
        return res.json({ success: true, ...catalog, timestamp: Date.now() });
      }
      if (!producer || producer.length > 120 || (model && model.length > 120)) {
        return res.status(400).json({ success: false, error: 'Podaj poprawną nazwę producenta i opcjonalnie modelu (maks. 120 znaków).' });
      }
      const parsed = JSON.parse(fs.readFileSync(SN_CATALOG_FILE, 'utf-8'));
      const catalog = {
        producers: Array.isArray(parsed?.producers) ? parsed.producers.filter((value: unknown) => typeof value === 'string') as string[] : [...INITIAL_SN_CATALOG.producers],
        modelsByProducer: parsed?.modelsByProducer && typeof parsed.modelsByProducer === 'object' ? parsed.modelsByProducer as Record<string, string[]> : { ...INITIAL_SN_CATALOG.modelsByProducer },
      };
      const canonicalProducer = catalog.producers.find(value => value.toLocaleLowerCase('pl') === producer.toLocaleLowerCase('pl')) || producer;

      if (action === 'removeProducer') {
        const existingProducer = catalog.producers.find(value => value.toLocaleLowerCase('pl') === producer.toLocaleLowerCase('pl'));
        if (!existingProducer) return res.status(404).json({ success: false, error: 'Nie znaleziono producenta w słowniku.' });
        catalog.producers = catalog.producers.filter(value => value !== existingProducer);
        delete catalog.modelsByProducer[existingProducer];
      } else if (action === 'removeModel') {
        const existingProducer = catalog.producers.find(value => value.toLocaleLowerCase('pl') === producer.toLocaleLowerCase('pl'));
        if (!existingProducer) return res.status(404).json({ success: false, error: 'Nie znaleziono producenta w słowniku.' });
        const models = Array.isArray(catalog.modelsByProducer[existingProducer]) ? catalog.modelsByProducer[existingProducer] : [];
        const existingModel = models.find(value => value.toLocaleLowerCase('pl') === model.toLocaleLowerCase('pl'));
        if (!model || !existingModel) return res.status(404).json({ success: false, error: 'Nie znaleziono modelu w słowniku.' });
        catalog.modelsByProducer[existingProducer] = models.filter(value => value !== existingModel);
      } else if (action === 'addProducer' || action === 'addModel' || action === 'add') {
        const existingProducer = catalog.producers.find(value => value.toLocaleLowerCase('pl') === producer.toLocaleLowerCase('pl'));
        const finalProducer = existingProducer || producer;
        if (!existingProducer) catalog.producers.push(producer);
        if (!Array.isArray(catalog.modelsByProducer[finalProducer])) catalog.modelsByProducer[finalProducer] = [];
        if (model && !catalog.modelsByProducer[finalProducer].some(value => value.toLocaleLowerCase('pl') === model.toLocaleLowerCase('pl'))) {
          catalog.modelsByProducer[finalProducer].push(model);
        }
      } else {
        return res.status(400).json({ success: false, error: 'Nieznana operacja słownika SN.' });
      }

      catalog.producers.sort((a, b) => a.localeCompare(b, 'pl', { sensitivity: 'base' }));
      for (const key of Object.keys(catalog.modelsByProducer)) {
        catalog.modelsByProducer[key] = Array.isArray(catalog.modelsByProducer[key])
          ? Array.from(new Set(catalog.modelsByProducer[key].filter(value => typeof value === 'string' && value.trim()).map(value => value.trim())))
          : [];
      }
      writeJsonAtomically(SN_CATALOG_FILE, catalog);
      return res.json({ success: true, ...catalog, timestamp: Date.now() });
    } catch (err) {
      console.error('Error saving SN catalogue:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu katalogu producentów i modeli SN' });
    }
  });

  // Shared custom enclosure-size catalogue. Changes reach other screens only on their next manual refresh.
  app.get('/api/obudowa-variants', (_req, res) => {
    try {
      const raw = fs.readFileSync(OBUDOWA_VARIANTS_FILE, 'utf-8');
      const variants = JSON.parse(raw);
      if (!Array.isArray(variants)) {
        return res.status(500).json({ success: false, error: 'Nieprawidłowy format katalogu rozmiarów obudów' });
      }
      return res.json({ success: true, variants, timestamp: Date.now() });
    } catch (err) {
      console.error('Error reading shared enclosure sizes:', err);
      return res.status(500).json({ success: false, error: 'Błąd odczytu katalogu rozmiarów obudów' });
    }
  });

  app.post('/api/obudowa-variants', requireItemPermission('OBUDOWA'), (req, res) => {
    try {
      if (Array.isArray(req.body?.variants)) {
        const variants = req.body.variants;
        const ids = new Set<string>();
        for (const variant of variants) {
          if (!variant || typeof variant.id !== 'string' || !variant.id.trim() ||
              !['BEK', 'NZ'].includes(variant.type) || typeof variant.name !== 'string' || !variant.name.trim() ||
              !Number.isFinite(Number(variant.width)) || Number(variant.width) <= 0 ||
              !Number.isFinite(Number(variant.depth)) || Number(variant.depth) <= 0 ||
              !Number.isFinite(Number(variant.height)) || Number(variant.height) <= 0) {
            return res.status(400).json({ success: false, error: 'Nieprawidłowe dane wariantów obudów. Każdy rekord wymaga id, typu BEK/NZ, nazwy oraz poprawnych wymiarów.' });
          }
          if (ids.has(variant.id)) return res.status(400).json({ success: false, error: 'Identyfikatory wariantów obudów muszą być unikalne.' });
          ids.add(variant.id);
        }
        const normalized = variants.map((variant: any) => ({
          ...variant,
          id: String(variant.id),
          name: String(variant.name).trim(),
          width: Number(variant.width),
          depth: Number(variant.depth),
          height: Number(variant.height),
          isCustom: true,
        }));
        writeJsonAtomically(OBUDOWA_VARIANTS_FILE, normalized);
        return res.json({ success: true, variants: normalized, timestamp: Date.now() });
      }
      const incoming = req.body?.variant;
      const type = incoming?.type;
      const name = typeof incoming?.name === 'string' ? incoming.name.trim() : '';
      const width = Number(incoming?.width);
      const depth = Number(incoming?.depth);
      const height = Number(incoming?.height);

      if (
        !incoming ||
        (type !== 'BEK' && type !== 'NZ') ||
        !name ||
        !Number.isFinite(width) || width <= 0 ||
        !Number.isFinite(depth) || depth <= 0 ||
        !Number.isFinite(height) || height <= 0
      ) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowe dane niestandardowego rozmiaru obudowy' });
      }

      const raw = fs.readFileSync(OBUDOWA_VARIANTS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      const variants: any[] = Array.isArray(parsed) ? parsed : [];
      const normalized = {
        ...incoming,
        id: String(incoming.id || `custom_${type.toLowerCase()}_${Date.now()}`),
        type,
        name,
        width,
        depth,
        height,
        isCustom: true,
      };
      const index = variants.findIndex((variant: any) =>
        variant.type === type && String(variant.name).toLocaleLowerCase() === name.toLocaleLowerCase()
      );
      if (index >= 0) variants[index] = normalized;
      else variants.push(normalized);

      writeJsonAtomically(OBUDOWA_VARIANTS_FILE, variants);
      return res.json({ success: true, variants, timestamp: Date.now() });
    } catch (err) {
      console.error('Error saving shared enclosure size:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu katalogu rozmiarów obudów' });
    }
  });

  // 4. File and Folder Management API
  // Get all folders and physical files for a given order
  app.get('/api/files/folders', (req, res) => {
    try {
      const orderNumber = String(req.query.orderNumber || '').trim();
      if (!orderNumber) {
        return res.status(400).json({ success: false, error: 'Brak numeru zlecenia' });
      }

      const safeOrder = sanitizePath(orderNumber);
      const orderDir = ensureOrderFolders(safeOrder);

      const items = fs.readdirSync(orderDir, { withFileTypes: true });
      const folderList = [];

      for (const item of items) {
        if (item.isDirectory()) {
          const folderKey = item.name;
          const subDirPath = path.join(orderDir, folderKey);
          const subFiles = fs.readdirSync(subDirPath, { withFileTypes: true });

          const fileEntries = [];
          let totalBytes = 0;

          for (const f of subFiles) {
            if (f.isFile() && !f.name.startsWith('.')) {
              const fullFPath = path.join(subDirPath, f.name);
              const stat = fs.statSync(fullFPath);
              totalBytes += stat.size;

              fileEntries.push({
                name: f.name,
                sizeBytes: stat.size,
                formattedSize: formatBytes(stat.size),
                mtime: stat.mtime.toISOString(),
                uploadedAt: stat.mtime.toISOString().split('T')[0],
                folderKey,
                diskPath: `data_store/uploads/${safeOrder}/${folderKey}/${f.name}`,
                downloadUrl: `/api/files/download?orderNumber=${encodeURIComponent(
                  safeOrder
                )}&folderKey=${encodeURIComponent(folderKey)}&fileName=${encodeURIComponent(f.name)}`,
              });
            }
          }

          // Match label from standard definitions or format nicely
          const standardDef = STANDARD_STATION_FOLDERS.find((s) => s.key === folderKey);
          folderList.push({
            folderKey,
            label: standardDef ? standardDef.label : folderKey.replace(/_/g, ' '),
            diskPath: `data_store/uploads/${safeOrder}/${folderKey}`,
            filesCount: fileEntries.length,
            totalSizeBytes: totalBytes,
            totalSizeFormatted: formatBytes(totalBytes),
            files: fileEntries,
          });
        }
      }

      // Sort folders according to numerical prefix
      folderList.sort((a, b) => a.folderKey.localeCompare(b.folderKey));

      return res.json({
        success: true,
        orderNumber: safeOrder,
        rootDiskPath: `data_store/uploads/${safeOrder}/`,
        foldersCount: folderList.length,
        totalFilesCount: folderList.reduce((acc, f) => acc + f.filesCount, 0),
        folders: folderList,
      });
    } catch (err) {
      console.error('Error fetching folders:', err);
      return res.status(500).json({ success: false, error: 'Błąd odczytu struktury folderów' });
    }
  });

  // Upload file into a specific folder location on server disk
  app.post('/api/files/upload', requireFileFolderPermission, (req, res) => {
    try {
      const { orderNumber, folderKey, fileName, base64Data, uploadedBy } = req.body;

      if (!orderNumber || !fileName || !base64Data) {
        return res.status(400).json({
          success: false,
          error: 'Wymagane parametry: orderNumber, fileName, base64Data',
        });
      }

      const safeOrder = sanitizePath(orderNumber);
      const safeFolderKey = sanitizePath(folderKey || '13_Inne_i_Dodatkowe');
      const safeFileName = sanitizePath(fileName);

      const targetDir = path.join(UPLOADS_DIR, safeOrder, safeFolderKey);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Strip potential data URL prefix if present
      let cleanBase64 = base64Data;
      const commaIdx = cleanBase64.indexOf(',');
      if (cleanBase64.startsWith('data:') && commaIdx !== -1) {
        cleanBase64 = cleanBase64.slice(commaIdx + 1);
      }

      const buffer = Buffer.from(cleanBase64, 'base64');
      const targetFilePath = path.join(targetDir, safeFileName);
      fs.writeFileSync(targetFilePath, buffer);

      const stat = fs.statSync(targetFilePath);
      const ext = safeFileName.split('.').pop()?.toLowerCase() || 'plik';
      const formattedSize = formatBytes(stat.size);

      const attachment = {
        id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: safeFileName,
        size: formattedSize,
        uploadedAt: new Date().toISOString().split('T')[0],
        fileType: ext,
        folderCategory: safeFolderKey,
        folderPath: `${safeOrder}/${safeFolderKey}`,
        diskPath: `data_store/uploads/${safeOrder}/${safeFolderKey}/${safeFileName}`,
        url: `/api/files/download?orderNumber=${encodeURIComponent(
          safeOrder
        )}&folderKey=${encodeURIComponent(safeFolderKey)}&fileName=${encodeURIComponent(safeFileName)}`,
        uploadedBy: uploadedBy || 'Użytkownik',
      };

      console.log(`[ENCO FLOW] File uploaded to: ${targetFilePath} (${formattedSize})`);

      return res.json({
        success: true,
        attachment,
        message: `Plik pomyślnie zapisany w lokalizacji: data_store/uploads/${safeOrder}/${safeFolderKey}/${safeFileName}`,
      });
    } catch (err) {
      console.error('Error saving file:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu pliku na serwerze' });
    }
  });

  // Download / view a file from structured storage
  app.get('/api/files/download', requireCapability('canDownload'), (req, res) => {
    try {
      const orderNumber = sanitizePath(String(req.query.orderNumber || ''));
      const folderKey = sanitizePath(String(req.query.folderKey || ''));
      const fileName = sanitizePath(String(req.query.fileName || ''));

      if (!orderNumber || !fileName) {
        return res.status(400).send('Nieprawidłowe zapytanie pliku.');
      }

      const safeFolder = folderKey || '13_Inne_i_Dodatkowe';
      const filePath = path.resolve(UPLOADS_DIR, orderNumber, safeFolder, fileName);

      // Prevent directory traversal attacks
      if (!filePath.startsWith(UPLOADS_DIR)) {
        return res.status(403).send('Brak uprawnień dostępu do podanej ścieżki.');
      }

      if (!fs.existsSync(filePath)) {
        return res.status(404).send('Plik nie istnieje w repozytorium.');
      }

      const ext = fileName.split('.').pop()?.toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === 'pdf') contentType = 'application/pdf';
      else if (ext === 'png') contentType = 'image/png';
      else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
      else if (ext === 'svg') contentType = 'image/svg+xml';
      else if (ext === 'txt') contentType = 'text/plain; charset=utf-8';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      return res.sendFile(filePath);
    } catch (err) {
      console.error('Error downloading file:', err);
      return res.status(500).send('Błąd serwera podczas pobierania pliku.');
    }
  });

  // Delete file from disk
  app.delete('/api/files', requireFileFolderPermission, (req, res) => {
    try {
      const orderNumber = sanitizePath(String(req.query.orderNumber || req.body.orderNumber || ''));
      const folderKey = sanitizePath(String(req.query.folderKey || req.body.folderKey || ''));
      const fileName = sanitizePath(String(req.query.fileName || req.body.fileName || ''));

      if (!orderNumber || !fileName) {
        return res.status(400).json({ success: false, error: 'Wymagane parametry pliku' });
      }

      const filePath = path.resolve(UPLOADS_DIR, orderNumber, folderKey || '13_Inne_i_Dodatkowe', fileName);
      if (!filePath.startsWith(UPLOADS_DIR)) {
        return res.status(403).json({ success: false, error: 'Niedozwolona ścieżka' });
      }

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[ENCO FLOW] File deleted: ${filePath}`);
      }

      return res.json({ success: true, message: 'Plik usunięty z dysku.' });
    } catch (err) {
      console.error('Error deleting file:', err);
      return res.status(500).json({ success: false, error: 'Błąd usuwania pliku' });
    }
  });

  // Create custom folder for order
  app.post('/api/files/create-folder', requireCapability('canDownload'), (req, res) => {
    try {
      const { orderNumber, folderName } = req.body;
      if (!orderNumber || !folderName) {
        return res.status(400).json({ success: false, error: 'Brak nazwy folderu lub zlecenia' });
      }

      const safeOrder = sanitizePath(orderNumber);
      const safeFolder = sanitizePath(folderName);
      const targetDir = path.join(UPLOADS_DIR, safeOrder, safeFolder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      return res.json({
        success: true,
        folderKey: safeFolder,
        diskPath: `data_store/uploads/${safeOrder}/${safeFolder}`,
      });
    } catch (err) {
      console.error('Error creating folder:', err);
      return res.status(500).json({ success: false, error: 'Błąd tworzenia folderu' });
    }
  });

  // 5. Reset to Demo Data
  app.post('/api/reset-data', requireCapability('canResetDemo'), (req, res) => {
    try {
      writeJsonAtomically(ORDERS_FILE, INITIAL_ORDERS);
      writeJsonAtomically(DOORS_FILE, INITIAL_DOOR_ORDERS);

      currentOrders = INITIAL_ORDERS;
      initAllFoldersAndSeedFiles();


      return res.json({ success: true, orders: INITIAL_ORDERS, doorOrders: INITIAL_DOOR_ORDERS });
    } catch (err) {
      console.error('Error resetting demo data:', err);
      return res.status(500).json({ success: false, error: 'Błąd resetowania danych' });
    }
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      storageUploadsDir: 'data_store/uploads',
      timestamp: Date.now(),
    });
  });

  // Serve Frontend
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ENCO FLOW] Server running on http://0.0.0.0:${PORT} with persistent structured file storage`);
  });
}

startServer().catch((err) => {
  console.error('[ENCO FLOW] Failed to start server:', err);
  process.exit(1);
});
