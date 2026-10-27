import { NextResponse, NextRequest } from 'next/server';
import { firestore } from '@/firebase/server-init';
import { collection, getDocs, writeBatch, doc, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

// Map frontend collection IDs to actual Firestore collection names
const COLLECTION_MAP: Record<string, string> = {
  'bookings': 'bookings',
  'customers': 'customers',
  'pos-customers': 'pos-customers',
  'stock': 'stock',
  'stockSales': 'stockSales',
  'orders': 'orders',
  'laundry': 'laundry',
  'salonServices': 'salonServices',
  'gym-members': 'gym-members',
  'expenses': 'expenses',
  'globalAuditLog': 'globalAuditLog',
  'restockHistory': 'restockHistory',
  'payments': 'payments',
  'stockReturns': 'stockReturns',
  'docketHistory': 'docketHistory',
};

// Maximum number of documents to delete in a single batch (Firestore limit is 500)
const BATCH_SIZE = 400;

/**
 * Delete all documents from a collection in batches
 */
async function deleteCollection(collectionName: string): Promise<number> {
  const collectionRef = collection(firestore, collectionName);
  const snapshot = await getDocs(collectionRef);

  if (snapshot.empty) {
    return 0;
  }

  let deletedCount = 0;
  const docs: QueryDocumentSnapshot<DocumentData>[] = [];

  // Collect all documents
  snapshot.forEach((docSnapshot) => {
    docs.push(docSnapshot);
  });

  // Process in batches
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = writeBatch(firestore);
    const batchDocs = docs.slice(i, i + BATCH_SIZE);

    batchDocs.forEach((docSnapshot) => {
      batch.delete(doc(firestore, collectionName, docSnapshot.id));
    });

    await batch.commit();
    deletedCount += batchDocs.length;
  }

  return deletedCount;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collections } = body;

    if (!collections || !Array.isArray(collections) || collections.length === 0) {
      return NextResponse.json(
        { error: 'No collections specified for deletion.' },
        { status: 400 }
      );
    }

    // Validate collection names
    const invalidCollections = collections.filter(
      (col: string) => !COLLECTION_MAP[col]
    );

    if (invalidCollections.length > 0) {
      return NextResponse.json(
        { error: `Invalid collection(s): ${invalidCollections.join(', ')}` },
        { status: 400 }
      );
    }

    const deletedCollections: string[] = [];
    const errors: string[] = [];

    // Delete each collection
    for (const collectionId of collections) {
      const firestoreCollectionName = COLLECTION_MAP[collectionId];

      try {
        const deletedCount = await deleteCollection(firestoreCollectionName);
        deletedCollections.push(collectionId);
        console.log(`Deleted ${deletedCount} documents from ${firestoreCollectionName}`);
      } catch (error: any) {
        console.error(`Error deleting collection ${firestoreCollectionName}:`, error);
        errors.push(`Failed to delete ${collectionId}: ${error.message}`);
      }
    }

    if (errors.length > 0 && deletedCollections.length === 0) {
      return NextResponse.json(
        { error: errors.join('; ') },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedCollections,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (error: any) {
    console.error('Error in delete-data API:', error);
    return NextResponse.json(
      { error: error.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
