import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Folder,
  FolderOpen,
  FileText,
  File,
  Image as ImageIcon,
  Download,
  Upload,
  Plus,
  Trash2,
  Copy,
  Check,
  Search,
  ExternalLink,
  Layers,
  Zap,
  Wrench,
  Shield,
  Palette,
  Tag,
  DoorClosed,
  Truck,
  Award,
  Archive,
  HardDrive,
  RefreshCw,
  FolderPlus,
} from 'lucide-react';
import {
  STATION_FOLDERS,
  StationFolderDefinition,
  getFolderDefinitionByKey,
  sanitizePathSegment,
} from '../utils/fileLocations';
import {
  fetchOrderFolders,
  uploadFileToServer,
  deleteFileFromServer,
  createCustomFolder,
  OrderFoldersSummary,
  FolderDetails,
  FolderFileItem,
} from '../services/fileService';
import { UserRoleProfile } from '../types/userRole';
import { Attachment } from '../types/enco';

interface OrderFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderNumber: string;
  projectName: string;
  currentProfile?: UserRoleProfile;
  initialFolderKey?: string;
  onAttachmentAdded?: (attachment: Attachment) => void;
  onAttachmentDeleted?: (attachmentIdOrName: string) => void;
}

export const OrderFilesModal: React.FC<OrderFilesModalProps> = ({
  isOpen,
  onClose,
  orderNumber,
  projectName,
  currentProfile,
  initialFolderKey,
  onAttachmentAdded,
  onAttachmentDeleted,
}) => {
  const [summary, setSummary] = useState<OrderFoldersSummary | null>(null);
  const [selectedFolderKey, setSelectedFolderKey] = useState<string>(
    initialFolderKey || '01_Dokumentacja_Glowna'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canDownload = currentProfile ? currentProfile.canDownload : true;
  const canEdit = currentProfile ? currentProfile.id !== 'ogolny' : true;

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchOrderFolders(orderNumber);
    if (data) {
      setSummary(data);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen && orderNumber) {
      loadData();
      if (initialFolderKey) {
        setSelectedFolderKey(initialFolderKey);
      }
    }
  }, [isOpen, orderNumber, initialFolderKey]);

  if (!isOpen) return null;

  const handleCopyPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 2500);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    for (const file of Array.from(files)) {
      const att = await uploadFileToServer({
        orderNumber,
        folderKey: selectedFolderKey,
        file,
        uploadedBy: currentProfile?.name || 'Użytkownik',
      });

      if (att && onAttachmentAdded) {
        onAttachmentAdded(att);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    await loadData();
    setIsUploading(false);
  };

  const handleDeleteFile = async (folderKey: string, fileName: string) => {
    if (!window.confirm(`Czy na pewno usunąć plik "${fileName}" z folderu ${folderKey}?`)) {
      return;
    }

    const success = await deleteFileFromServer({
      orderNumber,
      folderKey,
      fileName,
    });

    if (success) {
      if (onAttachmentDeleted) {
        onAttachmentDeleted(fileName);
      }
      await loadData();
    }
  };

  const handleCreateNewFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;

    const ok = await createCustomFolder(orderNumber, newFolderName.trim());
    if (ok) {
      const createdKey = sanitizePathSegment(newFolderName.trim());
      setNewFolderName('');
      setIsCreatingFolder(false);
      await loadData();
      setSelectedFolderKey(createdKey);
    }
  };

  const getFolderIcon = (folderKey: string) => {
    const def = getFolderDefinitionByKey(folderKey);
    switch (def.iconType) {
      case 'file-text':
        return <FileText className="w-4 h-4 text-blue-600" />;
      case 'layers':
        return <Layers className="w-4 h-4 text-amber-600" />;
      case 'zap':
        return <Zap className="w-4 h-4 text-yellow-600" />;
      case 'tool':
        return <Wrench className="w-4 h-4 text-indigo-600" />;
      case 'shield':
        return <Shield className="w-4 h-4 text-emerald-600" />;
      case 'palette':
        return <Palette className="w-4 h-4 text-purple-600" />;
      case 'tag':
        return <Tag className="w-4 h-4 text-slate-600" />;
      case 'door':
        return <DoorClosed className="w-4 h-4 text-orange-600" />;
      case 'truck':
        return <Truck className="w-4 h-4 text-teal-600" />;
      case 'award':
        return <Award className="w-4 h-4 text-rose-600" />;
      default:
        return <Folder className="w-4 h-4 text-slate-500" />;
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-4 h-4 text-rose-600 shrink-0" />;
    if (['jpg', 'jpeg', 'png', 'svg'].includes(ext || ''))
      return <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />;
    if (['dwg', 'dxf'].includes(ext || ''))
      return <Layers className="w-4 h-4 text-purple-600 shrink-0" />;
    return <File className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  const selectedFolderData = summary?.folders.find((f) => f.folderKey === selectedFolderKey);
  const selectedFolderDef = getFolderDefinitionByKey(selectedFolderKey);

  // Filter files if search active
  const filteredFiles = (selectedFolderData?.files || []).filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-linear-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/30 border border-blue-400/30 rounded-xl text-blue-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-blue-600 text-white">
                  {orderNumber}
                </span>
                <h2 className="text-base sm:text-lg font-bold">
                  Repozytorium Folderów i Załączników
                </h2>
              </div>
              <p className="text-xs text-slate-300 mt-0.5 truncate max-w-xl">
                Projekt: <span className="text-white font-medium">{projectName}</span> · Struktura lokalizacji serwerowych
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              title="Odśwież strukturę folderów"
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global info banner showing exact disk root */}
        <div className="bg-slate-50 px-6 py-2 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs gap-2">
          <div className="flex items-center gap-2 text-slate-600 font-mono text-[11px]">
            <FolderOpen className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Lokalizacja bazowa na dysku serwera:</span>
            <code className="bg-slate-200 px-1.5 py-0.5 rounded text-slate-800 font-bold">
              {summary?.rootDiskPath || `data_store/uploads/${sanitizePathSegment(orderNumber)}/`}
            </code>
            <button
              type="button"
              onClick={() =>
                handleCopyPath(
                  summary?.rootDiskPath || `data_store/uploads/${sanitizePathSegment(orderNumber)}/`
                )
              }
              title="Kopiuj pełną ścieżkę do schowka"
              className="text-slate-400 hover:text-blue-600 cursor-pointer"
            >
              {copiedPath ===
              (summary?.rootDiskPath || `data_store/uploads/${sanitizePathSegment(orderNumber)}/`) ? (
                <Check className="w-3 h-3 text-emerald-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 text-slate-500 text-xs">
            <span>
              Folderów: <strong>{summary?.foldersCount || 13}</strong>
            </span>
            <span>·</span>
            <span>
              Wszystkich plików: <strong>{summary?.totalFilesCount || 0}</strong>
            </span>
          </div>
        </div>

        {/* Body 2-column layout: Left = Folder Navigation Tree, Right = Files in Folder */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[460px]">
          {/* Left Column: Folders List */}
          <div className="w-full md:w-80 border-r border-slate-200 bg-slate-50/70 flex flex-col shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Katalogi Zlecenia ({summary?.folders.length || STATION_FOLDERS.length})
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setIsCreatingFolder(!isCreatingFolder)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  + Nowy folder
                </button>
              )}
            </div>

            {isCreatingFolder && (
              <form onSubmit={handleCreateNewFolder} className="p-3 bg-blue-50 border-b border-blue-200">
                <p className="text-[11px] text-blue-900 font-medium mb-1">Utwórz własny podfolder:</p>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="np. 14_Uzgodnienia_BHP"
                    className="flex-1 text-xs px-2 py-1 bg-white border border-blue-300 rounded focus:outline-hidden"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-semibold cursor-pointer"
                  >
                    Dodaj
                  </button>
                </div>
              </form>
            )}

            <div className="p-2 space-y-1">
              {(summary?.folders || []).map((folder) => {
                const isSelected = folder.folderKey === selectedFolderKey;
                const def = getFolderDefinitionByKey(folder.folderKey);

                return (
                  <button
                    key={folder.folderKey}
                    type="button"
                    onClick={() => setSelectedFolderKey(folder.folderKey)}
                    className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-start gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'bg-blue-600 text-white shadow-xs font-medium'
                        : 'text-slate-700 hover:bg-slate-200/70'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {isSelected ? (
                        <FolderOpen className="w-4 h-4 text-white" />
                      ) : (
                        getFolderIcon(folder.folderKey)
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold truncate">
                          {def ? def.title : folder.label}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono tabular-nums shrink-0 ${
                            isSelected
                              ? 'bg-blue-500 text-white'
                              : folder.filesCount > 0
                              ? 'bg-blue-100 text-blue-800 font-bold'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {folder.filesCount}
                        </span>
                      </div>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          isSelected ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {folder.folderKey}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: Files in Selected Folder */}
          <div className="flex-1 flex flex-col bg-white overflow-hidden">
            {/* Top Bar for Selected Folder */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/50">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    {getFolderIcon(selectedFolderKey)}
                    <h3 className="text-sm font-bold text-slate-900">
                      {selectedFolderDef ? selectedFolderDef.fullTitle : selectedFolderKey}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 max-w-xl">
                    {selectedFolderDef?.description}
                  </p>

                  <div className="flex items-center gap-2 mt-2 text-[11px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200 inline-flex">
                    <span className="text-slate-400">Ścieżka:</span>
                    <span className="text-slate-800 font-medium">
                      data_store/uploads/{sanitizePathSegment(orderNumber)}/{selectedFolderKey}/
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        handleCopyPath(
                          `data_store/uploads/${sanitizePathSegment(orderNumber)}/${selectedFolderKey}/`
                        )
                      }
                      title="Kopiuj ścieżkę folderu"
                      className="text-slate-400 hover:text-blue-600 cursor-pointer"
                    >
                      {copiedPath ===
                      `data_store/uploads/${sanitizePathSegment(orderNumber)}/${selectedFolderKey}/` ? (
                        <Check className="w-3 h-3 text-emerald-600" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Upload action */}
                {canEdit && (
                  <div className="shrink-0 flex items-center gap-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={isUploading}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isUploading ? 'Wgrywanie...' : 'Wgraj plik do tego folderu'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Search filter if folder has files */}
              {selectedFolderData && selectedFolderData.files.length > 3 && (
                <div className="mt-3 relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtruj pliki w tym folderze..."
                    className="w-full pl-8 pr-3 py-1 text-xs bg-white border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Files List */}
            <div className="flex-1 overflow-y-auto p-4">
              {!selectedFolderData || selectedFolderData.files.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <div className="p-3 bg-white rounded-full shadow-2xs border border-slate-200 mb-3 text-slate-400">
                    <Folder className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-700">Folder jest pusty</h4>
                  <p className="text-xs text-slate-400 max-w-sm mt-1">
                    Brak załączonych plików w folderze{' '}
                    <code className="text-slate-600 font-mono">{selectedFolderKey}</code>.
                    {canEdit && ' Kliknij przycisk powyżej, aby dodać pierwsze dokumenty lub rysunki techniczne.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-500 pb-1 border-b border-slate-100">
                    <span>
                      Pliki w folderze (<strong>{filteredFiles.length}</strong> z {selectedFolderData.filesCount}):
                    </span>
                    <span>Łączny rozmiar: <strong>{selectedFolderData.totalSizeFormatted}</strong></span>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {filteredFiles.map((file) => (
                      <div
                        key={file.name}
                        className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-2xs transition-all group"
                      >
                        <div className="flex items-center gap-3 min-w-0 mr-3">
                          <div className="p-2 bg-slate-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                            {getFileIcon(file.name)}
                          </div>
                          <div className="min-w-0">
                            <p
                              className="text-xs font-semibold text-slate-900 truncate"
                              title={file.name}
                            >
                              {file.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                              <span className="font-mono">{file.formattedSize}</span>
                              <span>·</span>
                              <span>Dodano: {file.uploadedAt}</span>
                              <span>·</span>
                              <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded text-slate-600 truncate max-w-xs" title={file.diskPath}>
                                📁 {file.diskPath}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyPath(file.diskPath)}
                            title="Kopiuj pełną ścieżkę serwera"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedPath === file.diskPath ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {canDownload && (
                            <a
                              href={file.downloadUrl}
                              download={file.name}
                              title="Pobierz plik z serwera"
                              className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-xs font-medium"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Pobierz</span>
                            </a>
                          )}

                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteFile(file.folderKey, file.name)}
                              title="Usuń plik z folderu"
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>Foldery i załączniki zapisywane są bezpośrednio w strukturze katalogowej systemu na serwerze</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg font-semibold cursor-pointer transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
