import { Order, OrderItem, calculateOrderStatus, Attachment, DoorOrder, ITEM_DEFINITIONS } from '../types/enco';
import { INITIAL_ORDERS, createDefaultItemsForOrder } from '../data/mockData';
import { normalizeOrderNumber } from '../utils/orderNumberUtils';
import { INITIAL_DOOR_ORDERS } from '../data/mockDoorOrders';

const STORAGE_KEY = 'enco_flow_orders_v8';
const PREV_STORAGE_KEY = 'enco_flow_orders_v7';
const DOOR_STORAGE_KEY = 'enco_flow_door_orders_v2';
const PREV_DOOR_STORAGE_KEY = 'enco_flow_door_orders_v1';
const SERVER_ORDERS_SNAPSHOT_KEY = 'enco_flow_server_snapshot_orders_v1';
const SERVER_DOOR_SNAPSHOT_KEY = 'enco_flow_server_snapshot_doors_v1';

// Keep the last server version locally. It is a baseline for sending only this
// browser's changed records, instead of replacing the shared server list.
function readSnapshot<T>(key: string): T[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as T[] : null;
  } catch {
    return null;
  }
}

function writeSnapshot<T>(key: string, values: T[]): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(values));
  } catch (err) {
    console.error('Failed to save server snapshot:', err);
  }
}

// Called by App.tsx only after verifying that the response belongs to the latest refresh.
export function setServerOrdersSnapshot(orders: Order[]): void {
  writeSnapshot(SERVER_ORDERS_SNAPSHOT_KEY, orders);
}

export function setServerDoorOrdersSnapshot(doorOrders: DoorOrder[]): void {
  writeSnapshot(SERVER_DOOR_SNAPSHOT_KEY, doorOrders);
}

function getPendingChanges<T>(current: T[], snapshot: T[] | null): { changed: T[]; deletedIds: string[] } {
  // If the initial server read failed, upsert records but never infer deletions
  // from an incomplete local cache.
  if (!snapshot) return { changed: current, deletedIds: [] };
  const previousById = new Map<string, T>(snapshot.map((entry: any) => [String(entry.id), entry as T] as [string, T]));
  const currentIds = new Set(current.map((entry: any) => String(entry.id)));
  const changed = current.filter((entry: any) => {
    const previous = previousById.get(String(entry.id));
    return !previous || JSON.stringify(previous) !== JSON.stringify(entry);
  });
  const deletedIds = snapshot
    .filter((entry: any) => !currentIds.has(String(entry.id)))
    .map((entry: any) => String((entry as any).id));
  return { changed, deletedIds };
}

