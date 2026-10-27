
'use client';

import * as React from 'react';
import { FoodBanner } from './FoodBanner';
import { TopHeader } from '../ui/top-header';
import { Utensils } from 'lucide-react';

export function RestaurantPage() {
    return (
        <div className="flex flex-col gap-6">
            <TopHeader name="Restaurant" icon={<Utensils />} description="Manage your restaurant tables, orders, and menus." />
            <FoodBanner />
            {/* Add more restaurant components here */}
        </div>
    )
}
