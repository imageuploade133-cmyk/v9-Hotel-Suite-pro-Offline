
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { ExpenseForm } from '@/components/expenses/expense-form';

function CreateExpensePage() {
    return <ExpenseForm />;
}

export default withAuth(CreateExpensePage, PagePermission.MANAGE_EXPENSES);
