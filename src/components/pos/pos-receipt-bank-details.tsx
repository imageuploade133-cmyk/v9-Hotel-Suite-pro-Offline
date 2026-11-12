'use client';

import * as React from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

export interface PosBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  bankLogoUrl?: string;
  showAccountOnDocket?: boolean;
  showAccountOnPaid?: boolean;
}

export const EMPTY_POS_BANK_DETAILS: PosBankDetails = {
  bankName: '',
  accountName: '',
  accountNumber: '',
  bankLogoUrl: '',
  showAccountOnDocket: undefined,
  showAccountOnPaid: undefined,
};

export const posStaffBankStorageKey = (uid: string) => `pos_staff_bank_details_${uid}`;
export const posStaffBankPendingKey = (uid: string) => `pos_staff_bank_details_pending_${uid}`;

export const OFFLINE_POS_BANK_LOGO_PREFIX = 'offline-pos-bank-logo:';

function openPosBankLogoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('v9-pos-bank-logos', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('logos')) db.createObjectStore('logos', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Could not open local logo storage.'));
  });
}

export async function saveOfflinePosBankLogo(key: string, file: File): Promise<string> {
  if (typeof indexedDB === 'undefined') throw new Error('This browser does not support offline logo storage.');
  const db = await openPosBankLogoDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('logos', 'readwrite');
      tx.objectStore('logos').put({ key, blob: file, name: file.name, type: file.type, lastModified: file.lastModified });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not save the logo for offline use.'));
      tx.onabort = () => reject(tx.error || new Error('Offline logo save was cancelled.'));
    });
  } finally { db.close(); }
  return OFFLINE_POS_BANK_LOGO_PREFIX + encodeURIComponent(key);
}

export async function getOfflinePosBankLogo(key: string): Promise<File | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openPosBankLogoDb();
  try {
    return await new Promise<File | null>((resolve, reject) => {
      const request = db.transaction('logos', 'readonly').objectStore('logos').get(key);
      request.onsuccess = () => {
        const record = request.result;
        resolve(record?.blob ? new File([record.blob], record.name || 'bank-logo', {
          type: record.type || record.blob.type || 'image/png',
          lastModified: record.lastModified || Date.now(),
        }) : null);
      };
      request.onerror = () => reject(request.error || new Error('Could not read the saved offline logo.'));
    });
  } finally { db.close(); }
}

export async function removeOfflinePosBankLogo(key: string): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openPosBankLogoDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('logos', 'readwrite');
      tx.objectStore('logos').delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Could not remove the offline logo.'));
    });
  } finally { db.close(); }
}

export function getOfflinePosBankLogoKey(url: string | undefined): string | null {
  if (!url?.startsWith(OFFLINE_POS_BANK_LOGO_PREFIX)) return null;
  try { return decodeURIComponent(url.slice(OFFLINE_POS_BANK_LOGO_PREFIX.length)); }
  catch { return null; }
}

export async function uploadPosBankLogo(file: File, apiKey: string): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file for the bank logo.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Bank logo must be 5 MB or smaller.');
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new Error('ImgBB upload needs an internet connection. Save the logo offline first; it will upload automatically when you reconnect.');
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1] || '') : reject(new Error('Could not read the selected image.'));
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.readAsDataURL(file);
  });
  const body = new FormData();
  body.append('image', base64);
  body.append('name', `pos-bank-logo-${Date.now()}`);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, { method: 'POST', body });
  const result = await response.json();
  if (!response.ok || !result?.success || !result?.data?.url) throw new Error(result?.error?.message || 'Bank logo upload failed.');
  return result.data.url as string;
}

export function normalizePosBankDetails(value: Partial<PosBankDetails> | null | undefined): PosBankDetails {
  return {
    bankName: typeof value?.bankName === 'string' ? value.bankName.trim() : '',
    accountName: typeof value?.accountName === 'string' ? value.accountName.trim() : '',
    accountNumber: typeof value?.accountNumber === 'string' ? value.accountNumber.replace(/\s+/g, '') : '',
    bankLogoUrl: typeof value?.bankLogoUrl === 'string' ? value.bankLogoUrl.trim() : '',
    showAccountOnDocket: typeof value?.showAccountOnDocket === 'boolean' ? value.showAccountOnDocket : undefined,
    showAccountOnPaid: typeof value?.showAccountOnPaid === 'boolean' ? value.showAccountOnPaid : undefined,
  };
}

