import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Order,
  OrderItem,
  calculateOrderStatus,
  DoorOrder,
  checkDoorOrderOverdue,
  formatDatePL,
  fetchCustomObudowaVariantsFromServer,
  setCustomObudowaVariants,
} from './types/enco';
import {
  loadOrders,
  saveOrders,
  createNewOrder,
  loadDoorOrders,
  saveDoorOrders,
  fetchOrdersFromServer,
  saveOrdersToServer,
  saveSingleOrderToServer,
  hasPendingOrderChanges,
  hasPendingDoorOrderChanges,
  setServerOrdersSnapshot,
  setServerDoorOrdersSnapshot,
  fetchDoorOrdersFromServer,
  saveDoorOrdersToServer,
  resetServerAndLocalData,
} from './services/storageService';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { OrderDetailView } from './components/OrderDetailView';
import { DoorOrdersView } from './components/DoorOrdersView';
import { DoorOrderModal } from './components/DoorOrderModal';
import { NewOrderModal } from './components/NewOrderModal';
import { EditOrderModal } from './components/EditOrderModal';
import { EditItemModal } from './components/EditItemModal';
import { RoleMatrixModal } from './components/RoleMatrixModal';
import { PasswordAuthModal } from './components/PasswordAuthModal';
import { DoorOrderDetailView } from './components/DoorOrderDetailView';
import { SNOrdersView } from './components/SNOrdersView';
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { validateOrderNumber } from './utils/orderNumberUtils';
import {
  UserRoleId,
  UserRoleProfile,
  USER_PROFILES,
  USER_PROFILES_LIST,
  hasPasswordProtection,
} from './types/userRole';

