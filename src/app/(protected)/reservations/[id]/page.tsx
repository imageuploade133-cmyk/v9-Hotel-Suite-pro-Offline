
import ReservationActionPageClient from './page-client';

export function generateStaticParams() {
  return [{ id: 'view' }];
}

export default function ReservationActionPage({ params }: { params: { id: string } }) {
  return <ReservationActionPageClient />;
}
