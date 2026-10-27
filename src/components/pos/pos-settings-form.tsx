'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { useBranch } from '@/contexts/branch-context';
import { doc, setDoc, writeBatch, collection, serverTimestamp } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Loader2, Receipt, Upload, X, RotateCcw, Printer, Settings2, Palette, FileText, Building2, Globe } from 'lucide-react';
import { POSReceiptPreview } from './pos-receipt-preview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const posSettingsSchema = z.object({
  // Business Info
  businessName: z.string().max(120).optional(),
  businessAddress: z.string().max(240).optional(),
  businessPhone: z.string().max(50).optional(),
  businessEmail: z.string().email('Invalid email.').optional().or(z.literal('')),

  // Logo Settings
  posReceiptLogoUrl: z.string().url().optional().or(z.literal('')),
  posReceiptLogoFile: z.instanceof(File).optional(),
  posReceiptLogoSize: z.number().min(32).max(200),
  posUseBusinessLogo: z.boolean().default(true),

  // Header & Footer
  posReceiptHeader: z.string().max(100).optional(),
  posReceiptFooter: z.string().max(500).optional(),
  posReceiptTitle: z.string().max(100).optional(),

  // Display Options
  posShowBusinessName: z.boolean().default(true),
  posShowAddress: z.boolean().default(true),
  posShowPhone: z.boolean().default(true),
  posShowEmail: z.boolean().default(false),
  posShowDate: z.boolean().default(true),
  posShowCashierName: z.boolean().default(true),
  posShowPaymentMethod: z.boolean().default(true),
  posShowBarcode: z.boolean().default(false),
  posShowCategorySeparator: z.boolean().default(true),

  // Tax Settings
  posEnableTax: z.boolean().default(false),
  posTaxLabel: z.string().max(50).optional(),
  posTaxRate: z.number().min(0).max(100),
  posTaxNumber: z.string().optional(),

  // Print Settings
  posDefaultPrinter: z.string().optional(),
  posAutoPrint: z.boolean().default(false),
  posAutoPrintTableUpdates: z.boolean().default(true),
  posAutoGenerateReceiptOnRunningTable: z.boolean().default(true),
  posPrintCopies: z.number().min(1).max(5),
  posPaperWidth: z.enum(['58mm', '80mm', 'a4']).default('80mm'),

  // Messages
  posThankYouMessage: z.string().max(200).optional(),
  posRefundPolicy: z.string().max(500).optional(),
  posTermsAndConditions: z.string().max(1000).optional(),
  posAllowPopups: z.boolean().default(false),
  });

type POSSettingsFormValues = z.infer<typeof posSettingsSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

