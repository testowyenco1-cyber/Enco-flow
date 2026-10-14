import React, { useState, useEffect } from 'react';
import {
  ObudowaType,
  OBUDOWA_TYPES,
  ObudowaSizeVariant,
  getObudowaVariantsForType,
  saveCustomObudowaVariant,
  formatDimensionM,
  checkReadinessOverdue,
  ItemStatus,
} from '../types/enco';
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Plus,
  Box,
  Layers,
  Ruler,
  Info,
  Clock,
  X,
} from 'lucide-react';

export interface ObudowaFormData {
  typObudowy: ObudowaType;
  rozmiar: string;
  dataGotowosci: string;
  szerokosc?: number | string;
  glebokosc?: number | string;
  wysokosc?: number | string;
  typWysokosci: string;
  wymiary?: string;
  isCustomSize?: boolean;
}

interface ObudowaFormProps {
  initialData?: {
    typObudowy?: string;
    rozmiar?: string;
    dataGotowosci?: string;
    szerokosc?: number | string;
    glebokosc?: number | string;
    wysokosc?: number | string;
    typWysokosci?: string;
    wymiary?: string;
  };
  itemStatus?: ItemStatus;
  orderPlannedDate?: string;
  onChange: (data: ObudowaFormData) => void;
  isReadOnly?: boolean;
}

