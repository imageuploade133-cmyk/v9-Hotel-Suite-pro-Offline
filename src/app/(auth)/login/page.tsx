'use client';

import * as React from 'react';
import Image from 'next/image';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useAuth } from '@/components/auth/auth-provider';
import { Loader2, Eye, EyeOff, LogIn, Mail, KeyRound, Database, HelpCircle, MapPin, Star, Copy, Building2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ZoomControls } from '@/components/ui/zoom-controls';
import { ForgotPasswordDialog } from '@/components/auth/forgot-password-dialog';
import { useToast } from '@/hooks/use-toast';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useFirestore } from '@/firebase';
import { doc, writeBatch, Timestamp, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { FirestorePermissionError } from '@/firebase/errors';
import { errorEmitter } from '@/firebase/error-emitter';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useSettings } from '@/contexts/settings-context';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/user-context';
import { getLandingPage, PagePermission } from '@/lib/permissions';

// Schema for form validation using Zod
const formSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email.' }),
  password: z
    .string()
    .min(1, { message: 'Password is required.' }),
  rememberMe: z.boolean().default(false).optional(),
});

type LoginFormValues = z.infer<typeof formSchema>;

const FlagIcon = ({ code }: { code: string }) => {
    const FlagComponent = flags[code];
    return FlagComponent ? <FlagComponent className="h-5 w-5 rounded-sm" /> : <MapPin className="h-5 w-5 text-muted-foreground" />;
};

const flags: Record<string, React.FC<React.SVGProps<SVGSVGElement>>> = {
    US: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" {...props}>
            <path fill="#fff" d="M0 0h900v600H0z"/>
            <path fill="#b22234" d="M0 60h900v60H0zm0 120h900v60H0zm0 120h900v60H0zm0 120h900v60H0zm0 120h900v60H0z"/>
            <path fill="#3c3b6e" d="M0 0h400v300H0z"/>
            <g fill="#fff">{[...Array(50)].map((_, i) => <path key={i} d="M50 30l-12 36 32-22h-40l32 22z" transform={`translate(${75 * (i % 8) + 25},${50 * Math.floor(i / 8) + 20}) scale(0.8)`} />)}</g>
        </svg>
    ),
    GB: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 30" {...props}>
            <clipPath id="a"><path d="M0 0v30h60V0z"/></clipPath><path d="M0 0v30h60V0z" fill="#012169"/><path d="M0 0l60 30m-60 0L60 0" stroke="#fff" strokeWidth="6" clipPath="url(#a)"/><path d="M0 0l60 30m-60 0L60 0" stroke="#C8102E" strokeWidth="4" clipPath="url(#a)"/><path d="M30 0v30M0 15h60" stroke="#fff" strokeWidth="10"/><path d="M30 0v30M0 15h60" stroke="#C8102E" strokeWidth="6"/>
        </svg>
    ),
    CA: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 15" {...props}>
            <path fill="#d52b1e" d="M0 0h30v15H0z"/><path fill="#fff" d="M7.5 0h15v15h-15z"/><path fill="#d52b1e" d="M15 2.5l2.5 3h-1.5l.5 2h-3l.5-2h-1.5l2.5-3zm-.5 6l-1 1h2l-1-1zm-1.5 1l-1 1h4l-1-1h-2zm-1 1.5l-.5 1h7l-.5-1h-6z"/>
        </svg>
    ),
    AU: (props) => (
         <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" {...props}><path fill="#00008b" d="M0 0h600v300H0z"/><path fill="#fff" d="m150 0 1-3 1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2zM75 99l36-1-1-36-35 2 1 36z"/><path fill="#fff" d="m300 150 1-3 1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2zm-75 51 36-1-1-36-35 2 1 36zm0-102 36-1-1-36-35 2 1 36zm-75 51 36-1-1-36-35 2 1 36z"/><path fill="#cc1428" stroke="#fff" strokeWidth=".6" d="m112 121-37 1 2-36-37 1 37-1-1 36z"/><path fill="#fff" d="m450 105 1-3 1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2zm0 90 1-3 1 3h3l-2 2 1 3-3-2-3 2 1-3-2-2z"/><path d="M75 99 38 98l1-36L1 99l37-1-1 36zm225 51L263 249l1-36-38 1 37-1-1 36zm0-102L263 98l1-36-38 1 37-1-1 36zm-75 51L188 149l1-36-38 1 37-1-1 36z" fill="#00008b"/><path d="M450 105-18 8-18-8h-3l18 8-18 8h3zm0 90-18 8-18-8h-3l18 8-18 8h3z" fill="#fff"/></svg>
    ),
    NG: (props) => (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2" {...props}>
            <rect width="3" height="2" fill="#fff"/>
            <rect width="1" height="2" fill="#008751"/>
            <rect width="1" height="2" x="2" fill="#008751"/>
        </svg>
    ),
    MA: (props) => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" {...props}>
        <rect width="600" height="400" fill="#c1272d"/>
        <path fill="none" stroke="#006233" strokeWidth="12" d="M300 150l-58.78 181.64h117.56L241.22 150h117.56L300 331.64 358.78 150H241.22z"/>
      </svg>
    ),
};


