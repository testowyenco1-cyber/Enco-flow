import React, { useEffect, useState } from 'react';

interface FormDictionarySelectProps {
  category: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
}

async function readApiResponse(response: Response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`API zwróciło nieoczekiwaną odpowiedź (HTTP ${response.status}). Sprawdź, czy działa aktualny serwer aplikacji.`);
  }
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error || `Błąd API (HTTP ${response.status}).`);
  }
  return result;
}

export const FormDictionarySelect: React.FC<FormDictionarySelectProps> = ({
  category, value, onChange, placeholder = 'Wybierz lub wpisz nową wartość', allowCustom = true,
}) => {
  const [options, setOptions] = useState<string[]>([]);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/form-dictionary', {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      });
      const result = await readApiResponse(response);
      if (!result.success || !result.dictionary || typeof result.dictionary !== 'object') {
        throw new Error('Serwer zwrócił nieprawidłowy format słownika.');
      }
      setOptions(Array.isArray(result.dictionary[category]) ? result.dictionary[category] : []);
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : 'Nie udało się połączyć z API słowników. Sprawdź, czy serwer działa i czy uruchomiono najnowszą wersję aplikacji.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [category]);

  const addToDictionary = async () => {
    const clean = newValue.trim();
    if (!clean) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/form-dictionary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ category, value: clean }),
      });
      const result = await readApiResponse(response);
      if (!result.success) throw new Error(result.error || 'Nie udało się zapisać wartości.');
      setOptions(Array.isArray(result.dictionary?.[category]) ? result.dictionary[category] : []);
      onChange(result.value || clean);
      setNewValue('');
    } catch (cause) {
      setError(cause instanceof Error
        ? cause.message
        : 'Błąd połączenia. Wartość nie została zapisana do wspólnego słownika.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0">
      <input list={`form-dictionary-${category}`} value={value} onChange={event => onChange(event.target.value)}
        placeholder={loading ? 'Ładowanie słownika…' : placeholder} className="w-full min-w-20 border-0 border-b border-dotted border-slate-300 bg-transparent px-1 py-1 outline-none focus:bg-blue-50" />
      <datalist id={`form-dictionary-${category}`}>
        {options.map(option => <option key={option} value={option} />)}
      </datalist>
      {allowCustom && (
        <div className="mt-1 flex items-center gap-1">
          <input value={newValue} onChange={event => setNewValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addToDictionary(); } }}
            placeholder="+ dodaj na stałe" aria-label="Nowa wartość słownika" className="w-full min-w-0 border-0 border-b border-dotted border-slate-300 bg-transparent px-1 py-0.5 text-[10px] outline-none focus:border-blue-500" />
          <button type="button" disabled={!newValue.trim() || saving} onClick={() => void addToDictionary()} className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 disabled:opacity-40">{saving ? 'Zapis…' : 'Dodaj'}</button>
        </div>
      )}
      {error && (
        <div className="mt-1">
          <p role="alert" className="text-[10px] text-rose-600">{error}</p>
          <button type="button" onClick={() => void load()} className="mt-1 text-[10px] font-semibold text-blue-700 underline">Spróbuj ponownie</button>
        </div>
      )}
    </div>
  );
};
