
'use client';

import * as React from 'react';
import Image from 'next/image';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import type { GymMember, Payment } from '@/lib/types';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { ArrowLeft, ChevronLeft, ChevronRight, Dumbbell, MoreVertical, Printer } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useFirestore, useDoc, useCollection } from '@/firebase';
import { collection, query, where, doc, getDocs, orderBy } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card';
import { useSettings } from '@/contexts/settings-context';
import {
  Mail,
  Phone,
  Calendar as CalendarIcon,
  User,
  RefreshCw,
} from 'lucide-react';
import { GymReceiptDialog } from '@/components/gym/gym-receipt-dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import GymMemberDetailsLoading from './loading';

const PAGE_SIZE = 5;

function PaginationControls({
  onPrev,
  onNext,
  canPrev,
  canNext,
}: {
  onPrev: () => void;
  onNext: () => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <Button variant="outline" size="sm" onClick={onPrev} disabled={!canPrev}>
        <ChevronLeft className="mr-1 h-4 w-4" /> Prev
      </Button>
      <Button variant="outline" size="sm" onClick={onNext} disabled={!canNext}>
        Next <ChevronRight className="ml-1 h-4 w-4" />
      </Button>
    </div>
  );
}


function MemberDetails({ member, currency }: { member: GymMember, currency: string }) {
    if (!member) return null;

    const firestore = useFirestore();
    const { toast } = useToast();

    const [allPayments, setAllPayments] = React.useState<Payment[]>([]);
    const [isLoadingPayments, setIsLoadingPayments] = React.useState(true);
    const [currentPage, setCurrentPage] = React.useState(1);
    const [receiptPayment, setReceiptPayment] = React.useState<Payment | null>(null);

    React.useEffect(() => {
        const fetchPayments = async () => {
            if (!firestore || !member.email) {
                setIsLoadingPayments(false);
                return;
            }
            setIsLoadingPayments(true);
            try {
                const q = query(
                    collection(firestore, 'payments'),
                    where('guestEmail', '==', member.email),
                    where('type', '==', 'Gym Membership'),
                    orderBy('transactionDate', 'desc')
                );
                const snapshot = await getDocs(q);
                const fetchedPayments = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
                setAllPayments(fetchedPayments);
            } catch (error) {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Could not fetch member's payment history.",
                });
                 console.error("Payment fetch error:", error);
            } finally {
                setIsLoadingPayments(false);
            }
        };

        fetchPayments();
    }, [firestore, member.email, toast]);

    const paginatedPayments = React.useMemo(() => {
        const startIndex = (currentPage - 1) * PAGE_SIZE;
        return allPayments.slice(startIndex, startIndex + PAGE_SIZE);
    }, [allPayments, currentPage]);

    const totalPages = Math.ceil(allPayments.length / PAGE_SIZE);
    const canNext = currentPage < totalPages;
    const canPrev = currentPage > 1;

    const handleNextPage = () => {
        if (canNext) setCurrentPage(p => p + 1);
    };

    const handlePrevPage = () => {
        if (canPrev) setCurrentPage(p => p - 1);
    };

    const handlePrintReceipt = (payment: Payment) => {
        setReceiptPayment(payment);
    };

    const expiresAtDate = getSafeDate(member.expiresAt);


    return (
        <>
            <div className="flex flex-col gap-6">
                <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                        <AvatarImage src={(member as any).photoURL} />
                        <AvatarFallback className="text-2xl">{getInitials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                        <h2 className="text-3xl font-bold">{member.name}</h2>
                        <p className="text-muted-foreground">{member.email}</p>
                    </div>
                </div>

                <Separator />

                <div className="grid grid-cols-1 gap-y-4 gap-x-6 text-sm sm:grid-cols-2 md:grid-cols-3">
                    <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                            <p className="text-muted-foreground">Phone Number</p>
                            <p className="font-semibold">{member.phoneNumber || 'Not provided'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <CalendarIcon className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                            <p className="text-muted-foreground">Membership Expires</p>
                            <p className="font-semibold">{expiresAtDate ? format(expiresAtDate, 'EEEE, dd-MM-yyyy') : 'N/A'}</p>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <User className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                            <p className="text-muted-foreground">Member Since</p>
                            <p className="font-semibold">{getSafeDate(member.createdAt) ? format(getSafeDate(member.createdAt)!, 'dd-MM-yyyy') : 'N/A'}</p>
                        </div>
                    </div>
                </div>

                <Separator />
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg font-semibold">Statement of Account</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {isLoadingPayments ? (
                            <div className="space-y-3">
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div key={i} className="flex items-center justify-between rounded-md border p-3">
                                    <div>
                                        <Skeleton className="h-5 w-24 mb-1.5" />
                                        <Skeleton className="h-3 w-40" />
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <Skeleton className="h-5 w-20" />
                                        <Skeleton className="h-6 w-24 rounded-full" />
                                    </div>
                                </div>
                            ))}
                            </div>
                        ) : paginatedPayments.length > 0 ? (
                            <div className="space-y-3">
                                {paginatedPayments.map(payment => {
                                    const transactionDate = getSafeDate(payment.transactionDate);
                                    return (
                                        <div
                                            key={payment.id}
                                            className="flex w-full items-center justify-between rounded-md border p-3 text-left transition-colors hover:bg-muted"
                                        >
                                            <div className="flex-1 text-left">
                                                <p className="font-semibold">{payment.type}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    ID: {payment.id.substring(0,8)}
                                                </p>
                                                <p className="text-xs text-muted-foreground">
                                                    {transactionDate ? format(transactionDate, 'dd-MM-yyyy, p') : 'N/A'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right font-medium">
                                                    {payment.amount ? new Intl.NumberFormat('en-US', {style: 'currency', currency: currency}).format(payment.amount) : 'N/A'}
                                                </div>
                                                <Badge variant={payment.status === 'Paid' ? 'success' : 'destructive'}>{payment.status}</Badge>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => handlePrintReceipt(payment)}>
                                                            <Printer className="mr-2 h-4 w-4" />
                                                            Reprint Receipt
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </div>
                                    )
                                })}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-center pt-2">
                                        <PaginationControls
                                            canPrev={canPrev}
                                            canNext={canNext}
                                            onPrev={handlePrevPage}
                                            onNext={handleNextPage}
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="py-4 text-center text-sm text-muted-foreground">No payment history found.</p>
                        )}
                    </CardContent>
                </Card>
            </div>
            <GymReceiptDialog
                isOpen={!!receiptPayment}
                onClose={() => setReceiptPayment(null)}
                payment={receiptPayment}
            />
        </>
    );
}

function GymMemberPageComponent({ initialMemberData }: { initialMemberData: any }) {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const { settings } = useSettings();
    const userCurrency = settings?.currency || 'USD';
    const firestore = useFirestore();

    const memberDocRef = React.useMemo(() => {
        if (!firestore || !id) return null;
        return doc(firestore, 'gym-members', id);
    }, [firestore, id]);

    const { data, isLoading } = useDoc<GymMember>(memberDocRef);

    const member = data ? {
        ...data,
        createdAt: getSafeDate(data.createdAt),
        expiresAt: getSafeDate(data.expiresAt),
    } : {
        ...initialMemberData,
        createdAt: getSafeDate(initialMemberData.createdAt),
        expiresAt: getSafeDate(initialMemberData.expiresAt),
    };


    if (isLoading && !initialMemberData) {
         return <GymMemberDetailsLoading />;
    }

    if (!member) {
        return <div className="text-center py-20">Member not found.</div>
    }

    return (
        <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
             <Button variant="ghost" onClick={() => router.back()} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Gym Management
            </Button>
            <MemberDetails member={member as GymMember} currency={userCurrency} />
        </div>
    );
}

export default withAuth(GymMemberPageComponent, PagePermission.MANAGE_GYM_MEMBERS);
