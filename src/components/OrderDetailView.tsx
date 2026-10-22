import React, { useEffect, useMemo, useState } from 'react';
import { Order, OrderItem, ItemStatus, Attachment, DoorOrder } from '../types/enco';
import { OrderStatusBadge, ItemStatusBadge } from './StatusBadge';
import { StatusSwitcher } from './StatusSwitcher';
import { DepartureBadge } from './DepartureBadge';
import { ItemDetailsCard } from './ItemDetailsCard';
import { AttachmentList } from './AttachmentList';
import { OfferDocumentModal } from './OfferDocumentModal';
import { OrderFilesModal } from './OrderFilesModal';
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit2,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Circle,
  ExternalLink,
  ChevronDown,
  Lock,
  Shield,
  Filter,
  FolderOpen,
  HardDrive,
} from 'lucide-react';
import { UserRoleProfile, USER_PROFILES, canEditItemType, getItemPermissionHint } from '../types/userRole';
import { getOrderFieldDepartment } from '../utils/departmentOwnership';
import { OrderTasksPanel } from './OrderTasksPanel';

interface OrderDetailViewProps {
  order: Order;
  doorOrders?: DoorOrder[];
  onBack: () => void;
  onArchive: () => void;
  isArchived: boolean;
  onUpdateOrderStatus: (orderId: string, updatedOrder: Order) => void;
  onSaveOrderChanges: (order: Order) => void;
  onOpenEditOrderModal: () => void;
  onOpenEditItemModal: (item: OrderItem) => void;
  onNavigateToDoorModule?: (numerDokumentu?: string) => void;
  onCreateDoorOrder?: (defaultStationZl?: string, defaultStationName?: string) => void;
  currentProfile?: UserRoleProfile;
  onOrderTasksPanelOpenChange?: (isOpen: boolean) => void;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  doorOrders = [],
  onBack,
  onArchive,
  isArchived,
  onUpdateOrderStatus,
  onSaveOrderChanges,
  onOpenEditOrderModal,
  onOpenEditItemModal,
  onNavigateToDoorModule,
  onCreateDoorOrder,
  currentProfile,
  onOrderTasksPanelOpenChange,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const [itemsFilter, setItemsFilter] = useState<'all' | 'my_scope'>('all');
  const [showHiddenItems, setShowHiddenItems] = useState(false);
  const hiddenMainPositionTypes = ["OBUDOWA","ROZDZIELNICA_SN","ROZDZIELNICA_NN","TABLICA_POMIAROWA","RPW","MOST","SZAFKA_TELEMECHANIKI","TRANSFORMATOR_POTRZEB_WLASNYCH","WSKAZNIKI_ZWARC","RYS_AKCEPTACJA","KOLORY","OPISY","DRZWI","ZAP_SERWISPOL","ZAM_SERWISPOL","ZLECENIE_MONTAZU","ZLECENIE MONTAŻU","ZLECENIE_MONTAŻU","POWYKONAWCZA","DATA_WYJAZDU","DODATKOWE"];
  const isHiddenMainPosition = (item: OrderItem) => item.status === 'NOT_APPLICABLE' && hiddenMainPositionTypes.includes(item.type);
  const hiddenItems = order.items.filter(isHiddenMainPosition);
  const visibleItems = order.items.filter((item) => !isHiddenMainPosition(item));
  const [editingGeneralNotes, setEditingGeneralNotes] = useState(false);
  const [generalNotesInput, setGeneralNotesInput] = useState(order.generalNotes);
  const [isOfferModalOpen, setIsOfferModalOpen] = useState(false);
  const [isOrderFilesModalOpen, setIsOrderFilesModalOpen] = useState(false);
  const [selectedFolderForModal, setSelectedFolderForModal] = useState<string>('01_Dokumentacja_Glowna');

