import React, { useRef } from 'react';
import { Order, STATUS_META, ORDER_STATUS_META, formatDimensionM } from '../types/enco';
import {
  X,
  Printer,
  FileText,
  CheckCircle2,
  Building2,
  Calendar,
  Zap,
  Shield,
  Layers,
  Check,
  Copy,
  Box,
} from 'lucide-react';

interface OfferDocumentModalProps {
  order: Order;
  isOpen: boolean;
  onClose: () => void;
  canDownload?: boolean;
}

export const OfferDocumentModal: React.FC<OfferDocumentModalProps> = ({
  order,
  isOpen,
  onClose,
  canDownload = true,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const itemSN = order.items.find((i) => i.type === 'ROZDZIELNICA_SN');
  const itemNN = order.items.find((i) => i.type === 'ROZDZIELNICA_NN');
  const itemObudowa = order.items.find((i) => i.type === 'OBUDOWA');
  const itemMost = order.items.find((i) => i.type === 'MOST');

  const snProducer = itemSN?.details?.producent || 'Schneider Electric';
  const snModel = itemSN?.details?.model || itemSN?.details?.typRozdzielnicy || 'AirSeT';
  const snFieldCount = itemSN?.details?.liczbaPol ?? itemSN?.details?.iloscPol ?? 3;
  const snConfig = itemSN?.details?.konfiguracjaPol || 'L-L-L-T';
  const snTech = itemSN?.details?.parametryTechniczne || '';

  const nnType = itemNN?.details?.typRozdzielnicy || 'RTS-z';
  const nnFieldCount = itemNN?.details?.iloscPol || itemNN?.details?.liczbaPol || '8';
  const nnTransportDate = itemNN?.details?.planowanaGotowoscTransportu || '';
  const nnEquip = itemNN?.details?.wyposazenieDodatkowe || '';

  const obudowaTyp =
    itemObudowa?.details?.typObudowy === 'NZ'
      ? 'NZ — obudowa zewnętrzna'
      : itemObudowa?.details?.typObudowy === 'BEK'
      ? 'BEK — obudowa wewnętrzna'
      : (itemObudowa?.details?.typObudowy || 'BEK — obudowa wewnętrzna');
  const obudowaRozmiar = itemObudowa?.details?.rozmiar || 'BEK 250/350';
  const obudowaWymiary =
    itemObudowa?.details?.szerokosc && itemObudowa?.details?.glebokosc
      ? `${formatDimensionM(itemObudowa.details.szerokosc)} × ${formatDimensionM(
          itemObudowa.details.glebokosc
        )} × ${formatDimensionM(itemObudowa.details.wysokosc)} (${
          itemObudowa.details.typWysokosci ||
          (itemObudowa.details.typObudowy === 'NZ'
            ? 'wysokość zewnętrzna'
            : 'wysokość wewnętrzna pomieszczeń')
        })`
      : itemObudowa?.details?.wymiary || 'Zgodnie ze specyfikacją wariantu';
  const obudowaDataGotowosci = itemObudowa?.details?.dataGotowosci
    ? itemObudowa.details.dataGotowosci.split('-').reverse().join('.')
    : itemObudowa?.plannedDate
    ? itemObudowa.plannedDate.split('-').reverse().join('.')
    : 'W toku';

  const todayStr = new Date().toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const handlePrint = () => {
    window.print();
  };

  const handleCopySpec = () => {
    const text = `SPECYFIKACJA STACJI TRANSFORMATOROWEJ ${order.orderNumber}
Klient: ${order.client}
Projekt: ${order.projectName}
Gabaryt: ${order.stationSize}

OBUDOWA BETONOWA:
- Typ: ${obudowaTyp}
- Rozmiar: ${obudowaRozmiar}
- Wymiary rzeczywiste: ${obudowaWymiary}
- Data gotowości prefabrykatu: ${obudowaDataGotowosci}

ROZDZIELNICA SN:
- Producent: ${snProducer}
- Model: ${snModel}
- Ilość pól: ${snFieldCount}
- Konfiguracja pól: ${snConfig} (L — pole liniowe, T — pole transformatorowe)
${snTech ? `- Parametry techniczne: ${snTech}` : ''}

ROZDZIELNICA nN:
- Typ: ${nnType}
- Ilość pól: ${nnFieldCount}
${nnTransportDate ? `- Gotowość transportowa: ${nnTransportDate}` : ''}
${nnEquip ? `- Wyposażenie: ${nnEquip}` : ''}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-300 overflow-hidden my-6">
        {/* Top Control Bar (Hidden when printed) */}
        <div className="print:hidden flex items-center justify-between px-6 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-white text-sm shadow-inner">
              E
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">
                Generowany dokument oferty — Karta techniczna stacji
              </h2>
              <p className="text-[11px] text-slate-400">
                Zlecenie {order.orderNumber} · {order.projectName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopySpec}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-300">Skopiowano!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5 text-slate-300" />
                  <span>Kopiuj specyfikację</span>
                </>
              )}
            </button>

            {canDownload ? (
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Drukuj / Pobierz PDF</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                title="Brak uprawnień do pobierania/drukowania (Profil Ogólny)"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-70"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Pobieranie zablokowane</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Content */}
        <div className="p-8 sm:p-10 text-slate-900 bg-white space-y-6 max-h-[82vh] overflow-y-auto print:max-h-none print:p-0">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <span className="font-mono text-xs font-black tracking-widest text-blue-900 uppercase bg-blue-50 px-2.5 py-1 rounded border border-blue-200">
                  ENCO FLOW · SYSTEM PREFABRYKACJI
                </span>
                <span className="text-xs text-slate-500 font-mono">
                  Wersja dokumentu: 2026.1
                </span>
              </div>
              <h1 className="text-2xl font-black text-slate-950 tracking-tight">
                DOKUMENT OFERTY I SPECYFIKACJA TECHNICZNA
              </h1>
              <p className="text-xs text-slate-600 mt-0.5">
                Kompletna konfiguracja prefabrykowanej kontenerowej stacji transformatorowej
              </p>
            </div>

            <div className="text-right">
              <span className="font-mono text-xl font-black text-blue-900 block">
                {order.orderNumber}
              </span>
              <span className="text-xs text-slate-500">
                Data sporządzenia: <strong>{todayStr}</strong>
              </span>
            </div>
          </div>

          {/* Section 1: Project & Client Overview */}
          <div className="bg-slate-50 rounded-xl p-5 border border-slate-200">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              1. Dane zlecenia i zamawiającego
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-slate-500 block">Inwestor / Klient:</span>
                <span className="font-bold text-slate-900 text-sm">{order.client}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Nazwa stacji:</span>
                <span className="font-bold text-slate-900 text-sm">{order.projectName}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Gabaryt korpusu:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{order.stationSize}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Termin wydania / transport:</span>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  {order.departureDate ? order.departureDate.split('-').reverse().join('.') : 'Do ustalenia'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Obudowa Betonowa (BEK / NZ) */}
          <div className="border border-indigo-200 bg-indigo-50/25 rounded-xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 mb-3 border-b border-indigo-100">
              <h3 className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-2">
                <Box className="w-4 h-4 text-indigo-600" />
                <span>2. Obudowa betonowa stacji</span>
              </h3>
              <span className="font-mono text-xs font-bold px-2.5 py-0.5 bg-indigo-100 text-indigo-950 rounded border border-indigo-200">
                {obudowaRozmiar}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                <span className="text-slate-500 block text-[11px] mb-0.5">Typ obudowy:</span>
                <span className="font-bold text-slate-900 text-sm">{obudowaTyp}</span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                <span className="text-slate-500 block text-[11px] mb-0.5">Rzeczywiste wymiary:</span>
                <span className="font-mono font-bold text-slate-900 text-xs">
                  {obudowaWymiary}
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-indigo-100 shadow-2xs">
                <span className="text-slate-500 block text-[11px] mb-0.5">Planowana data gotowości:</span>
                <span className="font-mono font-bold text-indigo-900 text-sm">
                  {obudowaDataGotowosci}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Rozdzielnica Średniego Napięcia (SN) — GŁÓWNA SEKCJA */}
          <div className="border-2 border-amber-300 bg-amber-50/30 rounded-xl p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-4 border-b border-amber-200">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                    3. Rozdzielnica Średniego Napięcia (SN)
                  </h3>
                  <p className="text-[11px] text-amber-800">
                    Moduł rozdzielczy SN stacji transformatorowej
                  </p>
                </div>
              </div>

              <span className="font-mono text-xs font-bold px-3 py-1 bg-amber-100 text-amber-950 rounded-lg border border-amber-300">
                {snProducer} · {snModel}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs mb-4">
              {/* Producent */}
              <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs">
                <span className="text-slate-500 block text-[11px] mb-0.5">Producent SN:</span>
                <span className="font-bold text-slate-900 text-sm">{snProducer}</span>
              </div>

              {/* Model */}
              <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs">
                <span className="text-slate-500 block text-[11px] mb-0.5">Model rozdzielnicy:</span>
                <span className="font-bold text-blue-900 text-sm">{snModel}</span>
              </div>

              {/* Ilość pól */}
              <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs">
                <span className="text-slate-500 block text-[11px] mb-0.5">Ilość pól:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {snFieldCount} {Number(snFieldCount) === 1 ? 'pole' : Number(snFieldCount) < 5 ? 'pola' : 'pól'}
                </span>
              </div>

              {/* Konfiguracja pól */}
              <div className="p-3 bg-white rounded-lg border border-amber-200 shadow-2xs">
                <span className="text-slate-500 block text-[11px] mb-0.5">Konfiguracja pól:</span>
                <span className="font-mono font-black text-blue-900 text-sm tracking-wider">
                  {snConfig}
                </span>
              </div>
            </div>

            {/* Legenda i objaśnienie oznaczeń */}
            <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs space-y-1.5">
              <div className="flex items-center gap-2 text-amber-950 font-bold">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span>Legenda oznaczeń konfiguracji pól rozdzielnicy SN:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-700 pl-5">
                <div>
                  <strong className="font-mono text-blue-900 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                    L
                  </strong>{' '}
                  — <strong>pole liniowe</strong> (wyposażone w rozłącznik lub wyłącznik liniowy)
                </div>
                <div>
                  <strong className="font-mono text-blue-900 bg-blue-50 px-1 py-0.5 rounded border border-blue-200">
                    T
                  </strong>{' '}
                  — <strong>pole transformatorowe</strong> (z zabezpieczeniem bezpiecznikowym lub wyłącznikowym)
                </div>
              </div>
              {snTech && (
                <div className="pt-2 mt-1 border-t border-slate-100 text-[11px] text-slate-600">
                  <span className="font-semibold text-slate-800">Parametry dodatkowe: </span>
                  {snTech}
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Rozdzielnica Niskiego Napięcia (nN) */}
          <div className="border border-blue-200 bg-blue-50/20 rounded-xl p-5">
            <h3 className="text-xs font-bold text-blue-950 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" />
              <span>4. Rozdzielnica Niskiego Napięcia (nN)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="p-3 bg-white rounded-lg border border-blue-100">
                <span className="text-slate-500 block text-[11px] mb-0.5">Typ rozdzielnicy:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {nnType.includes('RTS-w')
                    ? 'RTS-w — wolnostojąca, obsługa wewnętrzna'
                    : 'RTS-z — zawieszana, obsługa zewnętrzna'}
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-blue-100">
                <span className="text-slate-500 block text-[11px] mb-0.5">Ilość pól / odpływów:</span>
                <span className="font-mono font-bold text-slate-900 text-sm">
                  {nnFieldCount} odpływów
                </span>
              </div>
              <div className="p-3 bg-white rounded-lg border border-blue-100">
                <span className="text-slate-500 block text-[11px] mb-0.5">Gotowość do transportu:</span>
                <span className="font-mono font-bold text-blue-900 text-sm">
                  {nnTransportDate ? nnTransportDate.split('-').reverse().join('.') : 'Zgodnie z harmonogramem'}
                </span>
              </div>
            </div>

            {nnEquip && (
              <p className="mt-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-blue-100">
                <strong className="text-slate-800">Wyposażenie aparaturowe nN:</strong> {nnEquip}
              </p>
            )}
          </div>

          {/* Section 5: Pozostałe komponenty stacji */}
          <div className="border border-slate-200 rounded-xl p-5 bg-slate-50/60">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              5. Podsumowanie kompletności pozostałych modułów
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              {order.items
                .filter((it) => it.type !== 'ROZDZIELNICA_SN' && it.type !== 'ROZDZIELNICA_NN')
                .slice(0, 6)
                .map((it) => {
                  const statusMeta = STATUS_META[it.status];
                  return (
                    <div key={it.id} className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-mono font-bold text-[11px] text-slate-600">
                          {it.shortName}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${statusMeta.bgBadge} ${statusMeta.textBadge}`}>
                          {statusMeta.shortLabel}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-800 truncate">{it.name}</p>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Document Signatures & Engineering Approval */}
          <div className="pt-6 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-600">
            <div>
              <p className="font-bold text-slate-800 mb-8">Sporządził / Inżynier Projektu ENCO:</p>
              <div className="border-t border-slate-400 pt-1 text-[11px]">
                Dział Realizacji i Prefabrykacji ENCO FLOW
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-800 mb-8">Zatwierdzenie Techniczne Klienta:</p>
              <div className="border-t border-slate-400 pt-1 text-[11px]">
                Podpis i pieczęć upoważnionego przedstawiciela
              </div>
            </div>
          </div>
        </div>

        {/* Footer controls (hidden in print) */}
        <div className="print:hidden px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Wydruk automatycznie formatuje ofertę do strony A4 (Ctrl+P / Command+P).
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              Zamknij
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Drukuj dokument</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