async function uploadImage(file: File, apiKey: string, name: string, expiration?: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (event) => {
      if (event.target && typeof event.target.result === 'string') {
        const base64Image = event.target.result.split(',')[1];
        const formData = new FormData();
        formData.append('image', base64Image);
        formData.append('name', name);

        let uploadUrl = `https://api.imgbb.com/1/upload?key=${apiKey}`;
        if (expiration && expiration > 0) {
          uploadUrl += `&expiration=${expiration}`;
        }

        try {
          const response = await fetch(uploadUrl, {
            method: 'POST',
            body: formData,
          });

          const result = await response.json();
          if (result.success) {
            resolve(result.data.url);
          } else {
            reject(new Error(result.error?.message || 'Image upload failed'));
          }
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error('Failed to read file.'));
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
}

const defaultValues: Partial<POSSettingsFormValues> = {
  businessName: 'Hotel Suite Pro',
  businessAddress: '123 Luxury Lane, Suite 100, Metropolis, ST 12345',
  businessPhone: '+1 (800) 555-0199',
  businessEmail: 'contact@hotelsuitepro.com',
  posReceiptLogoSize: 64,
  posUseBusinessLogo: true,
  posReceiptHeader: 'SALE RECEIPT',
  posReceiptFooter: 'Thank you for your purchase!\nPlease come again.',
  posReceiptTitle: 'Point of Sale',
  posShowBusinessName: true,
  posShowAddress: true,
  posShowPhone: true,
  posShowEmail: false,
  posShowDate: true,
  posShowCashierName: true,
  posShowPaymentMethod: true,
  posShowBarcode: false,
  posEnableTax: false,
  posTaxLabel: 'Tax',
  posTaxRate: 0,
  posTaxNumber: '',
  posAutoPrint: false,
  posAutoPrintTableUpdates: true,
  posAutoGenerateReceiptOnRunningTable: true,
  posPrintCopies: 1,
  posPaperWidth: '80mm',
  posThankYouMessage: 'Thank you for choosing us!',
  posRefundPolicy: '',
  posTermsAndConditions: '',
  posAllowPopups: false,
  };

export function POSSettingsForm() {
  const { toast } = useToast();
  const { user, userProfile } = useUser();
  const firestore = useFirestore();
  const { currentBranchId, currentBranch, getCollectionPath, isBranchMode, isGlobalMode } = useBranch();
  const { settings, isLoading: isSettingsLoading, getEffectivePosSettings, branchPosSettings } = useSettings();
  const [isSaving, setIsSaving] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('logo');

  // Determine context: Global or Branch
  const contextLabel = isGlobalMode ? 'Global' : (currentBranch?.name || 'Branch');
  const ContextIcon = isGlobalMode ? Globe : Building2;

  const logoFileInputRef = React.useRef<HTMLInputElement>(null);
  const [isLogoDragging, setIsLogoDragging] = React.useState(false);

  const expirationSeconds = settings?.expirationSeconds ?? 0;
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const maxFileSize = settings?.maxFileSizeMb ?? 5;

  const form = useForm<POSSettingsFormValues>(
{
    resolver: zodResolver(posSettingsSchema),
    defaultValues,
  });

  const { reset, watch, setValue } = form;

  // Load effective POS settings based on current context (Global vs Branch)
  React.useEffect(() => {
    const posSettings = getEffectivePosSettings();
    const isGlobal = isGlobalMode || !currentBranchId || currentBranchId === 'global';

    // Use appropriate defaults based on context
    const defaultBusinessName = isGlobal ? 'Hotel Suite Pro' : (currentBranch?.name || 'Branch');
    const defaultBusinessAddress = isGlobal ? '123 Luxury Lane, Suite 100, Metropolis, ST 12345' : '';
    const defaultBusinessPhone = isGlobal ? '+1 (800) 555-0199' : (currentBranch?.phoneNumber || '');
    const defaultBusinessEmail = isGlobal ? 'contact@hotelsuitepro.com' : '';

    // For branch mode, check if settings exist - if not, leave empty to encourage configuration
    const hasExistingSettings = isBranchMode && Object.keys(posSettings).length > 0;

    reset({
      businessName: posSettings.businessName || defaultBusinessName,
      businessAddress: posSettings.businessAddress !== undefined
        ? posSettings.businessAddress
        : defaultBusinessAddress,
      businessPhone: posSettings.businessPhone !== undefined
        ? posSettings.businessPhone
        : defaultBusinessPhone,
      businessEmail: posSettings.businessEmail !== undefined
        ? posSettings.businessEmail
        : defaultBusinessEmail,
      posReceiptLogoUrl: posSettings.posReceiptLogoUrl || '',
      posReceiptLogoFile: undefined,
      posReceiptLogoSize: posSettings.posReceiptLogoSize || 64,
      posUseBusinessLogo: posSettings.posUseBusinessLogo ?? true,
      posReceiptHeader: posSettings.posReceiptHeader || 'SALE RECEIPT',
      posReceiptFooter: posSettings.posReceiptFooter || 'Thank you for your purchase!\nPlease come again.',
      posReceiptTitle: posSettings.posReceiptTitle || 'Point of Sale',
      posShowBusinessName: posSettings.posShowBusinessName ?? true,
      posShowAddress: posSettings.posShowAddress ?? true,
      posShowPhone: posSettings.posShowPhone ?? true,
      posShowEmail: posSettings.posShowEmail ?? false,
      posShowDate: posSettings.posShowDate ?? true,
      posShowCashierName: posSettings.posShowCashierName ?? true,
      posShowPaymentMethod: posSettings.posShowPaymentMethod ?? true,
      posShowBarcode: posSettings.posShowBarcode ?? false,
      posEnableTax: posSettings.posEnableTax ?? false,
      posTaxLabel: posSettings.posTaxLabel || 'Tax',
      posTaxRate: posSettings.posTaxRate || 0,
      posTaxNumber: posSettings.posTaxNumber || '',
      posAutoPrint: posSettings.posAutoPrint ?? false,
      posAutoPrintTableUpdates: posSettings.posAutoPrintTableUpdates ?? true,
      posAutoGenerateReceiptOnRunningTable: posSettings.posAutoGenerateReceiptOnRunningTable ?? true,
      posPrintCopies: posSettings.posPrintCopies || 1,
      posPaperWidth: posSettings.posPaperWidth || '80mm',
      posThankYouMessage: posSettings.posThankYouMessage || 'Thank you for choosing us!',
      posRefundPolicy: posSettings.posRefundPolicy || '',
      posTermsAndConditions: posSettings.posTermsAndConditions || '',
      posAllowPopups: posSettings.posAllowPopups ?? false,
      });
  }, [settings, reset, getEffectivePosSettings, isGlobalMode, isBranchMode, currentBranchId, currentBranch]);

  const watchedValues = watch();
  const logoFile = watchedValues.posReceiptLogoFile;
  const logoUrl = watchedValues.posReceiptLogoUrl;
  const logoImagePreview = logoFile ? URL.createObjectURL(logoFile) : logoUrl;

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const file = files[0];
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File Too Large',
          description: `${file.name} is larger than the allowed ${maxFileSize}MB.`,
        });
        return;
      }
      form.setValue('posReceiptLogoFile', file, { shouldDirty: true });
      form.setValue('posUseBusinessLogo', false, { shouldDirty: true });
    }
  };

  const handleRemoveImage = () => {
    form.setValue('posReceiptLogoFile', undefined, { shouldDirty: true });
    form.setValue('posReceiptLogoUrl', '', { shouldDirty: true });
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
  };

  const handleUseBusinessLogo = () => {
    form.setValue('posUseBusinessLogo', true, { shouldDirty: true });
    form.setValue('posReceiptLogoUrl', '', { shouldDirty: true });
    form.setValue('posReceiptLogoFile', undefined, { shouldDirty: true });
    if (logoFileInputRef.current) logoFileInputRef.current.value = '';
  };

  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsLogoDragging(true);
    },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsLogoDragging(true);
    },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsLogoDragging(false);
    },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsLogoDragging(false);
      if (e.dataTransfer.files) handleFileSelect(e.dataTransfer.files);
    },
  };

  async function onSubmit(data: POSSettingsFormValues) {
    if (!user || !firestore || !userProfile) {
      toast({ variant: 'destructive', title: 'Error', description: 'User must be logged in.' });
      return;
    }

    setIsSaving(true);
    try {
      const batch = writeBatch(firestore);
      const collectionPath = getCollectionPath('posSettings');
      const settingsDocRef = doc(firestore, collectionPath, 'settings');

      let finalLogoUrl = data.posReceiptLogoUrl;
      if (data.posReceiptLogoFile) {
        toast({ title: 'Uploading Receipt Logo...', description: 'Please wait.' });
        const logoName = `pos-receipt-logo_${currentBranchId || 'global'}_${Date.now()}`;
        finalLogoUrl = await uploadImage(data.posReceiptLogoFile, imgbbApiKey, logoName, expirationSeconds);
      }

      const settingsToSave = {
        businessName: data.businessName,
        businessAddress: data.businessAddress,
        businessPhone: data.businessPhone,
        businessEmail: data.businessEmail,
        posReceiptLogoUrl: data.posUseBusinessLogo ? '' : finalLogoUrl,
        posReceiptLogoSize: data.posReceiptLogoSize,
        posUseBusinessLogo: data.posUseBusinessLogo,
        posReceiptHeader: data.posReceiptHeader,
        posReceiptFooter: data.posReceiptFooter,
        posReceiptTitle: data.posReceiptTitle,
        posShowBusinessName: data.posShowBusinessName,
        posShowAddress: data.posShowAddress,
        posShowPhone: data.posShowPhone,
        posShowEmail: data.posShowEmail,
        posShowDate: data.posShowDate,
        posShowCashierName: data.posShowCashierName,
        posShowPaymentMethod: data.posShowPaymentMethod,
        posShowBarcode: data.posShowBarcode,
        posEnableTax: data.posEnableTax,
        posTaxLabel: data.posTaxLabel,
        posTaxRate: data.posTaxRate,
        posTaxNumber: data.posTaxNumber,
        posAutoPrint: data.posAutoPrint,
        posAutoPrintTableUpdates: data.posAutoPrintTableUpdates,
        posAutoGenerateReceiptOnRunningTable: data.posAutoGenerateReceiptOnRunningTable,
        posPrintCopies: data.posPrintCopies,
        posPaperWidth: data.posPaperWidth,
        posThankYouMessage: data.posThankYouMessage,
        posRefundPolicy: data.posRefundPolicy,
        posTermsAndConditions: data.posTermsAndConditions,
        posAllowPopups: data.posAllowPopups,
      };

      // Compare against the correct settings source based on context
      const comparisonSettings = getEffectivePosSettings();
      const changes: { field: string; before: any; after: any }[] = [];
      Object.keys(settingsToSave).forEach((key) => {
        const settingKey = key as keyof typeof settingsToSave;
        if (comparisonSettings[settingKey] !== settingsToSave[settingKey]) {
          changes.push({
            field: key.replace(/([A-Z])/g, ' $1').trim(),
            before: comparisonSettings[settingKey] || 'Not set',
            after: settingsToSave[settingKey],
          });
        }
      });

      if (changes.length > 0 || data.posReceiptLogoFile) {
        batch.set(settingsDocRef, settingsToSave, { merge: true });

        const auditLogRef = doc(collection(firestore, 'globalAuditLog'));
        batch.set(auditLogRef, {
          timestamp: serverTimestamp(),
          userId: userProfile.uid,
          userName: userProfile.name,
          changeType: 'Update',
          entityType: 'Settings',
          entityId: `POS Settings${currentBranchId && currentBranchId !== 'global' ? ` - ${currentBranch?.name || currentBranchId}` : ''}`,
          details: `Updated POS receipt and invoice settings for ${currentBranchId === 'global' || !currentBranchId ? 'Global' : currentBranch?.name || 'Branch'}.`,
          changes: changes.length > 0 ? changes : [{ field: 'Receipt Logo', before: 'No change', after: 'Updated' }],
        });

        await batch.commit();
      }

      toast({
        title: 'POS Settings Saved',
        description: `POS receipt settings for ${contextLabel} have been updated successfully.`,
        variant: 'success',
      });

      reset(
        {
          ...data,
          posReceiptLogoUrl: finalLogoUrl,
          posReceiptLogoFile: undefined,
        },
        { keepDirty: false }
      );
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  const handleReset = () => {
    reset(defaultValues, { keepDirty: true });
    toast({
      title: 'Settings Reset',
      description: 'Form has been reset to default values. Click Save to apply.',
    });
  };

  const isLoading = isSaving || isSettingsLoading;
  const branchLogoUrl = currentBranch?.logoUrl;

  // Determine effective logo URL for preview
  const effectiveLogoUrl = watchedValues.posUseBusinessLogo
    ? branchLogoUrl || settings?.businessLogoUrl
    : logoImagePreview || branchLogoUrl || settings?.businessLogoUrl;

  if (isSettingsLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-full max-w-lg" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
          <CardFooter className="border-t px-6 py-4">
            <Skeleton className="h-10 w-40" />
          </CardFooter>
        </Card>
        <div className="sticky top-20">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-96 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Check if branch has no POS settings configured yet
  const hasBranchPosSettings = isBranchMode && branchPosSettings && Object.keys(branchPosSettings).length > 0;
  const showSetupAlert = isBranchMode && !hasBranchPosSettings;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 items-start">
      <Card className="order-2 xl:order-1">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Receipt className="h-6 w-6 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle>POS Receipt Settings</CardTitle>
                <Badge variant={isGlobalMode ? 'secondary' : 'default'} className="flex items-center gap-1">
                  <ContextIcon className="h-3 w-3" />
                  {contextLabel}
                </Badge>
              </div>
              <CardDescription>
                Customize how your POS receipts and invoices look when printed.
                {isBranchMode && (
                  <span className="block text-xs text-muted-foreground mt-1">
                    These settings are specific to <strong>{currentBranch?.name}</strong> branch and are separate from Global settings.
                  </span>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {showSetupAlert && (
          <div className="px-6 pb-4">
            <Alert>
              <Building2 className="h-4 w-4" />
              <AlertTitle>Branch POS Settings Not Configured</AlertTitle>
              <AlertDescription>
                This branch doesn&apos;t have POS settings yet. Fill in the details below to configure
                <strong> Address</strong>, <strong>Phone Number</strong>, and <strong>Custom POS Receipt Logo</strong> for this branch.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <fieldset disabled={isLoading} className="group">
              <CardContent className="space-y-6 group-disabled:opacity-50">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-4">
                    <TabsTrigger value="logo" className="text-xs sm:text-sm">
                      <Palette className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Logo</span>
                    </TabsTrigger>
                    <TabsTrigger value="content" className="text-xs sm:text-sm">
                      <FileText className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Content</span>
                    </TabsTrigger>
                    <TabsTrigger value="display" className="text-xs sm:text-sm">
                      <Settings2 className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Display</span>
                    </TabsTrigger>
                    <TabsTrigger value="tax" className="text-xs sm:text-sm">
                      <Printer className="h-4 w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Tax & Print</span>
                    </TabsTrigger>
                  </TabsList>

                  {/* Logo Tab */}
                  <TabsContent value="logo" className="space-y-6 mt-4">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="posUseBusinessLogo"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Use Business Logo</FormLabel>
                              <FormDescription>
                                Use the same logo as your business information settings.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={(checked) => {
                                  field.onChange(checked);
                                  if (checked) {
                                    handleUseBusinessLogo();
                                  }
                                }}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {!watchedValues.posUseBusinessLogo && (
                        <div className="space-y-4 rounded-lg border p-4">
                          <FormLabel>Custom POS Receipt Logo</FormLabel>
                          <FormDescription>
                            Upload a logo specifically for POS receipts. Recommended size: 200x200px.
                          </FormDescription>
                          {logoImagePreview ? (
                            <div className="relative group w-40 h-40">
                              <Image
                                src={logoImagePreview}
                                alt="Logo preview"
                                fill
                                style={{ objectFit: 'contain' }}
                                className="rounded-md border p-2"
                              />
                              <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="icon"
                                  onClick={handleRemoveImage}
                                >
                                  <X className="h-5 w-5" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                                isLogoDragging
                                  ? 'border-primary bg-primary/10'
                                  : 'border-input hover:border-primary/50'
                              }`}
                              {...handleDragEvents}
                              onClick={() => logoFileInputRef.current?.click()}
                            >
                              <Upload className="w-8 h-8 text-muted-foreground" />
                              <p className="mt-2 text-sm text-muted-foreground">
                                <span className="font-semibold text-primary">Click to upload</span> or drag and drop
                              </p>
                              <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                            </div>
                          )}
                          <FormControl>
                            <Input
                              ref={logoFileInputRef}
                              type="file"
                              accept="image/png, image/jpeg"
                              className="hidden"
                              onChange={(e) => handleFileSelect(e.target.files)}
                            />
                          </FormControl>
                        </div>
                      )}

                      <FormField
                        control={form.control}
                        name="posReceiptLogoSize"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Logo Size on Receipt</FormLabel>
                            <div className="flex items-center gap-4">
                              <FormControl>
                                <Slider
                                  min={32}
                                  max={200}
                                  step={4}
                                  value={[field.value]}
                                  onValueChange={(value) => field.onChange(value[0])}
                                />
                              </FormControl>
                              <div className="font-semibold w-20 text-center text-sm tabular-nums">
                                {watchedValues.posReceiptLogoSize}px
                              </div>
                            </div>
                            <FormDescription>Controls the display size of the logo on receipts.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  {/* Content Tab */}
                  <TabsContent value="content" className="space-y-6 mt-4">
                    <div className="space-y-4">
                      <div className="space-y-4 rounded-lg border p-4">
                        <div>
                          <h4 className="text-sm font-medium">POS Business Details</h4>
                          <p className="text-xs text-muted-foreground">
                            This information prints on POS receipts and invoices.
                          </p>
                        </div>
                        <FormField
                          control={form.control}
                          name="businessName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Name</FormLabel>
                              <FormControl>
                                <Input {...field} value={field.value || ''} placeholder="Enter business name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="businessAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Business Address</FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value || ''}
                                  placeholder="Enter business address"
                                  rows={2}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField
                            control={form.control}
                            name="businessPhone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Business Phone</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ''} placeholder="Enter phone number" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="businessEmail"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Business Email</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value || ''}
                                    placeholder="Enter email address"
                                    type="email"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>

                      <FormField
                        control={form.control}
                        name="posReceiptTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receipt Title</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="e.g., Point of Sale Receipt" />
                            </FormControl>
                            <FormDescription>Shown in the browser tab and print dialog.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="posReceiptHeader"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receipt Header Text</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="e.g., SALE RECEIPT" />
                            </FormControl>
                            <FormDescription>
                              Displayed prominently on the receipt. Keep it short.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="posReceiptFooter"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Receipt Footer Text</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value || ''}
                                placeholder="Thank you for your purchase!"
                                rows={3}
                              />
                            </FormControl>
                            <FormDescription>
                              Use line breaks for multiple lines. This appears at the bottom of every receipt.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <Separator />

                      <FormField
                        control={form.control}
                        name="posThankYouMessage"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Thank You Message</FormLabel>
                            <FormControl>
                              <Input {...field} value={field.value || ''} placeholder="Thank you for choosing us!" />
                            </FormControl>
                            <FormDescription>Shown on A4-style invoices.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="posRefundPolicy"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Refund Policy</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value || ''}
                                placeholder="Items can be returned within 7 days with receipt..."
                                rows={2}
                              />
                            </FormControl>
                            <FormDescription>Optional. Shown at the bottom of receipts.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="posTermsAndConditions"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Terms & Conditions</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                value={field.value || ''}
                                placeholder="All sales are final..."
                                rows={2}
                              />
                            </FormControl>
                            <FormDescription>Optional. Small print on A4 invoices.</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </TabsContent>

                  {/* Display Tab */}
                  <TabsContent value="display" className="space-y-6 mt-4">
                    <div className="space-y-4">
                      <h4 className="font-medium text-sm text-muted-foreground">Business Information</h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="posShowBusinessName"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Business Name</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posShowAddress"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Address</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posShowPhone"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Phone</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posShowEmail"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Email</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>

                      <Separator />

                      <h4 className="font-medium text-sm text-muted-foreground">Receipt Details</h4>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="posShowDate"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Date & Time</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posShowCashierName"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Cashier Name</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posShowPaymentMethod"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Payment Method</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posShowBarcode"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <FormLabel className="text-sm font-normal">Show Barcode</FormLabel>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posShowCategorySeparator"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                              <div className="space-y-0.5">
                                <FormLabel className="text-sm font-normal">Category Separators</FormLabel>
                                <FormDescription className="text-xs">
                                  Show category names as separators in running table dockets
                                </FormDescription>
                              </div>
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>

                  {/* Tax & Print Tab */}
                  <TabsContent value="tax" className="space-y-6 mt-4">
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="posEnableTax"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Enable Tax Calculation</FormLabel>
                              <FormDescription>
                                Automatically calculate and display tax on receipts.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      {watchedValues.posEnableTax && (
                        <div className="space-y-4 pl-4 border-l-2 ml-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="posTaxLabel"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tax Label</FormLabel>
                                  <FormControl>
                                    <Input {...field} value={field.value || ''} placeholder="e.g., VAT, GST, Tax" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />

                            <FormField
                              control={form.control}
                              name="posTaxRate"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Tax Rate (%)</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={100}
                                      step={0.01}
                                      {...field}
                                      value={field.value || 0}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>

                          <FormField
                            control={form.control}
                            name="posTaxNumber"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Tax Registration Number</FormLabel>
                                <FormControl>
                                  <Input {...field} value={field.value || ''} placeholder="e.g., VAT Reg. No. 123456789" />
                                </FormControl>
                                <FormDescription>Optional. Displayed on receipts.</FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      )}

                      <Separator />

                      <h4 className="font-medium text-sm text-muted-foreground">Print Settings</h4>

                      <FormField
                        control={form.control}
                        name="posAllowPopups"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 bg-primary/5 border-primary/20">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Allow Pop-ups and Redirects</FormLabel>
                              <FormDescription>
                                When enabled, the system will use a more direct method to open print windows, which helps avoid browser blocks.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="posAutoPrint"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Auto-Print Receipts</FormLabel>
                              <FormDescription>
                                Automatically open print dialog after each sale.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="posAutoPrintTableUpdates"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Auto-Print Table Updates</FormLabel>
                              <FormDescription>
                                Automatically print docket when updating a running table.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="posAutoGenerateReceiptOnRunningTable"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                              <FormLabel className="text-base">Auto-Generate Receipt on Add to Running Table</FormLabel>
                              <FormDescription>
                                Automatically generate and show a receipt when adding items to a running table.
                              </FormDescription>
                            </div>
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                          </FormItem>
                        )}
                      />

                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="posPrintCopies"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Copies</FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={1}
                                  max={5}
                                  {...field}
                                  value={field.value || 1}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="posPaperWidth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Default Paper Width</FormLabel>
                              <FormControl>
                                <select
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                  {...field}
                                  value={field.value || '80mm'}
                                >
                                  <option value="58mm">58mm (Small)</option>
                                  <option value="80mm">80mm (Standard)</option>
                                  <option value="a4">A4 (Full Page)</option>
                                </select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
              <CardFooter className="border-t px-6 py-4 flex justify-between">
                <Button type="button" variant="outline" onClick={handleReset} disabled={isLoading}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset to Defaults
                </Button>
                <Button type="submit" disabled={isLoading || !form.formState.isDirty}>
                  {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save POS Settings
                </Button>
              </CardFooter>
            </fieldset>
          </form>
        </Form>
      </Card>

      {/* Preview */}
      <div className="order-1 xl:order-2 sticky top-20">
        <POSReceiptPreview
          posReceiptLogoUrl={effectiveLogoUrl}
          posReceiptLogoSize={watchedValues.posReceiptLogoSize}
          posReceiptHeader={watchedValues.posReceiptHeader}
          posReceiptFooter={watchedValues.posReceiptFooter}
          posShowBusinessName={watchedValues.posShowBusinessName}
          posShowAddress={watchedValues.posShowAddress}
          posShowPhone={watchedValues.posShowPhone}
          posShowEmail={watchedValues.posShowEmail}
          posShowDate={watchedValues.posShowDate}
          posShowCashierName={watchedValues.posShowCashierName}
          posShowPaymentMethod={watchedValues.posShowPaymentMethod}
          posShowBarcode={watchedValues.posShowBarcode}
          posTaxLabel={watchedValues.posTaxLabel}
          posTaxRate={watchedValues.posEnableTax ? watchedValues.posTaxRate : 0}
          businessName={watchedValues.businessName || settings?.businessName}
          businessAddress={watchedValues.businessAddress || settings?.businessAddress}
          businessPhone={watchedValues.businessPhone || settings?.businessPhone}
          businessEmail={watchedValues.businessEmail || settings?.businessEmail}
          currency={settings?.currency}
        />
      </div>
    </div>
  );
}
