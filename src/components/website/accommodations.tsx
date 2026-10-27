
'use client';

import React from 'react';
import { useBooking } from './booking-provider';
import type { Room } from '@/components/website/types';
import { Users, Maximize, Star } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import Image from 'next/image';
import { DynamicIcon } from '@/components/ui/dynamic-icon';

export const Accommodations = ({ data, settingsData }: { data?: Room[], settingsData?: any }) => {
  const { openBooking } = useBooking();
  const { settings } = useSettings();
  const currency = settings?.currency || 'USD';

  const accommodationsSettings = settingsData || {
    title: 'Luxurious Suites',
    subtitle: 'Designed for Comfort',
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  }

  const roomsData = data || [];

  return (
    <section id="accommodations" className="pt-40 pb-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-10 lg:px-20">
        <div className="flex flex-col md:flex-row justify-between items-end mb-16 gap-6">
          <div className="max-w-2xl">
            <h2 className="text-primary font-bold uppercase tracking-widest text-xs mb-4">Our Residences</h2>
            <h3 className="text-4xl md:text-5xl font-extrabold text-gray-900 leading-tight">{accommodationsSettings.title}</h3>
            <p className="text-2xl md:text-3xl font-medium text-gray-500 mt-2">{accommodationsSettings.subtitle}</p>
          </div>
          <button className="text-primary font-bold hover:opacity-80 underline underline-offset-8 transition-colors">View All Rooms</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {roomsData.map((room) => (
            <div key={room.id} className="group bg-white rounded-3xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-2xl transition-all flex flex-col">
              <div className="relative h-[300px] overflow-hidden">
                {room.images && room.images.length > 0 && room.images[0] ? (
                  <Image src={room.images[0]} alt={room.name} fill className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                ) : (
                   <div className="w-full h-full bg-muted flex items-center justify-center">
                    <p className="text-muted-foreground">No Image</p>
                  </div>
                )}
                <div className="absolute bottom-4 left-4 bg-gray-900/80 text-white px-4 py-2 rounded-2xl border border-white/20"><span className="text-lg font-bold">{formatCurrency(room.price)}</span><span className="text-xs text-gray-300">/night</span></div>
              </div>
              <div className="p-8 flex-1 flex flex-col">
                <h4 className="text-xl font-bold mb-4 group-hover:text-primary transition-colors">{room.name}</h4>
                <div className="flex items-center gap-6 mb-6 text-sm text-gray-500 font-medium font-body">
                  <div className="flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> {room.capacity || 2} Guests</div>
                </div>
                {room.facilities && room.facilities.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-8">
                    {room.facilities.slice(0, 4).map(facility => (
                      <span key={facility} className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-[#F9F5EF] text-primary-dark px-3 py-1 rounded-full border border-[#EAE0CB]">
                        <DynamicIcon iconName={facility} className="h-3 w-3" />
                        {facility}
                      </span>
                    ))}
                    </div>
                )}
                <button onClick={() => openBooking(room as any)} className="w-full mt-auto bg-gray-900 text-white font-bold py-4 rounded-2xl group-hover:bg-primary transition-all">Book Now</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
