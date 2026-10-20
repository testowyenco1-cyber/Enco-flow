import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, KeyRound, LogOut, ShieldCheck, UserRound, Users } from 'lucide-react';
import type { AuthUser } from '../types/auth';
import type { UserRoleProfile } from '../types/userRole';

interface UserRoleSelectorProps {
  currentUser: AuthUser;
  currentProfile: UserRoleProfile;
  onLogout: () => void;
  onOpenUserAdmin: () => void;
}

export const UserRoleSelector: React.FC<UserRoleSelectorProps> = ({
  currentUser, currentProfile, onLogout, onOpenUserAdmin,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const departmentNames = currentUser.isAdmin
    ? ['Administrator systemu']
    : currentUser.departments.length
      ? currentUser.departments.map((id) => ({
          dzial_handlowy: 'Dział Handlowy',
          logistyka: 'Logistyka',
          pyskowice: 'Produkcja – Pyskowice',
          plochocinska: 'Produkcja – Płochocińska',
        }[id]))
      : ['Tylko podgląd — brak przypisanych działów'];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex max-w-[230px] items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/90 px-2.5 py-1.5 text-white shadow-xs transition hover:bg-slate-800"
        title="Zalogowane konto użytkownika"
      >
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${currentUser.isAdmin ? 'bg-purple-600' : 'bg-blue-600'}`}>
          {currentUser.isAdmin ? <ShieldCheck className="h-4 w-4" /> : <UserRound className="h-4 w-4" />}
        </span>
        <span className="min-w-0 text-left leading-tight">
          <span className="block truncate text-xs font-bold text-white">{currentUser.displayName}</span>
          <span className="mt-0.5 block truncate text-[10px] text-slate-400">{currentUser.isAdmin ? 'Administrator' : currentProfile.shortName}</span>
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-24px)] overflow-hidden rounded-xl border border-slate-700 bg-slate-900 py-2 text-white shadow-2xl">
          <div className="border-b border-slate-800 px-4 pb-3 pt-2">
            <p className="text-sm font-bold">{currentUser.displayName}</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">@{currentUser.username}</p>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5" /> Przydzielone uprawnienia
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {departmentNames.map((name) => (
                <span key={name} className={`rounded-md border px-2 py-1 text-[10px] font-semibold ${currentUser.isAdmin ? 'border-purple-700 bg-purple-950/50 text-purple-200' : 'border-slate-700 bg-slate-800 text-slate-200'}`}>{name}</span>
              ))}
            </div>
          </div>
          {currentUser.isAdmin && (
            <button type="button" onClick={() => { setIsOpen(false); onOpenUserAdmin(); }}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-blue-300 transition hover:bg-slate-800 hover:text-blue-200">
              <Users className="h-4 w-4" /> Panel administratora — konta i uprawnienia
            </button>
          )}
          <div className="border-t border-slate-800 pt-1">
            <button type="button" onClick={() => { setIsOpen(false); onLogout(); }}
              className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-xs font-bold text-rose-300 transition hover:bg-rose-950/40">
              <LogOut className="h-4 w-4" /> Wyloguj z ENCO Flow
            </button>
            <p className="px-4 pb-1 text-[10px] leading-4 text-slate-500"><KeyRound className="mr-1 inline h-3 w-3" />Hasła i sesje są obsługiwane przez serwer.</p>
          </div>
        </div>
      )}
    </div>
  );
};
