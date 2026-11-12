'use client';

import * as React from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import { isLocalMasterHost } from '@/lib/lan-sync/is-local-master-host';

export interface PosBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
}

export const EMPTY_POS_BANK_DETAILS: PosBankDetails = {
  bankName: '',
  accountName: '',
  accountNumber: '',
};

export const posStaffBankStorageKey = (uid: string) => `pos_staff_bank_details_${uid}`;
export const posStaffBankPendingKey = (uid: string) => `pos_staff_bank_details_pending_${uid}`;

export function normalizePosBankDetails(value: Partial<PosBankDetails> | null | undefined): PosBankDetails {
  return {
    bankName: typeof value?.bankName === 'string' ? value.bankName.trim() : '',
    accountName: typeof value?.accountName === 'string' ? value.accountName.trim() : '',
    accountNumber: typeof value?.accountNumber === 'string' ? value.accountNumber.replace(/\s+/g, '') : '',
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
    };
  }, [personal, fallback.bankName, fallback.accountName, fallback.accountNumber]);

  return { details: effective, isLoading, hasDetails: !!(effective.bankName || effective.accountName || effective.accountNumber) };
}

export function POSReceiptBankDetails({
  staffUid,
  fallback,
  variant = 'terminal',
}: {
  staffUid?: string;
  fallback: Partial<PosBankDetails>;
  variant?: 'terminal' | 'invoice';
}) {
  const { details, hasDetails } = usePosReceiptBankDetails(staffUid, fallback);
  if (!hasDetails) return null;

  if (variant === 'terminal') {
    return (
      <div className="mt-4 border-t border-dashed border-black pt-2 text-center text-xs leading-relaxed">
        <p className="mb-1 font-bold uppercase">Bank Transfer Details</p>
        {details.bankName && <p>Bank: {details.bankName}</p>}
        {details.accountName && <p>Account Name: {details.accountName}</p>}
        {details.accountNumber && <p className="font-bold tracking-wider">Account No: {details.accountNumber}</p>}
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-md border border-slate-300 p-4 text-sm text-slate-800">
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
