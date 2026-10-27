'use client';

import type { GymMember } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CalendarIcon, Mail, MoreHorizontal, Phone, RefreshCw, User, MessageSquareText, DollarSign, FileText, Pencil, Trash2 } from 'lucide-react';
import { format, isBefore, isAfter, addDays, isWithinInterval } from 'date-fns';
import { getInitials, getSafeDate } from '@/lib/helpers';
import { useSettings } from '@/contexts/settings-context';
import Link from 'next/link';

interface MemberCardProps {
  member: GymMember & { status?: string };
  onRenew: (member: GymMember) => void;
  onSendReminder: (member: GymMember) => void;
  onOpenActions: (member: GymMember) => void;
}

export function MemberCard({ member, onRenew, onSendReminder, onOpenActions }: MemberCardProps) {
  const expiresAt = getSafeDate(member.expiresAt);
  const createdAt = getSafeDate(member.createdAt);
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(value);
  };

  const now = new Date();
  const expiryThreshold = addDays(now, 7);

  let status: 'active' | 'expiring' | 'expired' | 'refunded' = 'active';

  if (member.status === 'Refunded') {
      status = 'refunded';
  } else if (expiresAt && isBefore(expiresAt, now)) {
      status = 'expired';
  } else if (expiresAt && isWithinInterval(expiresAt, { start: now, end: expiryThreshold })) {
      status = 'expiring';
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex-row items-center gap-4">
        <Link href={`/gym-management/${member.id}`} className="flex-shrink-0">
          <Avatar className="h-16 w-16 border-2 border-primary hover:opacity-80 transition-opacity">
            <AvatarImage src={member.photoURL} alt={member.name} />
            <AvatarFallback className="text-xl">{getInitials(member.name)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1">
          <Link href={`/gym-management/${member.id}`} className="hover:underline">
            <CardTitle className="text-xl">{member.name}</CardTitle>
          </Link>
          <p className="text-sm text-muted-foreground font-mono">ID: {member.memberId}</p>
          <div className="flex items-center gap-2 mt-1">
            {status === 'active' && <Badge variant="success">Active</Badge>}
            {status === 'expiring' && <Badge variant="warning">Expiring Soon</Badge>}
            {status === 'expired' && <Badge variant="destructive">Expired</Badge>}
            {status === 'refunded' && <Badge variant="destructive">Refunded</Badge>}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={() => onOpenActions(member)}>
            <MoreHorizontal className="h-4 w-4"/>
        </Button>
      </CardHeader>
      <CardContent className="flex-grow space-y-4">
        <Separator />
         <div className="space-y-3 text-sm">
            {member.email && (
                 <div className="flex items-center gap-3">
                    <Mail className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{member.email}</span>
                </div>
            )}
             {member.phoneNumber && (
                 <div className="flex items-center gap-3">
                    <Phone className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>{member.phoneNumber}</span>
                </div>
             )}
             {createdAt && (
                <div className="flex items-center gap-3">
                    <User className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span>Registered: {format(createdAt, 'PPP')}</span>
                </div>
             )}
              <div className="flex items-center gap-3">
                <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>Expires: {expiresAt ? format(expiresAt, 'PPP') : 'N/A'}</span>
            </div>
         </div>
         {(member.membershipFee !== undefined) && (
           <>
            <Separator />
            <div className="space-y-2 text-sm">
                <h4 className="font-medium text-muted-foreground">Billing</h4>
                {member.membershipFee !== undefined && member.membershipFee > 0 && (
                     <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2"><DollarSign className="h-4 w-4"/>Membership Fee</span>
                        <span className="font-semibold">{formatCurrency(member.membershipFee)}</span>
                    </div>
                )}
                 {member.paymentMethod && (
                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-muted-foreground">Payment Method</span>
                        <span className="font-semibold">{member.paymentMethod}</span>
                    </div>
                 )}
            </div>
           </>
         )}
      </CardContent>
      {status !== 'active' && (
        <CardFooter className="p-2 flex flex-col gap-2">
            <Button className="w-full" onClick={() => onRenew(member)}>
                <RefreshCw className="mr-2 h-4 w-4"/>
                Renew Membership
            </Button>
            <Button variant="secondary" className="w-full" onClick={() => onSendReminder(member)} disabled={!member.phoneNumber}>
                <MessageSquareText className="mr-2 h-4 w-4"/>
                Send Reminder
            </Button>
        </CardFooter>
      )}
    </Card>
  );
}
