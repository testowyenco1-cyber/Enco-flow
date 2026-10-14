import { Order, OrderItem, calculateOrderStatus, Attachment, DoorOrder } from '../types/enco';
import { INITIAL_ORDERS, createDefaultItemsForOrder } from '../data/mockData';
import { INITIAL_DOOR_ORDERS } from '../data/mockDoorOrders';

const STORAGE_KEY = 'enco_flow_orders_v8';
const PREV_STORAGE_KEY = 'enco_flow_orders_v7';
const DOOR_STORAGE_KEY = 'enco_flow_door_orders_v2';
const PREV_DOOR_STORAGE_KEY = 'enco_flow_door_orders_v1';

// Unique client identifier for current browser tab to avoid echo loops
export const CLIENT_ID =
  typeof window !== 'undefined'
    ? sessionStorage.getItem('enco_client_id') ||
      (() => {
        const id = 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 8);
        try {
          sessionStorage.setItem('enco_client_id', id);
        } catch (e) {
          // ignore storage error
        }
        return id;
      })()
    : 'server';

/**
 * Sanitize and migrate orders array ensuring all fields and item structures are valid
 */
export function sanitizeOrders(parsed: any[]): Order[] {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return INITIAL_ORDERS;
  }

  const validItemStatuses: Set<string> = new Set([
    'NOT_ORDERED',
    'ORDERED',
    'IN_PROGRESS',
    'READY',
    'PROBLEM',
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
        let snProducer = it.details?.producent;
        if (
          !snProducer ||
          (snProducer !== 'Schneider Electric' &&
            snProducer !== 'EATON' &&
            snProducer !== 'Siemens')
        ) {
          if (snProducer === 'ABB') snProducer = 'EATON';
          else if (
            snProducer &&
            (snProducer.includes('ZPUE') || snProducer.includes('Siemens'))
          )
            snProducer = 'Siemens';
          else snProducer = 'Schneider Electric';
        }

        let snModel = it.details?.model || it.details?.typRozdzielnicy;
        if (snProducer === 'Schneider Electric') snModel = 'AirSeT';
        else if (snProducer === 'EATON') snModel = 'Xiria';
        else if (snProducer === 'Siemens') snModel = '8DJH 24 Blue GIS';

        const polCount = it.details?.liczbaPol ?? it.details?.iloscPol ?? 3;
        const snConfig = it.details?.konfiguracjaPol || 'L-L-L-T';

        return {
          ...baseItem,
          details: {
            ...it.details,
            producent: snProducer,
            model: snModel,
            typRozdzielnicy: snModel,
            liczbaPol: Number(polCount) || 3,
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

    return {
      ...ord,
      items: sanitizedItems,
      status: calculateOrderStatus(sanitizedItems),
      attachments: Array.isArray(ord.attachments) ? ord.attachments : [],
    };
  });
}

/**
 * Load initial orders immediately from local storage cache for 0ms initial render
 */
export function loadOrders(): Order[] {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(PREV_STORAGE_KEY);
    }
    if (!raw) {
      saveOrders(INITIAL_ORDERS);
      return INITIAL_ORDERS;
    }
    const parsed: Order[] = JSON.parse(raw);
    return sanitizeOrders(parsed);
  } catch (err) {
    console.error('Failed to load orders from localStorage:', err);
    return INITIAL_ORDERS;
  }
}

/**
 * Save orders to local storage cache
 */
export function saveOrders(orders: Order[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch (err) {
    console.error('Failed to save orders to localStorage:', err);
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
      const sanitized = sanitizeOrders(json.orders);
      saveOrders(sanitized);
      return sanitized;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch orders from server (falling back to cache):', err);
    return null;
  }
}

/**
 * Save orders to server API and broadcast to all connected users
 */
export async function saveOrdersToServer(orders: Order[]): Promise<boolean> {
  saveOrders(orders); // Always update local storage first
  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders, originId: CLIENT_ID }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save orders to server:', err);
    return false;
  }
}

/**
 * Load initial door orders immediately from local storage cache
 */
export function loadDoorOrders(): DoorOrder[] {
  try {
    let raw = localStorage.getItem(DOOR_STORAGE_KEY);
    if (!raw) {
      raw = localStorage.getItem(PREV_DOOR_STORAGE_KEY);
    }
    if (!raw) {
      saveDoorOrders(INITIAL_DOOR_ORDERS);
      return INITIAL_DOOR_ORDERS;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      saveDoorOrders(INITIAL_DOOR_ORDERS);
      return INITIAL_DOOR_ORDERS;
    }
    return parsed;
  } catch (err) {
    console.error('Failed to load door orders from localStorage:', err);
    return INITIAL_DOOR_ORDERS;
  }
}

/**
 * Save door orders to local storage cache
 */
