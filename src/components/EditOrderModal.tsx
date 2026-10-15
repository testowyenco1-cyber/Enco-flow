import React, { useState, useEffect, useMemo } from 'react';
import { Order } from '../types/enco';
import { X, Check, Trash2, AlertCircle, Lock, Shield } from 'lucide-react';
import { validateOrderNumber, normalizeOrderNumber } from '../utils/orderNumberUtils';
import { UserRoleProfile, USER_PROFILES } from '../types/userRole';

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: Partial<Order>) => void;
  onDelete?: (orderId: string) => void;
  existingOrders?: Order[];
  currentProfile?: UserRoleProfile;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  order,
  isOpen,
  onClose,
  onSave,
  onDelete,
  existingOrders = [],
  currentProfile,
}) => {
  const profile = currentProfile || USER_PROFILES.admin;
  const canEditMainMeta = profile.canEditOrderMetadata; // Admin & Dział Handlowy
  const canEditDeparture = profile.canEditDepartureDate; // Admin, Dział Handlowy, Logistyka, Pyskowice
  const canEditNotes = profile.canEditGeneralNotes; // Admin, Dział Handlowy, Pyskowice (opisy)
  const canEditAdditional = profile.canEditAdditionalInfo; // Admin, Dział Handlowy, Logistyka, Płochocińska
  const canDelete = Boolean(onDelete && profile.canDeleteOrders); // Admin & Dział Handlowy
  const isAllReadOnly = profile.id === 'ogolny';

  const [orderNumber, setOrderNumber] = useState(order?.orderNumber || '');
  const [client, setClient] = useState(order?.client || '');
  const [projectName, setProjectName] = useState(order?.projectName || '');
  const [stationSize, setStationSize] = useState(order?.stationSize || '');
  const [departureDate, setDepartureDate] = useState(order?.departureDate || '');
  const [generalNotes, setGeneralNotes] = useState(order?.generalNotes || '');
  const [additionalInfo, setAdditionalInfo] = useState(order?.additionalInfo || '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && order) {
      setOrderNumber(order.orderNumber);
      setClient(order.client);
      setProjectName(order.projectName);
      setStationSize(order.stationSize);
      setDepartureDate(order.departureDate);
      setGeneralNotes(order.generalNotes);
      setAdditionalInfo(order.additionalInfo || '');
      setConfirmDelete(false);
      setError('');
    }
  }, [isOpen, order?.id]);

  const validation = useMemo(() => {
    if (!order) return { isValid: false, error: 'Nie wybrano zlecenia', normalized: orderNumber };
    const year = Number(order.orderNumber.match(/\/(\d{4})$/)?.[1] || (order.createdAt ? new Date(order.createdAt).getFullYear() : new Date().getFullYear()));
    return validateOrderNumber(orderNumber, existingOrders, order.id, year);
  }, [orderNumber, existingOrders, order?.id]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || isAllReadOnly) return;

    if (canEditMainMeta && !validation.isValid) {
      setError(validation.error || 'Numer zlecenia jest nieprawidłowy lub zajęty.');
      return;
    }

    const updatedData: Partial<Order> = {};
    if (canEditMainMeta) {
      updatedData.orderNumber = validation.normalized;
      updatedData.client = client.trim();
      updatedData.projectName = projectName.trim();
      updatedData.stationSize = stationSize.trim();
    }
    if (canEditDeparture) {
      updatedData.departureDate = departureDate;
    }
    if (canEditNotes) {
      updatedData.generalNotes = generalNotes;
    }
    if (canEditAdditional) {
      updatedData.additionalInfo = additionalInfo;
    }

    onSave(updatedData);
    onClose();
  };

  const handleDelete = () => {
    if (!order) return;
    if (confirmDelete && canDelete && onDelete) {
      onDelete(order.id);
      onClose();
    } else {
      setConfirmDelete(true);
    }
  };

  if (!isOpen || !order) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">
                {isAllReadOnly ? 'Podgląd danych zlecenia' : 'Edycja danych zlecenia'}: {order.orderNumber}
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${profile.badgeBg} text-white`}>
                {profile.shortName}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Uprawnienia profilu: {profile.editScopeSummary}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informative notice about field permissions */}
        {!canEditMainMeta && (
          <div className="mx-6 mt-4 p-3 bg-slate-100 border border-slate-200 text-slate-700 text-xs rounded-xl flex items-center gap-2">
            <Lock className="w-4 h-4 text-slate-500 shrink-0" />
            <span>
              {isAllReadOnly
                ? 'Profil Ogólny: wszystkie pola są w trybie tylko do odczytu.'
                : `Profil „${profile.name}” może edytować wyłącznie przypisane pola: ${[
                    canEditDeparture ? 'Data wyjazdu' : null,
                    canEditNotes ? 'Opisy/Uwagi' : null,
                    canEditAdditional ? 'Dodatkowe info' : null,
                  ].filter(Boolean).join(', ')}.`}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Numer zlecenia <span className="text-rose-500">*</span>
                </label>
                {!canEditMainMeta && <span className="text-[10px] text-slate-400 font-mono">tylko odczyt</span>}
              </div>
              <input
                type="text"
                required
                disabled={!canEditMainMeta}
                value={orderNumber}
                onChange={(e) => {
                  setOrderNumber(e.target.value);
                  setError('');
                }}
                className={`w-full text-xs px-3 py-2 border rounded-lg font-mono font-bold focus:ring-1 focus:outline-hidden ${
                  !canEditMainMeta
                    ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                    : validation.error
                    ? 'border-rose-400 bg-rose-50/60 text-rose-900 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500'
                }`}
              />
              {orderNumber.trim() && canEditMainMeta && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Format znormalizowany: <strong className="font-mono text-slate-800">{normalizeOrderNumber(orderNumber, Number(order.orderNumber.match(/\/(\d{4})$/)?.[1] || (order.createdAt ? new Date(order.createdAt).getFullYear() : new Date().getFullYear())))}</strong>
                </p>
              )}
              {validation.error && canEditMainMeta && (
                <p className="text-[11px] font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded p-1.5 mt-1">
                  ⚠️ {validation.error}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Data wyjazdu
                </label>
                {!canEditDeparture && <span className="text-[10px] text-slate-400 font-mono">tylko odczyt</span>}
              </div>
              <input
                type="date"
                disabled={!canEditDeparture}
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                  !canEditDeparture
                    ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                    : 'border-slate-300 bg-white text-slate-900'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Klient
              </label>
              {!canEditMainMeta && <span className="text-[10px] text-slate-400 font-mono">tylko odczyt</span>}
            </div>
            <input
              type="text"
              required
              disabled={!canEditMainMeta}
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                !canEditMainMeta
                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Nazwa projektu
              </label>
              {!canEditMainMeta && <span className="text-[10px] text-slate-400 font-mono">tylko odczyt</span>}
            </div>
            <input
              type="text"
              required
              disabled={!canEditMainMeta}
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                !canEditMainMeta
                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Rozmiar / typ stacji
              </label>
              {!canEditMainMeta && <span className="text-[10px] text-slate-400 font-mono">tylko odczyt</span>}
            </div>
            <input
              type="text"
              disabled={!canEditMainMeta}
              value={stationSize}
              onChange={(e) => setStationSize(e.target.value)}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                !canEditMainMeta
                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Uwagi ogólne (opisy)
              </label>
              {!canEditNotes && <span className="text-[10px] text-slate-400 font-mono">tylko odczyt</span>}
            </div>
            <textarea
              rows={3}
              disabled={!canEditNotes}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                !canEditNotes
                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">
                Dodatkowe informacje (akcesoria / specyfikacja)
              </label>
              {!canEditAdditional && <span className="text-[10px] text-slate-400 font-mono">tylko odczyt</span>}
            </div>
            <input
              type="text"
              disabled={!canEditAdditional}
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              className={`w-full text-xs px-3 py-2 border rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden ${
                !canEditAdditional
                  ? 'bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed'
                  : 'border-slate-300 bg-white text-slate-900'
              }`}
            />
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            {canDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                className={`inline-flex items-center gap-1 px-3 py-2 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                  confirmDelete
                    ? 'bg-rose-600 text-white hover:bg-rose-700'
                    : 'text-rose-600 hover:bg-rose-50'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {confirmDelete ? 'Potwierdź usunięcie zlecenia' : 'Usuń zlecenie'}
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                {isAllReadOnly ? 'Zamknij' : 'Anuluj'}
              </button>
              {!isAllReadOnly && (
                <button
                  type="submit"
                  disabled={canEditMainMeta && !validation.isValid}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors ${
                    canEditMainMeta && !validation.isValid
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  Zapisz zmiany
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
