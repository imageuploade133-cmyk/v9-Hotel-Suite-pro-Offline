'use client';

import React, { useState } from 'react';
import {
  Building2, ChevronDown, Globe, Menu, X, Languages, DollarSign,
  Instagram, Linkedin, Twitter, Youtube, Mail, Play, ArrowRight,
  Star, Users, Maximize, Waves, UtensilsCrossed, Dumbbell,
  Sparkles, Car, ShieldCheck, Quote, Check, Calendar, CheckCircle2
} from 'lucide-react';
import type { Room, Amenity, Review } from '@/components/website/types';
import { useSettings } from '@/contexts/settings-context';

const AdminPanel: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState<'dash' | 'rooms' | 'amenities' | 'reviews'>('dash');

  return (
    <div className="fixed inset-0 z-[200] bg-gray-900/50 backdrop-blur-md flex">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white h-full flex flex-col p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-12">
          <span className="material-symbols-outlined text-primary text-3xl">terminal</span>
          <h2 className="font-bold text-xl uppercase tracking-tighter">Command Center</h2>
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {[
            { id: 'dash', icon: 'dashboard', label: 'Analytics' },
            { id: 'rooms', icon: 'bed', label: 'Room Manager' },
            { id: 'amenities', icon: 'spa', label: 'Amenities' },
            { id: 'reviews', icon: 'reviews', label: 'Guest Feedback' },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === item.id ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'hover:bg-white/5 text-gray-400'}`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="font-medium text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <button
          onClick={onClose}
          className="mt-auto flex items-center justify-center gap-2 p-3 border border-white/10 rounded-xl hover:bg-white/5 transition-colors text-sm font-bold"
        >
          <span className="material-symbols-outlined text-sm">visibility</span>
          Preview Website
        </button>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-slate-800 p-8 text-slate-900 dark:text-white">
        <header className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">
              {activeTab === 'dash' && 'Welcome, Administrator'}
              {activeTab === 'rooms' && 'Inventory Management'}
              {activeTab === 'amenities' && 'Property Amenities'}
              {activeTab === 'reviews' && 'Social Proof'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">Control and expand your digital hotel experience.</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold uppercase tracking-widest text-primary">System Status</span>
              <span className="text-sm font-bold text-green-500 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Fully Operational
              </span>
            </div>
          </div>
        </header>

        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-white/5 min-h-[500px]">
          {activeTab === 'dash' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: 'Total Bookings', val: '1,248', inc: '+12%', color: 'blue' },
                { label: 'Avg. Rating', val: '4.85', inc: '+0.2', color: 'yellow' },
                { label: 'Occupancy Rate', val: '92%', inc: '+5%', color: 'green' },
              ].map(stat => (
                <div key={stat.label} className="p-6 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                  <p className="text-sm text-gray-500 font-bold uppercase">{stat.label}</p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-3xl font-bold">{stat.val}</span>
                    <span className={`text-xs font-bold text-${stat.color}-500`}>{stat.inc}</span>
                  </div>
                </div>
              ))}
              <div className="md:col-span-3 mt-8 p-6 bg-primary/10 rounded-2xl border border-primary/20">
                <h3 className="font-bold text-primary">System Notice</h3>
                <p className="text-sm mt-1">Website is currently syncing with Global Distribution Systems (GDS). All room updates will be live in 0.5s.</p>
              </div>
            </div>
          )}

          {(activeTab === 'rooms' || activeTab === 'amenities' || activeTab === 'reviews') && (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <span className="material-symbols-outlined text-6xl mb-4 opacity-20">construction</span>
              <p className="font-bold">This management module is ready for full-stack integration.</p>
              <p className="text-sm">Content is currently synced from placeholder data.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};


export function WebsiteAdminDashboard() {
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) return null;

  return (
    <AdminPanel
      onClose={() => setIsOpen(false)}
    />
  );
}