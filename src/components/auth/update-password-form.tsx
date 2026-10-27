
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/components/auth/auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(6, { message: 'New password must be at least 6 characters.' }),
});

type UpdatePasswordFormValues = z.infer<typeof updatePasswordSchema>;

export function UpdatePasswordForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<UpdatePasswordFormValues>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
    },
    mode: 'onChange',
  });

  const onSubmit = async (data: UpdatePasswordFormValues) => {
    if (!user || !user.email) return;

    setIsLoading(true);
    form.clearErrors();

    try {
      const credential = EmailAuthProvider.credential(user.email, data.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, data.newPassword);

      toast({
        variant: 'success',
        title: 'Password Updated',
        description: 'Your password has been changed successfully.',
      });
      form.reset();
    } catch (error: any) {
      let errorMessage = 'An unexpected error occurred.';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'The current password you entered is incorrect.';
        form.setError('currentPassword', { type: 'manual', message: errorMessage });
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many attempts. Please try again later.';
      }
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Update your account password here.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Update Password
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  );
}
