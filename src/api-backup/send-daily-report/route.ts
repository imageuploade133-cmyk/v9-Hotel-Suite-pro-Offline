
import { NextResponse, NextRequest } from 'next/server';
import { firestore } from '@/firebase/server-init';
import { collection, getDocs, query, where, Timestamp, doc, getDoc, setDoc } from 'firebase/firestore';
import type { Payment, Booking, StockSale, SalonService, StockReturn, Expense } from '@/lib/types';
import { getSafeDate } from '@/lib/helpers';
import { startOfDay, endOfDay, format, parseISO } from 'date-fns';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { dates } = await request.json();
        if (!dates || !Array.isArray(dates) || dates.length === 0) {
            return NextResponse.json({ status: 'error', message: 'No dates provided.' }, { status: 400 });
        }

        const settingsDoc = await getDoc(doc(firestore, 'settings', 'global'));
        const settings = settingsDoc.data();

        if (!settings?.enableDailyReport || !settings.dailyReportPhoneNumber) {
            return NextResponse.json({ status: 'info', message: 'Daily report is disabled or no phone number is set.' });
        }

        for (const dateStr of dates) {
            const reportDate = parseISO(dateStr);
            const start = startOfDay(reportDate);
            const end = endOfDay(reportDate);

            // Fetch all data for the given day
            const bookingsQuery = query(collection(firestore, 'bookings'), where('createdAt', '>=', start), where('createdAt', '<=', end));
            const paymentsQuery = query(collection(firestore, 'payments'), where('transactionDate', '>=', start), where('transactionDate', '<=', end));
            const salesQuery = query(collection(firestore, 'stockSales'), where('soldAt', '>=', start), where('soldAt', '<=', end));
            const salonQuery = query(collection(firestore, 'salonServices'), where('createdAt', '>=', start), where('createdAt', '<=', end));
            const returnsQuery = query(collection(firestore, 'stockReturns'), where('returnedAt', '>=', start), where('returnedAt', '<=', end));
            const expensesQuery = query(collection(firestore, 'expenses'), where('date', '>=', start), where('date', '<=', end));

            const [
                bookingsSnap,
                paymentsSnap,
                salesSnap,
                salonSnap,
                returnsSnap,
                expensesSnap
            ] = await Promise.all([
                getDocs(bookingsQuery),
                getDocs(paymentsQuery),
                getDocs(salesQuery),
                getDocs(salonQuery),
                getDocs(returnsQuery),
                getDocs(expensesQuery)
            ]);

            const todaysBookings = bookingsSnap.docs.map(doc => doc.data() as Booking);
            const todaysPayments = paymentsSnap.docs.map(doc => doc.data() as Payment);
            const todaysSales = salesSnap.docs.map(doc => doc.data() as StockSale);
            const todaysSalon = salonSnap.docs.map(doc => doc.data() as SalonService);
            const todaysReturns = returnsSnap.docs.map(doc => doc.data() as StockReturn);
            const todaysExpenses = expensesSnap.docs.map(doc => doc.data() as Expense);

            const currency = settings.currency || 'USD';
            const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);

            const bookingIncome = todaysBookings
                .filter(b => b.paymentMethod)
                .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

            const hotelPosIncome = todaysSales
                .filter(s => s.context === 'hotel' && s.paymentStatus === 'Paid')
                .reduce((sum, s) => sum + s.totalAmount, 0);

            const mainPosIncome = todaysSales
                .filter(s => s.context !== 'hotel' && s.paymentStatus === 'Paid')
                .reduce((sum, s) => sum + s.totalAmount, 0);

            const mainPosCreditSales = todaysSales
                .filter(s => s.context !== 'hotel' && s.paymentMethod === 'Credit')
                .reduce((sum, s) => sum + s.totalAmount, 0);

            const laundryIncome = todaysPayments
                .filter(p => p.type === 'Additional Charges' && p.items?.some(i => i.id.startsWith('laundry-')))
                .reduce((sum, p) => sum + p.amount, 0);

            const kitchenIncome = todaysPayments
                .filter(p => p.type === 'Additional Charges' && p.items?.some(i => i.id.startsWith('order-')))
                .reduce((sum, p) => sum + p.amount, 0);

            const gymIncome = todaysPayments
                .filter(p => p.type === 'Gym Membership')
                .reduce((sum, p) => sum + p.amount, 0);

            const salonIncome = todaysSalon
                .filter(s => s.paymentStatus === 'Paid')
                .reduce((sum, s) => sum + s.totalPrice, 0);

            const totalRefunds = todaysReturns.reduce((sum, r) => sum + r.totalRefundAmount, 0);
            const totalExpenses = todaysExpenses.reduce((sum, e) => sum + e.amount, 0);

            const totalIncome = bookingIncome + hotelPosIncome + mainPosIncome + laundryIncome + kitchenIncome + gymIncome + salonIncome;
            const netTotal = totalIncome - totalRefunds - totalExpenses;

            const businessName = settings.businessName || 'Your Business';
            const dateFormattedStr = format(reportDate, 'EEEE, MMMM d, yyyy');

            let message = `*Daily Income Report for ${businessName}*\n`;
            message += `*Date:* ${dateFormattedStr}\n\n`;
            message += `*Income Summary:*\n`;
            message += `-----------------\n`;
            message += `Booking Income: *${formatCurrency(bookingIncome)}*\n`;
            message += `Hotel POS: *${formatCurrency(hotelPosIncome)}*\n`;
            message += `Main POS: *${formatCurrency(mainPosIncome)}*\n`;
            message += `Main POS (Credit): *${formatCurrency(mainPosCreditSales)}*\n`;
            message += `Laundry: *${formatCurrency(laundryIncome)}*\n`;
            message += `Kitchen: *${formatCurrency(kitchenIncome)}*\n`;
            message += `Gym: *${formatCurrency(gymIncome)}*\n`;
            message += `Salon: *${formatCurrency(salonIncome)}*\n`;
            message += `-----------------\n`;
            message += `*Gross Total Income:* *${formatCurrency(totalIncome)}*\n`;
            message += `Total Refunds: *-${formatCurrency(totalRefunds)}*\n`;
            message += `Today's Expenses: *-${formatCurrency(totalExpenses)}*\n`;
            message += `*Net Total:* *${formatCurrency(netTotal)}*\n\n`;
            message += `This is an automated report.`;

            const result = await sendWhatsAppMessage({
                phone: settings.dailyReportPhoneNumber,
                message: message,
                senderName: businessName,
                greeting: "Daily Report"
            });

            if (result.status !== 'success') {
                console.warn(`Failed to send report for ${dateStr}: ${result.message}`);
                // Don't throw, continue to next date
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const settingsRef = doc(firestore, 'settings', 'global');
        await setDoc(settingsRef, { dailyReportLastSent: todayStr }, { merge: true });

        return NextResponse.json({ status: 'success', message: `Processed ${dates.length} daily reports.` });

    } catch (error: any) {
        console.error("Error sending daily report:", error);
        return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
}
