'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppInstall } from '@/contexts/app-install-context';

export function InstallAppModal() {
  const { canInstall, triggerInstall, showInstallModal, closeInstallModal, permanentlyHideInstallModal } = useAppInstall();

  const handleInstall = () => {
    triggerInstall();
    closeInstallModal();
  };

  const handleDismiss = () => {
    permanentlyHideInstallModal();
  };

  if (!canInstall) {
    return null;
  }

  return (
    <Dialog open={showInstallModal} onOpenChange={closeInstallModal}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Install v9 Hotel Suite Pro</DialogTitle>
          <DialogDescription>
            For a better experience, install the v9 Hotel Suite Pro app on your device. It's fast, works offline, and is available on all your devices.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleDismiss}>Dismiss</Button>
          <Button onClick={handleInstall}>Install</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
