
import * as React from 'react';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import { notFound } from 'next/navigation';
import type { Menu, MenuItem, MenuCategory } from '@/lib/types';
import { MenuClientPage } from './client-page';

export const dynamicParams = true;

export async function generateStaticParams() {
  try {
    const col = collection(firestore, 'menus');
    const snapshot = await getDocs(col);
    const params = snapshot.docs.map(doc => ({ id: doc.id }));
    if (params.length === 0) {
      return [{ id: 'placeholder' }];
    }
    return params;
  } catch (error) {
    console.error("Failed to generate static params for menus:", error);
    return [{ id: 'placeholder' }];
  }
}

async function getMenuData(id: string) {
    try {
        const menuRef = doc(firestore, 'menus', id);
        const categoriesQuery = query(collection(firestore, `menus/${id}/categories`), orderBy('order'));
        const itemsQuery = query(collection(firestore, `menus/${id}/items`));

        const [menuSnap, categoriesSnap, itemsSnap] = await Promise.all([
            getDoc(menuRef),
            getDocs(categoriesQuery),
            getDocs(itemsQuery)
        ]);

        if (!menuSnap.exists()) return null;

        const menuData = { id: menuSnap.id, ...menuSnap.data() } as Menu;
        const categoriesData = categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MenuCategory[];
        const itemsData = itemsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as MenuItem[];

        return { menu: menuData, categories: categoriesData, items: itemsData };

    } catch (error) {
        console.error("Failed to fetch menu data:", error);
        return null;
    }
}


export default async function PublicMenuPage({ params }: { params: { id: string } }) {
  if (params.id === 'placeholder') {
    return <div>Loading menu...</div>;
  }

  const data = await getMenuData(params.id);

  if (!data) {
    notFound();
  }

  return <MenuClientPage menu={data.menu} categories={data.categories} items={data.items} />;
}
