'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useFirestore } from '../../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useSettings } from '../../../contexts/settings-context';
import { sendWhatsAppMessage } from '../../../lib/whatsapp';
import type { Booking } from '../../../lib/types';

import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Textarea } from '../../../components/ui/textarea';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { useToast } from '../../../hooks/use-toast';
import { Badge } from '../../../components/ui/badge';
import { ImageUploadFiles } from '../../../components/ui/image-upload-files';
import { Alert, AlertDescription } from '../../../components/ui/alert';

import { Loader2, Send, CheckCircle, AlertTriangle, User, Phone, MessageSquare, Lock, MapPin, Clock, Building2, Sparkles, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '../../../components/ui/skeleton';
import Image from 'next/image';
import { cn } from '../../../lib/utils';
import { uploadImage } from '../../../lib/helpers';

export interface ImageUploadProgress {
    total: number;
    uploaded: number;
    failed: number;
}

const DEFAULT_IMGBB_API_KEY = '162d7a9c40da4493e504e77f14e5efb4';

export default function GuestReportClientPage() {
    const searchParams = useSearchParams();
    const firestore = useFirestore();
    const { toast } = useToast();
    const { settings } = useSettings();

    const [reportMessage, setReportMessage] = React.useState('');
    const [guestName, setGuestName] = React.useState('');
    const [phoneNumber, setPhoneNumber] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isSubmitted, setIsSubmitted] = React.useState(false);
    const [isLoadingGuest, setIsLoadingGuest] = React.useState(true);
    const [selectedImages, setSelectedImages] = React.useState<File[]>([]);
    const [uploadedImageUrls, setUploadedImageUrls] = React.useState<string[]>([]);
    const [isUploading, setIsUploading] = React.useState(false);
    const [uploadProgress, setUploadProgress] = React.useState<ImageUploadProgress | null>(null);

    const roomNumber = searchParams.get('room');

    const quickActions = React.useMemo(() => [
        'AC not working',
        'No hot water',
        'Need extra towels',
        'Room cleaning',
        'WiFi issue',
        'TV not working',
    ], []);

    React.useEffect(() => {
        const fetchActiveBooking = async () => {
            if (!firestore || !roomNumber) {
                setIsLoadingGuest(false);
                return;
            };

            setIsLoadingGuest(true);
            try {
                const bookingsRef = collection(firestore, 'bookings');
                const q = query(bookingsRef,
                    where('roomNumber', '==', roomNumber),
                    where('status', 'in', ['Active', 'Checked-in'])
                );

                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const bookingDoc = querySnapshot.docs[0];
                    const bookingData = bookingDoc.data() as Booking;
                    setGuestName(bookingData.guestName);
                    setPhoneNumber(bookingData.guestPhoneNumber || '');
                }
            } catch (error) {
                console.error("Error fetching active booking: ", error);
            } finally {
                setIsLoadingGuest(false);
            }
        };

        fetchActiveBooking();
    }, [firestore, roomNumber]);


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!firestore || !roomNumber || !reportMessage.trim()) {
            toast({
                variant: 'destructive',
                title: 'Submission Failed',
                description: 'Message is empty or room number is missing. Please try again.',
            });
            return;
        }

        setIsSubmitting(true);
        try {
            // Upload images first if any are selected
            let imageUrls: string[] = [];
            if (selectedImages.length > 0) {
                try {
                    imageUrls = await uploadImagesToImgbb();
                } catch (error) {
                    console.error('Image upload failed:', error);
                    toast({
                        variant: 'destructive',
                        title: 'Image Upload Failed',
                        description: 'Report will be sent without images. You can describe the issue in detail.',
                    });
                    // Continue without images rather than failing completely
                    imageUrls = [];
                }
            }

            // Save report to Firestore
            const reportData = {
                roomNumber,
                reportMessage: reportMessage.trim(),
                guestName: guestName.trim() || 'Occupied Room',
                phoneNumber: phoneNumber.trim(),
                images: imageUrls,
                imageCount: imageUrls.length,
                reportedAt: serverTimestamp(),
                status: 'new',
            };

            await addDoc(collection(firestore, 'guestReports'), reportData);

            // Send WhatsApp notification with images
            const alertPhoneNumber = settings?.stockAlertPhoneNumber;
            if (alertPhoneNumber) {
                let notificationMessage = `New Guest Report from Room ${roomNumber}:\n\n*Guest:* ${guestName.trim() || 'Occupied Room'}\n*Phone:* ${phoneNumber.trim() || 'Not provided'}\n*Report:* "${reportMessage.trim()}"`;

                if (imageUrls.length > 0) {
                    notificationMessage += `\n\n*Images:* ${imageUrls.length} image(s) attached`;
                    notificationMessage += `\n\nView images: ${imageUrls.join('\n')}`;
                }

                try {
                    await sendWhatsAppMessage({
                        phone: alertPhoneNumber,
                        message: notificationMessage,
                        senderName: 'Guest Reporter',
                    });
                } catch (whatsappError) {
                    console.error('WhatsApp notification failed:', whatsappError);
                    // Don't fail the entire submission if WhatsApp fails
                }
            }

            setIsSubmitted(true);
            toast({
                variant: 'success',
                title: 'Report Sent!',
                description: 'Thank you! Your report has been received by our team.',
            });

        } catch (error) {
            console.error("Error submitting report: ", error);
            toast({
                variant: 'destructive',
                title: 'Submission Error',
                description: 'We could not submit your report at this time. Please find a staff member.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleQuickAction = (action: string) => {
        setReportMessage(prev => prev ? `${prev}\n${action}` : action);
    };

    // Handle image file changes from ImageUpload component
    const handleImagesChange = React.useCallback((files: File[]) => {
        setSelectedImages(files);
    }, []);

    const uploadImagesToImgbb = React.useCallback(async () => {
        if (selectedImages.length === 0) {
            return [];
        }

        setIsUploading(true);
        setUploadProgress({
            total: selectedImages.length,
            uploaded: 0,
            failed: 0,
        });

        try {
            const apiKey = settings?.imgbbApiKey || DEFAULT_IMGBB_API_KEY;
            const expirationSeconds = settings?.expirationSeconds || 0;
            const uploadedUrls: string[] = [];

            // Upload images sequentially to imgbb
            for (let i = 0; i < selectedImages.length; i++) {
                const file = selectedImages[i];
                try {
                    const imageName = `guest-report-room-${roomNumber}-${Date.now()}-${i}`;
                    const url = await uploadImage(file, apiKey, imageName, expirationSeconds > 0 ? expirationSeconds : undefined);
                    uploadedUrls.push(url);

                    setUploadProgress({
                        total: selectedImages.length,
                        uploaded: i + 1,
                        failed: 0,
                    });
                } catch (error) {
                    console.error(`Error uploading image ${i + 1}:`, error);
                    setUploadProgress(prev => ({
                        total: selectedImages.length,
                        uploaded: prev?.uploaded || i,
                        failed: (prev?.failed || 0) + 1,
                    }));
                }
            }

            setUploadedImageUrls(uploadedUrls);
            return uploadedUrls;

        } catch (error) {
            console.error('Error uploading images:', error);
            throw error;
        } finally {
            setIsUploading(false);
            setUploadProgress(null);
        }
    }, [selectedImages, roomNumber, settings]);

    const renderGuestInfoSkeleton = () => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-11 w-full" />
            </div>
            <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-11 w-full" />
            </div>
        </div>
    );

    if (!roomNumber) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-red-50 to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-red-950 p-4">
                <Card className="w-full max-w-lg text-center shadow-2xl border-2 border-destructive/20">
                    <CardHeader className="space-y-4">
                        <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
                            <AlertTriangle className="h-10 w-10 text-destructive" />
                        </div>
                        <CardTitle className="text-2xl font-bold">Room Not Found</CardTitle>
                        <CardDescription className="text-base">
                            We couldn&apos;t identify your room. Please scan the QR code in your room again or contact the front desk.
                        </CardDescription>
                    </CardHeader>
                </Card>
            </div>
        )
    }

    if (isSubmitted) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-slate-950 dark:via-emerald-950/20 dark:to-teal-950/20 p-4">
                <Card className="w-full max-w-lg text-center shadow-2xl border-2 border-green-500/20 animate-in fade-in zoom-in-95 duration-500">
                    <CardHeader className="space-y-4">
                        <div className="mx-auto w-24 h-24 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
                            <CheckCircle className="h-12 w-12 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                                Report Received!
                            </CardTitle>
                            <CardDescription className="text-lg mt-2">
                                Thank you for letting us know
                                {uploadedImageUrls.length > 0 && (
                                    <span className="block text-sm mt-1">
                                        Images have been successfully uploaded and sent to our team
                                    </span>
                                )}
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-6 bg-muted/50 rounded-xl space-y-2">
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <MapPin className="h-4 w-4" />
                                <span>Room {roomNumber}</span>
                            </div>
                            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                <Clock className="h-4 w-4" />
                                <span>{new Date().toLocaleTimeString()}</span>
                            </div>
                            {uploadedImageUrls.length > 0 && (
                                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                    <ImageIcon className="h-4 w-4" />
                                    <span>{uploadedImageUrls.length} Image{uploadedImageUrls.length > 1 ? 's' : ''} attached</span>
                                </div>
                            )}
                        </div>

                        {/* Show uploaded images in success screen */}
                        {uploadedImageUrls.length > 0 && (
                            <div className="space-y-2">
                                <Label className="text-sm text-muted-foreground text-center block">
                                    Attached Images
                                </Label>
                                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                                    {uploadedImageUrls.slice(0, 3).map((url, index) => (
                                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                                            <img
                                                src={url}
                                                alt={`Report image ${index + 1}`}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    ))}
                                    {uploadedImageUrls.length > 3 && (
                                        <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted flex items-center justify-center">
                                            <span className="text-xs text-muted-foreground font-medium">
                                                +{uploadedImageUrls.length - 3}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        <p className="text-muted-foreground leading-relaxed">
                            Our team has been notified and will attend to your request as soon as possible.
                        </p>
                    </CardContent>
                    <CardFooter>
                        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70 w-full">
                            <Sparkles className="h-3 w-3" />
                            <span>We appreciate your feedback</span>
                            <Sparkles className="h-3 w-3" />
                        </div>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-4">
            <div className="w-full max-w-xl mx-auto">
                <Card className="shadow-2xl overflow-hidden border-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
                    <CardHeader className="text-center space-y-4 pb-8 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b">
                        {settings?.businessLogoUrl ? (
                            <div className="relative inline-block">
                                <Image
                                    src={settings.businessLogoUrl}
                                    alt={`${settings.businessName || 'Business'} Logo`}
                                    width={100}
                                    height={100}
                                    className="h-24 w-24 rounded-2xl object-contain border-4 border-white shadow-xl bg-white"
                                    priority
                                />
                            </div>
                        ) : (
                            <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-xl">
                                <Building2 className="h-10 w-10 text-white" />
                            </div>
                        )}
                        <div className="space-y-2">
                            <CardTitle className="text-3xl font-extrabold tracking-tight">
                                {settings?.businessName || 'Guest Services'}
                            </CardTitle>
                            <CardDescription className="text-base">
                                Need assistance? We're here to help you with Room{' '}
                                <Badge variant="secondary" className="mx-1 text-sm font-semibold px-2 py-0.5">
                                    {roomNumber}
                                </Badge>
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <form onSubmit={handleSubmit}>
                        <CardContent className="p-6 md:p-8 space-y-6">
                            <p className="text-center text-muted-foreground text-sm leading-relaxed">
                                Your comfort is our priority. Let us know about any issue and we'll take care of it right away.
                            </p>

                            {isLoadingGuest ? (
                                renderGuestInfoSkeleton()
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="guest-name" className="text-sm font-medium">Guest Name</Label>
                                        <div className="relative group">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                id="guest-name"
                                                value={guestName || 'Checked-in Guest'}
                                                className="pl-10 font-medium bg-muted/50"
                                                readOnly
                                                disabled
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                                <Lock className="h-3.5 w-3.5 text-muted-foreground/40" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone-number" className="text-sm font-medium">Phone (Optional)</Label>
                                        <div className="relative group">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                            <Input
                                                id="phone-number"
                                                type="tel"
                                                placeholder="Your contact number"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                className="pl-10"
                                                disabled={isSubmitting}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="report-message" className="text-sm font-medium">
                                        Describe the Issue
                                    </Label>
                                    <span className="text-xs text-muted-foreground">Required</span>
                                </div>
                                <div className="relative group">
                                    <MessageSquare className="absolute left-3 top-4 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                    <Textarea
                                        id="report-message"
                                        placeholder="Please describe the issue in detail. For example: 'The AC is not cooling properly' or 'I would like extra towels delivered.'"
                                        value={reportMessage}
                                        onChange={(e) => setReportMessage(e.target.value)}
                                        required
                                        rows={4}
                                        className="pl-10 resize-none"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-medium text-muted-foreground">Quick Select</Label>
                                <div className="flex flex-wrap gap-2">
                                    {quickActions.map((action) => (
                                        <Button
                                            key={action}
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleQuickAction(action)}
                                            disabled={isSubmitting}
                                            className="text-xs h-8 px-3 transition-all hover:scale-105"
                                        >
                                            {action}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* Image Upload Section */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label className="text-sm font-medium">
                                        Add Images (Optional)
                                    </Label>
                                    <Badge variant="secondary" className="text-xs">
                                        <ImageIcon className="mr-1 h-3 w-3" />
                                        Help us see the issue
                                    </Badge>
                                </div>

                                <ImageUploadFiles
                                    onFilesChange={handleImagesChange}
                                    maxImages={5}
                                    disabled={isSubmitting || isUploading}
                                    className="w-full"
                                />

                                {/* Upload Progress */}
                                {isUploading && uploadProgress && (
                                    <Alert>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <AlertDescription>
                                            Uploading {uploadProgress.uploaded + uploadProgress.failed} of {uploadProgress.total} images...
                                            {uploadProgress.failed > 0 && (
                                                <span className="text-destructive">
                                                    {' '}({uploadProgress.failed} failed)
                                                </span>
                                            )}
                                        </AlertDescription>
                                    </Alert>
                                )}

                                {/* Uploaded Images Preview */}
                                {uploadedImageUrls.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-sm text-muted-foreground">
                                            Uploaded Images ({uploadedImageUrls.length})
                                        </Label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {uploadedImageUrls.map((url, index) => (
                                                <div key={index} className="relative aspect-square rounded-lg overflow-hidden border">
                                                    <img
                                                        src={url}
                                                        alt={`Uploaded ${index + 1}`}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <p className="text-xs text-muted-foreground">
                                    Take a photo or upload images to help our team better understand the issue.
                                    Maximum 5 images, 5MB each.
                                </p>
                            </div>
                        </CardContent>
                        <CardFooter className="p-6 pt-0">
                            <Button
                                type="submit"
                                className={cn(
                                    "w-full text-base py-6 shadow-lg shadow-primary/25",
                                    "hover:shadow-primary/40 hover:scale-[1.02]",
                                    "active:scale-[0.98]",
                                    "transition-all duration-200"
                                )}
                                disabled={isSubmitting || isUploading || !reportMessage.trim()}
                            >
                                {(isSubmitting || isUploading) ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        {isUploading ? (
                                            `Uploading Images${uploadProgress ? ` (${uploadProgress.uploaded}/${uploadProgress.total})` : ''}...`
                                        ) : (
                                            'Submitting Report...'
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <Send className="mr-2 h-5 w-5" />
                                        Submit Report{selectedImages.length > 0 ? ` +${selectedImages.length} Image${selectedImages.length > 1 ? 's' : ''}` : ''}
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>

                <p className="text-center text-xs text-muted-foreground/70 mt-6">
                    Your report will be sent to our team immediately
                </p>
            </div>
        </main>
    );
}