function applyLocalDiffToBaseline(base: any, incoming: any): any {
  const equal = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
  if (equal(base, incoming)) return base;
  const isObject = (value: any) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (isObject(base) && isObject(incoming)) {
    const next: Record<string, any> = { ...base };
    for (const key of new Set([...Object.keys(base), ...Object.keys(incoming)])) {
      const hasBase = Object.prototype.hasOwnProperty.call(base, key);
      const hasIncoming = Object.prototype.hasOwnProperty.call(incoming, key);
      if (hasBase && !hasIncoming) delete next[key];
      else if (!hasBase && hasIncoming) next[key] = incoming[key];
      else next[key] = applyLocalDiffToBaseline(base[key], incoming[key]);
    }
    return next;
  }
  const keyedArray = (value: any) => Array.isArray(value) && value.every((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string');
  if (keyedArray(base) && keyedArray(incoming)) {
    const next = new Map<string, any>(base.map((entry: any) => [entry.id, entry] as [string, any]));
    const incomingMap = new Map<string, any>(incoming.map((entry: any) => [entry.id, entry] as [string, any]));
    for (const id of new Set([...next.keys(), ...incomingMap.keys()])) {
      const previous = next.get(id);
      const current = incomingMap.get(id);
      if (previous && !current) next.delete(id);
      else if (!previous && current) next.set(id, current);
      else if (previous && current) next.set(id, applyLocalDiffToBaseline(previous, current));
    }
    return Array.from(next.values());
  }
  return incoming;
}

function applySavedChangesToSnapshot<T>(snapshotKey: string, changed: T[], deletedIds: string[]): void {
  // Patch only records confirmed by this save. This preserves local baseline
  // changes from other saves that may finish while this request is in flight.
  const snapshot = readSnapshot<T>(snapshotKey) || [];
  const deleted = new Set(deletedIds.map(String));
  const next = snapshot.filter((entry: any) => !deleted.has(String(entry.id)));

  changed.forEach((incoming: any) => {
    const index = next.findIndex((existing: any) => String(existing.id) === String(incoming.id));
    if (index >= 0) next[index] = incoming;
    else next.push(incoming);
  });

  writeSnapshot(snapshotKey, next);
}

function hasPendingChanges<T>(current: T[], snapshotKey: string): boolean {
  const snapshot = readSnapshot<T>(snapshotKey);
  if (!snapshot) return true;
  const pending = getPendingChanges(current, snapshot);
  return pending.changed.length > 0 || pending.deletedIds.length > 0;
}

export function hasPendingOrderChanges(orders: Order[]): boolean {
  return hasPendingChanges(orders, SERVER_ORDERS_SNAPSHOT_KEY);
}

export function hasPendingDoorOrderChanges(doorOrders: DoorOrder[]): boolean {
  return hasPendingChanges(doorOrders, SERVER_DOOR_SNAPSHOT_KEY);
}

/**
 * Sanitize and migrate orders array ensuring all fields and item structures are valid
 */
export function sanitizeOrders(parsed: any[]): Order[] {
  if (!Array.isArray(parsed)) {
    return INITIAL_ORDERS;
  }
  // Permanently exclude the original demo stations from the application.
  const demoOrderIds = new Set(['ord_zl1', 'ord_zl2', 'ord_zl3', 'ord_zl4', 'ord_zl5', 'ord_zl6']);
  parsed = parsed.filter((order: any) => !demoOrderIds.has(String(order?.id)) && !/^ZL[1-6]$/.test(String(order?.orderNumber || '').trim()));
  // An empty server array is valid state; do not replace it with demo orders.
  if (parsed.length === 0) return [];

  const validItemStatuses: Set<string> = new Set([
    'NOT_ORDERED',
    'ORDERED',
    'IN_PROGRESS',
    'READY',
    'PROBLEM',
    'NOT_APPLICABLE',
  ]);

  return parsed.map((ord) => {
    const safeItems = Array.isArray(ord.items) ? ord.items : [];
    const sanitizedItems = safeItems.map((it: any) => {
      let safeStatus: any = it.status;
      if (!validItemStatuses.has(safeStatus)) {
        safeStatus = 'NOT_ORDERED';
      }

      let safeOrderDate = it.orderDate || '';
      if (!safeOrderDate) {
        if (it.details?.dataWystawieniaZlecenia) safeOrderDate = it.details.dataWystawieniaZlecenia;
        else if (it.details?.dataZlecenia) safeOrderDate = it.details.dataZlecenia;
        else if (it.details?.dataZamowienia) safeOrderDate = it.details.dataZamowienia;
        else if (it.details?.dataZapytania) safeOrderDate = it.details.dataZapytania;
        else if (
          safeStatus === 'READY' ||
          safeStatus === 'IN_PROGRESS' ||
          safeStatus === 'ORDERED' ||
          safeStatus === 'PROBLEM'
        ) {
          safeOrderDate = ord.createdAt ? ord.createdAt.split('T')[0] : '2026-09-20';
        }
      }

      const baseItem = {
        ...it,
        status: safeStatus,
        orderDate: safeOrderDate,
        name: it.name || it.shortName || 'Element',
        shortName: it.shortName || it.name || 'EL',
        attachments: Array.isArray(it.attachments) ? it.attachments : [],
      };

      if (it.type === 'ROZDZIELNICA_SN') {
        let snProducer = it.details?.producent || '';
        if (snProducer === 'ABB') snProducer = 'EATON';
        else if (snProducer && !['Schneider Electric', 'EATON', 'Siemens'].includes(snProducer)) {
          if (snProducer.includes('ZPUE') || snProducer.includes('Siemens')) snProducer = 'Siemens';
          else snProducer = '';
        }

        // Do not invent technical choices while sanitizing: only preserve values
        // that were actually entered in this order.
        const snModel = it.details?.model || it.details?.typRozdzielnicy || '';
        const polCount = it.details?.liczbaPol ?? it.details?.iloscPol ?? '';
        const snConfig = it.details?.konfiguracjaPol || '';

        return {
          ...baseItem,
          details: {
            ...it.details,
            producent: snProducer,
            model: snModel,
            typRozdzielnicy: snModel,
            liczbaPol: polCount === '' ? '' : Number(polCount),
            konfiguracjaPol: snConfig,
          },
        };
      }

      if (it.type === 'ZAP_JK' || it.type === 'ZAP_SERWISPOL') {
        return {
          ...baseItem,
          type: 'ZAP_SERWISPOL',
          name: 'ZAP SERWISPOL',
          shortName: 'ZAP SERWISPOL',
          details: {
            ...it.details,
            zakresUslugi: it.details?.zakresUslugi || 'montaż Stacji/Złącza',
          },
        };
      }

      if (it.type === 'ZAM_JK' || it.type === 'ZAM_SERWISPOL') {
        return {
          ...baseItem,
          type: 'ZAM_SERWISPOL',
          name: 'ZAM SERWISPOL',
          shortName: 'ZAM SERWISPOL',
          details: {
            ...it.details,
            zakresUslugi: it.details?.zakresUslugi || 'montaż Stacji/Złącza',
          },
        };
      }

      return baseItem;
    });

    // Backfill newly introduced standard sections for existing orders without
    // replacing any saved data or disturbing additional SN/NN switchgear cards.
    const defaultItems = createDefaultItemsForOrder(String(ord.id || 'order'), String(ord.stationSize || ''));
    const missingItems = defaultItems.filter(
      (defaultItem) => !sanitizedItems.some((savedItem: any) => savedItem.type === defaultItem.type)
    );
    const itemDefinitionOrder = new Map<string, number>();
    ITEM_DEFINITIONS.forEach((definition, index) => {
      itemDefinitionOrder.set(definition.type, index);
    });
    // Put sections in one consistent production order while preserving the
    // relative order of multiple SN/NN switchgear cards of the same type.
    const completeItems = [...sanitizedItems, ...missingItems].sort((left: any, right: any) => {
      const leftOrder = itemDefinitionOrder.get(left.type) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = itemDefinitionOrder.get(right.type) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });

    const createdYear = ord.createdAt ? new Date(ord.createdAt).getFullYear() : new Date().getFullYear();
    const existingYear = String(ord.orderNumber || '').match(/\/(\d{4})$/)?.[1];
    const migratedOrderNumber = normalizeOrderNumber(ord.orderNumber || '', Number(existingYear || createdYear));

    return {
      ...ord,
      orderNumber: migratedOrderNumber,
      // For legacy records, preserve the currently stored date as the best available baseline.
      originalDepartureDate: ord.originalDepartureDate || ord.departureDate || '',
      items: completeItems,
      status: calculateOrderStatus(completeItems),
      attachments: Array.isArray(ord.attachments) ? ord.attachments : [],
    };
  });
}

/**
 * Load this tab's orders from sessionStorage for an immediate initial render
 */
export function loadOrders(): Order[] {
  try {
    let raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = sessionStorage.getItem(PREV_STORAGE_KEY);
    }
    if (!raw) {
      const migratedInitialOrders = sanitizeOrders(INITIAL_ORDERS);
      saveOrders(migratedInitialOrders);
      return migratedInitialOrders;
    }
    const parsed: Order[] = JSON.parse(raw);
    return sanitizeOrders(parsed);
  } catch (err) {
    console.error('Failed to load orders from sessionStorage:', err);
    return INITIAL_ORDERS;
  }
}

/**
 * Save orders to this tab's sessionStorage cache
 */
export function saveOrders(orders: Order[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (err) {
    console.error('Failed to save orders to sessionStorage:', err);
  }
}

/**
 * Fetch orders from server API (persisted across users and sessions)
 */
export async function fetchOrdersFromServer(): Promise<Order[] | null> {
  try {
    const res = await fetch('/api/orders');
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.orders)) {
      const demoIds = json.orders.filter((order: any) => /^ord_zl[1-6]$/.test(String(order?.id || '')) || /^ZL[1-6]$/.test(String(order?.orderNumber || '').trim())).map((order: any) => String(order.id));
      if (demoIds.length > 0) {
        // Remove legacy demo records from persistent shared server storage, not just the visible list.
        try {
          await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orders: [], deletedIds: demoIds, merge: true }) });
        } catch (cleanupError) {
          console.warn('Could not permanently remove legacy demo orders from server:', cleanupError);
        }
      }
      return sanitizeOrders(json.orders);
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch orders from server (falling back to cache):', err);
    return null;
  }
}

