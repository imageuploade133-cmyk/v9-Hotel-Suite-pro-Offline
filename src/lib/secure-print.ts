'use client';

import { runTransaction, doc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase';
import type { PrintStatus } from './types';
import { useToast } from '@/hooks/use-toast';
import * as React from 'react';

/**
 * Secure Print Control System
 *
 * This module provides a secure print control system to prevent duplicate docket printing
 * across multiple browser tabs using Firestore transactions and BroadcastChannel API.
 */

/**
 * Validates a document ID to prevent empty path errors
 * Returns true if the ID is valid (non-empty string)
 */
function isValidDocumentId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.trim().length > 0
  );
}

/**
 * Safe document reference creator - prevents empty path errors
 * Returns null if collection or documentId is invalid
 */
function safeDocRef(firestore: any, collectionName: string, documentId: string) {
  if (!firestore) {
    console.error('Firestore not initialized');
    return null;
  }

  if (!isValidDocumentId(collectionName)) {
    console.error('Invalid collection name:', collectionName);
    return null;
  }

  if (!isValidDocumentId(documentId)) {
    console.error('Invalid document ID:', documentId);
    return null;
  }

  return doc(firestore, collectionName, documentId);
}

export interface SecurePrintOptions {
  collection: string;
  documentId: string;
  userId: string;
  userName: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface SecurePrintResult {
  success: boolean;
  alreadyPrinted?: boolean;
  printedBy?: string;
  printedAt?: Date;
  error?: string;
}

/**
 * Securely mark a document as printed using Firestore transaction
 * This prevents race conditions and ensures atomicity
 */
export async function markAsPrinted(
  firestore: any,
  options: SecurePrintOptions
): Promise<SecurePrintResult> {
  const { collection, documentId, userId, userName } = options;

  // Validate inputs before creating any Firestore references
  if (!firestore) {
    return {
      success: false,
      error: 'Firestore is not initialized. Please check your connection.',
    };
  }

  if (!isValidDocumentId(collection)) {
    return {
      success: false,
      error: 'Invalid collection name provided.',
    };
  }

  if (!isValidDocumentId(documentId)) {
    return {
      success: false,
      error: 'Invalid document ID provided. Document ID is required for printing.',
    };
  }

  if (!isValidDocumentId(userId)) {
    return {
      success: false,
      error: 'User ID is required for printing.',
    };
  }

  try {
    return await runTransaction(firestore, async (transaction) => {
      const docRef = doc(firestore, collection, documentId);
      const docSnapshot = await transaction.get(docRef);

      if (!docSnapshot.exists()) {
        throw new Error('Document not found');
      }

      const data = docSnapshot.data();
      const currentStatus: PrintStatus = data.printStatus || 'pending';

      // Check if already printed
      if (currentStatus === 'printed') {
        return {
          success: false,
          alreadyPrinted: true,
          printedBy: data.printedByName || data.printedBy,
          printedAt: data.printedAt?.toDate ? data.printedAt.toDate() : new Date(),
        };
      }

      // Check if currently being printed by another user (prevent race condition)
      if (currentStatus === 'printing') {
        const printedAt = data.printedAt?.toDate ? data.printedAt.toDate() : null;
        return {
          success: false,
          alreadyPrinted: true,
          printedBy: data.printedByName || data.printedBy || 'Another user',
          printedAt: printedAt || new Date(),
        };
      }

      // First, set status to 'printing' to prevent other tabs from printing
      transaction.update(docRef, {
        printStatus: 'printing',
      });

      // Then update to printed
      transaction.update(docRef, {
        printStatus: 'printed',
        printedAt: serverTimestamp(),
        printedBy: userId,
        printedByName: userName,
      });

      return {
        success: true,
      };
    });
  } catch (error: any) {
    console.error('Secure print error:', error);

    // Handle specific transaction errors
    if (error.code === 'aborted') {
      return {
        success: false,
        error: 'Another user just printed this document. Please try again.',
      };
    }

    return {
      success: false,
      error: error.message || 'Failed to mark as printed',
    };
  }
}

/**
 * Hook to monitor print status in real-time with proper validation
 */
export function usePrintStatusMonitor(
  collection: string,
  documentId: string
): PrintStatus | null {
  const [status, setStatus] = React.useState<PrintStatus | null>(null);
  const firestore = useFirestore();

  React.useEffect(() => {
    // Validate inputs before creating Firestore references
    if (!firestore) {
      return;
    }

    if (!isValidDocumentId(collection)) {
      console.warn('usePrintStatusMonitor: Invalid collection name, skipping');
      return;
    }

    if (!isValidDocumentId(documentId)) {
      console.warn('usePrintStatusMonitor: Invalid document ID, skipping');
      return;
    }

    const docRef = doc(firestore, collection, documentId);

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setStatus(data.printStatus || 'pending');
        } else {
          // Document doesn't exist
          setStatus(null);
        }
      },
      (error) => {
        console.error('Print status monitor error:', error);
        // Don't update state on error to avoid UI issues
      }
    );