export function saveDoorOrders(doorOrders: DoorOrder[]): void {
  try {
    localStorage.setItem(DOOR_STORAGE_KEY, JSON.stringify(doorOrders));
  } catch (err) {
    console.error('Failed to save door orders to localStorage:', err);
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
      saveDoorOrders(json.doorOrders);
      return json.doorOrders;
    }
    return null;
  } catch (err) {
    console.warn('Could not fetch door orders from server (falling back to cache):', err);
    return null;
  }
}

/**
 * Save door orders to server API and broadcast to all connected users
 */
export async function saveDoorOrdersToServer(doorOrders: DoorOrder[]): Promise<boolean> {
  saveDoorOrders(doorOrders);
  try {
    const res = await fetch('/api/door-orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doorOrders, originId: CLIENT_ID }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Could not save door orders to server:', err);
    return false;
  }
}

/**
 * Reset demo data on server and locally
 */
export async function resetServerAndLocalData(): Promise<{ orders: Order[]; doorOrders: DoorOrder[] }> {
  saveOrders(INITIAL_ORDERS);
  saveDoorOrders(INITIAL_DOOR_ORDERS);

  try {
    await fetch('/api/reset-data', { method: 'POST' });
  } catch (e) {
    console.warn('Could not notify server of demo reset:', e);
  }

  return { orders: INITIAL_ORDERS, doorOrders: INITIAL_DOOR_ORDERS };
}

export function resetToDemoOrders(): Order[] {
  saveOrders(INITIAL_ORDERS);
  saveDoorOrders(INITIAL_DOOR_ORDERS);
  return INITIAL_ORDERS;
}

export function resetToDemoDoorOrders(): DoorOrder[] {
  saveDoorOrders(INITIAL_DOOR_ORDERS);
  return INITIAL_DOOR_ORDERS;
}

/**
 * Setup Real-time SSE synchronization listener
 */
export function setupRealtimeSync(options: {
  onOrdersUpdated: (orders: Order[], isRemote: boolean) => void;
  onDoorOrdersUpdated: (doorOrders: DoorOrder[], isRemote: boolean) => void;
  onReset: () => void;
  onStatusChange?: (isConnected: boolean) => void;
}): () => void {
  let eventSource: EventSource | null = null;
  let isClosed = false;
  let reconnectTimer: NodeJS.Timeout | null = null;

  function connect() {
    if (isClosed) return;

    try {
      eventSource = new EventSource('/api/realtime/stream');

      eventSource.onopen = () => {
        options.onStatusChange?.(true);
      };

      eventSource.onmessage = (event) => {
        if (!event.data || event.data.trim() === ': keepalive') return;
        try {
          const payload = JSON.parse(event.data);
          const isRemote = Boolean(payload.originId && payload.originId !== CLIENT_ID);

          if (payload.type === 'orders' && Array.isArray(payload.data)) {
            const sanitized = sanitizeOrders(payload.data);
            saveOrders(sanitized);
            options.onOrdersUpdated(sanitized, isRemote);
          } else if (payload.type === 'doorOrders' && Array.isArray(payload.data)) {
            saveDoorOrders(payload.data);
            options.onDoorOrdersUpdated(payload.data, isRemote);
          } else if (payload.type === 'reset') {
            options.onReset();
          }
        } catch (e) {
          console.error('Error handling SSE message:', e);
        }
      };

      eventSource.onerror = () => {
        options.onStatusChange?.(false);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (!isClosed) {
          reconnectTimer = setTimeout(connect, 3000);
        }
      };
    } catch (e) {
      options.onStatusChange?.(false);
      if (!isClosed) {
        reconnectTimer = setTimeout(connect, 3000);
      }
    }
  }

  connect();

  // Quick refresh when user switches tabs or window gets focus
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      fetchOrdersFromServer().then((orders) => {
        if (orders) options.onOrdersUpdated(orders, false);
      });
      fetchDoorOrdersFromServer().then((doors) => {
        if (doors) options.onDoorOrdersUpdated(doors, false);
      });
    }
  };

  window.addEventListener('visibilitychange', handleVisibilityChange);
  window.addEventListener('focus', handleVisibilityChange);

  return () => {
    isClosed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (eventSource) eventSource.close();
    window.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleVisibilityChange);
  };
}

export function createNewOrder(params: {
  orderNumber: string;
  client: string;
  projectName: string;
  stationSize: string;
  departureDate: string;
  generalNotes?: string;
  additionalInfo?: string;
}): Order {
  const id = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  const items = createDefaultItemsForOrder(id);
  const status = calculateOrderStatus(items);

  const newOrder: Order = {
    id,
    orderNumber: params.orderNumber.trim(),
    client: params.client.trim(),
    projectName: params.projectName.trim(),
    stationSize: params.stationSize.trim(),
    departureDate: params.departureDate,
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
