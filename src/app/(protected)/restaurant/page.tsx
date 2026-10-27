
'use client';

import { RestaurantPage } from '@/components/restaurant/restaurant-page';
import { FoodBanner } from '@/components/restaurant/FoodBanner';
import { TopHeader } from '@/components/ui/top-header';
import { Utensils } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function Restaurant() {
  return (
    <div className="flex flex-col gap-6">
      <TopHeader name="Restaurant" icon={<Utensils className="h-10 w-10" />} description="Manage your restaurant tables, orders, and menus." />
      <FoodBanner />
      <Card>
        <CardHeader>
          <CardTitle>Restaurant Management</CardTitle>
          <CardDescription>
            This section is under construction. Features for table management, order taking, and kitchen integration will be available here soon.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <p>In the meantime, you can manage your restaurant menu items from the Menus page.</p>
            <Button asChild>
              <Link href="/menus">Manage Menus</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
