import React from 'react';
import { X, Check, Minus, ShieldCheck, Lock, Eye, Edit3, Download, Info } from 'lucide-react';
import { USER_PROFILES_LIST, UserRoleProfile, UserRoleId } from '../types/userRole';

interface RoleMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeProfileId: UserRoleId;
  onSelectProfile: (roleId: UserRoleId) => void;
}

export const RoleMatrixModal: React.FC<RoleMatrixModalProps> = ({
  isOpen,
  onClose,
  activeProfileId,
  onSelectProfile,
}) => {
  if (!isOpen) return null;

  const rows = [
    {
      category: 'Autoryzacja',
      feature: 'Zabezpieczenie hasłem dostępowym',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: true,
      plochocinska: true,
      ogolny: false,
    },
    {
      category: 'Operacje główne',
      feature: 'Nowe zlecenie / Usuwanie zlecenia',
      admin: true,
      handlowy: true,
      logistyka: false,
      pyskowice: false,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Operacje główne',
      feature: 'Pobieranie plików & dokumentów PDF',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: true,
      plochocinska: true,
      ogolny: false,
    },
    {
      category: 'Operacje główne',
      feature: 'Repozytorium folderów & wgrywanie plików',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: true,
      plochocinska: true,
      ogolny: false,
    },
    {
      category: 'Moduł Drzwi',
      feature: 'Zarządzanie zamówieniami drzwi (dodawanie, edycja, usuwanie)',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: false,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Drzwi (status, parametry, PZD)',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: false,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Most (mosty szynowe, kable, głowice)',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: false,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Rozdzielnica SN (średnie napięcie, pola, model)',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: false,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Rozdzielnica NN (niskie napięcie RTS-z/w, pola, gotowość)',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: false,
      plochocinska: true,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Szafka telemechaniki (modem, protokoły)',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: false,
      plochocinska: true,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Wyjazd / Data wyjazdu stacji',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: true,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Wyposażenie dodatkowe / Uwagi dodatkowe',
      admin: true,
      handlowy: true,
      logistyka: true,
      pyskowice: false,
      plochocinska: true,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Obudowa (typ BEK/NZ, wymiary, fundament, gotowość)',
      admin: true,
      handlowy: true,
      logistyka: false,
      pyskowice: true,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Montaż (zlecenie montażu stacji/złącza)',
      admin: true,
      handlowy: true,
      logistyka: false,
      pyskowice: true,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Kolory (RAL obudowy, drzwi, dachu)',
      admin: true,
      handlowy: true,
      logistyka: false,
      pyskowice: true,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Elementy stacji',
      feature: 'Opisy (tabliczki znamionowe, uwagi ogólne)',
      admin: true,
      handlowy: true,
      logistyka: false,
      pyskowice: true,
      plochocinska: false,
      ogolny: false,
    },
    {
      category: 'Pozostałe',
      feature: 'Dokumentacja (Rys. akceptacja, Serwispol, JK, Powykonawcza)',
      admin: true,
      handlowy: true,
      logistyka: false,
      pyskowice: false,
      plochocinska: false,
      ogolny: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Matryca Uprawnień Kont Użytkowych</span>
                <span className="text-[11px] font-mono font-normal bg-slate-800 text-blue-300 px-2 py-0.5 rounded border border-slate-700">
                  6 Profili Roli
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Wybierz profil do natychmiastowego przełączenia lub sprawdź zakresy edycji i podglądu
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profiles bar */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mr-1">
            Aktywny profil:
          </span>
          {USER_PROFILES_LIST.map((p) => {
            const isActive = p.id === activeProfileId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProfile(p.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  isActive
                    ? `${p.badgeBg} text-white border-slate-900 shadow-sm ring-2 ring-blue-500/50`
                    : 'bg-white text-slate-700 border-slate-300 hover:border-slate-400 hover:bg-slate-100'
                }`}
              >
                <span>{p.avatar}</span>
                <span>{p.name}</span>
                {isActive && (
                  <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded font-mono font-bold">
                    AKTYWNY
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Matrix Table */}
        <div className="flex-1 overflow-auto p-6">
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 divide-x divide-slate-200">
                  <th className="py-3 px-4 w-64 bg-slate-100 sticky left-0 z-10">Obszar / Uprawnienie</th>
                  <th className="py-3 px-3 text-center bg-purple-50 text-purple-950 font-bold">
                    <div className="flex flex-col items-center">
                      <span className="text-base">👑</span>
                      <span>Admin</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center bg-blue-50 text-blue-950 font-bold">
                    <div className="flex flex-col items-center">
                      <span className="text-base">💼</span>
                      <span>Dział Handlowy</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center bg-amber-50 text-amber-950 font-bold">
                    <div className="flex flex-col items-center">
                      <span className="text-base">🚚</span>
                      <span>Logistyka</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center bg-emerald-50 text-emerald-950 font-bold">
                    <div className="flex flex-col items-center">
                      <span className="text-base">🏭</span>
                      <span>Pyskowice</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center bg-cyan-50 text-cyan-950 font-bold">
                    <div className="flex flex-col items-center">
                      <span className="text-base">⚡</span>
                      <span>Płochocińska</span>
                    </div>
                  </th>
                  <th className="py-3 px-3 text-center bg-slate-100 text-slate-900 font-bold">
                    <div className="flex flex-col items-center">
                      <span className="text-base">👁️</span>
                      <span>Ogólny</span>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors divide-x divide-slate-100">
                    <td className="py-2.5 px-4 font-medium text-slate-800 bg-white sticky left-0 z-10 shadow-2xs">
                      <div>
                        <span className="text-slate-900 font-semibold">{row.feature}</span>
                        <span className="text-[10px] text-slate-400 block">{row.category}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-center bg-purple-50/30">
                      <CellBadge canEdit={row.admin} />
                    </td>
                    <td className="py-2.5 px-3 text-center bg-blue-50/30">
                      <CellBadge canEdit={row.handlowy} />
                    </td>
                    <td className="py-2.5 px-3 text-center bg-amber-50/30">
                      <CellBadge canEdit={row.logistyka} />
                    </td>
                    <td className="py-2.5 px-3 text-center bg-emerald-50/30">
                      <CellBadge canEdit={row.pyskowice} />
                    </td>
                    <td className="py-2.5 px-3 text-center bg-cyan-50/30">
                      <CellBadge canEdit={row.plochocinska} />
                    </td>
                    <td className="py-2.5 px-3 text-center bg-slate-50/50">
                      <CellBadge canEdit={row.ogolny} isOgolny />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed Role Cards Grid */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {USER_PROFILES_LIST.map((prof) => {
              const isCur = prof.id === activeProfileId;
              return (
                <div
                  key={prof.id}
                  onClick={() => onSelectProfile(prof.id)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                    isCur
                      ? 'border-blue-500 bg-blue-50/40 shadow-xs ring-2 ring-blue-500/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{prof.avatar}</span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{prof.name}</h4>
                        <span className="text-[10px] text-slate-500">{prof.department}</span>
                      </div>
                    </div>
                    {isCur ? (
                      <span className="text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                        Aktywny
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                      >
                        Przełącz →
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2 mt-1">
                    {prof.description}
                  </p>
                  <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                    <span className="text-slate-500">Pobieranie plików:</span>
                    <span className={prof.canDownload ? 'font-bold text-emerald-700' : 'font-bold text-rose-600'}>
                      {prof.canDownload ? '✓ Dozwolone' : '✕ Zablokowane'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-slate-400" />
            <span>
              Wszelkie ograniczenia uprawnień działają w czasie rzeczywistym i są egzekwowane w całym systemie.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

function CellBadge({ canEdit, isOgolny }: { canEdit: boolean; isOgolny?: boolean }) {
  if (canEdit) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300">
        <Edit3 className="w-3 h-3 text-emerald-700" />
        Edycja
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium text-[11px] border border-slate-200">
      <Eye className="w-3 h-3 text-slate-400" />
      Podgląd
    </span>
  );
}
