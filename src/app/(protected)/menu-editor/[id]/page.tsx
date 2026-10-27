
import * as React from 'react';
import { collection, getDocs, query } from 'firebase/firestore';
import { firestore } from '@/firebase/server-init';
import MenuEditorPageComponent from './client-page';

// This function is required for static site generation (`output: 'export'`).
// It tells Next.js which dynamic pages to pre-build at build time.
export const dynamicParams = true; // Allow new menus to be rendered on-demand

export async function generateStaticParams() {
  try {
    const col = collection(firestore, 'menus');
    const snapshot = await getDocs(query(col));
    const params = snapshot.docs.map(doc => ({ id: doc.id }));

    // If there are no menus, we can return an empty array as dynamicParams is true.
    // However, providing a placeholder can be safer in some build environments.
    if (params.length === 0) {
      return [{ id: 'placeholder' }];
    }

    return params;
  } catch (error) {
    console.error("Failed to generate static params for menu editor:", error);
    // Return a placeholder to allow the build to succeed even if Firestore is unavailable.
    return [{ id: 'placeholder' }];
  }
}

// This is now a Server Component responsible for passing the ID to the client component.
export default function MenuEditorPage({ params }: { params: { id: string } }) {
  // We handle the placeholder case here to prevent rendering the editor for it.
  if (params.id === 'placeholder') {
    return <div>Loading menu editor...</div>;
  }

  // The actual interactive UI is in the client component.
  // We pass the menuId, and the client component will fetch its own data.
  // This makes the page more resilient to build-time data fetching issues.
  return <MenuEditorPageComponent menuId={params.id} />;
}
