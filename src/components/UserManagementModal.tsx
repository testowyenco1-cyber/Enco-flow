import React, { useEffect, useState } from 'react';
import { Activity, AlertCircle, Check, KeyRound, LoaderCircle, Plus, RefreshCw, Save, ShieldCheck, UserCog, Users, X } from 'lucide-react';
import { AUTH_DEPARTMENTS, AuthDepartmentId, AuthUser } from '../types/auth';
import { createAdminUser, getAdminUsers, resetAdminUserPassword, updateAdminUser } from '../services/authService';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
  onUsersChanged: () => void;
}

interface EditableUser {
  displayName: string;
  departments: AuthDepartmentId[];
  isAdmin: boolean;
  active: boolean;
}

const emptyNewUser = () => ({
  username: '',
  displayName: '',
  password: '',
  departments: [] as AuthDepartmentId[],
  isAdmin: false,
});

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen, onClose, currentUserId, onUsersChanged,
}) => {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EditableUser>>({});
  const [newUser, setNewUser] = useState(emptyNewUser);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [resetPasswords, setResetPasswords] = useState<Record<string, string>>({});
  const [showResetFor, setShowResetFor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminUsers();
      setUsers(result);
      const nextDrafts: Record<string, EditableUser> = {};
      result.forEach((user) => {
        nextDrafts[user.id] = {
          displayName: user.displayName,
          departments: [...user.departments],
          isAdmin: user.isAdmin,
          active: user.active,
        };
      });
      setDrafts(nextDrafts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się pobrać listy kont.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setNotice('');
    setShowCreateForm(false);
    void loadUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const updateDraft = (userId: string, patch: Partial<EditableUser>) => {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...current[userId], ...patch },
    }));
  };

  const toggleDraftDepartment = (userId: string, department: AuthDepartmentId, enabled: boolean) => {
    const current = drafts[userId]?.departments || [];
    updateDraft(userId, {
      departments: enabled
        ? [...new Set([...current, department])]
        : current.filter((entry) => entry !== department),
    });
  };

  const toggleNewDepartment = (department: AuthDepartmentId, enabled: boolean) => {
    setNewUser((current) => ({
      ...current,
      departments: enabled
        ? [...new Set([...current.departments, department])]
        : current.departments.filter((entry) => entry !== department),
    }));
  };

  const saveUser = async (user: AuthUser) => {
    const draft = drafts[user.id];
    if (!draft) return;
    setSavingId(user.id);
    setError('');
    setNotice('');
    try {
      const saved = await updateAdminUser(user.id, draft);
      setUsers((current) => current.map((entry) => entry.id === saved.id ? saved : entry));
      setDrafts((current) => ({
        ...current,
        [saved.id]: {
          displayName: saved.displayName,
          departments: [...saved.departments],
          isAdmin: saved.isAdmin,
          active: saved.active,
        },
      }));
      setNotice(`Zapisano uprawnienia konta „${saved.displayName}”.`);
      onUsersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać konta.');
    } finally {
      setSavingId(null);
    }
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setNotice('');
    if (newUser.username.trim().length < 3) {
      setError('Login musi mieć co najmniej 3 znaki.');
      return;
    }
    if (newUser.displayName.trim().length < 2) {
      setError('Wprowadź nazwę użytkownika.');
      return;
    }
    if (newUser.password.length < 10) {
      setError('Hasło musi mieć co najmniej 10 znaków.');
      return;
    }
    setCreating(true);
    try {
      const created = await createAdminUser({
        ...newUser,
        username: newUser.username.trim(),
        displayName: newUser.displayName.trim(),
      });
      setNewUser(emptyNewUser());
      setShowCreateForm(false);
      setNotice(`Dodano konto „${created.displayName}”.`);
      await loadUsers();
      onUsersChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się dodać użytkownika.');
    } finally {
      setCreating(false);
    }
  };

  const resetPassword = async (user: AuthUser) => {
    const password = resetPasswords[user.id] || '';
    if (password.length < 10) {
      setError('Nowe hasło musi mieć co najmniej 10 znaków.');
      return;
    }
    setSavingId(user.id);
    setError('');
    setNotice('');
    try {
      await resetAdminUserPassword(user.id, password);
      setResetPasswords((current) => ({ ...current, [user.id]: '' }));
      setShowResetFor(null);
      setNotice(`Zresetowano hasło konta „${user.displayName}”. Przekaż użytkownikowi nowe hasło bezpiecznym kanałem.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zresetować hasła.');
    } finally {
      setSavingId(null);
    }
  };

  const departmentList = (departments: AuthDepartmentId[]) => {
    const labels = AUTH_DEPARTMENTS.filter((department) => departments.includes(department.id)).map((department) => department.label);
    return labels.length ? labels.join(' · ') : 'Brak działów — tylko podgląd';
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label="Panel administratora — konta użytkowników">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="flex items-center justify-between gap-4 bg-slate-900 px-5 py-4 text-white sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600"><UserCog className="h-5 w-5" /></span>
            <div className="min-w-0">
              <h2 className="text-base font-black tracking-tight sm:text-lg">Panel administratora</h2>
              <p className="text-xs text-slate-400">Konta, hasła i uprawnienia działowe</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white" aria-label="Zamknij panel"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Użytkownicy systemu</h3>
              <p className="mt-1 text-xs text-slate-500">Możesz przypisać kilka działów do jednego konta. Odebranie wszystkich działów pozostawia wyłącznie podgląd.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void loadUsers()} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Odśwież
              </button>
              <button type="button" onClick={() => setShowCreateForm((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-500">
                <Plus className="h-3.5 w-3.5" /> Dodaj użytkownika
              </button>
            </div>
          </div>

          {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
          {notice && <div role="status" className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-800"><Check className="mt-0.5 h-4 w-4 shrink-0" /><span>{notice}</span></div>}

          {showCreateForm && (
            <form onSubmit={createUser} className="space-y-4 rounded-xl border border-blue-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2"><Plus className="h-4 w-4 text-blue-600" /><h4 className="text-sm font-bold text-slate-900">Nowe konto użytkownika</h4></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <label className="text-xs font-semibold text-slate-700">Login
                  <input value={newUser.username} onChange={(e) => setNewUser((current) => ({ ...current, username: e.target.value }))} required minLength={3} autoComplete="off" placeholder="np. jan.kowalski" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Nazwa użytkownika
                  <input value={newUser.displayName} onChange={(e) => setNewUser((current) => ({ ...current, displayName: e.target.value }))} required placeholder="Imię i nazwisko" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>
                <label className="text-xs font-semibold text-slate-700">Hasło początkowe
                  <input type="password" value={newUser.password} onChange={(e) => setNewUser((current) => ({ ...current, password: e.target.value }))} required minLength={10} autoComplete="new-password" placeholder="Minimum 10 znaków" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                </label>
              </div>
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Przypisz uprawnienia</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {AUTH_DEPARTMENTS.map((department) => (
                    <label key={department.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 px-3 py-2.5 hover:bg-slate-50">
                      <input type="checkbox" checked={newUser.departments.includes(department.id)} onChange={(e) => toggleNewDepartment(department.id, e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                      <span><span className="block text-xs font-bold text-slate-800">{department.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{department.description}</span></span>
                    </label>
                  ))}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2.5">
                  <input type="checkbox" checked={newUser.isAdmin} onChange={(e) => setNewUser((current) => ({ ...current, isAdmin: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500" />
                  <span className="text-xs font-bold text-purple-900">Administrator systemu — pełne uprawnienia i zarządzanie kontami</span>
                </label>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => { setShowCreateForm(false); setNewUser(emptyNewUser()); }} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Anuluj</button>
                <button type="submit" disabled={creating} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50">
                  {creating ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Utwórz konto
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" /> Pobieranie kont użytkowników…</div>
          ) : users.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Brak kont do wyświetlenia.</div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const draft = drafts[user.id] || { displayName: user.displayName, departments: user.departments, isAdmin: user.isAdmin, active: user.active };
                const isSelf = user.id === currentUserId;
                const changed = draft.displayName !== user.displayName || draft.isAdmin !== user.isAdmin || draft.active !== user.active ||
                  draft.departments.length !== user.departments.length || draft.departments.some((department) => !user.departments.includes(department));
                return (
                  <article key={user.id} className={`rounded-xl border bg-white p-4 shadow-sm sm:p-5 ${user.active ? 'border-slate-200' : 'border-rose-200 opacity-80'}`}>
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="break-words text-sm font-bold text-slate-900">{user.displayName}</h4>
                          {user.isAdmin && <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-800">ADMIN</span>}
                          {!user.active && <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">NIEAKTYWNE</span>}
                          {isSelf && <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">TWOJE KONTO</span>}
                        </div>
                        <p className="mt-1 font-mono text-xs text-slate-500">@{user.username}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{departmentList(user.departments)}</p>
                      </div>
                      <button type="button" title={isSelf ? 'Zmiana własnego hasła zakończy bieżącą sesję.' : 'Ustaw nowe hasło dla użytkownika'} onClick={() => setShowResetFor((current) => current === user.id ? null : user.id)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100">
                        <KeyRound className="h-3.5 w-3.5" /> {isSelf ? 'Zmień własne hasło' : 'Resetuj hasło'}
                      </button>
                    </div>

                    {showResetFor === user.id && (
                      <div className="mt-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50/70 p-3 sm:flex-row">
                        <input type="password" value={resetPasswords[user.id] || ''} onChange={(e) => setResetPasswords((current) => ({ ...current, [user.id]: e.target.value }))} minLength={10} autoComplete="new-password" placeholder="Nowe hasło tymczasowe — min. 10 znaków" className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 text-xs outline-none focus:border-amber-400" />
                        <button type="button" onClick={() => void resetPassword(user)} disabled={savingId === user.id} className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white hover:bg-amber-500 disabled:opacity-50">
                          {savingId === user.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Zapisz nowe hasło
                        </button>
                      </div>
                    )}

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <label className="text-xs font-semibold text-slate-700">Nazwa wyświetlana
                        <input value={draft.displayName} onChange={(e) => updateDraft(user.id, { displayName: e.target.value })} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                      </label>
                      <div className="flex items-end gap-3">
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700">
                          <input type="checkbox" checked={draft.active} disabled={isSelf} onChange={(e) => updateDraft(user.id, { active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50" />
                          Konto aktywne
                        </label>
                        <label className="flex flex-1 cursor-pointer items-center gap-2 rounded-lg border border-purple-200 px-3 py-2.5 text-xs font-semibold text-purple-800">
                          <input type="checkbox" checked={draft.isAdmin} disabled={isSelf} onChange={(e) => updateDraft(user.id, { isAdmin: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 disabled:opacity-50" />
                          Administrator
                        </label>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">Uprawnienia działowe</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {AUTH_DEPARTMENTS.map((department) => (
                          <label key={department.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${draft.departments.includes(department.id) ? 'border-blue-200 bg-blue-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'} ${draft.isAdmin ? 'opacity-50' : ''}`}>
                            <input type="checkbox" checked={draft.departments.includes(department.id)} disabled={draft.isAdmin} onChange={(e) => toggleDraftDepartment(user.id, department.id, e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:cursor-not-allowed" />
                            <span><span className="block text-xs font-bold text-slate-800">{department.label}</span><span className="mt-0.5 block text-[11px] leading-4 text-slate-500">{department.description}</span></span>
                          </label>
                        ))}
                      </div>
                      {draft.departments.length === 0 && !draft.isAdmin && <p className="mt-2 text-[11px] text-amber-700">Brak działów oznacza wyłącznie podgląd danych i brak edycji.</p>}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="text-[10px] text-slate-400">Utworzono: {new Date(user.createdAt).toLocaleDateString('pl-PL')}</span>
                      <button type="button" onClick={() => void saveUser(user)} disabled={!changed || savingId === user.id} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40">
                        {savingId === user.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Zapisz konto
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] leading-5 text-slate-500">
            <Activity className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            Zmiany uprawnień są stosowane przy kolejnych żądaniach. Dezaktywacja konta blokuje następne żądania i kończy jego sesję.
          </div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3">
          <div className="flex items-center gap-2 text-[11px] text-slate-500"><Users className="h-4 w-4" /> Konta indywidualne ENCO Flow</div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">Zamknij</button>
        </footer>
      </div>
    </div>
  );
};