  useEffect(() => {
    let targetType = '';
    try {
      targetType = sessionStorage.getItem('enco_dashboard_target_item_type') || '';
      if (targetType) sessionStorage.removeItem('enco_dashboard_target_item_type');
    } catch {}
    if (!targetType) return;
    const timer = window.setTimeout(() => {
      const target = document.getElementById(`item-section-${targetType}`);
      if (!target) return;
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2');
      window.setTimeout(() => target.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2'), 2200);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [order.id]);

  type LinkedSNRecord = {
    id: string;
    type: string;
    category: string;
    rodzaj: string;
    ilosc: number;
    terminDostawy: string;
    nrZamowienia: string;
    projekt: string;
    linkedOrderId?: string;
    lokalizacja: string;
  };
  const [linkedSNRecords, setLinkedSNRecords] = useState<LinkedSNRecord[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loadLinkedSNRecords = async () => {
      try {
        const response = await fetch('/api/sn-switchgear');
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled && data.success && Array.isArray(data.records)) {
          setLinkedSNRecords(data.records);
        }
      } catch {
        // The SN inventory is supplementary; a temporary API issue should not block the order view.
      }
    };
    void loadLinkedSNRecords();
    return () => { cancelled = true; };
  }, [order.id]);

  const orderLabelForSN = `${order.orderNumber} ${order.projectName}`.trim();
  const linkedSNRecordsForOrder = useMemo(() => linkedSNRecords.filter(record => {
    if (record.linkedOrderId === order.id) return true;
    if (record.linkedOrderId && record.linkedOrderId !== order.id) return false;
    const project = (record.projekt || '').trim().toLowerCase();
    return !!project && (
      project === (order.projectName || '').trim().toLowerCase() ||
      project === orderLabelForSN.toLowerCase() ||
      project.startsWith(`${(order.orderNumber || '').trim().toLowerCase()} `)
    );
  }), [linkedSNRecords, order.id, order.orderNumber, order.projectName, orderLabelForSN]);

  const totalOrderAttachments =
    (order.attachments?.length || 0) +
    order.items.reduce((acc, it) => acc + (it.attachments?.length || 0), 0);

  const handleItemStatusChange = (itemId: string, newStatus: ItemStatus) => {
    const updatedItems = order.items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          status: newStatus,
          completedDate: newStatus === 'READY' && !it.completedDate ? new Date().toISOString().split('T')[0] : it.completedDate,
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    onUpdateOrderStatus(order.id, {
      ...order,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateItemNotes = (itemId: string, notes: string) => {
    const updatedItems = order.items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          notes,
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    onUpdateOrderStatus(order.id, {
      ...order,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateItemDates = (
    itemId: string,
    orderDate: string,
    plannedDate: string,
    completedDate: string
  ) => {
    const updatedItems = order.items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          orderDate,
          plannedDate,
          completedDate,
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    onUpdateOrderStatus(order.id, {
      ...order,
      items: updatedItems,
      departureDate: order.items.some((item) => item.id === itemId && item.type === 'DATA_WYJAZDU') ? plannedDate : order.departureDate,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddItemAttachment = (itemId: string, attachment: Attachment) => {
    const updatedItems = order.items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          attachments: [...(it.attachments || []), attachment],
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    onUpdateOrderStatus(order.id, {
      ...order,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteItemAttachment = (itemId: string, attachmentId: string) => {
    const updatedItems = order.items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          attachments: (it.attachments || []).filter((a) => a.id !== attachmentId),
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    onUpdateOrderStatus(order.id, {
      ...order,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateItemDetails = (itemId: string, details: Record<string, any>) => {
    const updatedItems = order.items.map((it) => {
      if (it.id === itemId) {
        return {
          ...it,
          details,
          updatedAt: new Date().toISOString(),
        };
      }
      return it;
    });

    onUpdateOrderStatus(order.id, {
      ...order,
      items: updatedItems,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddSwitchgear = (type: 'ROZDZIELNICA_SN' | 'ROZDZIELNICA_NN') => {
    const now = new Date().toISOString();
    const matchingItems = order.items.filter((item) => item.type === type);
    const number = matchingItems.length + 1;
    const isSN = type === 'ROZDZIELNICA_SN';
    const newItem: OrderItem = {
      id: `item-${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderId: order.id,
      type,
      name: `${isSN ? 'ROZDZIELNICA SN' : 'ROZDZIELNICA NN'} ${number}`,
      shortName: `${isSN ? 'SN' : 'NN'} ${number}`,
      status: 'NOT_ORDERED',
      details: isSN
        ? { producent: '', model: '', typRozdzielnicy: '', konfiguracjaPol: 'L-L-L-T', liczbaPol: '' }
        : { typRozdzielnicy: '', iloscPol: '', planowanaGotowoscTransportu: '' },
      attachments: [],
      createdAt: now,
      updatedAt: now,
    };
    const updatedItems = [...order.items];
    const lastMatchingIndex = updatedItems.reduce(
      (lastIndex, item, index) => item.type === type ? index : lastIndex,
      -1
    );
    updatedItems.splice(lastMatchingIndex + 1, 0, newItem);
    onUpdateOrderStatus(order.id, {
      ...order,
      items: updatedItems,
      updatedAt: now,
    });
  };

  const handleAddOrderAttachment = (attachment: Attachment) => {
    onUpdateOrderStatus(order.id, {
      ...order,
      attachments: [...(order.attachments || []), attachment],
      updatedAt: new Date().toISOString(),
    });
  };

  const handleDeleteOrderAttachment = (attachmentId: string) => {
    onUpdateOrderStatus(order.id, {
      ...order,
      attachments: (order.attachments || []).filter((a) => a.id !== attachmentId),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSaveGeneralNotes = () => {
    onUpdateOrderStatus(order.id, {
      ...order,
      generalNotes: generalNotesInput,
      updatedAt: new Date().toISOString(),
    });
    setEditingGeneralNotes(false);
  };

  const scrollToItem = (type: string) => {
    const el = document.getElementById(`item-section-${type}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const readyItemsCount = order.items.filter((i) => i.status === 'READY').length;
  const inProgressItemsCount = order.items.filter((i) => i.status === 'IN_PROGRESS').length;
  const orderedItemsCount = order.items.filter((i) => i.status === 'ORDERED').length;
  const problemItemsCount = order.items.filter((i) => i.status === 'PROBLEM').length;
  const notOrderedCount = order.items.filter((i) => i.status === 'NOT_ORDERED').length;
  const orderNumberOwner = getOrderFieldDepartment('orderNumber');
  const clientOwner = getOrderFieldDepartment('client');
  const projectOwner = getOrderFieldDepartment('projectName');
  const departureOwner = getOrderFieldDepartment('departureDate');

  return (
    <div className="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1 space-y-8 pb-16">
      {/* Back button & Breadcrumbs */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs hover:border-slate-300 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{isArchived ? 'Wróć do archiwum' : 'Wróć do Centrum Zleceń'}</span>
        </button>

        <div className="flex items-center gap-3">
          <button type="button" onClick={onArchive} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
            {isArchived ? 'Przywróć z archiwum' : 'Archiwizuj zlecenie'}
          </button>
          <div className="text-xs text-slate-500 font-medium">
          Zlecenie: <span className="font-mono font-bold text-slate-900">{order.orderNumber}</span>
          </div>
        </div>
      </div>

      {/* POZIOM 2 — GŁÓWNA BELKA INFORMACYJNA ZLECENIA */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Top Header */}
        <div className="p-6 border-b border-slate-100 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <span className="font-mono text-base font-black px-3 py-1 rounded bg-blue-600 text-white tracking-wider">
                  {order.orderNumber}
                </span>
                {orderNumberOwner && (
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${orderNumberOwner.className}`}>
                    {orderNumberOwner.label}
                  </span>
                )}
                <h1 className="min-w-0 break-words text-xl sm:text-2xl font-bold tracking-tight">
                  {order.projectName}
                </h1>
                {projectOwner && projectOwner.key !== 'sales' && (
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${projectOwner.className}`}>
                    {projectOwner.label}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-2 text-xs text-slate-300">
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 shrink-0 text-blue-400" />
                  <span className="break-words font-medium text-white">{order.client}</span>
                  {clientOwner && clientOwner.key !== 'sales' && (
                    <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${clientOwner.className}`}>
                      {clientOwner.label}
                    </span>
                  )}
                </div>
                {order.contactName && (
                  <div className="inline-flex flex-wrap items-center gap-2 text-slate-200">
                    <span className="text-slate-500">·</span>
                    <span>Kontakt: <strong className="text-white">{order.contactName}</strong></span>
                    {order.contactEmail && <a className="text-blue-200 hover:text-white underline" href={`mailto:${order.contactEmail}`}>{order.contactEmail}</a>}
                    {order.contactPhone && <a className="text-blue-200 hover:text-white underline" href={`tel:${order.contactPhone}`}>{order.contactPhone}</a>}
                  </div>
                )}
                <span className="text-slate-500">·</span>
                <div className="inline-flex flex-wrap items-center gap-2 rounded-lg border border-blue-400/50 bg-blue-950/70 px-3 py-1.5 shadow-sm">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Rozmiar stacji</span>
                  <span className="font-mono text-sm font-black text-white">{order.stationSize || 'Nie określono'}</span>
                </div>
                {order.additionalInfo && (
                  <>
                    <span className="text-slate-500">·</span>
                    <span className="text-slate-400">{order.additionalInfo}</span>
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedFolderForModal('01_Dokumentacja_Glowna');
                  setIsOrderFilesModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-100 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg shadow-2xs border border-slate-600 transition-colors cursor-pointer"
                title="Przeglądaj strukturę folderów i lokalizacji plików na serwerze"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Foldery zlecenia ({totalOrderAttachments})</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOfferModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-2xs border border-blue-500 transition-colors cursor-pointer"
                title="Generuj dokument oferty i kartę techniczną stacji"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Dokument oferty</span>
              </button>
              <div className="flex flex-wrap items-center gap-1.5">
                <DepartureBadge
                  dateStr={order.departureDate}
                  isCompleted={order.status === 'READY'}
                />
                {departureOwner && (
                  <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold ${departureOwner.className}`}>
                    {departureOwner.label}
                  </span>
                )}
              </div>
              <OrderStatusBadge status={order.status} size="lg" />
              <button
                type="button"
                onClick={onOpenEditOrderModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Edytuj zlecenie</span>
              </button>
            </div>
          </div>
        </div>

        {/* General notes & Project-level attachments */}
        <div className="p-6 bg-slate-50/50 grid grid-cols-1 lg:grid-cols-3 gap-6 border-b border-slate-200">
          {/* General Notes */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Uwagi ogólne do zlecenia
              </span>
              {profile.canEditGeneralNotes && !editingGeneralNotes && (
                <button
                  type="button"
                  onClick={() => {
                    setGeneralNotesInput(order.generalNotes);
                    setEditingGeneralNotes(true);
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  Edytuj uwagi
                </button>
              )}
            </div>

            {editingGeneralNotes ? (
              <div className="space-y-2">
                <textarea
                  rows={3}
                  value={generalNotesInput}
                  onChange={(e) => setGeneralNotesInput(e.target.value)}
                  placeholder="Wpisz ogólne ustalenia, specyfikację, kontakt do inspektora..."
                  className="w-full text-xs p-3 border border-slate-300 rounded-lg bg-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveGeneralNotes}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md cursor-pointer"
                  >
                    Zapisz
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingGeneralNotes(false)}
                    className="px-2.5 py-1.5 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Anuluj
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-700 bg-white p-3 rounded-lg border border-slate-200 whitespace-pre-wrap">
                {order.generalNotes || 'Brak uwag ogólnych do projektu.'}
              </p>
            )}
          </div>

          {/* Project-level documentation */}
          <div className="bg-white p-3.5 rounded-lg border border-slate-200">
            <AttachmentList
              attachments={order.attachments || []}
              onAddAttachment={handleAddOrderAttachment}
              onDeleteAttachment={handleDeleteOrderAttachment}
              title="Główna dokumentacja projektu"
              readOnly={!profile.canEditAll}
              canDownload={profile.canDownload}
              orderNumber={order.orderNumber}
              folderCategory="01_Dokumentacja_Glowna"
              currentProfile={profile}
              onOpenFolderManager={(fKey) => {
                setSelectedFolderForModal(fKey || '01_Dokumentacja_Glowna');
                setIsOrderFilesModalOpen(true);
              }}
            />
          </div>
        </div>

        {/* POZIOM 2 — KAFLE WSZYSTKICH ELEMENTÓW (SZYBKI PRZEGLĄD I ZMIANA STATUSÓW) */}
        <div className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Elementy stacji transformatorowej ({visibleItems.length})
                </h2>
                {!profile.canEditAll && profile.id !== 'ogolny' && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${profile.badgeBg}`}>
                    {profile.shortName}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {profile.canEditAll
                  ? 'Zmiany statusu i parametrów pozostają lokalne. Kliknij „Zapisz zmiany” przy odpowiednim elemencie, aby wysłać je na serwer.'
                  : `Uprawnienia konta „${profile.name}”: edycja wybranych elementów, podgląd pozostałych.`}
              </p>
            </div>

            {/* Scope filter toggle and hidden main positions */}
            <div className="flex flex-wrap items-center gap-2">
              {hiddenItems.length > 0 && (
                <button type="button" onClick={() => setShowHiddenItems((shown) => !shown)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer" aria-expanded={showHiddenItems}>
                  {showHiddenItems ? 'Ukryj ukryte' : `Pokaż ukryte (${hiddenItems.length})`}
                </button>
              )}
              {!profile.canEditAll && profile.id !== 'ogolny' && (
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
                  <button
                    type="button"
                    onClick={() => setItemsFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all ${
                      itemsFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Wszystkie ({visibleItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemsFilter('my_scope')}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-all flex items-center gap-1 ${
                      itemsFilter === 'my_scope'
                        ? 'bg-blue-600 text-white shadow-2xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span>Moje do edycji ({visibleItems.filter((it) => canEditItemType(profile, it.type)).length})</span>
                  </button>
                </div>
              )}

              {showHiddenItems && hiddenItems.length > 0 && (
                <div className="mb-4 basis-full rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-900">Ukryte pozycje główne</h3>
                  <div className="flex flex-wrap gap-2">
                    {hiddenItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                        <span className="text-xs font-semibold text-slate-800">{item.name}</span>
                        <button type="button" onClick={() => handleItemStatusChange(item.id, 'NOT_ORDERED')} className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-blue-700 cursor-pointer" title={`Przywróć pozycję ${item.name} do panelu zlecenia`}>Przywróć</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completeness Pill Stats */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-bold text-emerald-900 bg-emerald-100 px-2.5 py-1 rounded-md border border-emerald-300 shadow-2xs">
                  🟢 {readyItemsCount}
                </span>
                {inProgressItemsCount > 0 && (
                  <span className="font-bold text-amber-950 bg-amber-100 px-2.5 py-1 rounded-md border border-amber-300 shadow-2xs">
                    🟡 {inProgressItemsCount}
                  </span>
                )}
                <span className="font-bold text-blue-900 bg-blue-100 px-2.5 py-1 rounded-md border border-blue-300 shadow-2xs">
                  🔵 {orderedItemsCount}
                </span>
                {problemItemsCount > 0 && (
                  <span className="font-black text-white bg-rose-600 px-2.5 py-1 rounded-md border border-rose-700 shadow-xs animate-pulse">
                    🔴 {problemItemsCount}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Elements Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 [&>*]:min-w-0">
            {visibleItems
              .filter((it) => {
                if (itemsFilter === 'my_scope' && !profile.canEditAll) {
                  return canEditItemType(profile, it.type);
                }
                return true;
              })
              .map((item, index) => {
                const isProblem = item.status === 'PROBLEM';
                const isReady = item.status === 'READY';
                const isInProgress = item.status === 'IN_PROGRESS';
                const isOrdered = item.status === 'ORDERED';
                const canEditItem = canEditItemType(profile, item.type);
                const hint = getItemPermissionHint(profile, item.type, item.name);

                return (
                  <div
                    key={item.id}
                    onClick={() => scrollToItem(item.type)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between hover:shadow-md ${
                      isProblem
                        ? 'bg-rose-50/90 border-rose-300 border-l-4 border-l-rose-600 ring-1 ring-rose-300/60'
                        : isReady
                        ? 'bg-emerald-50/80 border-emerald-300 border-l-4 border-l-emerald-600'
                        : isInProgress
                        ? 'bg-amber-50/90 border-amber-300 border-l-4 border-l-amber-500'
                        : isOrdered
                        ? 'bg-blue-50/80 border-blue-300 border-l-4 border-l-blue-600'
                        : 'bg-white border-slate-200 border-l-4 border-l-slate-400'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-bold text-slate-400">
                            {String(index + 1).padStart(2, '0')}.
                          </span>
                          <h3 className="text-xs font-bold text-slate-900 break-words min-w-0" title={item.name}>
                            {item.name}
                          </h3>
                          {canEditItem ? (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.2 rounded">
                              ✏️ Edycja
                            </span>
                          ) : (
                            <span
                              className="text-[9px] font-medium bg-slate-200 text-slate-700 border border-slate-300 px-1 py-0.2 rounded inline-flex items-center gap-0.5"
                              title={hint.reason}
                            >
                              <Lock className="w-2.5 h-2.5 text-slate-500" />
                              Podgląd
                            </span>
                          )}
                        </div>

                        {/* Snippet / preview */}
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                          {item.type === 'ROZDZIELNICA_SN' && (item.details?.producent || item.details?.model || item.details?.typRozdzielnicy) ? (
                            <span className="text-amber-950 font-medium">
                              <strong className="text-amber-900">{item.details.producent || 'Schneider Electric'}</strong> ·{' '}
                              {item.details.model || item.details.typRozdzielnicy || 'AirSeT'} ·{' '}
                              {item.details.liczbaPol ?? item.details.iloscPol ?? '3'} pola ({item.details.konfiguracjaPol || 'L-L-L-T'})
                            </span>
                          ) : item.type === 'ROZDZIELNICA_NN' && (item.details?.typRozdzielnicy || item.details?.iloscPol) ? (
                            <span className="text-blue-900 font-medium">
                              {item.details.typRozdzielnicy || 'RTS-z'} · {item.details.iloscPol || '8'} pól
                              {item.details.planowanaGotowoscTransportu &&
                                ` · Gotowość: ${item.details.planowanaGotowoscTransportu.split('-').reverse().join('.')}`}
                            </span>
                          ) : item.type === 'OBUDOWA' && (item.details?.typObudowy || item.details?.rozmiar) ? (
                            <span className="text-indigo-950 font-medium">
                              <strong className="text-indigo-900">{item.details.typObudowy || 'BEK'}</strong> ·{' '}
                              {item.details.rozmiar || 'BEK 250/350'}
                              {item.details.dataGotowosci &&
                                ` · Gotowość: ${item.details.dataGotowosci.split('-').reverse().join('.')}`}
                            </span>
                          ) : item.type === 'DRZWI' && item.details?.numerDokumentu ? (
                            <span className="text-amber-950 font-medium">
                              <strong className="text-amber-900 font-mono">{item.details.numerDokumentu}</strong>
                              {item.details.ilosc && ` · ${item.details.ilosc}`}
                              {item.details.typ && ` · ${item.details.typ}`}
                            </span>
                          ) : item.notes ? (
                            item.notes
                          ) : (
                            'Kliknij, aby otworzyć szczegóły...'
                          )}
                        </p>
                      </div>

                      {/* Quick status switcher */}
                      <div onClick={(e) => e.stopPropagation()}>
                        <StatusSwitcher
                          currentStatus={item.status}
                          onChange={(newSt) => handleItemStatusChange(item.id, newSt)}
                          variant="dropdown"
                          readOnly={!canEditItem}
                          readOnlyNotice={hint.reason}
                        />
                      </div>
                    </div>

                    {/* Bottom bar of card */}
                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {item.orderDate && (
                        <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                          Zlecono: {item.orderDate.split('-').reverse().join('.')}
                        </span>
                      )}
                      {item.plannedDate && (
                        <span className="font-mono text-slate-600">
                          Termin: {item.plannedDate.split('-').reverse().join('.')}
                        </span>
                      )}
                      {item.attachments && item.attachments.length > 0 && (
                        <span>📎 {item.attachments.length}</span>
                      )}
                    </div>

                    <span className="text-blue-600 hover:underline font-medium flex items-center gap-0.5">
                      Szczegóły ↓
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* POZIOM 3 — SZCZEGÓŁY POSZCZEGÓLNYCH ELEMENTÓW (PRZEWIJANIE W DÓŁ) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Szczegółowe informacje o elementach
            </h2>
            <p className="text-xs text-slate-500">
              Parametry techniczne, planowane terminy, uwagi montażowe i pliki dokumentacji
            </p>
          </div>

          {/* Quick jump anchor bar */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto py-1">
            <span className="shrink-0 text-slate-400">Skocz do:</span>
            {visibleItems.slice(0, 8).map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => scrollToItem(it.type)}
                className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 rounded text-[11px] text-slate-700 cursor-pointer shrink-0"
              >
                {it.shortName}
              </button>
            ))}
          </div>
        </div>

        {/* List of full item cards */}
        <div className="space-y-4">
          {visibleItems.map((item) => {
            const isLastSNItem = item.type === 'ROZDZIELNICA_SN' && !order.items.slice(order.items.findIndex((entry) => entry.id === item.id) + 1).some((entry) => entry.type === 'ROZDZIELNICA_SN');
            const isLastNNItem = item.type === 'ROZDZIELNICA_NN' && !order.items.slice(order.items.findIndex((entry) => entry.id === item.id) + 1).some((entry) => entry.type === 'ROZDZIELNICA_NN');
            const itemIndex = order.items.findIndex((entry) => entry.id === item.id);
            return (
            <div key={item.id} id={itemIndex === order.items.findIndex((entry) => entry.type === item.type) ? `item-section-${item.type}` : `item-section-${item.type}-${item.id}`} className="space-y-2">
            {item.type === 'ROZDZIELNICA_SN' && order.items.find((entry) => entry.type === 'ROZDZIELNICA_SN')?.id === item.id && linkedSNRecordsForOrder.length > 0 && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-blue-900">
                    Rozdzielnica SN z zestawienia
                  </h3>
                  <span className="rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-800">
                    {linkedSNRecordsForOrder.length} {linkedSNRecordsForOrder.length === 1 ? 'pozycja' : 'pozycje'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {linkedSNRecordsForOrder.map((record, index) => (
                    <div key={record.id} className="rounded-lg border border-blue-100 bg-white p-3">
                      <div className="mb-2 text-xs font-bold text-slate-800">
                        {index === 0 ? 'Rozdzielnica SN do ZL' : `Rozdzielnica SN do ZL ${index + 1}`}
                      </div>
                      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
                        {[
                          ['Typ zestawienia', record.type === 'SIEMENS' ? 'SIEMENS' : record.type === 'XIRIA' ? 'XIRIA' : record.type === 'RM_AIRSET_STOEN' ? 'RM AirSeT – STOEN' : 'RM AirSeT'],
                          ['Rodzaj', record.rodzaj],
                          ['Ilość', String(record.ilosc ?? '')],
                          ['Status', record.category === 'DELIVERED' ? 'Dostarczone' : record.category === 'TO_DELIVER' ? 'Do dostarczenia' : 'Wolne na magazynie'],
                          ['Termin dostawy', record.terminDostawy === 'dostarczono' ? 'Dostarczono' : record.terminDostawy],
                          ['Nr zamówienia', record.nrZamowienia],
                          ['Lokalizacja', record.lokalizacja],
                        ].filter((entry) => entry[1] && entry[1].trim()).map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-[10px] font-medium text-slate-500">{label}</dt>
                            <dd className="break-words text-xs font-semibold text-slate-800">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <ItemDetailsCard
              item={item}
              orderItems={order.items}
              orderNumber={order.orderNumber}
              doorOrders={doorOrders}
              onStatusChange={(newStatus) => handleItemStatusChange(item.id, newStatus)}
              onUpdateNotes={(notes) => handleUpdateItemNotes(item.id, notes)}
              onUpdateDates={(orderDate, plannedDate, completedDate) =>
                handleUpdateItemDates(item.id, orderDate, plannedDate, completedDate)
              }
              onUpdateDetails={(newDetails) => handleUpdateItemDetails(item.id, newDetails)}
              onOpenEditModal={() => onOpenEditItemModal(item)}
              onAddAttachment={(attachment) => handleAddItemAttachment(item.id, attachment)}
              onDeleteAttachment={(attachmentId) =>
                handleDeleteItemAttachment(item.id, attachmentId)
              }
              onNavigateToDoorModule={onNavigateToDoorModule}
              onCreateDoorOrderForStation={() =>
                onCreateDoorOrder && onCreateDoorOrder(order.orderNumber, `${order.stationSize} ${order.projectName}`)
              }
              currentProfile={profile}
              onOpenFolderManager={(fKey) => {
                setSelectedFolderForModal(fKey || '01_Dokumentacja_Glowna');
                setIsOrderFilesModalOpen(true);
              }}
            />
            {canEditItemType(profile, item.type) && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => onSaveOrderChanges(order)}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition-colors cursor-pointer"
                  title={`Zapisz zmiany dotyczące elementu ${item.name} na serwerze`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Zapisz zmiany — {item.shortName}
                </button>
              </div>
            )}
            {(isLastSNItem || isLastNNItem) && canEditItemType(profile, item.type) && (
              <div className={`rounded-xl border border-dashed ${isLastSNItem ? 'border-amber-300 bg-amber-50/50' : 'border-blue-300 bg-blue-50/50'} p-3`}>
                <button
                  type="button"
                  onClick={() => handleAddSwitchgear(item.type as 'ROZDZIELNICA_SN' | 'ROZDZIELNICA_NN')}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${isLastSNItem ? 'border-amber-300 bg-white text-amber-900 hover:bg-amber-100' : 'border-blue-300 bg-white text-blue-900 hover:bg-blue-100'}`}
                >
                  <span className="text-base leading-none">+</span>
                  Dodaj rozdzielnicę {isLastSNItem ? 'SN' : 'NN'}
                </button>
                <p className="mt-1 text-[10px] text-slate-500">
                  Nowa rozdzielnica zostanie dodana jako osobna, wyraźnie oddzielona karta w tej sekcji.
                </p>
              </div>
            )}
            </div>
            );
          })}
        </div>
      </div>

      </div>\n      <OrderTasksPanel
        orderId={order.id}
        orderNumber={order.orderNumber}
        projectName={order.projectName}
        client={order.client}
        currentProfile={profile}
        onOpenChange={onOrderTasksPanelOpenChange}
      />

      {/* Offer Document Generator & Technical Sheet Modal */}
      <OfferDocumentModal
        order={order}
        isOpen={isOfferModalOpen}
        onClose={() => setIsOfferModalOpen(false)}
        canDownload={profile.canDownload}
      />

      {/* Order Files & Folder Locations Modal */}
      <OrderFilesModal
        isOpen={isOrderFilesModalOpen}
        onClose={() => setIsOrderFilesModalOpen(false)}
        orderNumber={order.orderNumber}
        projectName={order.projectName}
        currentProfile={profile}
        initialFolderKey={selectedFolderForModal}
        onAttachmentAdded={(att) => {
          // If attachment belongs to an item folder, add to that item, otherwise to order
          const matchedItem = order.items.find((it) => {
            if (att.folderCategory === '02_Obudowa_Betonowa' && it.type === 'OBUDOWA') return true;
            if (att.folderCategory === '03_Rozdzielnica_SN' && it.type === 'ROZDZIELNICA_SN') return true;
            if (att.folderCategory === '04_Rozdzielnica_NN' && it.type === 'ROZDZIELNICA_NN') return true;
            if (att.folderCategory === '05_Mosty_i_Szynoprzewody' && it.type === 'MOST') return true;
            if (att.folderCategory === '06_Rysunki_i_Akceptacje' && it.type === 'RYS_AKCEPTACJA') return true;
            if (att.folderCategory === '07_Kolory_i_Elewacja' && it.type === 'KOLORY') return true;
            if (att.folderCategory === '08_Opisy_i_Oznaczenia' && it.type === 'OPISY') return true;
            if (att.folderCategory === '09_Drzwi_i_Slusarka' && it.type === 'DRZWI') return true;
            if (
              att.folderCategory === '10_Podwykonawcy_i_Montaz' &&
              (it.type === 'ZAP_SERWISPOL' || it.type === 'ZAM_SERWISPOL' || it.type === 'ZLECENIE_MONTAZU')
            )
              return true;
            if (att.folderCategory === '11_Telemechanika_i_Lacznosc' && it.type === 'SZAFKA_TELEMECHANIKI') return true;
            if (att.folderCategory === '12_Dokumentacja_Powykonawcza' && it.type === 'POWYKONAWCZA') return true;
            return false;
          });

          if (matchedItem) {
            handleAddItemAttachment(matchedItem.id, att);
          } else {
            handleAddOrderAttachment(att);
          }
        }}
        onAttachmentDeleted={(deletedIdOrName) => {
          handleDeleteOrderAttachment(deletedIdOrName);
        }}
      />
    </div>
  );
};
