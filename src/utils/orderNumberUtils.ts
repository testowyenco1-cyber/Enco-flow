import { Order } from '../types/enco';

const currentYear = () => new Date().getFullYear();

/** Normalizuje numer do formatu ZL1/2026. Brakujący rok uzupełnia podanym rokiem. */
export function normalizeOrderNumber(input: string, defaultYear: number = currentYear()): string {
  if (!input) return '';
  const clean = input.trim();
  const match = clean.match(/^(?:zlecenie\s*(?:nr|numer)?\.?\s*|zl\s*[-/.\s]?\s*|nr\s*|#\s*)(\d+)(.*)$/i);
  if (match) {
    const num = parseInt(match[1], 10);
    const suffix = (match[2] || '').trim().replace(/^[\s-]+/, '');
    const yearMatch = suffix.match(/^(?:\/\s*)?(\d{4})$/);
    const year = yearMatch ? yearMatch[1] : String(defaultYear);
    return `ZL${num}/${year}`;
  }
  if (/^\d+$/.test(clean)) return `ZL${parseInt(clean, 10)}/${defaultYear}`;
  return clean.toUpperCase().replace(/\s+/g, ' ');
}

/** Numery są identyczne tylko wtedy, gdy zgadza się numer i rok. */
export function isSameOrderNumber(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  return normalizeOrderNumber(a) === normalizeOrderNumber(b);
}

export function getOrderYear(order: Pick<Order, 'orderNumber' | 'createdAt'>): number {
  const explicitYear = String(order.orderNumber || '').match(/\/(\d{4})$/)?.[1];
  if (explicitYear) return Number(explicitYear);
  const createdYear = order.createdAt ? new Date(order.createdAt).getFullYear() : NaN;
  return Number.isFinite(createdYear) ? createdYear : currentYear();
}

export interface AvailableOrderItem {
  number: string;
  isOccupied: boolean;
  occupiedBy?: string;
  isNext: boolean;
}

/** Lista numerów ZL dla wybranego roku; numeracja jest niezależna dla każdego roku. */
export function getOrderNumbersList(existingOrders: Order[] = [], count = 30, year: number = currentYear()): {
  items: AvailableOrderItem[];
  nextAvailable: string;
  occupiedMap: Map<string, Order>;
} {
  const occupiedMap = new Map<string, Order>();
  let maxNumber = 0;
  existingOrders.forEach((ord) => {
    if (!ord.orderNumber) return;
    const norm = normalizeOrderNumber(ord.orderNumber, getOrderYear(ord));
    if (!norm.endsWith(`/${year}`)) return;
    occupiedMap.set(norm, ord);
    const numMatch = norm.match(/^ZL(\d+)\//);
    if (numMatch) maxNumber = Math.max(maxNumber, parseInt(numMatch[1], 10));
  });

  let nextFreeNum = 1;
  while (occupiedMap.has(`ZL${nextFreeNum}/${year}`)) nextFreeNum++;
  const nextAvailable = `ZL${nextFreeNum}/${year}`;
  const totalCount = Math.max(maxNumber + 10, count, 20);
  const items: AvailableOrderItem[] = [];
  for (let i = 1; i <= totalCount; i++) {
    const key = `ZL${i}/${year}`;
    const occupiedOrder = occupiedMap.get(key);
    items.push({
      number: key,
      isOccupied: !!occupiedOrder,
      occupiedBy: occupiedOrder ? `${occupiedOrder.client || 'Klient'} · ${occupiedOrder.projectName || 'Projekt'}` : undefined,
      isNext: key === nextAvailable,
    });
  }
  existingOrders.forEach((ord) => {
    const norm = normalizeOrderNumber(ord.orderNumber, getOrderYear(ord));
    if (norm.endsWith(`/${year}`) && !items.some((it) => it.number === norm)) {
      items.push({ number: norm, isOccupied: true, occupiedBy: `${ord.client || 'Klient'} · ${ord.projectName || 'Projekt'}`, isNext: false });
    }
  });
  return { items, nextAvailable, occupiedMap };
}

/** Waliduje unikalność pełnego numeru, łącznie z rokiem. */
export function validateOrderNumber(
  input: string,
  existingOrders: Order[] = [],
  excludeOrderId?: string,
  defaultYear: number = currentYear()
): { isValid: boolean; normalized: string; error?: string; duplicateOrder?: Order } {
  if (!input || !input.trim()) {
    return { isValid: false, normalized: '', error: 'Wybierz lub podaj numer zlecenia.' };
  }
  const normalized = normalizeOrderNumber(input, defaultYear);
  const duplicate = existingOrders.find((o) => {
    if (excludeOrderId && o.id === excludeOrderId) return false;
    return isSameOrderNumber(normalizeOrderNumber(o.orderNumber, getOrderYear(o)), normalized);
  });
  if (duplicate) {
    return {
      isValid: false,
      normalized,
      duplicateOrder: duplicate,
      error: `Numer zlecenia ${normalized} jest już zajęty przez: ${duplicate.client} (${duplicate.projectName}). Duplikaty są zablokowane.`,
    };
  }
  return { isValid: true, normalized };
}