/**
 * Save exactly one order record. Other records edited locally in this tab remain unsent.
 * Only this record is advanced in the server snapshot after a successful response.
 */
export async function saveSingleOrderToServer(order: Order): Promise<boolean> {
  const snapshot = readSnapshot<Order>(SERVER_ORDERS_SNAPSHOT_KEY);
  if (!snapshot) {
    console.warn('Cannot save an order before a successful server refresh establishes a baseline.');
    return false;
  }
  const baseOrder = snapshot.find((entry) => String(entry.id) === String(order.id));
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: [order], baseOrders: baseOrder ? [baseOrder] : [], deletedIds: [], merge: true }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 409 && payload?.conflict) {
        window.alert((payload.error || 'Wykryto konflikt zmian. Odśwież zlecenie i spróbuj ponownie.') + (Array.isArray(payload.fields) && payload.fields.length ? '\n\nPola objęte konfliktem: ' + payload.fields.join(', ') : ''));
      }
      return false;
    }
    const savedBaseline = baseOrder ? applyLocalDiffToBaseline(baseOrder, order) : order;
    applySavedChangesToSnapshot(SERVER_ORDERS_SNAPSHOT_KEY, [savedBaseline], []);
    return true;
  } catch (err) {
    console.warn('Could not save single order to server:', err);
    return false;
  }
}

