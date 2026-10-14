import { Order } from '../types/enco';

/**
 * Normalizuje numer zlecenia do jednolitego standardu:
 * - "Zlecenie 7", "zlecenie 7", "Zlecenie nr 7", "ZL 7", "zl-7", "zl7", "7" -> "ZL7"
 * - "ZL 08/2026", "Zlecenie 8/2026" -> "ZL8/2026"
 * - Usuwa zbędne spacje, zamienia na wielkie litery
 */
export function normalizeOrderNumber(input: string): string {
  if (!input) return '';
  const clean = input.trim();

  // Dopasowanie do wzorców:
  // "Zlecenie nr 7", "zlecenie 7", "zl 7", "zl-7", "zl/7", "nr 7", "#7"
  const zlMatch = clean.match(/^(?:zlecenie\s*(?:nr|numer)?\.?\s*|zl\s*[-/.\s]?\s*|nr\s*|#\s*)(\d+)(.*)$/i);
  if (zlMatch) {
    const num = parseInt(zlMatch[1], 10);
    const suffix = (zlMatch[2] || '').trim();
    if (suffix) {
      const cleanSuffix = suffix.replace(/^[\s-]+/, '');
      const formattedSuffix = cleanSuffix.startsWith('/') ? cleanSuffix : `/${cleanSuffix}`;
      return `ZL${num}${formattedSuffix}`.toUpperCase();
    }
    return `ZL${num}`;
  }

  // Same cyfry, np. "7" -> "ZL7"
  if (/^\d+$/.test(clean)) {
    return `ZL${parseInt(clean, 10)}`;
  }

  // W innym wypadku, uppercase i pojedyncze spacje
  return clean.toUpperCase().replace(/\s+/g, ' ');
}

/**
 * Sprawdza czy dwa numery zleceń odnoszą się do tego samego zlecenia
 * (np. "Zlecenie 7" i "ZL7" to to samo)
 */
export function isSameOrderNumber(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const normA = normalizeOrderNumber(a);
  const normB = normalizeOrderNumber(b);
  if (normA && normB && normA === normB) return true;

  // Sprawdzenie samego numeru liczbowego dla formatów ZL
  const numA = normA.match(/^ZL(\d+)/)?.[1];
  const numB = normB.match(/^ZL(\d+)/)?.[1];
  if (numA && numB && numA === numB) {
    // Jeśli jeden to ZL7 a drugi to ZL7/2026 lub Zlecenie 7, uznajemy za potencjalny konflikt
    return normA === normB || normA.replace(/\/[0-9]+/, '') === normB.replace(/\/[0-9]+/, '');
  }

  return false;
}

export interface AvailableOrderItem {
  number: string;
  isOccupied: boolean;
  occupiedBy?: string;
  isNext: boolean;
}

/**
 * Zwraca listę uporządkowanych standardowych numerów ZL (np. ZL1 .. ZL30)
 * z informacją który jest wolny, który zajęty (i przez kogo) oraz który jest kolejnym wolnym.
 */
export function getOrderNumbersList(existingOrders: Order[] = [], count = 30): {
  items: AvailableOrderItem[];
  nextAvailable: string;
  occupiedMap: Map<string, Order>;
} {
  const occupiedMap = new Map<string, Order>();
  let maxNumber = 0;

  existingOrders.forEach((ord) => {
    if (!ord.orderNumber) return;
    const norm = normalizeOrderNumber(ord.orderNumber);
    occupiedMap.set(norm, ord);

    // Wyciągnij liczbę
    const numMatch = norm.match(/^ZL(\d+)/);
    if (numMatch) {
      const parsed = parseInt(numMatch[1], 10);
      if (parsed > maxNumber) {
        maxNumber = parsed;
      }
    }
  });

  // Znajdź pierwszy wolny numer od 1 w górę
  let nextFreeNum = 1;
  while (occupiedMap.has(`ZL${nextFreeNum}`)) {
    nextFreeNum++;
  }
  const nextAvailable = `ZL${nextFreeNum}`;

  // Wygeneruj listę standardowych numerów ZL
  const totalCount = Math.max(maxNumber + 10, count, 20);
  const items: AvailableOrderItem[] = [];

  for (let i = 1; i <= totalCount; i++) {
    const key = `ZL${i}`;
    const occupiedOrder = occupiedMap.get(key);
    items.push({
      number: key,
      isOccupied: !!occupiedOrder,
      occupiedBy: occupiedOrder
        ? `${occupiedOrder.client || 'Klient'} · ${occupiedOrder.projectName || 'Projekt'}`
        : undefined,
      isNext: key === nextAvailable,
    });
  }

  // Dodaj również niestandardowe numery istniejące w systemie, jeśli nie są standardowym ZL{i}
  existingOrders.forEach((ord) => {
    const norm = normalizeOrderNumber(ord.orderNumber);
    if (!items.some((it) => it.number === norm)) {
      items.push({
        number: norm,
        isOccupied: true,
        occupiedBy: `${ord.client || 'Klient'} · ${ord.projectName || 'Projekt'}`,
        isNext: false,
      });
    }
  });

  return { items, nextAvailable, occupiedMap };
}

/**
 * Waliduje numer zlecenia pod kątem unikalności i poprawności
 */
export function validateOrderNumber(
  input: string,
  existingOrders: Order[] = [],
  excludeOrderId?: string
): {
  isValid: boolean;
  normalized: string;
  error?: string;
  duplicateOrder?: Order;
} {
  if (!input || !input.trim()) {
    return {
      isValid: false,
      normalized: '',
      error: 'Wybierz lub podaj numer zlecenia.',
    };
  }

  const normalized = normalizeOrderNumber(input);

  // Sprawdź czy numer nie koliduje z żadnym istniejącym zleceniem
  const duplicate = existingOrders.find((o) => {
    if (excludeOrderId && o.id === excludeOrderId) return false;
    return isSameOrderNumber(o.orderNumber, normalized);
  });

  if (duplicate) {
    return {
      isValid: false,
      normalized,
      duplicateOrder: duplicate,
      error: `Numer zlecenia ${normalized} jest już zajęty przez: ${duplicate.client} (${duplicate.projectName}). Duplikaty są zablokowane.`,
    };
  }

  return {
    isValid: true,
    normalized,
  };
}
