import React, { useEffect, useState } from 'react';

interface FormDictionarySelectProps {
  category: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
}

export const FormDictionarySelect: React.FC<FormDictionarySelectProps> = ({
  category, value, onChange, placeholder = 'Wybierz lub wpisz nową wartość', allowCustom = true,
}) => {
  const [options, setOptions] = useState<string[]>([]);
  const [newValue, setNewValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const response = await fetch('/api/form-dictionary');
      const result = await response.json();
      if (response.ok && result.success) {
        setOptions(Array.isArray(result.dictionary?.[category]) ? result.dictionary[category] : []);
      }
    } catch {
      setError('Nie udało się pobrać słownika. Możesz nadal wpisać wartość ręcznie.');
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, value: clean }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        setError(result.error || 'Nie udało się zapisać wartości.');
        return;
      }
      setOptions(Array.isArray(result.dictionary?.[category]) ? result.dictionary[category] : []);
      onChange(result.value || clean);
      setNewValue('');
    } catch {
      setError('Błąd połączenia. Wartość nie została zapisana do wspólnego słownika.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-0">
      <input list={`form-dictionary-${category}`} value={value} onChange={event => onChange(event.target.value)}
        placeholder={placeholder} className="w-full min-w-20 border-0 bg-transparent px-1 py-1 outline-none focus:bg-blue-50" />
      <datalist id={`form-dictionary-${category}`}>
        {options.map(option => <option key={option} value={option} />)}
      </datalist>
      {allowCustom && (
        <div className="mt-1 flex items-center gap-1">
          <input value={newValue} onChange={event => setNewValue(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void addToDictionary(); } }}
            placeholder="+ dodaj na stałe" aria-label="Nowa wartość słownika" className="w-full min-w-0 border-0 border-b border-dotted border-slate-300 bg-transparent px-1 py-0.5 text-[10px] outline-none focus:border-blue-500" />
          <button type="button" disabled={!newValue.trim() || saving} onClick={() => void addToDictionary()} className="shrink-0 rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 disabled:opacity-40">Dodaj</button>
        </div>
      )}
      {error && <p className="mt-1 text-[10px] text-rose-600">{error}</p>}
    </div>
  );
};