const StarRating = ({ rating }: { rating: number }) => {
  const fullStars = Math.floor(rating);
  const halfStar = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);

  return (
    <div className="flex items-center">
      {[...Array(fullStars)].map((_, i) => (
        <Star key={`full-${i}`} className="h-3 w-3 text-yellow-400 fill-yellow-400" />
      ))}
      {halfStar && (
        <div className="relative">
          <Star className="h-3 w-3 text-yellow-400" />
          <div className="absolute top-0 left-0 h-full w-1/2 overflow-hidden">
             <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
          </div>
        </div>
      )}
      {[...Array(emptyStars)].map((_, i) => (
        <Star key={`empty-${i}`} className="h-3 w-3 text-yellow-400" />
      ))}
    </div>
  );
};


const TopCountries = () => {
    const top = [
        { code: 'MA', name: 'Morocco', hotels: 2600, rating: 5.0 },
        { code: 'GB', name: 'United Kingdom', hotels: 2000, rating: 4.9 },
        { code: 'NG', name: 'Nigeria', hotels: 1200, rating: 4.8 },
        { code: 'US', name: 'United States', hotels: 751, rating: 5.0 },
    ].sort((a, b) => b.hotels - a.hotels);

    return (
        <div className="relative z-10 mt-auto pt-2">
            <h3 className="font-semibold text-white/80 text-xs sm:text-sm mb-2">Powering hotels in top destinations</h3>
            <div className="grid grid-cols-1 gap-2">
                {top.map(country => (
                    <div key={country.code} className="flex items-center gap-3 bg-black/25 backdrop-blur-sm px-3 py-2 rounded-lg border border-white/10">
                        <FlagIcon code={country.code} />
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-xs sm:text-sm truncate">{country.name}</p>
                            <p className="text-[11px] text-white/70">{country.hotels.toLocaleString()} hotels</p>
                        </div>
                        <div className="flex flex-col items-end shrink-0">
                            <StarRating rating={country.rating} />
                            <span className="text-[11px] font-bold text-white mt-0.5">{country.rating.toFixed(1)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export default function LoginPage() {
  const { login, loading: authLoading, user } = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingIn, setIsLoggingIn] = React.useState(false);
  const [isSeeding, setIsSeeding] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [isForgotPasswordOpen, setForgotPasswordOpen] = React.useState(false);
  const loginImage = PlaceHolderImages.find(p => p.id === 'login-background');
  const { settings } = useSettings();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const { userProfile, loading: profileLoading, permissions } = useUser();

  React.useEffect(() => {
    if (user && !profileLoading) {
      // Redirect user to their appropriate landing page based on permissions
      const landingPage = getLandingPage(permissions);
      router.replace(landingPage);
    }
  }, [user, profileLoading, userProfile, permissions, router]);

  async function onSubmit(values: LoginFormValues) {
    setIsLoggingIn(true);
    form.clearErrors();
    try {
      await login(values.email, values.password, values.rememberMe);
      toast({
        variant: 'success',
        title: 'Login Successful',
        description: 'Glad to see you again! Redirecting to your dashboard...',
      });
      // Don't redirect here - let the useEffect handle it once profile is loaded
    } catch (error: any) {
        let errorMessage = 'An unexpected error occurred. Please try again.';
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
          errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message) {
          errorMessage = error.message;
        }

      toast({
        variant: 'destructive',
        title: 'Login Failed',
        description: errorMessage,
        duration: 8000,
      });
    } finally {
        setIsLoggingIn(false);
    }
  }

  const handleSeedData = async () => {
    if (!firestore) return;
    setIsSeeding(true);

    const batch = writeBatch(firestore);

    // Seed Dashboard Metrics
    const metricsRef = doc(firestore, 'dashboard-metrics', 'summary');
    const metricsData = {
        todaysIncome: 4820,
        thisMonthsIncome: 85300,
        totalIncome: 1250000,
        totalActiveRooms: 128,
        todaysCheckIns: 34,
        todaysCheckOuts: 28,
        totalVacantRooms: 22,
        totalCustomers: 1204,
        outstandingBookings: 72,
        totalInventoryStock: 2500,
        totalOutOfStock: 15,
        totalLowStock: 42,
    };
    batch.set(metricsRef, metricsData, { merge: true });

    // Seed Recent Bookings
    const bookingsData = [
        { name: 'Olivia Martin', email: 'olivia.martin@email.com', amount: 1999.00, timestamp: Timestamp.now() },
        { name: 'Jackson Lee', email: 'jackson.lee@email.com', amount: 39.00, timestamp: Timestamp.now() },
        { name: 'Isabella Nguyen', email: 'isabella.nguyen@email.com', amount: 299.00, timestamp: Timestamp.now() },
        { name: 'William Kim', email: 'will@email.com', amount: 99.00, timestamp: Timestamp.now() },
        { name: 'Sofia Davis', email: 'sofia.davis@email.com', amount: 39.00, timestamp: Timestamp.now() },
    ];

    bookingsData.forEach(booking => {
        const bookingRef = doc(collection(firestore, 'recent-bookings'));
        batch.set(bookingRef, booking);
    });

    // Seed Weekly Occupancy
    const occupancyData = [
      { day: "Monday", occupancy: 55, order: 1 },
      { day: "Tuesday", occupancy: 72, order: 2 },
      { day: "Wednesday", occupancy: 85, order: 3 },
      { day: "Thursday", occupancy: 88, order: 4 },
      { day: "Friday", occupancy: 92, order: 5 },
      { day: "Saturday", occupancy: 95, order: 6 },
      { day: "Sunday", occupancy: 78, order: 7 },
    ];

    occupancyData.forEach(dayData => {
        const dayRef = doc(firestore, 'weekly-occupancy', dayData.day.toLowerCase());
        batch.set(dayRef, dayData, { merge: true });
    });

    batch.commit()
    .then(() => {
        toast({
            variant: 'success',
            title: 'Database Seeded',
            description: 'Your Firestore database has been populated with sample data.',
        });
    })
    .catch(async (serverError: any) => {
        const permissionError = new FirestorePermissionError({
            path: 'batch-write', // path is illustrative for batch
            operation: 'create',
            requestResourceData: {
              metrics: metricsData,
              bookings: bookingsData,
              occupancy: occupancyData,
            },
        });
        errorEmitter.emit('permission-error', permissionError);
    }).finally(() => {
        setIsSeeding(false);
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/website`;
    navigator.clipboard.writeText(url);
    toast({
      title: 'Link Copied!',
      description: 'The public website link has been copied to your clipboard.',
    });
  };

  if (authLoading || user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="relative flex h-screen max-h-screen w-full bg-background overflow-hidden">
        {/* Floating zoom controls on login page */}
        <div className="absolute top-4 right-4 z-50">
          <ZoomControls />
        </div>

        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden p-6 lg:p-8 xl:p-10 text-white lg:flex h-full max-h-screen">
          <div className="absolute inset-0 h-full w-full">
            <Image
              src="/login-bg.png"
              alt="Hotel Luxury Interior"
              fill
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover object-center w-full h-full"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/35" />
          </div>
          <div className="relative z-10 flex items-center gap-2 text-lg font-bold">
            <Building2 className="h-8 w-8" />
            <span className="font-bold text-lg tracking-tight">v9 Hotel Suite Pro</span>
          </div>
          <TopCountries />
        </div>

        <div className="flex w-full items-center justify-center p-4 sm:p-6 lg:w-1/2 lg:p-8 h-full max-h-screen overflow-y-auto">
          <div className="mx-auto my-auto flex w-full max-w-sm flex-col justify-center space-y-4 sm:space-y-5 py-4">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center gap-3 mb-2 lg:hidden">
                  <Building2 className="h-9 w-9 text-primary" />
              </div>
              <h1 className="text-2xl font-bold tracking-tight">
                  Welcome Back
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Sign in to access your hotel management dashboard.
              </p>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs sm:text-sm font-medium">Email</FormLabel>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="name@example.com"
                            className="pl-9 h-10 text-sm"
                            {...field}
                            disabled={isLoggingIn}
                          />
                        </FormControl>
                      </div>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="space-y-1">
                      <FormLabel className="text-xs sm:text-sm font-medium">Password</FormLabel>
                      <div className="relative">
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <FormControl>
                          <Input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            className="pl-9 pr-9 h-10 text-sm"
                            {...field}
                            disabled={isLoggingIn}
                          />
                        </FormControl>
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                           aria-label={
                            showPassword ? 'Hide password' : 'Show password'
                          }
                          disabled={isLoggingIn}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-between pt-1">
                  <FormField
                    control={form.control}
                    name="rememberMe"
                    render={({ field }) => (
                      <FormItem className="space-y-0">
                        <div className="flex items-center gap-2">
                           <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              id="remember-me"
                              disabled={isLoggingIn}
                              className="size-4 rounded-[4px]"
                            />
                          </FormControl>
                          <FormLabel
                            htmlFor="remember-me"
                            className="!mt-0 cursor-pointer text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Stay logged in
                          </FormLabel>
                           <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <HelpCircle className="size-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs text-xs">
                                  Check this box to stay logged in on this device.
                                  Do not use on shared or public computers.
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </FormItem>
                    )}
                  />
                  <Button
                      type="button"
                      variant="link"
                      className="h-auto p-0 text-xs sm:text-sm font-medium"
                      onClick={() => setForgotPasswordOpen(true)}
                      disabled={isLoggingIn}
                  >
                      Forgot Password?
                  </Button>
                </div>

                <Button type="submit" className="w-full h-10 text-sm font-semibold mt-2" loading={isLoggingIn}>
                  <LogIn className="mr-2 h-4 w-4" />
                  <span>Sign In</span>
                </Button>
              </form>
            </Form>

            <div className="flex flex-col gap-2 pt-1">
                 <Button variant="outline" className="w-full h-9 text-xs sm:text-sm" onClick={handleCopyLink}>
                    <Copy className="mr-2 h-3.5 w-3.5" />
                    <span>Copy public website link</span>
                </Button>
            </div>

            <p className="text-center text-[11px] text-muted-foreground font-semibold pt-1">
              Powered by ADS Developments Inc.
            </p>
          </div>
        </div>
      </div>
      <ForgotPasswordDialog open={isForgotPasswordOpen} onOpenChange={setForgotPasswordOpen} />
    </>
  );
}