export const ObudowaForm: React.FC<ObudowaFormProps> = ({
  initialData,
  itemStatus,
  orderPlannedDate,
  onChange,
  isReadOnly = false,
}) => {
  // 1. Determine active type (BEK or NZ)
  const initialType: ObudowaType =
    initialData?.typObudowy === 'NZ' ||
    (initialData?.typObudowy && String(initialData.typObudowy).toUpperCase().includes('NZ'))
      ? 'NZ'
      : 'BEK';

  const [typObudowy, setTypObudowy] = useState<ObudowaType>(initialType);

  // 2. Active size variant
  const [rozmiar, setRozmiar] = useState<string>(() => {
    if (initialData?.rozmiar) return initialData.rozmiar;
    if (initialData?.typObudowy && String(initialData.typObudowy).includes(' ')) {
      return String(initialData.typObudowy);
    }
    return initialType === 'NZ' ? 'NZ 210/290' : 'BEK 250/350';
  });

  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    return initialData?.rozmiar === 'Inny rozmiar' || initialData?.rozmiar === 'Niestandardowy';
  });

  // Custom dimensions state
  const [customName, setCustomName] = useState<string>('');
  const [customWidth, setCustomWidth] = useState<string>(
    initialData?.szerokosc !== undefined ? String(initialData.szerokosc) : ''
  );
  const [customDepth, setCustomDepth] = useState<string>(
    initialData?.glebokosc !== undefined ? String(initialData.glebokosc) : ''
  );
  const [customHeight, setCustomHeight] = useState<string>(
    initialData?.wysokosc !== undefined
      ? String(initialData.wysokosc)
      : initialType === 'NZ'
      ? '2.66'
      : '2.40'
  );

  // 3. Data gotowości
  const [dataGotowosci, setDataGotowosci] = useState<string>(() => {
    return initialData?.dataGotowosci || orderPlannedDate || '';
  });

  // Modal / popover for adding a new variant to config
  const [isAddingVariant, setIsAddingVariant] = useState(false);
  const [newVarName, setNewVarName] = useState('');
  const [newVarWidth, setNewVarWidth] = useState('');
  const [newVarDepth, setNewVarDepth] = useState('');
  const [newVarHeight, setNewVarHeight] = useState('');
  const [newVarError, setNewVarError] = useState<string | null>(null);

  // Available variants for the selected type
  const [availableVariants, setAvailableVariants] = useState<ObudowaSizeVariant[]>(() =>
    getObudowaVariantsForType(initialType)
  );

  // Refresh available variants when type changes
  useEffect(() => {
    const list = getObudowaVariantsForType(typObudowy);
    setAvailableVariants(list);
  }, [typObudowy]);

  // Sync initialData changes from parent
  useEffect(() => {
    if (initialData) {
      const type: ObudowaType =
        initialData.typObudowy === 'NZ' ||
        (initialData.typObudowy && String(initialData.typObudowy).toUpperCase().includes('NZ'))
          ? 'NZ'
          : 'BEK';
      setTypObudowy(type);

      if (initialData.rozmiar) {
        setRozmiar(initialData.rozmiar);
        if (initialData.rozmiar === 'Inny rozmiar') {
          setIsCustomMode(true);
        }
      }
      if (initialData.dataGotowosci) {
        setDataGotowosci(initialData.dataGotowosci);
      } else if (orderPlannedDate && !dataGotowosci) {
        setDataGotowosci(orderPlannedDate);
      }
      if (initialData.szerokosc !== undefined) setCustomWidth(String(initialData.szerokosc));
      if (initialData.glebokosc !== undefined) setCustomDepth(String(initialData.glebokosc));
      if (initialData.wysokosc !== undefined) setCustomHeight(String(initialData.wysokosc));
    }
  }, [initialData, orderPlannedDate]);

  // Current type info
  const typeInfo = OBUDOWA_TYPES[typObudowy];

  // Helper to compute dimensions and notify parent
  const notifyChange = (
    newType: ObudowaType,
    newSize: string,
    newDate: string,
    isCustom: boolean,
    cW: string,
    cD: string,
    cH: string
  ) => {
    const tInfo = OBUDOWA_TYPES[newType];
    let widthVal: number | string | undefined;
    let depthVal: number | string | undefined;
    let heightVal: number | string | undefined;

    if (isCustom) {
      widthVal = cW ? parseFloat(cW.replace(',', '.')) : undefined;
      depthVal = cD ? parseFloat(cD.replace(',', '.')) : undefined;
      heightVal = cH ? parseFloat(cH.replace(',', '.')) : tInfo.defaultHeight;
    } else {
      const matched = availableVariants.find((v) => v.name === newSize);
      if (matched) {
        widthVal = matched.width;
        depthVal = matched.depth;
        heightVal = matched.height !== undefined ? matched.height : tInfo.defaultHeight;
      } else {
        // If not matched, use initialData if present or undefined
        widthVal = initialData?.szerokosc;
        depthVal = initialData?.glebokosc;
        heightVal = initialData?.wysokosc ?? tInfo.defaultHeight;
      }
    }

    const wymiarySummary =
      widthVal && depthVal && heightVal
        ? `${formatDimensionM(widthVal)} × ${formatDimensionM(depthVal)} × ${formatDimensionM(
            heightVal
          )} (${tInfo.heightTypeLabel.toLowerCase()})`
        : undefined;

    onChange({
      typObudowy: newType,
      rozmiar: isCustom ? (customName.trim() || 'Inny rozmiar') : newSize,
      dataGotowosci: newDate,
      szerokosc: widthVal,
      glebokosc: depthVal,
      wysokosc: heightVal,
      typWysokosci: tInfo.heightTypeLabel,
      wymiary: wymiarySummary,
      isCustomSize: isCustom,
    });
  };

  // 1. Handle Type Change
  const handleTypeChange = (newType: ObudowaType) => {
    setTypObudowy(newType);
    const variantsForNewType = getObudowaVariantsForType(newType);
    setAvailableVariants(variantsForNewType);

    // If current size does not match new type, reset to first variant of new type
    const matchesNewType = variantsForNewType.some((v) => v.name === rozmiar);
    let nextSize = rozmiar;
    let nextIsCustom = isCustomMode;

    if (!matchesNewType && !isCustomMode) {
      nextSize = variantsForNewType[0]?.name || '';
    }

    // Default height for new type
    const defaultH = newType === 'NZ' ? '2.66' : '2.40';
    if (!customHeight || customHeight === '2.66' || customHeight === '2.40') {
      setCustomHeight(defaultH);
    }

    notifyChange(newType, nextSize, dataGotowosci, nextIsCustom, customWidth, customDepth, defaultH);
  };

  // 2. Handle Size Variant Change
  const handleSizeChange = (val: string) => {
    if (val === '__CUSTOM__') {
      setIsCustomMode(true);
      const defaultH = typObudowy === 'NZ' ? '2.66' : '2.40';
      setCustomHeight(customHeight || defaultH);
      notifyChange(
        typObudowy,
        customName || 'Inny rozmiar',
        dataGotowosci,
        true,
        customWidth,
        customDepth,
        customHeight || defaultH
      );
    } else {
      setIsCustomMode(false);
      setRozmiar(val);
      const matched = availableVariants.find((v) => v.name === val);
      const matchedWidth = matched?.width !== undefined ? String(matched.width) : '';
      const matchedDepth = matched?.depth !== undefined ? String(matched.depth) : '';
      const matchedHeight =
        matched?.height !== undefined ? String(matched.height) : String(typeInfo.defaultHeight);

      setCustomWidth(matchedWidth);
      setCustomDepth(matchedDepth);
      setCustomHeight(matchedHeight);

      notifyChange(typObudowy, val, dataGotowosci, false, matchedWidth, matchedDepth, matchedHeight);
    }
  };

  // 3. Handle Date Change
  const handleDateChange = (newDate: string) => {
    setDataGotowosci(newDate);
    notifyChange(
      typObudowy,
      isCustomMode ? (customName || 'Inny rozmiar') : rozmiar,
      newDate,
      isCustomMode,
      customWidth,
      customDepth,
      customHeight
    );
  };

  // Handle saving new variant to config
  const handleSaveNewVariant = (e: React.FormEvent) => {
    e.preventDefault();
    setNewVarError(null);

    const name = newVarName.trim();
    if (!name) {
      setNewVarError('Wprowadź nazwę nowego rozmiaru (np. BEK 250/500).');
      return;
    }

    const widthNum = parseFloat(newVarWidth.replace(',', '.'));
    const depthNum = parseFloat(newVarDepth.replace(',', '.'));
    const heightNum = newVarHeight
      ? parseFloat(newVarHeight.replace(',', '.'))
      : typeInfo.defaultHeight;

    if (isNaN(widthNum) || widthNum <= 0) {
      setNewVarError('Wprowadź poprawną szerokość w metrach (np. 2.50).');
      return;
    }
    if (isNaN(depthNum) || depthNum <= 0) {
      setNewVarError('Wprowadź poprawną głębokość w metrach (np. 5.00).');
      return;
    }

    const newVar: ObudowaSizeVariant = {
      id: `custom_${typObudowy.toLowerCase()}_${Date.now()}`,
      type: typObudowy,
      name,
      width: widthNum,
      depth: depthNum,
      height: heightNum,
      heightTypeLabel: typeInfo.heightTypeLabel,
      isCustom: true,
    };

    saveCustomObudowaVariant(newVar);
    const updatedList = getObudowaVariantsForType(typObudowy);
    setAvailableVariants(updatedList);
    setRozmiar(name);
    setIsCustomMode(false);
    setIsAddingVariant(false);
    setNewVarName('');
    setNewVarWidth('');
    setNewVarDepth('');
    setNewVarHeight('');

    notifyChange(
      typObudowy,
      name,
      dataGotowosci,
      false,
      String(widthNum),
      String(depthNum),
      String(heightNum)
    );
  };

  // Active matched variant for display
  const activeMatchedVariant = availableVariants.find((v) => v.name === rozmiar);

  // Active dimensions to show
  const displayWidth = isCustomMode
    ? customWidth
      ? parseFloat(customWidth.replace(',', '.'))
      : undefined
    : activeMatchedVariant?.width;

  const displayDepth = isCustomMode
    ? customDepth
      ? parseFloat(customDepth.replace(',', '.'))
      : undefined
    : activeMatchedVariant?.depth;

  const displayHeight = isCustomMode
    ? customHeight
      ? parseFloat(customHeight.replace(',', '.'))
      : typeInfo.defaultHeight
    : activeMatchedVariant?.height !== undefined
    ? activeMatchedVariant.height
    : typeInfo.defaultHeight;

  // Deadline check
  const overdueInfo = checkReadinessOverdue(dataGotowosci, itemStatus);

  return (
    <div className="space-y-4">
      {/* 3 Core Fields in logical order: 1. Typ, 2. Rozmiar, 3. Data gotowości */}
      <div className="bg-slate-50/90 p-4 rounded-xl border border-slate-200 space-y-4">
        {/* Form Title & Process Context */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Box className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Realizacja obudowy betonowej
            </h4>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            Śledzenie procesu i przekaz między działami
          </span>
        </div>

        {/* 1. Typ obudowy */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-600" />
              1. Typ obudowy
            </span>
            <span className="text-[11px] font-normal text-slate-500">
              {typObudowy === 'BEK' ? 'Obsługa wewnętrzna' : 'Obsługa zewnętrzna'}
            </span>
          </label>

          <select
            value={typObudowy}
            disabled={isReadOnly}
            onChange={(e) => handleTypeChange(e.target.value as ObudowaType)}
            className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden transition-colors"
          >
            <option value="BEK">BEK — obudowa wewnętrzna</option>
            <option value="NZ">NZ — obudowa zewnętrzna</option>
          </select>

          {/* Auxiliary Helper Name Display */}
          <div className="mt-1.5 flex items-start gap-2 p-2 bg-blue-50/70 rounded-lg border border-blue-200/60 text-[11px] text-blue-900">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
            <div className="leading-tight">
              <strong>{typeInfo.fullLabel}:</strong> {typeInfo.auxiliaryName}.{' '}
              <span className="text-blue-700 font-medium">
                Domyślna {typeInfo.heightTypeLabel.toLowerCase()}:{' '}
                <strong className="font-bold underline">{typeInfo.defaultHeightFormatted}</strong>.
              </span>
            </div>
          </div>
        </div>

        {/* 2. Rozmiar obudowy */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-blue-600" />
              2. Rozmiar obudowy
            </label>

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setIsAddingVariant(!isAddingVariant)}
                className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                {isAddingVariant ? 'Zamknij dodawanie' : 'Dodaj wariant do bazy'}
              </button>
            )}
          </div>

          {/* Quick Variant Adder (Configurable) */}
          {isAddingVariant && !isReadOnly && (
            <form
              onSubmit={handleSaveNewVariant}
              className="p-3 mb-3 bg-white rounded-lg border border-blue-300 shadow-xs space-y-2.5 animate-fadeIn"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-blue-950">
                  Nowy wariant rozmiaru dla {typeInfo.label}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddingVariant(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {newVarError && (
                <p className="text-[11px] text-rose-600 font-medium">{newVarError}</p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                <div className="sm:col-span-1">
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    Nazwa wariantu
                  </label>
                  <input
                    type="text"
                    value={newVarName}
                    onChange={(e) => setNewVarName(e.target.value)}
                    placeholder={`np. ${typeInfo.label} 250/500`}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    Szerokość [m]
                  </label>
                  <input
                    type="text"
                    value={newVarWidth}
                    onChange={(e) => setNewVarWidth(e.target.value)}
                    placeholder="np. 2.50"
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    Głębokość [m]
                  </label>
                  <input
                    type="text"
                    value={newVarDepth}
                    onChange={(e) => setNewVarDepth(e.target.value)}
                    placeholder="np. 5.00"
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    Wysokość [m]
                  </label>
                  <input
                    type="text"
                    value={newVarHeight}
                    onChange={(e) => setNewVarHeight(e.target.value)}
                    placeholder={typeInfo.defaultHeightFormatted.replace(' m', '')}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingVariant(false)}
                  className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="px-3 py-1 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded shadow-2xs"
                >
                  Zapisz rozmiar do bazy
                </button>
              </div>
            </form>
          )}

          {/* Variant Selector Dropdown */}
          <select
            value={isCustomMode ? '__CUSTOM__' : rozmiar}
            disabled={isReadOnly}
            onChange={(e) => handleSizeChange(e.target.value)}
            className="w-full text-xs font-semibold px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
          >
            <optgroup label={`Gotowe warianty ${typeInfo.label}`}>
              {availableVariants.map((v) => (
                <option key={v.id} value={v.name}>
                  {v.name}
                  {v.width && v.depth
                    ? ` (${formatDimensionM(v.width)} × ${formatDimensionM(v.depth)})`
                    : ''}
                  {v.isCustom ? ' [Własny]' : ''}
                </option>
              ))}
            </optgroup>
            <optgroup label="Niestandardowe">
              <option value="__CUSTOM__">Inny rozmiar (wprowadź ręcznie wymiary)</option>
            </optgroup>
          </select>

          {/* Custom Size Manual Input */}
          {isCustomMode && (
            <div className="mt-2 p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                <Ruler className="w-3.5 h-3.5 text-amber-600" />
                <span>Ręczne wprowadzanie niestandardowego rozmiaru:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    Oznaczenie / Nazwa
                  </label>
                  <input
                    type="text"
                    value={customName}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setCustomName(e.target.value);
                      notifyChange(
                        typObudowy,
                        e.target.value || 'Inny rozmiar',
                        dataGotowosci,
                        true,
                        customWidth,
                        customDepth,
                        customHeight
                      );
                    }}
                    placeholder={`np. ${typeInfo.label} spec.`}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    Szerokość [m]
                  </label>
                  <input
                    type="text"
                    value={customWidth}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setCustomWidth(e.target.value);
                      notifyChange(
                        typObudowy,
                        customName || 'Inny rozmiar',
                        dataGotowosci,
                        true,
                        e.target.value,
                        customDepth,
                        customHeight
                      );
                    }}
                    placeholder="np. 2.40"
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    Głębokość [m]
                  </label>
                  <input
                    type="text"
                    value={customDepth}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setCustomDepth(e.target.value);
                      notifyChange(
                        typObudowy,
                        customName || 'Inny rozmiar',
                        dataGotowosci,
                        true,
                        customWidth,
                        e.target.value,
                        customHeight
                      );
                    }}
                    placeholder="np. 3.20"
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-mono bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-600 font-medium mb-0.5">
                    {typeInfo.heightTypeLabel} [m]
                  </label>
                  <input
                    type="text"
                    value={customHeight}
                    disabled={isReadOnly}
                    onChange={(e) => {
                      setCustomHeight(e.target.value);
                      notifyChange(
                        typObudowy,
                        customName || 'Inny rozmiar',
                        dataGotowosci,
                        true,
                        customWidth,
                        customDepth,
                        e.target.value
                      );
                    }}
                    placeholder={typeInfo.defaultHeightFormatted.replace(' m', '')}
                    className="w-full text-xs px-2 py-1.5 border border-slate-300 rounded font-mono bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dimensions preview in details (without occupying main screen) */}
          <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200/90 shadow-2xs">
            <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Box className="w-3 h-3 text-slate-400" />
                Rzeczywiste wymiary przypisane do wariantu:
              </span>
              <span className="text-[10px] text-slate-400">Jednostka: metry [m]</span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Szerokość:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatDimensionM(displayWidth)}
                </span>
              </div>
              <div className="bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100">
                <span className="text-[10px] text-slate-400 block">Głębokość:</span>
                <span className="font-mono font-bold text-slate-800">
                  {formatDimensionM(displayDepth)}
                </span>
              </div>
              <div className="bg-slate-50 px-2.5 py-1.5 rounded border border-slate-100">
                <span className="text-[10px] text-slate-400 block truncate" title={typeInfo.heightTypeLabel}>
                  {typeInfo.heightTypeLabel}:
                </span>
                <span className="font-mono font-bold text-blue-900">
                  {formatDimensionM(displayHeight)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Data gotowości */}
        <div>
          <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              3. Data gotowości obudowy
            </span>
            <span className="text-[11px] font-mono text-slate-500">
              Format: {overdueInfo.formattedDate || 'DD.MM.RRRR'}
            </span>
          </label>

          <div className="relative">
            <input
              type="date"
              value={dataGotowosci}
              disabled={isReadOnly}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full text-xs font-mono font-bold px-3 py-2.5 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900"
            />
          </div>

          <p className="text-[11px] text-slate-500 mt-1">
            Dzień, na który obudowa ma być gotowa (termin realizacji prefabrykatu, a nie data wyjazdu).
          </p>

          {/* Overdue Warning Notice */}
          {overdueInfo.isOverdue && (
            <div className="mt-2.5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 text-xs animate-fadeIn">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-rose-900 block">
                  Przekroczono planowany termin gotowości!
                </strong>
                <span>
                  Obudowa nie jest oznaczona jako gotowa, a termin minął{' '}
                  <strong className="font-mono underline">{overdueInfo.formattedDate}</strong> (
                  {overdueInfo.daysOverdue}{' '}
                  {overdueInfo.daysOverdue === 1 ? 'dzień' : 'dni'} po terminie).
                </span>
              </div>
            </div>
          )}

          {!overdueInfo.isOverdue && dataGotowosci && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-emerald-700">
              <CheckCircle className="w-3 h-3 text-emerald-600" />
              <span>
                Planowany termin gotowości:{' '}
                <strong className="font-mono font-bold">{overdueInfo.formattedDate}</strong>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
