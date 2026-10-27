
'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/components/auth/auth-provider';

export function FirebaseErrorListener() {
  const { toast } = useToast();
  const { user } = useAuth();

  const handleAIFix = (error: FirestorePermissionError) => {
    // Here you would implement the logic to send the error to an AI service.
    // For this example, we'll just log it to the console.
    console.log("Attempting to fix error with AI:", error);
    toast({
      title: 'AI Assistant',
      description: 'The AI is analyzing the error. Please stand by.',
    });
    // In a real implementation, this would trigger an async operation.
  };

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      console.error('Firestore Permission Error:', error);
      toast({
        variant: 'destructive',
        title: 'Permission Denied',
        description: `You don't have permission to perform this action. Please contact your administrator.`,
        duration: 9000,
        onAIFix: () => handleAIFix(error),
      });
    };

    errorEmitter.on('permission-error', handlePermissionError);

    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast, user]);

  return null;
}
