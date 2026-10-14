import { Attachment } from '../types/enco';
import { sanitizePathSegment, getFolderDefinitionByKey, getFolderDefinitionForType } from '../utils/fileLocations';

export interface FolderFileItem {
  name: string;
  sizeBytes: number;
  formattedSize: string;
  mtime: string;
  uploadedAt: string;
  folderKey: string;
  diskPath: string;
  downloadUrl: string;
}

export interface FolderDetails {
  folderKey: string;
  label: string;
  diskPath: string;
  filesCount: number;
  totalSizeBytes: number;
  totalSizeFormatted: string;
  files: FolderFileItem[];
}

export interface OrderFoldersSummary {
  success: boolean;
  orderNumber: string;
  rootDiskPath: string;
  foldersCount: number;
  totalFilesCount: number;
  folders: FolderDetails[];
}

/**
 * Fetch list of physical folders and files on the server for a specific order
 */
export async function fetchOrderFolders(orderNumber: string): Promise<OrderFoldersSummary | null> {
  try {
    const res = await fetch(`/api/files/folders?orderNumber=${encodeURIComponent(orderNumber)}`);
    if (!res.ok) return null;
    const data: OrderFoldersSummary = await res.json();
    return data;
  } catch (err) {
    console.warn('Could not fetch folders from server:', err);
    return null;
  }
}

/**
 * Upload a file directly to the structured folder on the server
 */
export async function uploadFileToServer(params: {
  orderNumber: string;
  folderKey?: string;
  file: File;
  uploadedBy?: string;
}): Promise<Attachment | null> {
  const { orderNumber, folderKey = '01_Dokumentacja_Glowna', file, uploadedBy } = params;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;

        const res = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderNumber,
            folderKey,
            fileName: file.name,
            base64Data,
            uploadedBy,
          }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success && json.attachment) {
            resolve(json.attachment);
            return;
          }
        }

        // Fallback if server upload fails (e.g. offline mode)
        const fileSizeKB = Math.round(file.size / 1024);
        const sizeStr = fileSizeKB > 1024 ? `${(fileSizeKB / 1024).toFixed(1)} MB` : `${fileSizeKB} KB`;
        const ext = file.name.split('.').pop()?.toLowerCase() || 'plik';
        const safeOrder = sanitizePathSegment(orderNumber);

        resolve({
          id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: file.name,
          size: sizeStr,
          uploadedAt: new Date().toISOString().split('T')[0],
          fileType: ext,
          folderCategory: folderKey,
          folderPath: `${safeOrder}/${folderKey}`,
          diskPath: `data_store/uploads/${safeOrder}/${folderKey}/${file.name}`,
          dataUrl: base64Data,
          uploadedBy: uploadedBy || 'Użytkownik',
        });
      } catch (e) {
        console.error('Error during upload request:', e);
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Delete a file from server storage
 */
export async function deleteFileFromServer(params: {
  orderNumber: string;
  folderKey?: string;
  fileName: string;
}): Promise<boolean> {
  try {
    const res = await fetch('/api/files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to delete file on server:', err);
    return false;
  }
}

/**
 * Create a new custom folder on server disk
 */
export async function createCustomFolder(orderNumber: string, folderName: string): Promise<boolean> {
  try {
    const res = await fetch('/api/files/create-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber, folderName }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to create custom folder on server:', err);
    return false;
  }
}