function readLocalDetails(uid: string): PosBankDetails {
  if (typeof window === 'undefined') return EMPTY_POS_BANK_DETAILS;
  try {
    const raw = localStorage.getItem(posStaffBankStorageKey(uid));
    return raw ? normalizePosBankDetails(JSON.parse(raw)) : EMPTY_POS_BANK_DETAILS;
  } catch {
    return EMPTY_POS_BANK_DETAILS;
  }
}

export function usePosReceiptBankDetails(
  staffUid: string | undefined,
  fallback: Partial<PosBankDetails>
) {
  const firestore = useFirestore();
  // Start with a deterministic server/client value; load the UID-scoped cache in the effect.
  const [personalState, setPersonalState] = React.useState<{ uid?: string; details: PosBankDetails }>({
    uid: staffUid,
    details: EMPTY_POS_BANK_DETAILS,
  });
  // Never render the previous cashier's cached details during a staff UID change.
  const personal = personalState.uid === staffUid
    ? personalState.details
    : (staffUid ? readLocalDetails(staffUid) : EMPTY_POS_BANK_DETAILS);
  const [isLoading, setIsLoading] = React.useState(!!staffUid);

  React.useEffect(() => {
    let active = true;
    if (!staffUid) {
      setPersonalState({ uid: staffUid, details: EMPTY_POS_BANK_DETAILS });
      setIsLoading(false);
      return;
    }

    const cached = readLocalDetails(staffUid);
    setPersonalState({ uid: staffUid, details: cached });
    setIsLoading(true);

    const loadLocalMaster = async () => {
      if (!isLocalMasterHost()) return;
      try {
        const response = await fetch('/api/lan-sync?collection=posStaffAccountSettings');
        if (!response.ok) return;
        const payload = await response.json();
        const localRecord = payload?.data?.[staffUid];
        if (localRecord && active) {
          const localDetails = normalizePosBankDetails(localRecord);
          setPersonalState({ uid: staffUid, details: localDetails });
          try { localStorage.setItem(posStaffBankStorageKey(staffUid), JSON.stringify(localDetails)); } catch {}
        }
      } catch (error) {
        console.warn('[POS bank details] Local Master lookup failed:', error);
      }
    };

    const syncAndLoad = async () => {
      if (!firestore) {
        const hasPendingLocalChange = (() => {
          try { return localStorage.getItem(posStaffBankPendingKey(staffUid)) === '1'; }
          catch { return false; }
        })();
        if (!hasPendingLocalChange) await loadLocalMaster();
        if (active) setIsLoading(false);
        return;
      }
      try {
        const ref = doc(firestore, 'posStaffAccountSettings', staffUid);
        const snapshot = await getDoc(ref);
        if (!active) return;
        const pending = (() => {
          try { return localStorage.getItem(posStaffBankPendingKey(staffUid)) === '1'; }
          catch { return false; }
        })();
        if (pending && typeof navigator !== 'undefined' && navigator.onLine) {
          // Locally saved changes (including an intentional clear) take precedence until synced.
          await setDoc(ref, { ...cached, uid: staffUid, updatedAt: new Date().toISOString() }, { merge: true });
          try { localStorage.removeItem(posStaffBankPendingKey(staffUid)); } catch {}
          if (active) setPersonalState({ uid: staffUid, details: cached });
        } else if (snapshot.exists()) {
          const remote = normalizePosBankDetails(snapshot.data() as Partial<PosBankDetails>);
          setPersonalState({ uid: staffUid, details: remote });
          try { localStorage.setItem(posStaffBankStorageKey(staffUid), JSON.stringify(remote)); } catch {}
        } else {
          await loadLocalMaster();
        }
      } catch (error) {
        // The local per-user cache remains authoritative while a save/clear is pending.
        console.warn('[POS bank details] Could not refresh staff account details:', error);
        const pending = (() => {
          try { return localStorage.getItem(posStaffBankPendingKey(staffUid)) === '1'; }
          catch { return false; }
        })();
        if (!pending) await loadLocalMaster();
      } finally {
        if (active) setIsLoading(false);
      }
    };

    void syncAndLoad();
    return () => { active = false; };
  }, [staffUid, firestore]);

  const effective = React.useMemo(() => {
    const own = normalizePosBankDetails(personal);
    const global = normalizePosBankDetails(fallback);
    return {
      bankName: own.bankName || global.bankName,
      accountName: own.accountName || global.accountName,
      accountNumber: own.accountNumber || global.accountNumber,
      bankLogoUrl: own.bankLogoUrl || global.bankLogoUrl,
      showAccountOnDocket: own.showAccountOnDocket ?? global.showAccountOnDocket ?? true,
      showAccountOnPaid: own.showAccountOnPaid ?? global.showAccountOnPaid ?? true,
    };
  }, [personal, fallback.bankName, fallback.accountName, fallback.accountNumber, fallback.bankLogoUrl, fallback.showAccountOnDocket, fallback.showAccountOnPaid]);

  return { details: effective, isLoading, hasDetails: !!(effective.bankName || effective.accountName || effective.accountNumber) };
}

