import PageClient from './page-client';

export function generateStaticParams() {
  return [{ id: 'view' }];
}

export default function Page() {
  return <PageClient />;
}
