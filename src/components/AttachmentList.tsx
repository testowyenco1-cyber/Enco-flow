import React, { useRef, useState } from 'react';
import { Attachment } from '../types/enco';
import {
  Paperclip,
  FileText,
  Download,
  Trash2,
  Plus,
  File,
  Image as ImageIcon,
  FolderOpen,
  Copy,
  Check,
  Upload,
} from 'lucide-react';
import {
  getFolderDefinitionForType,
  getFolderDefinitionByKey,
  sanitizePathSegment,
  STATION_FOLDERS,
} from '../utils/fileLocations';
import { uploadFileToServer } from '../services/fileService';
import { UserRoleProfile } from '../types/userRole';

interface AttachmentListProps {
  attachments: Attachment[];
  onAddAttachment: (attachment: Attachment) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  title?: string;
  readOnly?: boolean;
  canDownload?: boolean;
  orderNumber?: string;
  itemType?: string;
  folderCategory?: string;
  currentProfile?: UserRoleProfile;
  onOpenFolderManager?: (folderKey?: string) => void;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  onAddAttachment,
  onDeleteAttachment,
  title = 'Załączniki',
  readOnly = false,
  canDownload = true,
  orderNumber,
  itemType,
  folderCategory,
  currentProfile,
  onOpenFolderManager,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAddingLink, setIsAddingLink] = useState(false);
  const [manualName, setManualName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Compute default target folder for this card
  const defaultFolderDef = folderCategory
    ? getFolderDefinitionByKey(folderCategory)
    : getFolderDefinitionForType(itemType);
  const targetFolderKey = defaultFolderDef.folderKey;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      if (orderNumber) {
        // Real server-side upload into exact physical disk directory
        const newAtt = await uploadFileToServer({
          orderNumber,
          folderKey: targetFolderKey,
          file,
          uploadedBy: currentProfile?.name || 'Użytkownik',
        });

        if (newAtt) {
          onAddAttachment(newAtt);
        }
      } else {
        // Fallback offline / local upload
        const reader = new FileReader();
        const fileSizeKB = Math.round(file.size / 1024);
        const sizeStr = fileSizeKB > 1024 ? `${(fileSizeKB / 1024).toFixed(1)} MB` : `${fileSizeKB} KB`;
        const ext = file.name.split('.').pop()?.toLowerCase() || 'plik';

        reader.onload = () => {
          const dataUrl = reader.result as string;
          const newAtt: Attachment = {
            id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: file.name,
            size: sizeStr,
            uploadedAt: new Date().toISOString().split('T')[0],
            fileType: ext,
            folderCategory: targetFolderKey,
            folderPath: `${orderNumber ? sanitizePathSegment(orderNumber) : 'PROJEKT'}/${targetFolderKey}`,
            diskPath: `data_store/uploads/${orderNumber ? sanitizePathSegment(orderNumber) : 'PROJEKT'}/${targetFolderKey}/${file.name}`,
            dataUrl: dataUrl,
            uploadedBy: currentProfile?.name || 'Użytkownik',
          };
          onAddAttachment(newAtt);
        };
        reader.readAsDataURL(file);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsUploading(false);
  };

  const handleAddManualName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualName.trim()) return;

    const fileName = manualName.trim().endsWith('.pdf') ? manualName.trim() : `${manualName.trim()}.pdf`;
    const safeOrder = orderNumber ? sanitizePathSegment(orderNumber) : 'PROJEKT';

    const newAtt: Attachment = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: fileName,
      size: '1.2 MB',
      uploadedAt: new Date().toISOString().split('T')[0],
      fileType: 'pdf',
      folderCategory: targetFolderKey,
      folderPath: `${safeOrder}/${targetFolderKey}`,
      diskPath: `data_store/uploads/${safeOrder}/${targetFolderKey}/${fileName}`,
      uploadedBy: currentProfile?.name || 'Użytkownik',
    };
    onAddAttachment(newAtt);
    setManualName('');
    setIsAddingLink(false);
  };

  const handleDownload = (att: Attachment) => {
    if (att.url) {
      window.open(att.url, '_blank');
      return;
    }

    if (att.dataUrl) {
      const link = document.createElement('a');
      link.href = att.dataUrl;
      link.download = att.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // If orderNumber and folderCategory are known, attempt direct download from server route
    if (orderNumber) {
      const cat = att.folderCategory || targetFolderKey;
      const downloadEndpoint = `/api/files/download?orderNumber=${encodeURIComponent(
        orderNumber
      )}&folderKey=${encodeURIComponent(cat)}&fileName=${encodeURIComponent(att.name)}`;
      window.open(downloadEndpoint, '_blank');
      return;
    }

    // Mock text blob download if nothing else available
    const blob = new Blob(
      [
        `ENCO FLOW - Dokumentacja stacji transformatorowej\nPlik: ${att.name}\nLokalizacja: ${
          att.diskPath || att.folderPath || 'data_store/uploads/'
        }\nData utworzenia: ${att.uploadedAt}`,
      ],
      {
        type: 'text/plain;charset=utf-8',
      }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = att.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyDiskPath = (att: Attachment) => {
    const path =
      att.diskPath ||
      `data_store/uploads/${orderNumber ? sanitizePathSegment(orderNumber) : 'PROJEKT'}/${
        att.folderCategory || targetFolderKey
      }/${att.name}`;
    navigator.clipboard.writeText(path);
    setCopiedId(att.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return <FileText className="w-4 h-4 text-rose-600 shrink-0" />;
    if (['jpg', 'jpeg', 'png', 'svg'].includes(ext || ''))
      return <ImageIcon className="w-4 h-4 text-blue-600 shrink-0" />;
    return <File className="w-4 h-4 text-slate-500 shrink-0" />;
  };

  return (
    <div className="space-y-2">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap min-w-0 items-center gap-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
          <Paperclip className="w-3.5 h-3.5 text-slate-400" />
          <span>{title}</span>
          <span className="text-slate-400 font-normal">({attachments.length})</span>
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0 max-w-full">
          {/* Destination folder indicator */}
          <span
            title={`Domyślna lokalizacja na dysku: data_store/uploads/${
              orderNumber ? sanitizePathSegment(orderNumber) : 'PROJEKT'
            }/${targetFolderKey}/`}
            className="min-w-0 max-w-full text-[10px] font-mono font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-0.5 rounded border border-slate-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
            onClick={() => onOpenFolderManager && onOpenFolderManager(targetFolderKey)}
          >
            <FolderOpen className="w-3 h-3 text-blue-600" />
            <span className="truncate max-w-[130px] sm:max-w-none">{targetFolderKey}</span>
          </span>

          {!readOnly && (
            <div className="flex items-center gap-1.5">
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
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                {isUploading ? 'Wgrywanie...' : 'Wgraj plik'}
              </button>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => setIsAddingLink(!isAddingLink)}
                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer break-words"
              >
                + Wpisz nazwę
              </button>
            </div>
          )}

          {onOpenFolderManager && (
            <>
              <span className="text-slate-300">·</span>
              <button
                type="button"
                onClick={() => onOpenFolderManager(targetFolderKey)}
                title="Otwórz pełny menedżer folderów i załączników"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-blue-600 cursor-pointer"
              >
                <FolderOpen className="w-3 h-3 text-amber-600" />
                <span>Foldery</span>
              </button>
            </>
          )}
        </div>
      </div>

      {isAddingLink && (
        <form
          onSubmit={handleAddManualName}
          className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-md"
        >
          <input
            type="text"
            value={manualName}
            onChange={(e) => setManualName(e.target.value)}
            placeholder="np. DTR_Rozdzielnicy_SN.pdf"
            className="flex-1 text-xs px-2.5 py-1 bg-white border border-slate-300 rounded focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            type="submit"
            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded cursor-pointer"
          >
            Dodaj
          </button>
          <button
            type="button"
            onClick={() => setIsAddingLink(false)}
            className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700 cursor-pointer"
          >
            Anuluj
          </button>
        </form>
      )}

      {attachments.length === 0 ? (
        <div className="text-xs text-slate-400 italic py-1 flex items-center justify-between">
          <span>Brak załączonych plików i rysunków.</span>
          <span className="text-[11px] text-slate-400">
            Lokalizacja: <code className="text-slate-600 font-mono">{targetFolderKey}</code>
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {attachments.map((att) => {
            const folderName = att.folderCategory || targetFolderKey;
            const fullDisk =
              att.diskPath ||
              `data_store/uploads/${orderNumber ? sanitizePathSegment(orderNumber) : 'PROJEKT'}/${folderName}/${att.name}`;

            return (
              <div
                key={att.id}
                className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-white hover:border-blue-300 hover:shadow-2xs transition-colors group"
              >
                <div className="flex items-center gap-2 min-w-0 mr-2">
                  {getFileIcon(att.name)}
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-800 truncate" title={att.name}>
                      {att.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                      {att.size && <span>{att.size}</span>}
                      <span>·</span>
                      <span className="font-mono tabular-nums">{att.uploadedAt}</span>
                      <span>·</span>
                      <span
                        title={`Folder: ${fullDisk}`}
                        onClick={() => onOpenFolderManager && onOpenFolderManager(folderName)}
                        className="bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-800 px-1 rounded font-mono truncate max-w-[120px] cursor-pointer inline-flex items-center gap-0.5"
                      >
                        📁 {folderName}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleCopyDiskPath(att)}
                    title={`Kopiuj pełną ścieżkę serwera: ${fullDisk}`}
                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                  >
                    {copiedId === att.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>

                  {canDownload ? (
                    <button
                      type="button"
                      onClick={() => handleDownload(att)}
                      title="Pobierz / otwórz plik"
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <span
                      title="Brak uprawnień do pobierania plików dla aktywnego profilu (Ogólny)"
                      className="p-1 text-slate-300 rounded cursor-not-allowed opacity-60 inline-flex items-center"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </span>
                  )}

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onDeleteAttachment(att.id)}
                      title="Usuń załącznik"
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