    return () => unsubscribe();
  }, [firestore, collection, documentId]);

  return status;
}

/**
 * Enhanced hook to manage tab synchronization for print status
 * Uses both BroadcastChannel and Firestore onSnapshot for robust protection
 */
export function usePrintTabSync(
  documentId: string,
  firestore: any,
  collection: string,
  resetAfterDelay: boolean = false
) {
  const [isPrinted, setIsPrinted] = React.useState(false);
  const channelRef = React.useRef<BroadcastChannel | null>(null);
  const unsubscribeRef = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    // Validate documentId
    if (!isValidDocumentId(documentId)) {
      return;
    }

    // Create a unique channel for this document
    const channelName = `print-sync-${documentId}`;
    const channel = new BroadcastChannel(channelName);
    channelRef.current = channel;

    // Listen for messages from other tabs
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'PRINT_COMPLETED') {
        setIsPrinted(true);

        // Optionally reset after a delay (for dockets that can be reprinted)
        if (resetAfterDelay) {
          setTimeout(() => {
            setIsPrinted(false);
          }, 5000); // Reset after 5 seconds
        }
      }
    };

    channel.addEventListener('message', handleMessage);

    // Also check localStorage as fallback
    const storageKey = `docket-printed-${documentId}`;
    const checkLocalStorage = () => {
      try {
        const printed = localStorage.getItem(storageKey);
        if (printed) {
          setIsPrinted(true);

          // Check if it's old (older than 5 seconds), if so, ignore it
          const printTime = parseInt(printed, 10);
          const now = Date.now();
          if (resetAfterDelay && now - printTime > 5000) {
            setIsPrinted(false);
            localStorage.removeItem(storageKey);
          }
        }
      } catch (e) {
        // localStorage might not be available
        console.warn('localStorage not available:', e);
      }
    };

    checkLocalStorage();
    window.addEventListener('storage', checkLocalStorage);

    // Also listen to Firestore for real-time updates
    if (firestore && isValidDocumentId(collection) && isValidDocumentId(documentId)) {
      try {
        const docRef = doc(firestore, collection, documentId);
        const unsubscribe = onSnapshot(
          docRef,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.data();
              if (data.printStatus === 'printed') {
                setIsPrinted(true);
              }
            }
          },
          (error) => {
            console.warn('Firestore sync error (non-critical):', error);
          }
        );
        unsubscribeRef.current = unsubscribe;
      } catch (e) {
        console.warn('Failed to set up Firestore sync:', e);
      }
    }

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      window.removeEventListener('storage', checkLocalStorage);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [documentId, firestore, collection, resetAfterDelay]);

  const notifyPrinted = () => {
    // Notify via BroadcastChannel
    if (channelRef.current) {
      channelRef.current.postMessage({ type: 'PRINT_COMPLETED' });
    }

    // Also set in localStorage as fallback
    try {
      const storageKey = `docket-printed-${documentId}`;
      localStorage.setItem(storageKey, Date.now().toString());
    } catch (e) {
      console.warn('localStorage not available:', e);
    }
  };

  const reset = () => {
    setIsPrinted(false);
    try {
      const storageKey = `docket-printed-${documentId}`;
      localStorage.removeItem(storageKey);
    } catch (e) {
      // Ignore
    }
  };

  return {
    isPrinted,
    notifyPrinted,
    reset,
  };
}

/**
 * Complete secure print workflow
 * Combines transaction, real-time monitoring, and tab synchronization
 */
export interface UseSecurePrintOptions {
  collection: string;
  documentId: string;
  allowReprintAfterDelay?: boolean;
  onAlreadyPrinted?: (printedBy: string, printedAt: Date) => void;
}

/**
 * Creates a safe options object with validation flag
 */
function createSafeOptions(options: UseSecurePrintOptions): UseSecurePrintOptions & { isValid: boolean } {
  const isValid = isValidDocumentId(options.collection) && isValidDocumentId(options.documentId);
  return {
    ...options,
    isValid,
  };
}