export default function App() {
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname);
  const [activeModule, setActiveModule] = useState<'orders' | 'doors' | 'sn'>(() => {
    const path = window.location.pathname;
    if (path === '/rozdzielnice-sn') return 'sn';
    return path === '/drzwi' || path.startsWith('/drzwi/') ? 'doors' : 'orders';
  });
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());
  const [doorOrders, setDoorOrders] = useState<DoorOrder[]>(() => loadDoorOrders());
  // Refs expose the newest local copies to async save/refresh callbacks.
  const ordersRef = useRef<Order[]>(orders);
  const doorOrdersRef = useRef<DoorOrder[]>(doorOrders);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { doorOrdersRef.current = doorOrders; }, [doorOrders]);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(() => {
    const match = window.location.pathname.match(/^\/zlecenia\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  });
  const selectedDoorOrderId = (() => {
    const match = currentPath.match(/^\/drzwi\/([^/]+)$/);
    return match ? decodeURIComponent(match[1]) : null;
  })();

  const navigate = (path: string) => {
    if (window.location.pathname !== path) window.history.pushState({}, '', path);
    setCurrentPath(path);
    if (path === '/rozdzielnice-sn') {
      setActiveModule('sn');
      setSelectedOrderId(null);
      sessionStorage.setItem('enco_active_module', 'sn');
      sessionStorage.removeItem('enco_selected_order_id');
    } else if (path === '/drzwi' || path.startsWith('/drzwi/')) {
      setActiveModule('doors');
      setSelectedOrderId(null);
      sessionStorage.setItem('enco_active_module', 'doors');
      sessionStorage.removeItem('enco_selected_order_id');
    } else {
      setActiveModule('orders');
      const match = path.match(/^\/zlecenia\/([^/]+)$/);
      const id = match ? decodeURIComponent(match[1]) : null;
      setSelectedOrderId(id);
      sessionStorage.setItem('enco_active_module', 'orders');
      if (id) sessionStorage.setItem('enco_selected_order_id', id);
      else sessionStorage.removeItem('enco_selected_order_id');
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      setCurrentPath(path);
      if (path === '/rozdzielnice-sn') {
        setActiveModule('sn');
        setSelectedOrderId(null);
      } else if (path === '/drzwi' || path.startsWith('/drzwi/')) {
        setActiveModule('doors');
        setSelectedOrderId(null);
      } else {
        setActiveModule('orders');
        const match = path.match(/^\/zlecenia\/([^/]+)$/);
        setSelectedOrderId(match ? decodeURIComponent(match[1]) : null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [filterTab, setFilterTab] = useState<string>('all');

  // User Profile Role State
  const [currentRoleId, setCurrentRoleId] = useState<UserRoleId>(() => {
    const saved = localStorage.getItem('enco_current_role_id');
    if (saved && saved in USER_PROFILES) {
      return saved as UserRoleId;
    }
    return 'admin';
  });
  const [isRoleMatrixOpen, setIsRoleMatrixOpen] = useState(false);
  const [pendingRoleId, setPendingRoleId] = useState<UserRoleId | null>(null);
  const [isPasswordAuthModalOpen, setIsPasswordAuthModalOpen] = useState(false);

  const currentProfile: UserRoleProfile = USER_PROFILES[currentRoleId] || USER_PROFILES.admin;

  const handleSelectProfile = (roleId: UserRoleId) => {
    if (roleId === currentRoleId) return;

    // Jeśli profil jest chroniony hasłem, wymagaj autoryzacji
    if (hasPasswordProtection(roleId)) {
      setPendingRoleId(roleId);
      setIsPasswordAuthModalOpen(true);
      return;
    }

    // Profil bez hasła (np. Ogólny) przełącz natychmiast
    setCurrentRoleId(roleId);
    localStorage.setItem('enco_current_role_id', roleId);
    const profile = USER_PROFILES[roleId];
    showToast(`Przełączono profil: ${profile.name} (${profile.shortName})`, 'info');
  };

  const handlePasswordAuthSuccess = (authenticatedRoleId: UserRoleId) => {
    setCurrentRoleId(authenticatedRoleId);
    localStorage.setItem('enco_current_role_id', authenticatedRoleId);
    setIsPasswordAuthModalOpen(false);
    setPendingRoleId(null);
    const profile = USER_PROFILES[authenticatedRoleId];
    showToast(`Zalogowano pomyślnie do konta: ${profile.name} (${profile.shortName})`, 'success');
  };

  // Modals state
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);
  const [isEditOrderModalOpen, setIsEditOrderModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<OrderItem | null>(null);

  // Door order modal state
  const [isDoorOrderModalOpen, setIsDoorOrderModalOpen] = useState(false);
  const [editingDoorOrder, setEditingDoorOrder] = useState<DoorOrder | null>(null);
  const [newDoorOrderDefaults, setNewDoorOrderDefaults] = useState<{ zl?: string; realizacje?: string }>({});

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'info' | 'warning';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'warning' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const pendingOrdersRef = useRef(false);
  const pendingDoorOrdersRef = useRef(false);
  const refreshRequestIdRef = useRef(0);
  // Śledzi wyłącznie lokalnie otwarty formularz.
  const editingItemRef = useRef(false);

  // Server data is applied only at startup or after the user clicks ODŚWIEŻ.
  // The latest request wins; background/older requests cannot overwrite newer local state.
  const refreshDataFromServer = async (options?: { orders?: boolean; doors?: boolean; discardPending?: boolean; showMessage?: boolean }) => {
    const requestId = ++refreshRequestIdRef.current;
    const loadServerOrders = options?.orders !== false;
    const loadServerDoors = options?.doors !== false;
    const [srvOrders, srvDoors, srvCustomObudowaVariants] = await Promise.all([
      loadServerOrders ? fetchOrdersFromServer() : Promise.resolve(null),
      loadServerDoors ? fetchDoorOrdersFromServer() : Promise.resolve(null),
      fetchCustomObudowaVariantsFromServer(),
    ]);

    // Ignore an older request if a later manual refresh has already started.
    if (requestId !== refreshRequestIdRef.current) return;

    // Do not advance the baseline for a module with unsaved local edits.
    // Otherwise a navigation refresh could silently lose track of those edits.
    const applyOrders = Boolean(srvOrders) &&
      (options?.discardPending === true || !pendingOrdersRef.current);
    const applyDoors = Boolean(srvDoors) &&
      (options?.discardPending === true || !pendingDoorOrdersRef.current);

    if (srvOrders && applyOrders) {
      setServerOrdersSnapshot(srvOrders);
      setOrders(srvOrders);
      ordersRef.current = srvOrders;
      saveOrders(srvOrders);
    }
    if (srvDoors && applyDoors) {
      setServerDoorOrdersSnapshot(srvDoors);
      setDoorOrders(srvDoors);
      doorOrdersRef.current = srvDoors;
      saveDoorOrders(srvDoors);
    }
    if (srvCustomObudowaVariants) setCustomObudowaVariants(srvCustomObudowaVariants);

    // A failed refresh must not clear the unsaved indicator or discard local work.
    if (options?.discardPending) {
      if (loadServerOrders && srvOrders) pendingOrdersRef.current = false;
      if (loadServerDoors && srvDoors) pendingDoorOrdersRef.current = false;
      setHasPendingChanges(pendingOrdersRef.current || pendingDoorOrdersRef.current);
    }

    if (options?.showMessage) {
      if ((loadServerOrders && !srvOrders) || (loadServerDoors && !srvDoors) || !srvCustomObudowaVariants) {
        showToast('Nie udało się pobrać wszystkich danych z serwera. Niezapisane zmiany pozostają lokalnie.', 'warning');
      } else {
        showToast('Dane odświeżone z serwera.', 'success');
      }
    }
  };

  // Re-fetch only for this browser tab on first load and on actual URL changes.
  // This also covers browser Back/Forward, because popstate updates currentPath.
  // A save or a change elsewhere on the server never changes currentPath.
  useEffect(() => {
    void refreshDataFromServer();
  }, [currentPath]);

  // Keep edits local until the user explicitly saves them.
  const markChangesPending = () => setHasPendingChanges(true);

  const updateOrdersState = (newOrders: Order[]) => {
    setOrders(newOrders);
    saveOrders(newOrders);
    pendingOrdersRef.current = true;
    markChangesPending();
  };

  const updateDoorOrdersState = (newDoorOrders: DoorOrder[]) => {
    setDoorOrders(newDoorOrders);
    saveDoorOrders(newDoorOrders);
    pendingDoorOrdersRef.current = true;
    markChangesPending();
  };

  const handleSaveOrderChanges = async (orderToSave: Order) => {
    const latestOrders = orders.map((current) => current.id === orderToSave.id ? orderToSave : current);
    saveOrders(latestOrders);
    setOrders(latestOrders);
    ordersRef.current = latestOrders;
    pendingOrdersRef.current = true;
    setHasPendingChanges(true);

    // Zapis pojedynczego zlecenia nie może wysłać do serwera innych
    // zleceń, które w tej karcie są jeszcze niezapisane.
    const saved = await saveSingleOrderToServer(orderToSave);
    pendingOrdersRef.current = hasPendingOrderChanges(ordersRef.current);
    setHasPendingChanges(pendingOrdersRef.current || pendingDoorOrdersRef.current);

    if (saved) {
      showToast(`Zapisano zlecenie ${orderToSave.orderNumber} na serwerze. Pozostałe lokalne zmiany nie zostały wysłane.`, 'success');
    } else {
      showToast('Nie udało się zapisać zlecenia na serwerze. Zmiany pozostają lokalnie — spróbuj ponownie.', 'warning');
    }
  };

  const handleSaveAllChanges = async () => {
    const ordersAtClick = orders;
    const doorsAtClick = doorOrders;
    const [ordersSaved, doorsSaved] = await Promise.all([
      pendingOrdersRef.current ? saveOrdersToServer(ordersAtClick) : Promise.resolve(true),
      pendingDoorOrdersRef.current ? saveDoorOrdersToServer(doorsAtClick) : Promise.resolve(true),
    ]);

    // Recalculate against the snapshot actually saved. If the user edited more
    // data while the request was in flight, those newer edits remain pending.
    if (ordersSaved) pendingOrdersRef.current = hasPendingOrderChanges(ordersRef.current);
    if (doorsSaved) pendingDoorOrdersRef.current = hasPendingDoorOrderChanges(doorOrdersRef.current);
    setHasPendingChanges(pendingOrdersRef.current || pendingDoorOrdersRef.current);

    if (ordersSaved && doorsSaved) {
      if (pendingOrdersRef.current || pendingDoorOrdersRef.current) {
        showToast('Zapisano poprzedni zestaw zmian. Nowsze zmiany nadal pozostają lokalne — zapisz je ponownie.', 'info');
      } else {
        showToast('Zmiany zapisane na serwerze. Lokalny widok nie został odświeżony.', 'success');
      }
    } else {
      showToast('Nie udało się zapisać wszystkich zmian na serwerze. Dane pozostają lokalnie — spróbuj ponownie.', 'warning');
    }
  };

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) || null;

  // Problem orders count for header badge
  const problemOrdersCount = orders.filter((o) => o.status === 'PROBLEM').length;

  // Door overdue count
  const doorOverdueCount = doorOrders.filter(
    (d) => checkDoorOrderOverdue(d.terminZamowienia, d.terminDostawy).isOverdue
  ).length;

  const existingZlSuggestions = useMemo(() => {
    return Array.from(new Set(orders.map((o) => o.orderNumber).filter(Boolean)));
  }, [orders]);

  const existingStationSuggestions = useMemo(() => {
    return Array.from(
      new Set(
        orders
          .map((o) => `${o.stationSize} ${o.projectName}`.trim())
          .filter(Boolean)
      )
    );
  }, [orders]);

  const handleSelectOrder = (orderId: string) => {
    navigate(`/zlecenia/${encodeURIComponent(orderId)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToDashboard = () => {
    navigate('/zlecenia');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateOrder = (params: {
    orderNumber: string;
    client: string;
    projectName: string;
    stationSize: string;
    departureDate: string;
    generalNotes?: string;
    additionalInfo?: string;
  }) => {
    if (!currentProfile.canCreateOrders) {
      showToast(`Profil „${currentProfile.name}” nie ma uprawnień do tworzenia zleceń`, 'warning');
      return;
    }
    const val = validateOrderNumber(params.orderNumber, orders, undefined, new Date().getFullYear());
    if (!val.isValid) {
      showToast(val.error || 'Numer zlecenia jest zajęty', 'warning');
      return;
    }
    const newOrd = createNewOrder({
      ...params,
      orderNumber: val.normalized,
    });
    const updated = [newOrd, ...orders];
    updateOrdersState(updated);
    sessionStorage.setItem('enco_active_module', 'orders');
    sessionStorage.setItem('enco_selected_order_id', newOrd.id);
    // Każde nowe zlecenie dostaje od razu własną podstronę i adres URL.
    navigate(`/zlecenia/${encodeURIComponent(newOrd.id)}`);
    showToast(`Utworzono zlecenie ${newOrd.orderNumber} (${newOrd.projectName})`, 'success');
  };

  const handleUpdateOrderStatus = (orderId: string, updatedOrder: Order) => {
    const computedStatus = calculateOrderStatus(updatedOrder.items);
    const orderWithStatus: Order = {
      ...updatedOrder,
      status: computedStatus,
      updatedAt: new Date().toISOString(),
    };

    const newOrders = orders.map((o) => (o.id === orderId ? orderWithStatus : o));
    updateOrdersState(newOrders);
  };

  const handleSaveOrderMetadata = (updatedFields: Partial<Order>) => {
    if (!selectedOrderId) return;
    const current = orders.find((o) => o.id === selectedOrderId);
    if (!current) return;

    let normalizedOrderNumber = current.orderNumber;
    if (updatedFields.orderNumber && updatedFields.orderNumber.trim()) {
      const val = validateOrderNumber(updatedFields.orderNumber, orders, current.id);
      if (!val.isValid) {
        showToast(val.error || 'Numer zlecenia jest zajęty', 'warning');
        return;
      }
      normalizedOrderNumber = val.normalized;
    }

    const updated: Order = {
      ...current,
      ...updatedFields,
      orderNumber: normalizedOrderNumber,
      updatedAt: new Date().toISOString(),
    };

    void handleSaveOrderChanges(updated);
    showToast(`Zaktualizowano dane zlecenia ${updated.orderNumber}`, 'info');
  };

  const handleDeleteOrder = (orderId: string) => {
    if (!currentProfile.canDeleteOrders) {
      showToast(`Profil „${currentProfile.name}” nie ma uprawnień do usuwania zleceń`, 'warning');
      return;
    }
    const newOrders = orders.filter((o) => o.id !== orderId);
    updateOrdersState(newOrders);
    navigate('/zlecenia');
    showToast('Zlecenie zostało usunięte', 'info');
  };

  const handleCancelItemEdit = () => {
    // Anulowanie zamyka formularz bez pobierania danych z serwera.
    editingItemRef.current = false;
    setEditingItem(null);
  };

  const handleSaveEditedItem = (updatedItem: OrderItem) => {
    if (!selectedOrder) return;

    const updatedItems = selectedOrder.items.map((i) =>
      i.id === updatedItem.id ? updatedItem : i
    );

    const computedStatus = calculateOrderStatus(updatedItems);
    const updatedOrder: Order = {
      ...selectedOrder,
      items: updatedItems,
      status: computedStatus,
      updatedAt: new Date().toISOString(),
    };

    // Zatwierdzenie formularza aktualizuje wyłącznie lokalny stan.
    // Wysłanie zmian na serwer następuje dopiero po kliknięciu
    // przycisku „Zapisz zmiany” przy odpowiednim elemencie.
    const updatedOrders = orders.map((order) =>
      order.id === updatedOrder.id ? updatedOrder : order
    );
    updateOrdersState(updatedOrders);
    showToast(
      `Zmiany elementu „${updatedItem.name}” zapisano lokalnie. Kliknij „Zapisz zmiany” przy elemencie, aby wysłać je na serwer.`,
      'info'
    );
  };

  // Door Order Handlers
  const handleSaveDoorOrder = (savedDoorOrder: DoorOrder) => {
    if (!currentProfile.canManageDoors) {
      showToast(`Profil „${currentProfile.name}” nie posiada uprawnień do edycji drzwi`, 'warning');
      return;
    }
    const exists = doorOrders.some((d) => d.id === savedDoorOrder.id);
    let updated: DoorOrder[];
    if (exists) {
      updated = doorOrders.map((d) => (d.id === savedDoorOrder.id ? savedDoorOrder : d));
      showToast(`Zaktualizowano zamówienie drzwi: ${savedDoorOrder.numerDokumentu}`, 'success');
    } else {
      updated = [savedDoorOrder, ...doorOrders];
      showToast(`Dodano nowe zamówienie drzwi: ${savedDoorOrder.numerDokumentu}`, 'success');
      // Nowe zamówienie drzwi od razu otwiera własną podstronę.
      navigate(`/drzwi/${encodeURIComponent(savedDoorOrder.id)}`);
    }
    updateDoorOrdersState(updated);
  };

  const handleSaveDoorOrdersBulk = (savedDoorOrders: DoorOrder[]) => {
    if (!currentProfile.canManageDoors) {
      showToast(`Profil „${currentProfile.name}” nie posiada uprawnień do edycji drzwi`, 'warning');
      return;
    }
    const updates = new Map(savedDoorOrders.map((order) => [order.id, order]));
    const updated = doorOrders.map((order) => updates.get(order.id) || order);
    updateDoorOrdersState(updated);
    showToast(`Zapisano zmiany w ${savedDoorOrders.length} zamówieniach drzwi`, 'success');
  };

  const handleDeleteDoorOrder = (doorOrderId: string) => {
    if (!currentProfile.canManageDoors) {
      showToast(`Profil „${currentProfile.name}” nie posiada uprawnień do usuwania drzwi`, 'warning');
      return;
    }
    const toDelete = doorOrders.find((d) => d.id === doorOrderId);
    const updated = doorOrders.filter((d) => d.id !== doorOrderId);
    updateDoorOrdersState(updated);
    showToast(`Usunięto zamówienie drzwi ${toDelete?.numerDokumentu || ''}`, 'info');
  };

  const handleQuickConfirmDelivery = (doorOrder: DoorOrder) => {
    if (!currentProfile.canManageDoors) {
      showToast(`Profil „${currentProfile.name}” nie posiada uprawnień do potwierdzania dostaw`, 'warning');
      return;
    }
    const today = '2026-10-09';
    const nowIso = new Date().toISOString();
    const updatedHistory = doorOrder.history ? [...doorOrder.history] : [];
    updatedHistory.unshift({
      id: `h_${Date.now()}_conf`,
      timestamp: nowIso,
      field: 'terminDostawy',
      fieldName: 'Termin dostawy',
      oldValue: doorOrder.terminDostawy ? formatDatePL(doorOrder.terminDostawy) : 'Nieustalony',
      newValue: '09.10.2026',
      note: `Potwierdzenie przyjęcia dostawy przez profil ${currentProfile.name}`,
    });

    const updatedOrder: DoorOrder = {
      ...doorOrder,
      terminDostawy: today,
      history: updatedHistory,
      updatedAt: nowIso,
    };
    handleSaveDoorOrder(updatedOrder);
  };

  const handleResetData = async () => {
    if (!currentProfile.canResetDemo) {
      showToast('Tylko profil Administratora może przywrócić dane demonstracyjne', 'warning');
      return;
    }
    const res = await resetServerAndLocalData();
    if (!res.success) {
      showToast('Nie udało się przywrócić danych na serwerze. Lokalny widok pozostawiono bez zmian.', 'warning');
      return;
    }
    setOrders(res.orders);
    setDoorOrders(res.doorOrders);
    ordersRef.current = res.orders;
    doorOrdersRef.current = res.doorOrders;
    pendingOrdersRef.current = false;
    pendingDoorOrdersRef.current = false;
    setHasPendingChanges(false);
    sessionStorage.removeItem('enco_selected_order_id');
    setSelectedOrderId(null);
    showToast('Przywrócono przykładowe dane testowe zleceń i drzwi na serwerze.', 'info');
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Bar */}
      <Header
        onNewOrder={() => setIsNewOrderModalOpen(true)}
        onNewDoorOrder={() => {
          setEditingDoorOrder(null);
          setIsDoorOrderModalOpen(true);
        }}
        onResetData={handleResetData}
        onRefresh={() => void refreshDataFromServer({ discardPending: true, showMessage: true })}
        activeTab={filterTab}
        onSelectTab={(tab) => {
          setFilterTab(tab);
          navigate('/zlecenia');
        }}
        problemCount={problemOrdersCount}
        activeModule={activeModule}
        onSelectModule={(mod) => navigate(mod === 'doors' ? '/drzwi' : mod === 'sn' ? '/rozdzielnice-sn' : '/zlecenia')}
        doorOrdersCount={doorOrders.length}
        doorOverdueCount={doorOverdueCount}
        currentProfile={currentProfile}
        onSelectProfile={handleSelectProfile}
        onOpenMatrixModal={() => setIsRoleMatrixOpen(true)}
      />

      {/* Main Viewport */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 ${
        activeModule === 'doors' ? 'max-w-full xl:max-w-[1600px]' : 'max-w-7xl'
      }`}>
        {activeModule !== 'sn' && (
          <div className="flex items-center justify-between gap-3 mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
            <div className="text-xs text-slate-600">
              {hasPendingChanges ? 'Masz niezapisane zmiany.' : 'Wszystkie zmiany są zapisane.'}
            </div>
            <button
              type="button"
              onClick={handleSaveAllChanges}
              disabled={!hasPendingChanges}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                hasPendingChanges
                  ? 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              Zapisz zmiany
            </button>
          </div>
        )}
        {activeModule === 'sn' ? (
          <SNOrdersView orders={orders} currentProfile={currentProfile} onNavigateToOrder={handleSelectOrder} />
        ) : activeModule === 'doors' ? (
          selectedDoorOrderId ? (
            (() => {
              const doorOrder = doorOrders.find((item) => item.id === selectedDoorOrderId);
              if (!doorOrder) return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center"><h2 className="text-lg font-bold">Nie znaleziono zamówienia drzwi</h2><button type="button" onClick={() => navigate('/drzwi')} className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">Wróć do modułu drzwi</button></div>;
              return <DoorOrderDetailView order={doorOrder} onBack={() => navigate('/drzwi')} onEdit={() => { setEditingDoorOrder(doorOrder); setIsDoorOrderModalOpen(true); }} onDelete={() => { handleDeleteDoorOrder(doorOrder.id); navigate('/drzwi'); }} onQuickConfirm={() => handleQuickConfirmDelivery(doorOrder)} currentProfile={currentProfile} />;
            })()
          ) : (
          <DoorOrdersView
            doorOrders={doorOrders}
            orders={orders}
            onOpenDoorOrder={(doorOrd) => navigate(`/drzwi/${encodeURIComponent(doorOrd.id)}`)}
            onAddDoorOrder={() => {
              setEditingDoorOrder(null);
              setIsDoorOrderModalOpen(true);
            }}
            onEditDoorOrder={(doorOrd) => {
              setEditingDoorOrder(doorOrd);
              setIsDoorOrderModalOpen(true);
            }}
            onSaveDoorOrderDirect={handleSaveDoorOrder}
            onSaveDoorOrdersBulk={handleSaveDoorOrdersBulk}
            onDeleteDoorOrder={handleDeleteDoorOrder}
            onQuickConfirmDelivery={handleQuickConfirmDelivery}
            onNavigateToOrder={(ordId) => navigate(`/zlecenia/${encodeURIComponent(ordId)}`)}
            currentProfile={currentProfile}
          />
          )
        ) : selectedOrder ? (
          <OrderDetailView
            order={selectedOrder}
            doorOrders={doorOrders}
            onBack={handleBackToDashboard}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onSaveOrderChanges={handleSaveOrderChanges}
            onOpenEditOrderModal={() => setIsEditOrderModalOpen(true)}
            onOpenEditItemModal={(item) => {
              editingItemRef.current = true;
              setEditingItem(item);
            }}
            onNavigateToDoorModule={(numerDokumentu) => {
              const matchingDoor = doorOrders.find((item) => item.numerDokumentu === numerDokumentu);
              navigate(matchingDoor ? `/drzwi/${encodeURIComponent(matchingDoor.id)}` : '/drzwi');
            }}
            onCreateDoorOrder={(defaultZl, defaultStation) => {
              setEditingDoorOrder(null);
              setNewDoorOrderDefaults({
                zl: defaultZl,
                realizacje: defaultStation,
              });
              setIsDoorOrderModalOpen(true);
            }}
            currentProfile={currentProfile}
          />
        ) : (
          <DashboardView
            orders={orders}
            onSelectOrder={handleSelectOrder}
            onNewOrder={() => setIsNewOrderModalOpen(true)}
            filterTab={filterTab}
            onFilterTabChange={setFilterTab}
            doorOrders={doorOrders}
            onOpenDoorModule={() => navigate('/drzwi')}
            currentProfile={currentProfile}
          />
        )}
      </main>

      {/* Quiet Corporate Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-200">ENCO FLOW</span>
            <span className="text-slate-600">·</span>
            <span>System kontroli kompletności i monitorowania stacji transformatorowych</span>
          </div>
          <div className="text-slate-400">
            Dedykowane narzędzie operacyjne dla ENCO Sp. z o.o.
          </div>
        </div>
      </footer>

      {/* Modals */}
      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onSubmit={handleCreateOrder}
        existingOrders={orders}
      />

      <EditOrderModal
        order={selectedOrder}
        isOpen={isEditOrderModalOpen}
        onClose={() => setIsEditOrderModalOpen(false)}
        onSave={handleSaveOrderMetadata}
        onDelete={handleDeleteOrder}
        existingOrders={orders}
        currentProfile={currentProfile}
      />

      <EditItemModal
        item={editingItem}
        orderItems={selectedOrder?.items || []}
        doorOrders={doorOrders}
        isOpen={Boolean(editingItem)}
        onClose={() => {
          editingItemRef.current = false;
          setEditingItem(null);
        }}
        onCancel={handleCancelItemEdit}
        onSave={handleSaveEditedItem}
        currentProfile={currentProfile}
      />

      <DoorOrderModal
        order={editingDoorOrder}
        isOpen={isDoorOrderModalOpen}
        onClose={() => {
          setIsDoorOrderModalOpen(false);
          setEditingDoorOrder(null);
          setNewDoorOrderDefaults({});
        }}
        onSave={(savedDoor) => {
          handleSaveDoorOrder(savedDoor);
          setNewDoorOrderDefaults({});
        }}
        orders={orders}
        existingZlSuggestions={existingZlSuggestions}
        existingStationSuggestions={existingStationSuggestions}
        initialZl={newDoorOrderDefaults.zl}
        initialRealizacje={newDoorOrderDefaults.realizacje}
        onDelete={(id) => {
          handleDeleteDoorOrder(id);
          setIsDoorOrderModalOpen(false);
          setEditingDoorOrder(null);
        }}
        currentProfile={currentProfile}
      /> 
      
      {/* Role Matrix Modal */}
      <RoleMatrixModal
        isOpen={isRoleMatrixOpen}
        onClose={() => setIsRoleMatrixOpen(false)}
        activeProfileId={currentRoleId}
        onSelectProfile={handleSelectProfile}
      />

      {/* Password Authentication Modal */}
      <PasswordAuthModal
        isOpen={isPasswordAuthModalOpen}
        targetProfileId={pendingRoleId}
        onClose={() => {
          setIsPasswordAuthModalOpen(false);
          setPendingRoleId(null);
        }}
        onSuccess={handlePasswordAuthSuccess}
        onSwitchToGuest={() => {
          setIsPasswordAuthModalOpen(false);
          setPendingRoleId(null);
          handleSelectProfile('ogolny');
        }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xl border border-slate-800 animate-in fade-in slide-in-from-bottom-3 duration-200">
          {toastMessage.type === 'success' && (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          )}
          {toastMessage.type === 'warning' && (
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          )}
          {toastMessage.type === 'info' && (
            <Info className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
}
