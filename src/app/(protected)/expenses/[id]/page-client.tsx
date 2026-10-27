
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { ExpenseForm } from '@/components/expenses/expense-form';
import { useParams } from 'next/navigation';

function EditExpensePage() {
    const params = useParams();
    const id = params.id as string;

    return <ExpenseForm expenseId={id} />;
}

export default withAuth(EditExpensePage, PagePermission.MANAGE_EXPENSES);
