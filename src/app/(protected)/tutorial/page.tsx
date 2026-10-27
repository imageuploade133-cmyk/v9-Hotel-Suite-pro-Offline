
'use client';

import * as React from 'react';
import withAuth from '@/components/auth/withAuth';
import { PagePermission } from '@/lib/permissions';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { BookOpenCheck, LayoutDashboard, BedDouble, AlertTriangle, ShoppingCart, Settings } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

function TutorialPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <BookOpenCheck className="h-12 w-12 text-primary" />
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Application Tutorial</h1>
          <p className="text-lg text-muted-foreground">Your step-by-step guide to using Hotel Suite Pro.</p>
        </div>
      </div>

      <p>Welcome to your new hotel management application! This guide will walk you through the core features and help you get started with managing your property efficiently.</p>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LayoutDashboard /> The Dashboard</CardTitle>
          <CardDescription>Your central hub for a real-time overview of hotel operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <p>The first page you see after logging in is the Dashboard. It's designed to give you a quick, at-a-glance summary of what's happening right now.</p>
            <ul className="list-disc pl-6 space-y-2">
                <li><b>Stat Cards:</b> At the top, you'll find key metrics like Today's Income, Active Check-ins, Available Rooms, and any Overdue Checkouts that need immediate attention.</li>
                <li><b>Weekly Overview:</b> A visual chart showing your occupancy and income trends over the last 7 days. This helps you spot patterns and plan ahead.</li>
                <li><b>Recent Activity:</b> A log of the latest transactions, including new bookings, reservations, and cancellations, so you're always in the loop.</li>
            </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><BedDouble /> Managing Bookings & Rooms</CardTitle>
          <CardDescription>The heart of your hotel management operations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>The <strong>Bookings</strong> page is where you'll spend most of your time. It combines room status management with booking operations.</p>
            <h4 className="font-semibold pt-2">Step 1: Understanding the Views</h4>
             <ul className="list-decimal pl-6 space-y-2">
                <li><b>Timeline View:</b> This provides a Gantt chart-style overview of all your rooms and their bookings over time. It's great for visualizing occupancy and finding gaps.</li>
                <li><b>Calendar View:</b> A traditional monthly calendar that shows which days are booked, available, or scheduled for checkout. You can click on any vacant date to start a new booking.</li>
                <li><b>Room Status Tabs:</b> Above the calendar, you'll find tabs like "Vacant," "Active Check-ins," "Reserved," etc. These filter the grid of rooms below to show only those matching that status.</li>
            </ul>
            <h4 className="font-semibold pt-2">Step 2: Creating a New Booking</h4>
             <ul className="list-decimal pl-6 space-y-2">
                <li>Click the <strong>"New Booking"</strong> button or click on a vacant date/room.</li>
                <li>A form will appear. Select the booking type:
                    <ul className="list-disc pl-6">
                        <li><b>Unpaid Reservation:</b> Holds the room without payment.</li>
                        <li><b>Paid Reservation:</b> Holds the room and records a payment.</li>
                        <li><b>Check-in Today:</b> For walk-in guests who are checking in immediately.</li>
                    </ul>
                </li>
                <li>Fill in the guest's details, select the room type and number, and choose the stay dates.</li>
                <li>If payment is required, select the payment method and confirm.</li>
            </ul>
             <h4 className="font-semibold pt-2">Step 3: Handling Check-ins and Check-outs</h4>
             <ul className="list-decimal pl-6 space-y-2">
                <li>Find upcoming reservations on the <strong>Reservations</strong> page. Click "Check In" to confirm the guest's arrival.</li>
                <li>Find active guests on the <strong>Active Check-ins</strong> page. When a guest is ready to leave, click "Check Out".</li>
                <li>You can add final bills or charges before completing the checkout process.</li>
            </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart /> Point of Sale (POS) & Inventory</CardTitle>
          <CardDescription>Manage your hotel's stock and sell items to guests or walk-in customers.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
             <ul className="list-decimal pl-6 space-y-2">
                <li>Go to the <strong>POS</strong> page to access the sales terminal.</li>
                <li>Use the search bar to find and add items to the cart. The system will track stock in real-time.</li>
                <li>Select a customer or proceed as a "Walk-in Customer".</li>
                <li>Choose a payment method and process the sale. A receipt will be generated.</li>
                <li>Use the <strong>Stock Management</strong> page to add new items, update prices, and set low-stock alerts.</li>
            </ul>
        </CardContent>
      </Card>
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings /> Application Settings</CardTitle>
          <CardDescription>Customize the application to fit your hotel's specific needs.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <p>The <strong>Settings</strong> page allows you to tailor the application. Here are a few key areas:</p>
             <ul className="list-disc pl-6 space-y-2">
                <li><b>Business Information:</b> Set your hotel's name, address, and logo, which will appear on all receipts and invoices.</li>
                <li><b>Currency & Region:</b> Define the default currency and country code used throughout the app.</li>
                <li><b>Theme:</b> Customize the application's colors to match your brand.</li>
                <li><b>Hotel Policy:</b> Set important operational rules like default check-in/check-out times.</li>
            </ul>
        </CardContent>
      </Card>

    </div>
  );
}

export default withAuth(TutorialPage, PagePermission.VIEW_TUTORIAL_PAGE);
