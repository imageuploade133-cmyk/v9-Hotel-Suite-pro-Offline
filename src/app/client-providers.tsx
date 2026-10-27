
'use client';

import { FirebaseClientProvider } from '@/firebase/client-provider';
import { Toaster } from '@/components/ui/toaster';
import { SettingsProvider } from '@/contexts/settings-context';
import { ConnectivityProvider } from '@/contexts/connectivity-context';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { CacheProvider } from '@/contexts/cache-context';
import { UserProvider } from '@/contexts/user-context';
import { BranchProvider } from '@/contexts/branch-context';


export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ConnectivityProvider>
        <FirebaseClientProvider>
            <CacheProvider>
                <UserProvider>
                    <BranchProvider>
                        <SettingsProvider>
                            {children}
                            <Toaster />
                        </SettingsProvider>
                    </BranchProvider>
                </UserProvider>
            </CacheProvider>
            <OfflineIndicator />
        </FirebaseClientProvider>
    </ConnectivityProvider>
  );
}
