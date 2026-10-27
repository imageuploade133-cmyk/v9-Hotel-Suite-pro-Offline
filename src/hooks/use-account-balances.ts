
import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query } from 'firebase/firestore';
import type { Payment, Expense, Transfer, PaymentMethod } from '@/lib/types';

export function useAccountBalances() {
    const firestore = useFirestore();

    const paymentMethodsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'paymentMethods')) : null, [firestore]);
    const paymentsQuery = React.useMemo(() => firestore ? query(collection(firestore, 'payments')) : null, [firestore]);
    const expensesQuery = React.useMemo(() => firestore ? query(collection(firestore, 'expenses')) : null, [firestore]);
    const transfersQuery = React.useMemo(() => firestore ? query(collection(firestore, 'transfers')) : null, [firestore]);

    const { data: paymentMethods, isLoading: loadingMethods } = useCollection<PaymentMethod>(paymentMethodsQuery);
    const { data: payments, isLoading: loadingPayments } = useCollection<Payment>(paymentsQuery);
    const { data: expenses, isLoading: loadingExpenses } = useCollection<Expense>(expensesQuery);
    const { data: transfers, isLoading: loadingTransfers } = useCollection<Transfer>(transfersQuery);

    const accountBalances = React.useMemo(() => {
        const balances = new Map<string, number>();
        if (!paymentMethods || !payments || !expenses || !transfers) {
            return balances;
        }

        // Initialize balances
        paymentMethods.forEach(method => {
            balances.set(method.name, 0);
        });

        // Process payments
        payments.forEach(p => {
            if (p.paymentMethod) {
                balances.set(p.paymentMethod, (balances.get(p.paymentMethod) || 0) + p.amount);
            }
        });

        // Process expenses
        expenses.forEach(e => {
            if (e.paymentMethod) {
                balances.set(e.paymentMethod, (balances.get(e.paymentMethod) || 0) - e.amount);
            }
        });

        // Process transfers
        transfers.forEach(t => {
            if (t.fromAccount) {
                balances.set(t.fromAccount, (balances.get(t.fromAccount) || 0) - t.amount);
            }
            if (t.toAccount) {
                balances.set(t.toAccount, (balances.get(t.toAccount) || 0) + t.amount);
            }
        });

        return balances;
    }, [paymentMethods, payments, expenses, transfers]);

    const isLoading = loadingMethods || loadingPayments || loadingExpenses || loadingTransfers;

    return { accountBalances, isLoading };
}
