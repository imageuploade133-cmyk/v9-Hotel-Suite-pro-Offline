'use client';

import * as React from 'react';
import { useFirestore, useCollection } from '@/firebase';
import { collection, query, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import type { Menu, StockCategory, StockItem } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import {
  Utensils,
  Plus,
  MoreHorizontal,
  Edit,
  Trash2,
  Loader2,
  Share,
  Copy,
  Upload,
  X,
  Eye,
  Tags,
  Search,
  QrCode,
  GitCompareArrows,
  ExternalLink
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { EmptyState } from '@/components/ui/empty-state';
import Image from 'next/image';
import { useSettings } from '@/contexts/settings-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter } from 'next/navigation';
import { MenuPreviewDialog } from '@/components/menu/menu-preview-dialog';
import { TopHeader } from '@/components/ui/top-header';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { QRCodeCanvas as QRCode } from 'qrcode.react';
import * as htmlToImage from 'html-to-image';
import { Badge } from '@/components/ui/badge';
import { SyncMenuDialog } from '@/components/menu/sync-menu-dialog';
import { uploadImage } from '@/lib/helpers';
import { Label } from '@/components/ui/label';

const menuSchema = z.object({
  name: z.string().min(1, 'Menu name is required.'),
  description: z.string().optional(),
  coverImageUrl: z.string().url().optional().or(z.literal('')),
  coverImageFile: z.instanceof(File).optional(),
});

type MenuFormValues = z.infer<typeof menuSchema>;

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

function copyText(text: string) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    document.execCommand('copy');
    console.log('Copied successfully');
  } catch (err) {
    console.error('Copy failed', err);
  }

  document.body.removeChild(textarea);
}