export function useSecurePrint(options: UseSecurePrintOptions) {
  const { collection, documentId, allowReprintAfterDelay = false, onAlreadyPrinted } = options;
  const { toast } = useToast();
  const firestore = useFirestore();

  const safeOptions = React.useMemo(
    () => createSafeOptions({ collection, documentId, allowReprintAfterDelay }),
    [collection, documentId, allowReprintAfterDelay]
  );

  const isValid = safeOptions.isValid;

  // Always call hooks in the same order - even when invalid, we call with safe defaults
  const printStatus = usePrintStatusMonitor(
    isValid ? safeOptions.collection : 'invalid',
    isValid ? safeOptions.documentId : 'invalid'
  );

  const { isPrinted: syncedPrinted, notifyPrinted, reset: resetSync } = usePrintTabSync(
    isValid ? safeOptions.documentId : '',
    firestore,
    isValid ? safeOptions.collection : '',
    safeOptions.allowReprintAfterDelay ?? false
  );

  const [isProcessing, setIsProcessing] = React.useState(false);

  if (!isValid) {
    return {
      isAlreadyPrinted: false,
      isProcessing: false,
      handlePrint: async (_userId: string, _userName: string, _printFunction: () => void): Promise<boolean> => false,
      reset: () => {},
      isValid: false,
    };
  }

  const isAlreadyPrinted = printStatus === 'printed' || syncedPrinted;

  const handlePrint = async (
    userId: string,
    userName: string,
    printFunction: () => void
  ): Promise<boolean> => {
    // Validate system state
    if (!firestore) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'System not ready. Please check your connection.',
      });
      return false;
    }

    // Validate required parameters
    if (!isValidDocumentId(userId)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'User not identified. Please log in again.',
      });
      return false;
    }

    // Check if already printed
    if (isAlreadyPrinted) {
      if (allowReprintAfterDelay && printStatus !== 'printed') {
        toast({
          variant: 'warning',
          title: 'Recent Print Detected',
          description: 'This docket was recently printed. Are you sure you want to print again?',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Already Printed',
          description: 'This docket has already been printed.',
        });
        return false;
      }
    }

    // Prevent concurrent printing
    if (isProcessing) {
      toast({
        variant: 'warning',
        title: 'Processing',
        description: 'A print operation is already in progress.',
      });
      return false;
    }

    setIsProcessing(true);

    try {
      // For dockets that allow reprint after delay, skip the transaction
      if (allowReprintAfterDelay && printStatus !== 'printed') {
        // Notify other tabs to prevent duplicate prints
        notifyPrinted();

        // Execute the actual print
        printFunction();

        toast({
          variant: 'success',
          title: 'Print Success',
          description: 'Docket printed successfully.',
        });

        return true;
      }

      // For dockets requiring permanent print tracking, use transaction
      // Note: We don't check document existence here to avoid issues on slow connections
      // The sale data is already available in the dialog, so we can print even if
      // the document check fails (common on mobile devices with slower networks)

      // Try to mark as printed using transaction
      const result = await markAsPrinted(firestore, {
        collection,
        documentId,
        userId,
        userName,
      });

      if (result.success) {
        // Notify other tabs
        notifyPrinted();

        // Execute the actual print
        printFunction();

        toast({
          variant: 'success',
          title: 'Print Success',
          description: 'Docket printed successfully.',
        });

        return true;
      } else if (result.alreadyPrinted) {
        if (onAlreadyPrinted) {
          onAlreadyPrinted(
            result.printedBy || 'Unknown',
            result.printedAt || new Date()
          );
        }

        toast({
          variant: 'destructive',
          title: 'Already Printed',
          description: `This docket was already printed by ${result.printedBy} at ${result.printedAt?.toLocaleTimeString()}.`,
        });

        return false;
      } else {
        // If the transaction fails due to document not found (common on slow mobile connections),
        // still allow printing since the data is already available in the dialog
        if (result.error?.includes('Document not found') || result.error?.includes('not found')) {
          console.warn('Document not found in Firestore, but printing anyway since data is loaded:', result.error);

          // Notify other tabs via local mechanism
          notifyPrinted();

          // Execute the actual print
          printFunction();

          toast({
            variant: 'success',
            title: 'Print Success',
            description: 'Receipt printed successfully.',
          });

          return true;
        }

        toast({
          variant: 'destructive',
          title: 'Print Failed',
          description: result.error || 'Failed to print docket.',
        });

        return false;
      }
    } catch (error: any) {
      console.error('Print error:', error);

      // If the error is about document not being found, still allow printing
      // since the data is already loaded in the dialog
      if (error?.message?.includes('Document not found') || error?.message?.includes('not found')) {
        console.warn('Document not found in Firestore, but printing anyway since data is loaded:', error);

        // Notify other tabs via local mechanism
        notifyPrinted();

        // Execute the actual print
        printFunction();

        toast({
          variant: 'success',
          title: 'Print Success',
          description: 'Receipt printed successfully.',
        });

        return true;
      }

      toast({
        variant: 'destructive',
        title: 'Print Error',
        description: error.message || 'An error occurred while printing.',
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isAlreadyPrinted,
    isProcessing,
    handlePrint,
    reset: () => {
      resetSync();
    },
    // Expose validation status for UI
    isValid: safeOptions.isValid,
  };
}
