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

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

async function uploadImage(file: File, apiKey: string): Promise<string> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result.split(',')[1] || '') : reject(new Error('Unable to read image.'));
    reader.onerror = () => reject(new Error('Unable to read image.'));
    reader.readAsDataURL(file);
  });
  if (!base64) throw new Error('The selected image is empty.');
  const body = new FormData();
  body.append('image', base64);
  body.append('name', `global-product-default-${Date.now()}`);
  const response = await fetch(`https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`, { method: 'POST', body });
  const result = await response.json();
  if (!response.ok || !result?.success || !result?.data?.url) throw new Error(result?.error?.message || 'ImgBB upload failed.');
  return result.data.url;
}

export function GlobalDefaultProductImageSettings() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { settings } = useSettings();
  const { toast } = useToast();
  const [enabled, setEnabled] = React.useState(false);
  const [savedUrl, setSavedUrl] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const previewUrl = React.useMemo(() => file ? URL.createObjectURL(file) : savedUrl, [file, savedUrl]);

  React.useEffect(() => {
    setEnabled(!!settings?.useGlobalStockImage);
    setSavedUrl(settings?.globalStockImageUrl || '');
  }, [settings?.useGlobalStockImage, settings?.globalStockImageUrl]);

  React.useEffect(() => () => {
    if (previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const chooseFile = (selected?: File) => {
    if (!selected) return;
    if (!selected.type.startsWith('image/')) {
      toast({ title: 'Invalid image', description: 'Choose a valid image file.', variant: 'destructive' });
      return;
    }
    const maxMb = Number(settings?.maxFileSizeMb || 5);
    if (selected.size > maxMb * 1024 * 1024) {
      toast({ title: 'Image too large', description: `The maximum allowed size is ${maxMb} MB.`, variant: 'destructive' });
      return;
    }
    setFile(selected);
  };

  const save = async () => {
    if (!user || !firestore) {
      toast({ title: 'Cannot save', description: 'You must be signed in and connected to the settings service.', variant: 'destructive' });
      return;
    }
    if (enabled && !file && !savedUrl) {
      toast({ title: 'Image required', description: 'Upload a default product image or disable the setting.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      let url = savedUrl;
      if (file) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('An internet connection is required to upload a new image to ImgBB. Your existing saved settings remain unchanged.');
        url = await uploadImage(file, settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY);
      }
      const values = { useGlobalStockImage: enabled, globalStockImageUrl: url };
      await setDoc(doc(firestore, 'settings', 'global'), values, { merge: true });
      try {
        const cache = JSON.parse(localStorage.getItem('app_saved_settings') || '{}');
        localStorage.setItem('app_saved_settings', JSON.stringify({ ...cache, ...values }));
      } catch (error) { console.warn('[Global product image] Settings cache update failed:', error); }
      setSavedUrl(url);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      toast({ title: 'Global product image saved', description: enabled ? 'Products without their own image will use this fallback.' : 'The global fallback is disabled. Individual product images are unchanged.' });
    } catch (error) {
      toast({ title: 'Save failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const remove = () => {
    setFile(null);
    setSavedUrl('');
    if (inputRef.current) inputRef.current.value = '';
  };

  const unchanged = !file && enabled === !!settings?.useGlobalStockImage && savedUrl === (settings?.globalStockImageUrl || '');

  return <Card>
    <CardHeader>
      <div className="flex items-center gap-3">
        <ImageIcon className="h-6 w-6 text-muted-foreground" />
        <div><CardTitle>Global Default Product Image</CardTitle><CardDescription className="mt-1">Choose the shared fallback image for products without an individual image. This setting applies globally throughout the application.</CardDescription></div>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
        <div><Label htmlFor="global-default-product-image">Enable global default product image</Label><p className="mt-1 text-sm text-muted-foreground">An individual product image always takes priority. This setting never changes product records.</p></div>
        <Switch id="global-default-product-image" checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex h-36 w-36 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {previewUrl ? <Image src={previewUrl} alt="Global default product image preview" fill unoptimized className="object-cover" /> : <div className="flex flex-col items-center gap-2 text-muted-foreground"><ImageIcon className="h-8 w-8" /><span className="text-xs">No image selected</span></div>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => chooseFile(e.target.files?.[0])} />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()} disabled={saving}><Upload className="mr-2 h-4 w-4" />{previewUrl ? 'Change image' : 'Upload image'}</Button>
          {previewUrl && <Button type="button" variant="ghost" onClick={remove} disabled={saving}><X className="mr-2 h-4 w-4" />Remove</Button>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Images are hosted on ImgBB without an expiry setting. Uploading a new image requires internet access; the saved URL is also kept in the application settings cache for offline display where available.</p>
    </CardContent>
    <CardFooter className="justify-end border-t px-6 py-4">
      <Button type="button" onClick={save} disabled={saving || unchanged}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Global Image Settings</Button>
    </CardFooter>
  </Card>;
}
