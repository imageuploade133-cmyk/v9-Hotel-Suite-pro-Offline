
'use client';

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from './auth-provider';
import { useToast } from '@/hooks/use-toast';
import { Mail, KeyRound, User, Loader2 } from 'lucide-react';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signupSchema = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(6),
})

export function AuthDialog({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const [activeTab, setActiveTab] = React.useState('login');
  const [isLoading, setIsLoading] = React.useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const { auth } = useAuth();


  const loginForm = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
        email: '',
        password: '',
    }
  });

  const signupForm = useForm<z.infer<typeof signupSchema>>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
        name: '',
        email: '',
        password: '',
    }
  });

  const handleLogin = async (values: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      await login(values.email, values.password, true);
      toast({ title: 'Login Successful', description: 'Welcome back!' });
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Login Failed', description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (values: z.infer<typeof signupSchema>) => {
    if (!auth) return;
    setIsLoading(true);
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, values.email, values.password);
        // Here you would typically update the user's profile with their name
        // and create a user document in Firestore.
        toast({ title: 'Signup Successful', description: 'Welcome! You can now log in.' });
        setActiveTab('login'); // Switch to login tab after signup
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Signup Failed', description: error.message });
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Guest Access</DialogTitle>
          <DialogDescription>
            Log in to manage your bookings or sign up to get started.
          </DialogDescription>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Log In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <TabsContent value="login">
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4 pt-4">
                 <FormField
                  control={loginForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl><Input placeholder="name@example.com" {...field} className="pl-10" /></FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password</FormLabel>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl><Input type="password" placeholder="••••••••" {...field} className="pl-10" /></FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Log In
                </Button>
              </form>
            </Form>
          </TabsContent>
          <TabsContent value="signup">
             <Form {...signupForm}>
              <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4 pt-4">
                 <FormField
                  control={signupForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Full Name</FormLabel>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl><Input placeholder="John Doe" {...field} className="pl-10" /></FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={signupForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Email</FormLabel>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl><Input placeholder="name@example.com" {...field} className="pl-10" /></FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                 <FormField
                  control={signupForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                        <FormLabel>Password</FormLabel>
                        <div className="relative">
                            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <FormControl><Input type="password" placeholder="••••••••" {...field} className="pl-10" /></FormControl>
                        </div>
                        <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Sign Up
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
