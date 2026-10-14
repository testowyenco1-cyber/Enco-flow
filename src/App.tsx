import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Order,
  OrderItem,
  calculateOrderStatus,
  DoorOrder,
  checkDoorOrderOverdue,
  formatDatePL,
} from './types/enco';
import {
  loadOrders,
  saveOrders,
  createNewOrder,
  resetToDemoOrders,
  loadDoorOrders,
  saveDoorOrders,
  fetchOrdersFromServer,
  saveOrdersToServer,
  fetchDoorOrdersFromServer,
  saveDoorOrdersToServer,
  resetServerAndLocalData,
  setupRealtimeSync,
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
  const [activeModule, setActiveModule] = useState<'orders' | 'doors'>('orders');
  const [orders, setOrders] = useState<Order[]>(() => loadOrders());
  const [doorOrders, setDoorOrders] = useState<DoorOrder[]>(() => loadDoorOrders());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
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

  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const pendingOrdersRef = useRef(false);
  const pendingDoorOrdersRef = useRef(false);
  // Wstrzymuj zdalne odświeżanie zleceń podczas edycji formularza lub przy niezapisanych zmianach.
  const editingItemRef = useRef(false);
  const queuedRemoteOrdersRef = useRef<Order[] | null>(null);

  // Background fetch & real-time SSE listener
  useEffect(() => {
    // 1. Initial fetch from server to get changes made by User B
    fetchOrdersFromServer().then((srvOrders) => {
      if (srvOrders && srvOrders.length > 0) {
        setOrders(srvOrders);
      }
    });

    fetchDoorOrdersFromServer().then((srvDoors) => {
      if (srvDoors && srvDoors.length > 0) {
        setDoorOrders(srvDoors);
      }
    });

    // 2. Setup real-time SSE stream across all users and browsers
    const unsubscribe = setupRealtimeSync({
      onOrdersUpdated: (updatedOrders, isRemote) => {
        if (pendingOrdersRef.current || editingItemRef.current) {
          // Zapamiętaj najnowszy zdalny stan, ale nie zmieniaj widoku w trakcie edycji.
          queuedRemoteOrdersRef.current = updatedOrders;
          return;
        }
        saveOrders(updatedOrders);
        setOrders(updatedOrders);
        if (isRemote) {
          showToast('Dane zleceń zaktualizowane w czasie rzeczywistym z serwera', 'info');
        }
      },
      onDoorOrdersUpdated: (updatedDoors, isRemote) => {
        if (pendingDoorOrdersRef.current) {
          showToast('Otrzymano zmianę zamówień drzwi z innej sesji. Najpierw zapisz lub rozstrzygnij lokalne zmiany drzwi.', 'warning');
          return;
        }
        saveDoorOrders(updatedDoors);
        setDoorOrders(updatedDoors);
        if (isRemote) {
          showToast('Dane zamówień drzwi zaktualizowane w czasie rzeczywistym z serwera', 'info');
        }
      },
      onReset: () => {
        if (pendingOrdersRef.current || pendingDoorOrdersRef.current || editingItemRef.current) {
          showToast('Serwer zgłosił reset danych, ale masz niezapisane zmiany. Zapisz je lub odśwież aplikację po rozstrzygnięciu konfliktu.', 'warning');
          return;
        }
        setOrders(loadOrders());
        setDoorOrders(loadDoorOrders());
        setSelectedOrderId(null);
        showToast('Zresetowano dane demonstracyjne', 'info');
      },
      onStatusChange: (connected) => {
        setIsRealtimeConnected(connected);
      },
    });

    return unsubscribe;
  }, []);

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
    const saved = await saveOrdersToServer(latestOrders);
    if (saved) {
      pendingOrdersRef.current = false;
      setHasPendingChanges(pendingDoorOrdersRef.current);

      // Po zatwierdzeniu własnej edycji przywróć zdalne zmiany otrzymane w trakcie.
      // Edytowane właśnie zlecenie zachowuje wersję, którą użytkownik świadomie zapisał.
      const queuedRemoteOrders = queuedRemoteOrdersRef.current;
      queuedRemoteOrdersRef.current = null;
      if (queuedRemoteOrders) {
        const remoteOrderIds = new Set(queuedRemoteOrders.map((order) => order.id));
        const mergedOrders = queuedRemoteOrders.map((remoteOrder) =>
          remoteOrder.id === orderToSave.id
            ? (latestOrders.find((localOrder) => localOrder.id === orderToSave.id) || remoteOrder)
            : remoteOrder
        );
        latestOrders.forEach((localOrder) => {
          if (!remoteOrderIds.has(localOrder.id)) mergedOrders.push(localOrder);
        });
        saveOrders(mergedOrders);
        setOrders(mergedOrders);
        // Rozgłoś scalony stan, aby zachować także zmiany innych zleceń.
        const mergedSaved = await saveOrdersToServer(mergedOrders);
        if (!mergedSaved) {
          pendingOrdersRef.current = true;
          setHasPendingChanges(true);
          showToast('Twoje zmiany zapisano, ale nie udało się zsynchronizować zmian otrzymanych od innych użytkowników.', 'warning');
          return;
        }
      }
      showToast(`Zapisano zmiany w zleceniu ${orderToSave.orderNumber}.`, 'success');
    } else {
      showToast('Nie udało się zapisać zmian na serwerze. Zmiany pozostają lokalnie — spróbuj ponownie.', 'warning');
    }
  };

  const handleSaveAllChanges = async () => {
    const [ordersSaved, doorsSaved] = await Promise.all([
      pendingOrdersRef.current ? saveOrdersToServer(orders) : Promise.resolve(true),
      pendingDoorOrdersRef.current ? saveDoorOrdersToServer(doorOrders) : Promise.resolve(true),
    ]);

    if (ordersSaved && doorsSaved) {
      pendingOrdersRef.current = false;
      pendingDoorOrdersRef.current = false;
      queuedRemoteOrdersRef.current = null;
      setHasPendingChanges(false);
      showToast('Zmiany zapisane na serwerze i zsynchronizowane.', 'success');
    } else {
      showToast('Nie udało się zapisać wszystkich zmian na serwerze. Dane pozostają w pamięci lokalnej — spróbuj ponownie.', 'warning');
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
    setSelectedOrderId(orderId);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToDashboard = () => {
    setSelectedOrderId(null);
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
    const val = validateOrderNumber(params.orderNumber, orders);
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
    setSelectedOrderId(newOrd.id);
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
    setSelectedOrderId(null);
    showToast('Zlecenie zostało usunięte', 'info');
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
    }
    updateDoorOrdersState(updated);
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
    setOrders(res.orders);
    setDoorOrders(res.doorOrders);
    setSelectedOrderId(null);
    showToast('Przywrócono przykładowe dane testowe zleceń i drzwi (zsynchronizowano z serwerem)', 'info');
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
        activeTab={filterTab}
        onSelectTab={(tab) => {
          setFilterTab(tab);
          setSelectedOrderId(null);
        }}
        problemCount={problemOrdersCount}
        activeModule={activeModule}
        onSelectModule={(mod) => {
          setActiveModule(mod);
          setSelectedOrderId(null);
        }}
        doorOrdersCount={doorOrders.length}
        doorOverdueCount={doorOverdueCount}
        currentProfile={currentProfile}
        onSelectProfile={handleSelectProfile}
        onOpenMatrixModal={() => setIsRoleMatrixOpen(true)}
        isRealtimeConnected={isRealtimeConnected}
      />

      {/* Main Viewport */}
      <main className={`flex-1 w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 ${
        activeModule === 'doors' ? 'max-w-full xl:max-w-[1600px]' : 'max-w-7xl'
      }`}>
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
        {activeModule === 'doors' ? (
          <DoorOrdersView
            doorOrders={doorOrders}
            orders={orders}
            onAddDoorOrder={() => {
              setEditingDoorOrder(null);
              setIsDoorOrderModalOpen(true);
            }}
            onEditDoorOrder={(doorOrd) => {
              setEditingDoorOrder(doorOrd);
              setIsDoorOrderModalOpen(true);
            }}
            onDeleteDoorOrder={handleDeleteDoorOrder}
            onQuickConfirmDelivery={handleQuickConfirmDelivery}
            onNavigateToOrder={(ordId) => {
              setActiveModule('orders');
              setSelectedOrderId(ordId);
            }}
            currentProfile={currentProfile}
          />
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
              setActiveModule('doors');
              setSelectedOrderId(null);
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
            onOpenDoorModule={() => setActiveModule('doors')}
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
        doorOrders={doorOrders}
        isOpen={Boolean(editingItem)}
        onClose={() => {
          editingItemRef.current = false;
          setEditingItem(null);
          // Anulowanie edycji bez lokalnych zmian pozwala od razu odświeżyć dane z serwera.
          if (!pendingOrdersRef.current && queuedRemoteOrdersRef.current) {
            const queued = queuedRemoteOrdersRef.current;
            queuedRemoteOrdersRef.current = null;
            saveOrders(queued);
            setOrders(queued);
            showToast('Zaktualizowano dane otrzymane od innych użytkowników.', 'info');
          }
        }}
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
