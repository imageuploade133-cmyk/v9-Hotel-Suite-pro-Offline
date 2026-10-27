
'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Settings, SearchX } from 'lucide-react';
import { SettingsNavigation } from '@/components/settings/settings-navigation';
import { EmptyState } from '@/components/ui/empty-state';

// Import all settings components
import { ProfileForm } from '@/components/auth/profile-form';
import { UpdatePasswordForm } from '@/components/auth/update-password-form';
import { BusinessInformationForm } from '@/components/settings/business-information-form';
import { LocalizationForm } from '@/components/settings/localization-form';
import { ThemeCustomizerForm } from '@/components/settings/theme-customizer-form';
import { HotelPolicyForm } from '@/components/settings/hotel-policy-form';
import { CancellationPolicyForm } from '@/components/settings/cancellation-policy-form';
import { CalendarColorForm } from '@/components/settings/calendar-color-form';
import { TagManagement } from '@/components/settings/tag-management';
import { GymSettingsForm } from '@/components/settings/gym-settings-form';
import { ImageUploadSettings } from '@/components/settings/image-upload-settings';
import { DangerZone } from '@/components/settings/danger-zone';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Book, Building2, User, KeyRound, Languages, Palette, Clock, FileX, Bed, CreditCard, ImageIcon, AlertTriangle, Dumbbell, Wifi, Tags, Server, Globe, AppWindow, WashingMachine, Scissors, Bell, Star, Package, Percent, Receipt, Settings2 } from 'lucide-react';
import { DocketReceiptSettingsForm } from '@/components/settings/docket-receipt-settings-form';
import { RewardReceiptSettingsForm } from '@/components/settings/reward-receipt-settings-form';
import { AttendancePolicyForm } from '@/components/settings/attendance-policy-form';
import { DeploymentSettingsForm } from '@/components/settings/deployment-settings-form';
import { ApiSettingsForm } from '@/components/settings/api-settings';
import { SalonSettings } from '@/components/settings/salon-settings';
import { LaundrySettings } from '@/components/settings/laundry-settings';
import { NotificationSettingsForm } from '@/components/settings/notification-settings-form';
import { SignatureRoomManagement } from '@/components/settings/signature-room-management';
import { InventoryPolicyForm } from '@/components/settings/inventory-policy-form';
import { Accordion } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import Link from 'next/link';


