import React, { useState, useEffect, useRef } from 'react';
import {
  UserRoleId,
  UserRoleProfile,
  USER_PROFILES,
  verifyUserPassword,
} from '../types/userRole';
import {
  Lock,
  Eye,
  EyeOff,
  X,
  Check,
  AlertCircle,
  KeyRound,
  Shield,
  ArrowRight,
} from 'lucide-react';

interface PasswordAuthModalProps {
  isOpen: boolean;
  targetProfileId: UserRoleId | null;
  onClose: () => void;
  onSuccess: (roleId: UserRoleId) => void;
  onSwitchToGuest: () => void;
}

export const PasswordAuthModal: React.FC<PasswordAuthModalProps> = ({
  isOpen,
  targetProfileId,
  onClose,
  onSuccess,
  onSwitchToGuest,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const targetProfile: UserRoleProfile | null = targetProfileId
    ? USER_PROFILES[targetProfileId]
    : null;

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setError(null);
      setShowPassword(false);
      setIsShaking(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, targetProfileId]);

  if (!isOpen || !targetProfile) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Wprowadź hasło dostępu do profilu.');
      return;
    }

    const isValid = verifyUserPassword(targetProfile.id, password);
    if (isValid) {
      setError(null);
      onSuccess(targetProfile.id);
    } else {
      setError('Nieprawidłowe hasło dla tego konta użytkownika.');
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 500);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className={`bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden transition-all transform ${
          isShaking ? 'animate-shake' : ''
        }`}
      >
        {/* Header with profile theme */}
        <div className="p-6 bg-slate-900 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            title="Zamknij"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3.5">
            <div className="text-3xl p-3 bg-slate-800 rounded-2xl border border-slate-700/80 shadow-inner shrink-0">
              {targetProfile.avatar}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-white">
                  {targetProfile.name}
                </h3>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded text-white ${targetProfile.badgeBg}`}>
                  {targetProfile.shortName}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {targetProfile.department}
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3 bg-slate-50 border border-slate-200/90 rounded-xl text-xs text-slate-600">
            <div className="flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-800">
                  Wymagana autoryzacja hasłem
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  Aby przełączyć się na konto z uprawnieniami edycyjnymi, podaj przydzielone hasło operacyjne.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Hasło dla profilu {targetProfile.name}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Wprowadź hasło..."
                className="w-full text-sm pl-9 pr-10 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 shadow-2xs"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>

            {error && (
              <div className="mt-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-semibold animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="pt-2 space-y-2">
            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Zaloguj i przełącz na ten profil</span>
            </button>

            <button
              type="button"
              onClick={onSwitchToGuest}
              className="w-full py-2 px-3 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer font-medium"
            >
              <span>Przejdź do profilu Ogólny (tylko podgląd, bez hasła)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
