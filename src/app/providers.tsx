'use client';

import { FirebaseClientProvider } from '@/firebase/client-provider';
import { AuthProvider } from '@/components/auth/auth-provider';
import { Toaster } from '@/components/ui/toaster';
import { UserProvider } from '@/contexts/user-context';
import { SettingsProvider } from '@/contexts/settings-context';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';
import { ConnectivityProvider } from '@/contexts/connectivity-context';
import { OfflineIndicator } from '@/components/ui/offline-indicator';
import { CacheProvider } from '@/contexts/cache-context';
import { CacheWarmingProvider } from '@/components/cache/cache-warming-provider';
import { BranchProvider } from '@/contexts/branch-context';
import { ZoomProvider } from '@/contexts/zoom-context';


export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ZoomProvider>
      <ConnectivityProvider>
          <FirebaseClientProvider>
              <CacheProvider>
                  <CacheWarmingProvider>
                      <AuthProvider>
                          <UserProvider>
                              <BranchProvider>
                                  <SettingsProvider>
                                      {children}
                                      <Toaster />
                                      <FirebaseErrorListener />
                                  </SettingsProvider>
                              </BranchProvider>
                          </UserProvider>
                      </AuthProvider>
                  </CacheWarmingProvider>
              </CacheProvider>
              <OfflineIndicator />
          </FirebaseClientProvider>
      </ConnectivityProvider>
    </ZoomProvider>
  );
}
