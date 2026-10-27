import { ClientProviders } from "../client-providers";

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ClientProviders>{children}</ClientProviders>;
}
