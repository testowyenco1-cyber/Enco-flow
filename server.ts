import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { INITIAL_ORDERS } from './src/data/mockData';
import { INITIAL_DOOR_ORDERS } from './src/data/mockDoorOrders';

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
  const DATA_DIR = path.resolve(__dirname, 'data_store');
  const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
  const DOORS_FILE = path.join(DATA_DIR, 'door_orders.json');

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
              item.type === 'ZLECENIE_MONTAZU'
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
  app.use('/uploads', express.static(UPLOADS_DIR));

  // SSE (Server-Sent Events) clients for real-time live synchronization
  let sseClients: { id: number; res: express.Response }[] = [];
  let nextClientId = 1;

  // Automatyczne powiadomienia SSE są celowo wyłączone.
  // Pozostali użytkownicy nie otrzymują zmian ani sygnałów resetowania na żywo.
  function broadcastSSE(_type: 'orders' | 'doorOrders' | 'reset', _data: any, _originId?: string) {
    // Intentionally disabled: each user refreshes data only through their own actions.
  }

  // 1. SSE Stream for Real-time Synchronization across all connected browsers
  app.get('/api/realtime/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const clientId = nextClientId++;
    sseClients.push({ id: clientId, res });

    // Send initial handshake ping
    res.write(`data: ${JSON.stringify({ type: 'connected', clientId, timestamp: Date.now() })}\n\n`);

    // Keepalive heartbeat every 20 seconds
    const heartbeat = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch (e) {
        clearInterval(heartbeat);
      }
    }, 20000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients = sseClients.filter((c) => c.id !== clientId);
    });
  });

  // 2. Orders API
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
      const { orders, originId, merge, deletedIds } = req.body;
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
      const deleted = new Set(merge === true && Array.isArray(deletedIds) ? deletedIds.map((id: any) => String(id)) : []);
      const ordersToSave = serverOrders.filter((ord: any) => !deleted.has(String(ord.id)));
      orders.forEach((incoming: any) => {
        const index = ordersToSave.findIndex((existing: any) => String(existing.id) === String(incoming.id));
        if (index >= 0) ordersToSave[index] = incoming;
        else ordersToSave.push(incoming);
      });

      // Ensure folders exist for changed/new orders.
      orders.forEach((ord: any) => {
        if (ord.orderNumber) ensureOrderFolders(ord.orderNumber, ord.projectName);
      });

      fs.writeFileSync(ORDERS_FILE, JSON.stringify(ordersToSave, null, 2), 'utf-8');
      currentOrders = ordersToSave;
      broadcastSSE('orders', ordersToSave, originId);

      return res.json({ success: true, count: ordersToSave.length, timestamp: Date.now() });
    } catch (err) {
      console.error('Error writing orders file:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu zleceń na serwerze' });
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

  app.post('/api/door-orders', (req, res) => {
    try {
      const { doorOrders, originId, merge, deletedIds } = req.body;
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
      const deleted = new Set(merge === true && Array.isArray(deletedIds) ? deletedIds.map((id: any) => String(id)) : []);
      const doorOrdersToSave = serverDoorOrders.filter((ord: any) => !deleted.has(String(ord.id)));
      doorOrders.forEach((incoming: any) => {
        const index = doorOrdersToSave.findIndex((existing: any) => String(existing.id) === String(incoming.id));
        if (index >= 0) doorOrdersToSave[index] = incoming;
        else doorOrdersToSave.push(incoming);
      });

      fs.writeFileSync(DOORS_FILE, JSON.stringify(doorOrdersToSave, null, 2), 'utf-8');
      broadcastSSE('doorOrders', doorOrdersToSave, originId);

      return res.json({ success: true, count: doorOrdersToSave.length, timestamp: Date.now() });
    } catch (err) {
      console.error('Error writing door orders file:', err);
      return res.status(500).json({ success: false, error: 'Błąd zapisu zamówień drzwi na serwerze' });
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
  app.post('/api/files/upload', (req, res) => {
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
  app.get('/api/files/download', (req, res) => {
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
  app.delete('/api/files', (req, res) => {
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
  app.post('/api/files/create-folder', (req, res) => {
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
  app.post('/api/reset-data', (req, res) => {
    try {
      fs.writeFileSync(ORDERS_FILE, JSON.stringify(INITIAL_ORDERS, null, 2), 'utf-8');
      fs.writeFileSync(DOORS_FILE, JSON.stringify(INITIAL_DOOR_ORDERS, null, 2), 'utf-8');

      currentOrders = INITIAL_ORDERS;
      initAllFoldersAndSeedFiles();

      broadcastSSE('orders', INITIAL_ORDERS);
      broadcastSSE('doorOrders', INITIAL_DOOR_ORDERS);
      broadcastSSE('reset', {});

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
      activeSseConnections: sseClients.length,
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
