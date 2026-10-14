import React, { useState, useRef, useEffect } from 'react';
import {
  UserRoleId,
  UserRoleProfile,
  USER_PROFILES,
  USER_PROFILES_LIST,
  hasPasswordProtection,
} from '../types/userRole';
import { ChevronDown, Check, Shield, Info, Lock, LogOut, KeyRound } from 'lucide-react';

interface UserRoleSelectorProps {
  currentProfile: UserRoleProfile;
  onSelectProfile: (profileId: UserRoleId) => void;
  onOpenMatrixModal: () => void;
}

export const UserRoleSelector: React.FC<UserRoleSelectorProps> = ({
  currentProfile,
  onSelectProfile,
  onOpenMatrixModal,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-800 border border-slate-700 text-white transition-all cursor-pointer shadow-xs group"
        title="Kliknij, aby zmienić aktywne konto użytkownika lub wprowadzić hasło"
      >
        <span className="text-sm">{currentProfile.avatar}</span>
        <div className="flex flex-col text-left leading-tight">
          <span className="text-xs font-bold text-white group-hover:text-blue-300 transition-colors flex items-center gap-1.5">
            {currentProfile.name}
            {currentProfile.id === 'ogolny' ? (
              <span className="text-[9px] bg-slate-700 text-slate-300 px-1 py-0.2 rounded font-normal">
                Tylko podgląd
              </span>
            ) : (
              <span className="text-[9px] bg-emerald-950/80 text-emerald-300 border border-emerald-600/50 px-1 py-0.2 rounded font-mono font-medium flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" />
                Zalogowano
              </span>
            )}
          </span>
          <span className="text-[9px] text-slate-400 font-mono tracking-tight">
            {currentProfile.shortName}
          </span>
        </div>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-colors ml-0.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-84 rounded-xl bg-slate-900 border border-slate-700 shadow-2xl z-50 py-2 text-white animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Konta użytkowników (6 profili)</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenMatrixModal();
              }}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer"
            >
              Matryca uprawnień
            </button>
          </div>

          <div className="py-1 divide-y divide-slate-800/60 max-h-96 overflow-y-auto">
            {USER_PROFILES_LIST.map((prof) => {
              const isSelected = prof.id === currentProfile.id;
              const hasPw = hasPasswordProtection(prof.id);
              return (
                <button
                  key={prof.id}
                  type="button"
                  onClick={() => {
                    onSelectProfile(prof.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2.5 flex items-start justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-blue-950/70 border-l-3 border-blue-500'
                      : 'hover:bg-slate-800/70 border-l-3 border-transparent'
                  }`}
                >
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className="text-lg shrink-0 mt-0.5">{prof.avatar}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold ${isSelected ? 'text-blue-300' : 'text-white'}`}>
                          {prof.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold ${prof.badgeBg} text-white`}>
                          {prof.shortName}
                        </span>
                        {hasPw ? (
                          <span className="text-[9px] text-amber-300 bg-amber-950/70 border border-amber-800/60 px-1 py-0.2 rounded flex items-center gap-0.5">
                            <Lock className="w-2.5 h-2.5" />
                            Hasło
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-400 bg-slate-800 px-1 py-0.2 rounded">
                            Bez hasła
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {prof.department}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5 leading-tight">
                        {prof.editScopeSummary}
                      </p>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="shrink-0 text-blue-400 mt-1">
                      <Check className="w-4 h-4" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick logout / switch to guest profile */}
          <div className="px-3 pt-2 mt-1 border-t border-slate-800 flex items-center justify-between text-[11px]">
            {currentProfile.id !== 'ogolny' ? (
              <button
                type="button"
                onClick={() => {
                  onSelectProfile('ogolny');
                  setIsOpen(false);
                }}
                className="text-rose-400 hover:text-rose-300 font-semibold cursor-pointer flex items-center gap-1"
                title="Przełącz do bezpiecznego trybu tylko do podglądu bez uprawnień edycji"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Wyloguj (profil Ogólny)</span>
              </button>
            ) : (
              <span className="text-slate-400">Aktywny tryb gościa</span>
            )}

            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenMatrixModal();
              }}
              className="text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
            >
              Szczegóły uprawnień →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
