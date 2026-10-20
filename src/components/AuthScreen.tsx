import React, { useState } from 'react';
import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, LockKeyhole, ShieldCheck, UserRound, Zap } from 'lucide-react';
import { bootstrapAdmin, login } from '../services/authService';
import { AuthUser } from '../types/auth';

interface AuthScreenProps {
  setupRequired: boolean;
  onAuthenticated: (user: AuthUser) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ setupRequired, onAuthenticated }) => {
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Wprowadź login i hasło.');
      return;
    }
    if (setupRequired && displayName.trim().length < 2) {
      setError('Wprowadź imię i nazwisko lub nazwę administratora.');
      return;
    }
    if (setupRequired && password.length < 10) {
      setError('Hasło administratora musi mieć co najmniej 10 znaków.');
      return;
    }
    if (setupRequired && password !== confirmPassword) {
      setError('Podane hasła nie są takie same.');
      return;
    }

    setBusy(true);
    try {
      const user = setupRequired
        ? await bootstrapAdmin(username, displayName, password)
        : await login(username, password);
      onAuthenticated(user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zalogować.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-32 -right-24 h-96 w-96 rounded-full bg-blue-700/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-cyan-600/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.06)_1px,transparent_1px)] bg-[size:36px_36px]" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-700 bg-slate-900/95 shadow-2xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden lg:flex flex-col justify-between border-r border-slate-800 bg-slate-900 p-10">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-950/50"><Zap className="h-6 w-6 fill-white" /></span>
              <div>
                <p className="text-xl font-black tracking-tight">ENCO FLOW</p>
                <p className="text-xs text-slate-400">Operacyjny system zleceń</p>
              </div>
            </div>
            <div className="mt-20">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Dostęp firmowy</p>
              <h1 className="mt-3 text-4xl font-black leading-tight">Jedno konto.<br />Twoje uprawnienia.</h1>
              <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">
                Dostęp do zleceń, dokumentacji i modułów zależy od uprawnień przypisanych do Twojego konta przez administratora.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Indywidualne logowanie ENCO Flow
          </div>
        </section>

        <section className="p-6 sm:p-9 lg:p-10">
          <div className="flex items-center gap-3 lg:hidden mb-8">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600"><Zap className="h-5 w-5 fill-white" /></span>
            <div><p className="font-black">ENCO FLOW</p><p className="text-xs text-slate-400">Operacyjny system zleceń</p></div>
          </div>

          <div className="mb-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-bold text-blue-200">
              {setupRequired ? <ShieldCheck className="h-3.5 w-3.5" /> : <LockKeyhole className="h-3.5 w-3.5" />}
              {setupRequired ? 'PIERWSZE URUCHOMIENIE' : 'STREFA LOGOWANIA'}
            </span>
            <h2 className="mt-4 text-2xl font-black tracking-tight">{setupRequired ? 'Utwórz konto administratora' : 'Zaloguj się do systemu'}</h2>
            <p className="mt-2 text-sm leading-5 text-slate-400">
              {setupRequired
                ? 'To jednorazowa konfiguracja. Konto administratora będzie mogło dodawać użytkowników i nadawać im uprawnienia.'
                : 'Użyj indywidualnego loginu i hasła otrzymanego od administratora.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-300">Login</label>
              <div className="relative">
                <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required
                  placeholder="np. jan.kowalski"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-3 pl-10 pr-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            </div>

            {setupRequired && (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">Nazwa wyświetlana</label>
                <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="name" required
                  placeholder="Imię i nazwisko"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-bold text-slate-300">{setupRequired ? 'Hasło administratora' : 'Hasło'}</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={setupRequired ? 'new-password' : 'current-password'} required minLength={setupRequired ? 10 : undefined}
                  placeholder={setupRequired ? 'Minimum 10 znaków' : 'Wprowadź hasło'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 py-3 pl-10 pr-11 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ukryj hasło' : 'Pokaż hasło'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {setupRequired && (
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-300">Powtórz hasło administratora</label>
                <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password" required placeholder="Powtórz hasło"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
              </div>
            )}

            {error && <div role="alert" className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-200">{error}</div>}

            <button type="submit" disabled={busy}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
              {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? 'Proszę czekać…' : setupRequired ? 'Utwórz administratora' : 'Zaloguj się'}
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] leading-5 text-slate-500">
            Dostępne moduły i możliwości edycji są zależne od uprawnień konta.
          </p>
        </section>
      </div>
    </main>
  );
};
