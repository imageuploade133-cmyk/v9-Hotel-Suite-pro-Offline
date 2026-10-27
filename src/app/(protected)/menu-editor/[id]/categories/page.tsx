
import * as React from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import AuthedMenuCategoriesClientPage from './authed-client-page';
import { notFound } from 'next/navigation';
import type { Menu } from '@/lib/types';

export const dynamicParams = true; // Allow new menus to be rendered on-demand

export async function generateStaticParams() {
  try {
    const col = collection(firestore, 'menus');
    const snapshot = await getDocs(col);
    const params = snapshot.docs.map(doc => ({ id: doc.id }));
    // If there are no menus, it's crucial to return a placeholder
    // to avoid an error during build if getStaticPaths returns an empty array.
    if (params.length === 0) {
      return [{ id: 'placeholder' }];
    }
    return params;
  } catch (error) {
    console.error("Failed to generate static params for menu categories:", error);
    // Return a placeholder to allow the build to succeed even if Firestore is unavailable.
    return [{ id: 'placeholder' }];
  }
}

async function getMenuData(id: string): Promise<Menu | null> {
    try {
        const docRef = doc(firestore, 'menus', id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            return { id: docSnap.id, ...data } as Menu;
        }
        return null;
    } catch (error) {
        console.error("Failed to fetch menu data:", error);
        return null;
    }
}

export default async function MenuCategoriesPage({ params }: { params: { id: string } }) {
  // Handle the placeholder case for builds where data fetching might fail.
  if (params.id === 'placeholder') {
    return <div>Loading menu data...</div>;
  }

  const menuData = await getMenuData(params.id);

  if (!menuData) {
    notFound();
  }

  return <AuthedMenuCategoriesClientPage menu={menuData} />;
}