export function POSReceiptBankDetails({
  staffUid,
  fallback,
  variant = 'terminal',
  receiptType = 'paid',
}: {
  staffUid?: string;
  fallback: Partial<PosBankDetails>;
  variant?: 'terminal' | 'invoice';
  receiptType?: 'docket' | 'paid';
}) {
  const { details, hasDetails } = usePosReceiptBankDetails(staffUid, fallback);
  const shouldShow = receiptType === 'docket' ? details.showAccountOnDocket !== false : details.showAccountOnPaid !== false;
  const [displayBankLogoUrl, setDisplayBankLogoUrl] = React.useState(details.bankLogoUrl || '');

  React.useEffect(() => {
    let active = true;
    let objectUrl = '';
    const offlineKey = getOfflinePosBankLogoKey(details.bankLogoUrl);
    if (!offlineKey) {
      setDisplayBankLogoUrl(details.bankLogoUrl || '');
      return;
    }
    setDisplayBankLogoUrl('');
    void getOfflinePosBankLogo(offlineKey).then(file => {
      if (!active || !file) return;
      objectUrl = URL.createObjectURL(file);
      setDisplayBankLogoUrl(objectUrl);
    }).catch(error => console.warn('[POS bank logo] Offline image unavailable:', error));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [details.bankLogoUrl]);

  if (!hasDetails || !shouldShow) return null;

  if (variant === 'terminal') {
    return (
      <div className="mt-4 border-t border-dashed border-black pt-2 text-center text-xs leading-relaxed">
        {displayBankLogoUrl && <img src={displayBankLogoUrl} alt="Bank logo" className="mx-auto mb-2 max-h-12 max-w-[120px] object-contain" />}
        <p className="mb-1 font-bold uppercase">Bank Transfer Details</p>
        {details.bankName && <p>Bank: {details.bankName}</p>}
        {details.accountName && <p>Account Name: {details.accountName}</p>}
        {details.accountNumber && <p className="font-bold tracking-wider">Account No: {details.accountNumber}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-md border border-slate-300 p-4 text-sm text-slate-800">
      {displayBankLogoUrl && <img src={displayBankLogoUrl} alt="Bank logo" className="mb-3 max-h-14 max-w-[150px] object-contain" />}
      <h3 className="mb-2 font-bold uppercase tracking-wide">Bank Transfer Details</h3>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {details.bankName && <p><strong>Bank:</strong> {details.bankName}</p>}
        {details.accountName && <p><strong>Account Name:</strong> {details.accountName}</p>}
        {details.accountNumber && <p className="font-mono sm:col-span-2"><strong>Account Number:</strong> {details.accountNumber}</p>}
      </div>
      <p className="mt-2 text-xs text-slate-500">Please use the sale or invoice reference when making a transfer.</p>
    </div>
  );
}
