'use client';

import * as React from 'react';
import Image from 'next/image';
import { doc, setDoc } from 'firebase/firestore';
import { Image as ImageIcon, Loader2, Upload, X } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { useUser } from '@/contexts/user-context';
import { useSettings } from '@/contexts/settings-context';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

async function uploadDefaultProductImage(file: File, apiKey: string): Promise<string> {
  const formData = new FormData();
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error('Unable to read the selected image.'));
      resolve(reader.result.split(',')[1] || '');
    };
    reader.onerror = () => reject(new Error('Unable to read the selected image.'));
    reader.readAsDataURL(file);
  });
  if (!base64) throw new Error('The selected image is empty or invalid.');
  formData.append('image', base64);
  formData.append('name', `global-product-default-${Date.now()}`);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, { method: 'POST', body: formData });
  const result = await response.json();
  if (!response.ok || !result?.success || !result?.data?.url) {
    throw new Error(result?.error?.message || 'ImgBB could not upload the default product image.');
  }
  return result.data.url as string;
}

export function GlobalDefaultProductImageSettings() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState(false);
  const [savedUrl, setSavedUrl] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewUrl = React.useMemo(() => file ? URL.createObjectURL(file) : savedUrl, [file, savedUrl]);

  React.useEffect(() => {
    setEnabled(!!settings?.useGlobalStockImage);
    setSavedUrl(settings?.globalStockImageUrl || '');
  }, [settings?.useGlobalStockImage, settings?.globalStockImageUrl]);

  React.useEffect(() => () => {
    if (file && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [file, previewUrl]);

  const selectFile = (selected: File | null) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      toast({ title: 'Unsupported file', description: 'Please select a valid image file.', variant: 'destructive' });
      return;
    }
    const maxSizeMb = Number(settings?.maxFileSizeMb || 5);
    if (selected.size > maxSizeMb * 1024 * 1024) {
      toast({ title: 'Image is too large', description: `Choose an image smaller than ${maxSizeMb} MB.`, variant: 'destructive' });
      return;
    }
    setFile(selected);
  };

  const save = async () => {
    if (!user || !firestore) {
      toast({ title: 'Unable to save settings', description: 'Sign in and connect to the settings service before saving.', variant: 'destructive' });
      return;
    }
    if (enabled && !file && !savedUrl) {
      toast({ title: 'Default image required', description: 'Upload a default product image or turn this setting off.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      let finalUrl = savedUrl;
      if (file) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('Connect to the internet to upload the image to ImgBB. Your existing saved image and settings have not been changed.');
        finalUrl = await uploadDefaultProductImage(file, settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY);
      }
      const update = { useGlobalStockImage: enabled, globalStockImageUrl: finalUrl };
      await setDoc(doc(firestore, 'settings', 'global'), update, { merge: true });
      try {
        const cached = JSON.parse(localStorage.getItem('app_saved_settings') || '{}');
        localStorage.setItem('app_saved_settings', JSON.stringify({ ...cached, ...update }));
      } catch (error) {
        console.warn('[Global product image] Local settings cache could not be updated:', error);
      }
      setSavedUrl(finalUrl);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      toast({ title: 'Global default product image saved', description: enabled ? 'Products without their own image will use this image.' : 'The global fallback is disabled. Individual product images are unchanged.' });
    } catch (error) {
      toast({ title: 'Could not save default image', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const removeImage = () => {
    setSavedUrl('');
    setFile(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <ImageIcon className="h-6 w-6 text-muted-foreground" />
          <div>
            <CardTitle>Global Default Product Image</CardTitle>
            <CardDescription className="mt-1">Set one shared fallback image for products that do not have an individual image. This applies globally across the application.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Label htmlFor="global-product-image-enabled" className="text-sm font-medium">Enable global default product image</Label>
            <p className="text-sm text-muted-foreground">Individual product images always take priority. This setting never overwrites product records.</p>
          </div>
          <Switch id="global-product-image-enabled" checked={enabled} onCheckedChange={setEnabled} disabled={isSaving} />
        </div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
            {previewUrl ? <Image src={previewUrl} alt="Global default product image preview" fill unoptimized className="object-cover" /> : <div className="flex flex-col items-center gap-2 text-muted-foreground"><ImageIcon className="h-8 w-8" /><span className="text-xs">No image selected</span></div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={event => selectFile(event.target.files?.[0] || null)} />
            <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={isSaving}><Upload className="mr-2 h-4 w-4" />{previewUrl ? 'Change image' : 'Upload image'}</Button>
            {previewUrl && <Button type="button" variant="ghost" onClick={removeImage} disabled={isSaving}><X className="mr-2 h-4 w-4" />Remove</Button>}
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Images are hosted on ImgBB. Uploading a new image requires an internet connection. The saved image URL is cached with application settings for offline display where the settings cache is available.</p>
      </CardContent>
      <CardFooter className="justify-end border-t px-6 py-4">
        <Button type="button" onClick={save} disabled={isSaving || (!file && enabled === !!settings?.useGlobalStockImage && savedUrl === (settings?.globalStockImageUrl || ''))}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Global Image Settings
        </Button>
      </CardFooter>
    </Card>
  );
}