function MenuCard({ menu, onEdit, onDelete, onPreview, onSync, onOpenActions }: { menu: Menu & { itemCount?: number, categoryCount?: number }, onEdit: (menu: Menu) => void, onDelete: (menu: Menu) => void, onPreview: (menu: Menu) => void, onSync: (menu: Menu) => void, onOpenActions: (menu: Menu) => void }) {
    const { toast } = useToast();
    const [origin, setOrigin] = React.useState('');
    const qrCodeRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (typeof window !== 'undefined') {
            setOrigin(window.location.origin);
        }
    }, []);

    const menuUrl = origin ? `${origin}/menus/${menu.id}` : '';

    const handleCopyUrl = () => {
        if (!menuUrl) return;
        copyText(menuUrl);
        toast({
            title: 'URL Copied',
            description: 'The public URL for this menu has been copied to your clipboard.',
        });
    }

    const handleDownloadQr = () => {
        if (qrCodeRef.current === null) return;

        htmlToImage.toPng(qrCodeRef.current, { cacheBust: true, quality: 1.0, pixelRatio: 4 })
            .then((dataUrl) => {
                const link = document.createElement('a');
                link.download = `menu-qr-${menu.slug}.png`;
                link.href = dataUrl;
                link.click();
            })
            .catch((err) => {
                console.error('Failed to download QR code', err);
                toast({ variant: 'destructive', title: 'Download Failed' });
            });
    }


    const handleShare = async () => {
        if (navigator.share) {
          try {
            await navigator.share({
              title: menu.name,
              text: `Check out the ${menu.name} menu!`,
              url: menuUrl,
            });
          } catch (error) {
            console.error('Error sharing:', error);
            // Fallback to copy if share fails on some devices
            handleCopyUrl();
          }
        } else {
          // Fallback for browsers that don't support the Web Share API
          handleCopyUrl();
        }
    };


    return (
        <Card className="flex flex-col h-full">
           {menu.coverImageUrl && (
                <div className="aspect-video relative w-full">
                    <Image src={menu.coverImageUrl} alt={menu.name} fill className="object-cover rounded-t-lg" />
                </div>
            )}
            <CardHeader>
                <div className="flex items-start justify-between">
                    <div>
                        <CardTitle className="line-clamp-1" title={menu.name}>{menu.name}</CardTitle>
                        <CardDescription className="line-clamp-2 min-h-[2.5em]">
                            {menu.description || "No description provided."}
                        </CardDescription>
                        <div className="flex items-center gap-2 mt-3 flex-wrap">
                             {(menu.itemCount !== undefined) && (
                                <Badge variant="secondary" className="text-xs">
                                    {menu.itemCount} Items
                                </Badge>
                            )}
                            {(menu.categoryCount !== undefined) && (
                                <Badge variant="outline" className="text-xs">
                                    {menu.categoryCount} Categories
                                </Badge>
                            )}
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 shrink-0">
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onPreview(menu)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Live Preview
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onSync(menu)}>
                                <GitCompareArrows className="mr-2 h-4 w-4" />
                                Sync Menu
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleShare}>
                                <Share className="mr-2 h-4 w-4" />
                                Share
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleCopyUrl}>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy URL
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onEdit(menu)}>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onDelete(menu)} className="text-destructive focus:text-destructive">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Menu
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </CardHeader>

             <CardContent className="flex-grow flex flex-col items-center gap-6">
                {/* QR Code Section */}
                <div className="flex flex-col items-center justify-center w-full pt-2">
                    <div ref={qrCodeRef} className="p-3 bg-white rounded-lg border shadow-sm text-center transition-transform hover:scale-105 duration-200">
                        <QRCode value={menuUrl || 'loading...'} size={120} level="M" includeMargin />
                        <div className="mt-1 text-[10px] font-bold text-black uppercase tracking-wider truncate max-w-[120px] mx-auto">
                            {menu.name}
                        </div>
                    </div>
                </div>

                {/* URL Display Section */}
                <div className="w-full space-y-2">
                    <Label className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Public Link</Label>
                    <div className="flex items-center space-x-2">
                        <div className="relative flex-1 group">
                            <Input
                                readOnly
                                value={menuUrl}
                                className="pr-2 text-xs h-9 bg-muted/50 font-mono text-muted-foreground focus-visible:ring-1 truncate"
                                onClick={(e) => e.currentTarget.select()}
                            />
                        </div>
                        <Button
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 hover:bg-muted"
                            onClick={handleCopyUrl}
                            title="Copy to clipboard"
                        >
                            <Copy className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                            asChild
                            title="Open in new tab"
                        >
                            <a href={menuUrl} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-4 w-4" />
                            </a>
                        </Button>
                    </div>
                </div>
            </CardContent>

            <CardFooter className="grid grid-cols-2 gap-3">
                 <Button variant="outline" className="w-full text-xs" onClick={handleDownloadQr}>
                    <QrCode className="mr-2 h-3 w-3" /> Save QR
                </Button>
                 <Button asChild className="w-full text-xs">
                    <Link href={`/menu-editor/${menu.id}`}>
                        <Edit className="mr-2 h-3 w-3" /> Edit Items
                    </Link>
                </Button>
            </CardFooter>
        </Card>
    );
}