/**
 * Save only this browser's changed records; the server merges them without
 * replacing records created or updated by other users.
 */
export async function saveOrdersToServer(orders: Order[]): Promise<boolean> {
  saveOrders(orders);
  const snapshot = readSnapshot<Order>(SERVER_ORDERS_SNAPSHOT_KEY);
  if (!snapshot) {
    console.warn('Cannot save orders before a successful server refresh establishes a baseline.');
    return false;
  }
  const { changed, deletedIds } = getPendingChanges(orders, snapshot);
  const baseOrders = changed.map((entry) => snapshot.find((base) => String(base.id) === String(entry.id))).filter(Boolean);
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders: changed, baseOrders, deletedIds, merge: true }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 409 && payload?.conflict) {
        window.alert((payload.error || 'Wykryto konflikt zmian. Odśwież dane i spróbuj ponownie.') + (Array.isArray(payload.fields) && payload.fields.length ? '\n\nPola objęte konfliktem: ' + payload.fields.join(', ') : ''));
      }
      return false;
    }
    const savedBaselines = changed.map((entry) => {
      const base = snapshot.find((previous) => String(previous.id) === String(entry.id));
      return base ? applyLocalDiffToBaseline(base, entry) : entry;
    });
    applySavedChangesToSnapshot(SERVER_ORDERS_SNAPSHOT_KEY, savedBaselines, deletedIds);
    return true;
  } catch (err) {
    console.warn('Could not save orders to server:', err);
    return false;
  }
}

/**
 * Load this tab's door orders from sessionStorage
 */
export function loadDoorOrders(): DoorOrder[] {
  try {
    let raw = sessionStorage.getItem(DOOR_STORAGE_KEY);
    if (!raw) {
      raw = sessionStorage.getItem(PREV_DOOR_STORAGE_KEY);
    }
    if (!raw) {
      saveDoorOrders(INITIAL_DOOR_ORDERS);
      return INITIAL_DOOR_ORDERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      saveDoorOrders(INITIAL_DOOR_ORDERS);
      return INITIAL_DOOR_ORDERS;
    }
    // An intentionally empty server list must remain empty.
    return parsed;
  } catch (err) {
    console.error('Failed to load door orders from sessionStorage:', err);
    return INITIAL_DOOR_ORDERS;
  }
}

/**
 * Save door orders to this tab's sessionStorage cache
 */
export function saveDoorOrders(doorOrders: DoorOrder[]): void {
  try {
    sessionStorage.setItem(DOOR_STORAGE_KEY, JSON.stringify(doorOrders));
  } catch (err) {
    console.error('Failed to save door orders to sessionStorage:', err);
  }
}