const settingsSections = [
    {
        group: 'General',
        items: [
            { id: 'profile', title: 'Your Profile', icon: User, component: <ProfileForm />, permission: PagePermission.MANAGE_OWN_PROFILE },
            { id: 'password', title: 'Change Password', icon: KeyRound, component: <UpdatePasswordForm />, permission: PagePermission.MANAGE_OWN_PROFILE },
            { id: 'business-info', title: 'Business Information', icon: Building2, component: <BusinessInformationForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'localization', title: 'Currency & Region', icon: Languages, component: <LocalizationForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'theme', title: 'Theme', icon: Palette, component: <ThemeCustomizerForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
        ]
    },
    {
        group: 'Hotel & Rooms',
        items: [
            { id: 'hotel-policy', title: 'Hotel Policy', icon: Clock, component: <HotelPolicyForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'inventory-policy', title: 'Inventory Policy', icon: Package, component: <InventoryPolicyForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'cancellation-policy', title: 'Invoice Text', icon: FileX, component: <CancellationPolicyForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'calendar-colors', title: 'Calendar Colors', icon: Palette, component: <CalendarColorForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'booking-form-fields', title: 'Custom Booking Fields', icon: Book, component: (
                <Card>
                    <CardHeader>
                    <CardTitle>Custom Booking Fields</CardTitle>
                    <CardDescription>Add custom fields to the new booking form to collect more information.</CardDescription>
                    </CardHeader>
                    <CardContent>
                    <TagManagement
                        title="Booking Form Fields"
                        description="Define extra text fields to show on the booking/check-in form."
                        collectionName="bookingFormFields"
                        icon={Book}
                    />
                    </CardContent>
                </Card>
            ), permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'room-management', title: 'Room Management', icon: Bed, component: (
                <Card>
                    <CardHeader>
                    <CardTitle>Room Management</CardTitle>
                    <CardDescription>Manage room categories, facilities, and statuses.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                    <TagManagement
                        title="Room Facilities"
                        description="Define the facilities and amenities available in rooms (e.g., Wi-Fi, TV)."
                        collectionName="roomFacilities"
                        icon={Wifi}
                    />
                    <Separator />
                    <TagManagement
                        title="Room Statuses"
                        description="Define custom statuses for rooms (e.g., Needs Deep Clean, Inspection Required)."
                        collectionName="roomStatuses"
                        icon={Tags}
                    />
                    </CardContent>
                </Card>
            ), permission: PagePermission.MANAGE_GENERAL_SETTINGS },
             { id: 'signature-rooms', title: 'Signature Rooms', icon: Star, component: <SignatureRoomManagement />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
        ]
    },
    {
        group: 'Services',
        items: [
            { id: 'gym-management', title: 'Gym Management', icon: Dumbbell, component: <GymSettingsForm />, permission: PagePermission.MANAGE_GYM_MEMBERS },
            { id: 'salon-management', title: 'Salon Management', icon: Scissors, component: <SalonSettings />, permission: PagePermission.VIEW_SALON_PAGE },
            { id: 'laundry-management', title: 'Laundry Management', icon: WashingMachine, component: <LaundrySettings />, permission: PagePermission.VIEW_LAUNDRY_PAGE },
        ]
    },
    {
        group: 'Staff',
        items: [
            { id: 'attendance-policy', title: 'Attendance Policy', icon: Clock, component: <AttendancePolicyForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
        ],
    },
    {
        group: 'Administration',
        items: [
            { id: 'notifications', title: 'Notification Settings', icon: Bell, component: <NotificationSettingsForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'financial', title: 'Financial Settings', icon: CreditCard, component: (
                <Card>
                    <CardHeader>
                    <CardTitle>Financial Settings</CardTitle>
                    <CardDescription>Manage payment methods and receipt text.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                    <TagManagement
                        title="Payment Methods"
                        description="Define the accepted payment methods for bookings and services (e.g., Credit Card, Cash)."
                        collectionName="paymentMethods"
                        icon={CreditCard}
                    />
                    <Separator />
                    <DocketReceiptSettingsForm />
                    <Separator />
                    <RewardReceiptSettingsForm />
                    </CardContent>
                </Card>
            ), permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'pos-settings', title: 'POS Receipt Settings', icon: Receipt, component: (
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <Receipt className="h-6 w-6 text-muted-foreground" />
                            <div>
                                <CardTitle>POS Receipt Settings</CardTitle>
                                <CardDescription>Customize your Point of Sale receipts and invoices.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <p className="text-sm text-muted-foreground mb-4">
                            Configure receipt logos, header/footer text, tax settings, and print options for your POS system.
                        </p>
                        <Button asChild>
                            <Link href="/pos/settings">
                                <Receipt className="mr-2 h-4 w-4" />
                                Open POS Settings
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ), permission: PagePermission.MANAGE_POS_SETTINGS },
            { id: 'image-uploads', title: 'Image Uploads', icon: ImageIcon, component: <ImageUploadSettings />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'deployment', title: 'Deployment Mode', icon: Server, component: <DeploymentSettingsForm />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
            { id: 'danger-zone', title: 'Danger Zone', icon: AlertTriangle, component: <DangerZone />, permission: PagePermission.MANAGE_GENERAL_SETTINGS },
        ]
    }
];

function SettingsContent() {
    const searchParams = useSearchParams();
    const [searchTerm, setSearchTerm] = React.useState('');
    const activeTab = searchParams.get('tab') || 'business-info';

    const ActiveComponent =
        settingsSections.flatMap(g => g.items).find(item => item.id === activeTab)?.component || null;

    return (
        <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Settings className="h-10 w-10 text-primary" />
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
                        <p className="text-muted-foreground">
                            Manage your account and application settings.
                        </p>
                    </div>
                </div>
                 <Button asChild>
                    <Link href="/settings/page2">
                        <Settings2 className="mr-2 h-4 w-4" />
                        Go to Settings Page 2
                    </Link>
                </Button>
            </div>
            <Separator className="my-6" />

            <div className="grid flex-1 grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-[250px_1fr] overflow-hidden">
               <aside className="w-full md:w-64 lg:w-72">
                  <div className="sticky top-20">
                    <SettingsNavigation
                        sections={settingsSections}
                        searchTerm={searchTerm}
                        onSearchChange={setSearchTerm}
                    />
                  </div>
                </aside>

                <main className="overflow-y-auto pr-6">
                    {ActiveComponent ? (
                        <section id={activeTab} className="scroll-mt-20">
                            {ActiveComponent}
                        </section>
                    ) : (
                        <div className="pt-10">
                            <EmptyState
                                icon={SearchX}
                                title="Settings Not Found"
                                description={`The settings tab "${activeTab}" does not exist.`}
                            />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function SettingsPage() {
    return (
        <React.Suspense fallback={<div>Loading settings...</div>}>
            <SettingsContent />
        </React.Suspense>
    )
}

export default withAuth(SettingsPage, PagePermission.VIEW_SETTINGS_PAGE);