function MenuFormDialog({
  open,
  onOpenChange,
  onSuccess,
  menu,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newMenuId?: string) => void;
  menu: Menu | null;
}) {
  const isEditMode = !!menu;
  const [isSaving, setIsSaving] = React.useState(false);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { settings } = useSettings();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const expirationSeconds = settings?.expirationSeconds ?? 0;
  const imgbbApiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
  const maxFileSize = settings?.maxFileSizeMb ?? 5;


  const form = useForm<MenuFormValues>({
    resolver: zodResolver(menuSchema),
    defaultValues: {
      name: '',
      description: '',
      coverImageUrl: '',
    },
  });

  React.useEffect(() => {
    if (open) {
        if (menu) {
        form.reset({
            name: menu.name,
            description: menu.description,
            coverImageUrl: menu.coverImageUrl,
        });
        } else {
        form.reset({
            name: '',
            description: '',
            coverImageUrl: '',
            coverImageFile: undefined,
        });
        }
    }
  }, [menu, form, open]);

  const coverImageFile = form.watch('coverImageFile');
  const coverImageUrl = form.watch('coverImageUrl');
  const imagePreview = coverImageFile ? URL.createObjectURL(coverImageFile) : coverImageUrl;

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
        const file = files[0];
        if (file.size > maxFileSize * 1024 * 1024) {
            toast({
                variant: 'destructive',
                title: 'File Too Large',
                description: `${file.name} is larger than the allowed ${maxFileSize}MB.`
            });
            return;
        }
        form.setValue('coverImageFile', file, { shouldDirty: true });
    }
  };

  const handleRemoveImage = () => {
    form.setValue('coverImageFile', undefined, { shouldDirty: true });
    form.setValue('coverImageUrl', '', { shouldDirty: true });
    if(fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  const handleDragEvents = {
    onDragEnter: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); },
    onDragOver: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); },
    onDragLeave: (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(false); },
    onDrop: (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFileSelect(e.dataTransfer.files);
      }
    },
  };


  const onSubmit = async (data: MenuFormValues) => {
    if (!firestore) return;

    setIsSaving(true);
    try {
        let finalCoverImageUrl = data.coverImageUrl;

        if (data.coverImageFile) {
            toast({ title: 'Uploading Cover Image...', description: 'Please wait.' });
            const timestamp = Date.now();
            const safeMenuName = data.name.replace(/\s+/g, '_');
            const photoName = `menu-cover-${safeMenuName}_${timestamp}`;
            finalCoverImageUrl = await uploadImage(data.coverImageFile, imgbbApiKey, photoName, expirationSeconds);
        }

        const menuData = {
            name: data.name,
            description: data.description,
            coverImageUrl: finalCoverImageUrl,
        };

      if (isEditMode) {
        const menuRef = doc(firestore, 'menus', menu!.id);
        await updateDoc(menuRef, menuData);
        toast({ title: 'Menu Updated', description: `"${data.name}" has been updated.` });
        onSuccess();
      } else {
        const slug = data.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const docRef = await addDoc(collection(firestore, 'menus'), { ...menuData, slug, createdAt: serverTimestamp() });
        toast({ title: 'Menu Created', description: `"${data.name}" has been created.` });
        onSuccess(docRef.id);
      }
      onOpenChange(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Menu' : 'Create New Menu'}</DialogTitle>
          <DialogDescription>
            {isEditMode ? 'Update the details for this menu.' : 'Give your new menu a name and an optional description.'}
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] -mx-6 px-6">
            <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="menu-form">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Menu Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Summer Specials" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="A short description of this menu." {...field} value={field.value || ''}/></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <FormItem>
                    <FormLabel>Cover Image (Optional)</FormLabel>
                    {imagePreview ? (
                         <div className="relative group w-full aspect-video">
                            <Image
                                src={imagePreview}
                                alt="Cover image preview"
                                fill
                                style={{ objectFit: 'cover' }}
                                className="rounded-md"
                            />
                             <div className="absolute inset-0 bg-black/40 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Button type="button" variant="destructive" size="icon" onClick={handleRemoveImage}>
                                    <X className="h-5 w-5" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                         <div
                            className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/10' : 'border-input hover:border-primary/50'}`}
                            {...handleDragEvents}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Upload className="w-8 h-8 text-muted-foreground" />
                            <p className="mt-2 text-sm text-muted-foreground"><span className="font-semibold text-primary">Click to upload</span> or drag and drop</p>
                            <p className="text-xs text-muted-foreground">PNG, JPG up to {maxFileSize}MB</p>
                        </div>
                    )}
                    <FormControl>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png, image/jpeg"
                            className="hidden"
                            onChange={(e) => handleFileSelect(e.target.files)}
                        />
                    </FormControl>
                </FormItem>
            </form>
            </Form>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
          <Button type="submit" form="menu-form" loading={isSaving}>
            {isEditMode ? 'Save Changes' : 'Create Menu'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AuthenticatedMenusPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = React.useState(false);
  const [editingMenu, setEditingMenu] = React.useState<Menu | null>(null);
  const [deletingMenu, setDeletingMenu] = React.useState<Menu | null>(null);
  const [previewingMenu, setPreviewingMenu] = React.useState<Menu | null>(null);
  const [syncingMenu, setSyncingMenu] = React.useState<Menu | null>(null);
  const [reloadCounter, setReloadCounter] = React.useState(0);
  const [searchTerm, setSearchTerm] = React.useState('');
  const [actionsMenu, setActionsMenu] = React.useState<Menu | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = React.useState('');
  const CONFIRM_DELETE_TEXT = "DELETE";


  const [menusWithCounts, setMenusWithCounts] = React.useState<(Menu & { itemCount?: number, categoryCount?: number })[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const menusQuery = React.useMemo(() => {
    return firestore ? query(collection(firestore, 'menus')) : null;
  }, [firestore, reloadCounter]);
  const { data: menus } = useCollection<Menu>(menusQuery);

  React.useEffect(() => {
    if (!menus || !firestore) {
      setIsLoading(menus === undefined);
      return;
    }

    const fetchCounts = async () => {
      setIsLoading(true);
      const menusWithCounts = await Promise.all(
        menus.map(async (menu) => {
          const itemsColRef = collection(firestore, `menus/${menu.id}/items`);
          const itemsSnapshot = await getDocs(query(itemsColRef));

          const categoriesColRef = collection(firestore, `menus/${menu.id}/categories`);
          const categoriesSnapshot = await getDocs(query(categoriesColRef));

          return {
            ...menu,
            itemCount: itemsSnapshot.size,
            categoryCount: categoriesSnapshot.size,
          };
        })
      );
      setMenusWithCounts(menusWithCounts);
      setIsLoading(false);
    };

    fetchCounts();
  }, [menus, firestore]);

  const { isLoading: areMenusLoading } = useCollection<Menu>(menusQuery);


  const filteredMenus = React.useMemo(() => {
    if (!menusWithCounts) return [];
    if (!searchTerm) return menusWithCounts;
    return menusWithCounts.filter(menu =>
      menu.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (menu.description && menu.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [menusWithCounts, searchTerm]);

  const handleCreate = () => {
    setEditingMenu(null);
    setIsFormOpen(true);
  };

  const handleEdit = (menu: Menu) => {
    setEditingMenu(menu);
    setIsFormOpen(true);
  };

  const handleDelete = (menu: Menu) => {
    setDeletingMenu(menu);
  };

  const handlePreview = (menu: Menu) => {
    setPreviewingMenu(menu);
  }

  const handleSync = (menu: Menu) => {
    setSyncingMenu(menu);
  };

  const handleOpenActions = (menu: Menu) => {
    setActionsMenu(menu);
  };


  const handleSuccess = (newMenuId?: string) => {
    setReloadCounter(c => c + 1);
    if (newMenuId) {
        router.push(`/menu-editor/${newMenuId}`);
    }
  };

  const confirmDelete = async () => {
    if (!firestore || !actionsMenu) return;

    try {
      await deleteDoc(doc(firestore, 'menus', actionsMenu.id));
      // Note: Deleting subcollections (the items and categories) should ideally be handled by a Cloud Function.
      // This client-side delete only removes the menu document itself.
      toast({
        variant: 'success',
        title: 'Menu Deleted',
        description: `The menu "${actionsMenu.name}" has been permanently deleted.`,
      });
      handleModalClose();
      setReloadCounter(c => c + 1);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error Deleting Role',
        description: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  const router = useRouter();

   const handleModalClose = () => {
    setActionsMenu(null);
    setShowDeleteConfirm(false);
    setDeleteConfirmText('');
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <TopHeader name="Manage Menus" icon={<Utensils />} />
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" /> New Menu
          </Button>
        </div>

        <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
                placeholder="Search menus..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <Skeleton className="aspect-video w-full rounded-t-lg" />
                <CardHeader>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </CardHeader>
                <CardFooter>
                  <Skeleton className="h-10 w-full" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : filteredMenus && filteredMenus.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMenus.map((menu) => (
              <MenuCard key={menu.id} menu={menu} onEdit={handleEdit} onDelete={handleDelete} onPreview={handlePreview} onSync={handleSync} onOpenActions={handleOpenActions} />
            ))}
          </div>
        ) : (
             <EmptyState
                icon={Utensils}
                title={searchTerm ? "No Menus Found" : "No Menus Created"}
                description={searchTerm ? `Your search for "${searchTerm}" did not return any results.` : "Get started by creating your first menu."}
                className="h-[60vh]"
            >
                {!searchTerm && (
                    <Button onClick={handleCreate} className="mt-4">
                        <Plus className="mr-2 h-4 w-4" /> Create Menu
                    </Button>
                )}
            </EmptyState>
        )}
      </div>

      <MenuFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSuccess={handleSuccess}
        menu={editingMenu}
      />

       <AlertDialog open={!!deletingMenu} onOpenChange={(open) => !open && setDeletingMenu(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the menu "{deletingMenu?.name}" and all of its items. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {syncingMenu && (
        <SyncMenuDialog
          open={!!syncingMenu}
          onOpenChange={() => setSyncingMenu(null)}
          sourceMenu={syncingMenu}
          allMenus={menus || []}
          onSuccess={handleSuccess}
        />
      )}

      {previewingMenu && (
        <MenuPreviewDialog
            open={!!previewingMenu}
            onOpenChange={() => setPreviewingMenu(null)}
            menuId={previewingMenu.id}
        />
      )}
      <Dialog open={!!actionsMenu} onOpenChange={handleModalClose}>
        <DialogContent>
            {actionsMenu && (
                 <>
                    <DialogHeader>
                        <DialogTitle>{showDeleteConfirm ? 'Confirm Deletion' : `Actions for "${actionsMenu.name}"`}</DialogTitle>
                        {!showDeleteConfirm && <DialogDescription>{actionsMenu.description || 'No description available.'}</DialogDescription>}
                    </DialogHeader>

                    {!showDeleteConfirm ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                        <Button
                            variant="outline"
                            onClick={() => {
                            if (actionsMenu) handlePreview(actionsMenu);
                            setActionsMenu(null);
                            }}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            Live Preview
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href={`/menu-editor/${actionsMenu!.id}/categories`}>
                                <Tags className="mr-2 h-4 w-4" />
                                Manage Categories
                            </Link>
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                            if (actionsMenu) handleSync(actionsMenu);
                            setActionsMenu(null);
                            }}
                        >
                            <GitCompareArrows className="mr-2 h-4 w-4" />
                            Sync Menu
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                if (actionsMenu) handleEdit(actionsMenu);
                                setActionsMenu(null);
                            }}
                            >
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Details
                        </Button>
                        <Button
                            variant="destructive"
                            className="md:col-span-2"
                            onClick={() => setShowDeleteConfirm(true)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Menu
                        </Button>
                        </div>
                    ) : (
                        <div className="py-4 space-y-4">
                        <DialogDescription>
                            This action cannot be undone. This will permanently delete the menu "{actionsMenu?.name}" and all of its items. Please confirm.
                        </DialogDescription>
                        <div>
                            <Label htmlFor="delete-confirm" className="text-destructive font-semibold">Type "{CONFIRM_DELETE_TEXT}" to confirm.</Label>
                            <Input
                                id="delete-confirm"
                                value={deleteConfirmText}
                                onChange={(e) => setDeleteConfirmText(e.target.value)}
                                autoComplete="off"
                            />
                        </div>
                        </div>
                    )}

                    <DialogFooter>
                        {!showDeleteConfirm ? (
                        <Button variant="ghost" onClick={handleModalClose}>Close</Button>
                        ) : (
                        <>
                            <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Go Back</Button>
                            <Button
                            variant="destructive"
                            onClick={() => {
                                confirmDelete();
                                handleModalClose();
                                }
                            }
                            disabled={deleteConfirmText !== CONFIRM_DELETE_TEXT}
                            >
                            Confirm Deletion
                            </Button>
                        </>
                        )}
                    </DialogFooter>
                 </>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}

const MenusPage = withAuth(AuthenticatedMenusPage, PagePermission.VIEW_MENUS_PAGE);
export default MenusPage;