/**
 * Fetch door orders from server API
 */
export async function fetchDoorOrdersFromServer(): Promise<DoorOrder[] | null> {
  try {
    const res = await fetch('/api/door-orders');
    if (!res.ok) return null;
    const json = await res.json();
    if (json.success && Array.isArray(json.doorOrders)) {
      return json.doorOrders;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch door orders from server (falling back to cache):', err);
    return null;
  }
}

/**
 * Save only this browser's changed door records; preserve other users' records.
 */
export async function saveDoorOrdersToServer(doorOrders: DoorOrder[]): Promise<boolean> {
  saveDoorOrders(doorOrders);
  const snapshot = readSnapshot<DoorOrder>(SERVER_DOOR_SNAPSHOT_KEY);
  if (!snapshot) {
    console.warn('Cannot save door orders before a successful server refresh establishes a baseline.');
    return false;
  }
  const { changed, deletedIds } = getPendingChanges(doorOrders, snapshot);
  const baseDoorOrders = changed.map((entry) => snapshot.find((base) => String(base.id) === String(entry.id))).filter(Boolean);
  try {
    const res = await fetch('/api/door-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doorOrders: changed, baseDoorOrders, deletedIds, merge: true }),
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      if (res.status === 409 && payload?.conflict) {
        window.alert((payload.error || 'Wykryto konflikt zmian w zamówieniu drzwi. Odśwież dane i spróbuj ponownie.') + (Array.isArray(payload.fields) && payload.fields.length ? '\n\nPola objęte konfliktem: ' + payload.fields.join(', ') : ''));
      }
      return false;
    }
    const savedBaselines = changed.map((entry) => {
      const base = snapshot.find((previous) => String(previous.id) === String(entry.id));
      return base ? applyLocalDiffToBaseline(base, entry) : entry;
    });
    applySavedChangesToSnapshot(SERVER_DOOR_SNAPSHOT_KEY, savedBaselines, deletedIds);
    return true;
  } catch (err) {
    console.warn('Could not save door orders to server:', err);
    return false;
  }
}

/**
 * Reset demo data on server and locally
 */
export async function resetServerAndLocalData(): Promise<{ orders: Order[]; doorOrders: DoorOrder[]; success: boolean }> {
  try {
    const res = await fetch('/api/reset-data', { method: 'POST' });
    if (!res.ok) {
      console.warn('Server rejected demo-data reset:', res.status);
      return { orders: [], doorOrders: [], success: false };
    }

    const json = await res.json();
    if (!json.success || !Array.isArray(json.orders) || !Array.isArray(json.doorOrders)) {
      return { orders: [], doorOrders: [], success: false };
    }

    const orders = sanitizeOrders(json.orders);
    const doorOrders = json.doorOrders as DoorOrder[];
    saveOrders(orders);
    saveDoorOrders(doorOrders);
    setServerOrdersSnapshot(orders);
    setServerDoorOrdersSnapshot(doorOrders);
    return { orders, doorOrders, success: true };
  } catch (err) {
    console.warn('Could not reset demo data on the server:', err);
    return { orders: [], doorOrders: [], success: false };
  }
}

export function createNewOrder(params: {
  orderNumber: string;
  client: string;
  customerId?: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  projectName: string;
  stationSize: string;
  departureDate: string;
  generalNotes?: string;
  additionalInfo?: string;
}): Order {
  const id = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const items = createDefaultItemsForOrder(id, params.stationSize.trim());
  const status = calculateOrderStatus(items);

  const newOrder: Order = {
    id,
    orderNumber: params.orderNumber.trim(),
    client: params.client.trim(),
    customerId: params.customerId || '',
    contactId: params.contactId || '',
    contactName: params.contactName || '',
    contactEmail: params.contactEmail || '',
    contactPhone: params.contactPhone || '',
    projectName: params.projectName.trim(),
    stationSize: params.stationSize.trim(),
    departureDate: params.departureDate,
    originalDepartureDate: params.departureDate,
    generalNotes: params.generalNotes || '',
    additionalInfo: params.additionalInfo || '',
    status,
    items,
    attachments: [],
    createdAt: now,
    updatedAt: now,
  };

  return newOrder;
}
