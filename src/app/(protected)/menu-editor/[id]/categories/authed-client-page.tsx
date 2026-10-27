
'use client';

import withAuth from '@/components/auth/withAuth';
import MenuCategoriesClientPage from './client-page';
import { PagePermission } from '@/lib/permissions';

// Apply the withAuth HOC to the client-side page
const AuthedMenuCategoriesClientPage = withAuth(MenuCategoriesClientPage, PagePermission.MANAGE_MENUS);

export default AuthedMenuCategoriesClientPage;
