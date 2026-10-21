import React, { useState, useEffect, useMemo } from 'react';
import { X, Plus, AlertCircle, Check, Sparkles } from 'lucide-react';
import { Order } from '../types/enco';
type CustomerContact = { id: string; name: string; position?: string; email?: string; phone?: string };
type CustomerRecord = { id: string; name: string; nip?: string; address?: string; contacts: CustomerContact[] };
import {
  getOrderNumbersList,
  normalizeOrderNumber,
  validateOrderNumber,
} from '../utils/orderNumberUtils';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
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
  }) => void;
  existingOrders?: Order[];
}

export const NewOrderModal: React.FC<NewOrderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  existingOrders = [],
}) => {
  const [mode, setMode] = useState<'list' | 'custom'>('list');
  const [selectedListNumber, setSelectedListNumber] = useState('');
  const [customNumber, setCustomNumber] = useState('');
  const [client, setClient] = useState('');
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [contactId, setContactId] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerNip, setNewCustomerNip] = useState('');
  const [newCustomerAddress, setNewCustomerAddress] = useState('');
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPosition, setNewContactPosition] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [customerError, setCustomerError] = useState('');
  const selectedCustomer = customers.find((item) => item.id === customerId);
  const selectedContact = selectedCustomer?.contacts.find((item) => item.id === contactId);
  const [projectName, setProjectName] = useState('');
  const [stationSize, setStationSize] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [error, setError] = useState('');

  // Wyliczanie listy uporządkowanych numerów i kolejnego wolnego numeru
  const { items: orderListItems, nextAvailable } = useMemo(() => {
    return getOrderNumbersList(existingOrders, 30, new Date().getFullYear());
  }, [existingOrders]);

  // 3 kolejne wolne numery dla szybkiego wyboru 1 kliknięciem
  const quickPills = useMemo(() => {
    return orderListItems.filter((it) => !it.isOccupied).slice(0, 3);
  }, [orderListItems]);


  const loadCustomers = async () => {
    try {
      const response = await fetch('/api/customers');
      const data = await response.json();
      if (response.ok && data.success && Array.isArray(data.customers)) setCustomers(data.customers);
      else setCustomerError('Nie udało się pobrać bazy klientów.');
    } catch { setCustomerError('Nie udało się pobrać bazy klientów. Sprawdź połączenie z serwerem.'); }
  };
  const saveCustomer = async (customer: CustomerRecord): Promise<CustomerRecord> => {
    const response = await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer }) });
    const data = await response.json();
    if (!response.ok || !data.success || !Array.isArray(data.customers)) throw new Error(data.error || 'Nie udało się zapisać firmy.');
    setCustomers(data.customers);
    return data.customers.find((item: CustomerRecord) => item.id === customer.id) as CustomerRecord;
  };
  const handleAddCustomer = async () => {
    if (!newCustomerName.trim()) { setCustomerError('Wpisz nazwę firmy.'); return; }
    const duplicate = customers.find((item) => item.name.trim().toLowerCase() === newCustomerName.trim().toLowerCase());
    if (duplicate) { setCustomerId(duplicate.id); setClient(duplicate.name); setShowNewCustomer(false); setCustomerError('Firma już istnieje — wybrano ją z bazy.'); return; }
    const customer: CustomerRecord = { id: 'customer_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), name: newCustomerName.trim(), nip: newCustomerNip.trim(), address: newCustomerAddress.trim(), contacts: [] };
    try {
      const saved = await saveCustomer(customer);
      setCustomerId(saved.id); setContactId(''); setClient(saved.name); setNewCustomerName(''); setNewCustomerNip(''); setNewCustomerAddress(''); setShowNewCustomer(false); setCustomerError('');
    } catch (error) { setCustomerError(error instanceof Error ? error.message : 'Nie udało się zapisać firmy.'); }
  };
  const handleAddContact = async () => {
    if (!selectedCustomer) { setCustomerError('Najpierw wybierz firmę.'); return; }
    if (!newContactName.trim()) { setCustomerError('Wpisz imię i nazwisko przedstawiciela.'); return; }
    const contact: CustomerContact = { id: 'contact_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7), name: newContactName.trim(), position: newContactPosition.trim(), email: newContactEmail.trim(), phone: newContactPhone.trim() };
    try {
      const saved = await saveCustomer({ ...selectedCustomer, contacts: [...selectedCustomer.contacts, contact] });
      setCustomerId(saved.id); setContactId(contact.id); setNewContactName(''); setNewContactPosition(''); setNewContactEmail(''); setNewContactPhone(''); setShowNewContact(false); setCustomerError('');
    } catch (error) { setCustomerError(error instanceof Error ? error.message : 'Nie udało się zapisać przedstawiciela.'); }
  };

  // Inicjalizacja przy otwarciu okna
  useEffect(() => {
    if (isOpen) {
      void loadCustomers();
      setCustomerError('');
      setShowNewCustomer(false);
      setShowNewContact(false);
      setMode('list');
      setSelectedListNumber(nextAvailable);
      setCustomNumber('');
      setClient('');
      setCustomerId('');
      setContactId('');
      setProjectName('');
      setStationSize('');
      setDepartureDate('');
      setGeneralNotes('');
      setAdditionalInfo('');
      setShowNewCustomer(false);
      setShowNewContact(false);
      setNewCustomerName('');
      setNewCustomerNip('');
      setNewCustomerAddress('');
      setNewContactName('');
      setNewContactPosition('');
      setNewContactEmail('');
      setNewContactPhone('');
      setError('');
    }
  }, [isOpen, nextAvailable]);

  // Efektywny numer zlecenia
  const effectiveOrderNumber = mode === 'list' ? selectedListNumber : customNumber;

  // Walidacja w czasie rzeczywistym
  const validation = useMemo(() => {
    return validateOrderNumber(effectiveOrderNumber, existingOrders, undefined, new Date().getFullYear());
  }, [effectiveOrderNumber, existingOrders]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const valResult = validateOrderNumber(effectiveOrderNumber, existingOrders, undefined, new Date().getFullYear());
    if (!valResult.isValid) {
      setError(valResult.error || 'Numer zlecenia jest nieprawidłowy lub zajęty.');
      return;
    }
    if (!client.trim()) {
      setError('Nazwa klienta jest wymagana.');
      return;
    }
    if (!projectName.trim()) {
      setError('Nazwa projektu / lokalizacja jest wymagana.');
      return;
    }

    onSubmit({
      orderNumber: valResult.normalized,
      client: selectedCustomer?.name || client.trim(),
      customerId: selectedCustomer?.id || '',
      contactId: selectedContact?.id || '',
      contactName: selectedContact?.name || '',
      contactEmail: selectedContact?.email || '',
      contactPhone: selectedContact?.phone || '',
      projectName: projectName.trim(),
      stationSize: stationSize.trim(),
      departureDate,
      generalNotes,
      additionalInfo,
    });

    // Reset and close
    setMode('list');
    setSelectedListNumber(nextAvailable);
    setCustomNumber('');
    setClient('');
    setCustomerId('');
    setContactId('');
    setProjectName('');
    setStationSize('BEK 250/450');
    setDepartureDate('');
    setGeneralNotes('');
    setAdditionalInfo('');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Nowe zlecenie produkcyjne
            </h2>
            <p className="text-xs text-slate-500">
              Utworzy zlecenie wraz z kompletną listą 15 standardowych elementów stacji
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Wybór numeru zlecenia z listy zabezpieczającej przed powielaniem */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Numer zlecenia <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('list');
                      if (!selectedListNumber) setSelectedListNumber(nextAvailable);
                    }}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      mode === 'list'
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Lista ZL
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setMode('custom')}
                    className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
                      mode === 'custom'
                        ? 'bg-blue-100 text-blue-800 font-bold'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Wpis ręczny
                  </button>
                </div>
              </div>

              {mode === 'list' ? (
                <div className="space-y-2">
                  <select
                    value={selectedListNumber}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM__') {
                        setMode('custom');
                        setCustomNumber('');
                      } else {
                        setSelectedListNumber(e.target.value);
                      }
                    }}
                    required
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg bg-white font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer shadow-2xs"
                  >
                    <option value="" disabled>-- Wybierz numer zlecenia z listy --</option>
                    <optgroup label="Aktywne i dostępne numery zleceń:">
                      {orderListItems.map((item) => (
                        <option
                          key={item.number}
                          value={item.number}
                          disabled={item.isOccupied}
                          className={
                            item.isOccupied
                              ? 'text-slate-400 bg-slate-100'
                              : item.isNext
                              ? 'font-bold text-blue-700 bg-blue-50'
                              : 'text-slate-900 font-medium'
                          }
                        >
                          {item.number}{' '}
                          {item.isNext
                            ? '⭐ (Kolejny wolny - sugerowany)'
                            : item.isOccupied
                            ? `— ⛔ Zajęty (${item.occupiedBy})`
                            : '— Wolny'}
                        </option>
                      ))}
                    </optgroup>
                    <option value="__CUSTOM__">➕ Inny format / Wpisz ręcznie...</option>
                  </select>

                  {/* Szybki wybór kolejnych wolnych numerów */}
                  {quickPills.length > 0 && (
                    <div className="flex items-center flex-wrap gap-1.5 pt-0.5">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        Szybki wybór:
                      </span>
                      {quickPills.map((p) => (
                        <button
                          key={p.number}
                          type="button"
                          onClick={() => setSelectedListNumber(p.number)}
                          className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-bold transition-all cursor-pointer ${
                            selectedListNumber === p.number
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
                          }`}
                        >
                          {p.isNext ? `⭐ ${p.number}` : p.number}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500">
                    Zajęte numery są zablokowane na liście, co uniemożliwia ich powielenie.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    required
                    value={customNumber}
                    onChange={(e) => setCustomNumber(e.target.value)}
                    placeholder={`np. ZL7 (rok ${new Date().getFullYear()} zostanie dodany automatycznie)`}
                    className={`w-full text-xs px-3 py-2 border rounded-lg font-mono font-bold focus:ring-1 focus:outline-hidden ${
                      validation.error
                        ? 'border-rose-400 bg-rose-50/60 text-rose-900 focus:border-rose-500 focus:ring-rose-500'
                        : 'border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-500'
                    }`}
                  />

                  {customNumber.trim() && (
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">
                        Format systemowy:{' '}
                        <strong className="font-mono text-slate-900 bg-slate-100 px-1 py-0.5 rounded">
                          {normalizeOrderNumber(customNumber, new Date().getFullYear())}
                        </strong>
                      </span>
                      {validation.isValid && (
                        <span className="text-emerald-600 font-semibold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          Unikalny i wolny
                        </span>
                      )}
                    </div>
                  )}

                  {validation.error && (
                    <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-[11px] font-medium leading-tight">
                      ⚠️ {validation.error}
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500">
                    Wpisy takie jak „Zlecenie 7” i „ZL7” są automatycznie łączone i sprawdzane jako jeden numer.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Planowana data wyjazdu
              </label>
              <input
                type="date"
                value={departureDate}
                onChange={(e) => setDepartureDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden bg-white"
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3 sm:col-span-2">
            <div className="flex items-center justify-between gap-2"><label className="text-xs font-bold text-slate-800">Klient / firma <span className="text-rose-500">*</span></label><button type="button" onClick={() => { setShowNewCustomer((v) => !v); setCustomerError(''); }} className="text-[11px] font-bold text-blue-700">+ Dodaj firmę</button></div>
            <select required value={customerId} onChange={(e) => { const id = e.target.value; setCustomerId(id); const item = customers.find((customer) => customer.id === id); setClient(item?.name || ''); setContactId(''); setCustomerError(''); }} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"><option value="">Wybierz firmę z bazy…</option>{customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            {showNewCustomer && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-blue-200 bg-white p-3"><input value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Nazwa firmy *" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /><input value={newCustomerNip} onChange={(e) => setNewCustomerNip(e.target.value)} placeholder="NIP (opcjonalnie)" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /><input value={newCustomerAddress} onChange={(e) => setNewCustomerAddress(e.target.value)} placeholder="Adres siedziby (opcjonalnie)" className="rounded-lg border border-slate-300 px-3 py-2 text-xs sm:col-span-2" /><button type="button" onClick={() => void handleAddCustomer()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white sm:col-span-2">Zapisz firmę w bazie</button></div>}
            {selectedCustomer && <div className="space-y-2 border-t border-slate-200 pt-3"><div className="flex items-center justify-between gap-2"><label className="text-xs font-semibold text-slate-700">Osoba kontaktowa</label><button type="button" onClick={() => { setShowNewContact((v) => !v); setCustomerError(''); }} className="text-[11px] font-bold text-blue-700">+ Dodaj przedstawiciela</button></div>
              <select value={contactId} onChange={(e) => setContactId(e.target.value)} className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs"><option value="">Bez przypisanej osoby kontaktowej</option>{selectedCustomer.contacts.map((person) => <option key={person.id} value={person.id}>{person.name}{person.position ? ' — ' + person.position : ''}</option>)}</select>
              {selectedContact && <p className="text-[11px] text-slate-600">{[selectedContact.email, selectedContact.phone].filter(Boolean).join(' · ')}</p>}
              {showNewContact && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-blue-200 bg-white p-3"><input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Imię i nazwisko *" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /><input value={newContactPosition} onChange={(e) => setNewContactPosition(e.target.value)} placeholder="Stanowisko" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /><input type="email" value={newContactEmail} onChange={(e) => setNewContactEmail(e.target.value)} placeholder="E-mail" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /><input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="Telefon" className="rounded-lg border border-slate-300 px-3 py-2 text-xs" /><button type="button" onClick={() => void handleAddContact()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white sm:col-span-2">Zapisz przedstawiciela</button></div>}
            </div>}
            {customerError && <p className="text-[11px] text-rose-700">{customerError}</p>}
            {customers.length === 0 && !showNewCustomer && <p className="text-[11px] text-slate-500">Baza jest pusta. Dodaj firmę, aby rozpocząć.</p>}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nazwa projektu / Lokalizacja <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="np. ST05-3333 Rogalik lub Farma Fotowoltaiczna"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Rozmiar / typ stacji
            </label>
            <input
              type="text"
              value={stationSize}
              onChange={(e) => setStationSize(e.target.value)}
              placeholder="np. BEK 250/450, MRw-b 20/630, STLmb 15/400"
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Uwagi ogólne do zlecenia
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="Najważniejsze założenia techniczne, wymagania klienta..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Dodatkowe informacje (opcjonalnie)
            </label>
            <input
              type="text"
              value={additionalInfo}
              onChange={(e) => setAdditionalInfo(e.target.value)}
              placeholder="np. Klucze systemowe, wytyczne OSD..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-1 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={!validation.isValid}
              className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white rounded-lg shadow-xs transition-colors ${
                !validation.isValid
                  ? 'bg-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
              }`}
            >
              <Plus className="w-4 h-4" />
              Utwórz zlecenie
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
