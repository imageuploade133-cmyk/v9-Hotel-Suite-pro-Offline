
'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import type { Booking, Room, IndividualRoom } from '@/lib/types';
import { useUser } from '@/contexts/user-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, ChevronLeft, ChevronRight, Bed, Search } from 'lucide-react';
import { EmptyState } from '../ui/empty-state';
import { useRoomStatus } from '@/hooks/use-room-status';
import { DynamicIcon } from '../ui/dynamic-icon';
import { Input } from '@/components/ui/input';
import { useSettings } from '@/contexts/settings-context';
import { RoomGrid } from './room-grid';


const PAGE_SIZE = 12;

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function PaginationControls({ currentPage, totalPages, onPageChange }: PaginationControlsProps) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 mt-4">
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}>
        <ChevronLeft className="mr-2 h-4 w-4" />
        Prev
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}>
        Next
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

const getPaginatedItems = (items: any[], currentPage: number) => {
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  return items.slice(startIndex, startIndex + PAGE_SIZE);
};


export function BookingsTabs(props: any) {
  const { isLoading, rooms } = props;
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabsContainerRef = React.useRef<HTMLDivElement>(null);
  const [visibleTabsCount, setVisibleTabsCount] = React.useState(0);

  const tabFromUrl = searchParams.get('tab');
  const [activeTab, setActiveTab] = React.useState<string>(tabFromUrl || 'All');
  const [currentPage, setCurrentPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState('');

  const { settings } = useSettings();

  const {
    individualRoomsByStatus,
    reservationsByRoom,
    roomStatusesData
  } = useRoomStatus();

  React.useEffect(() => {
    setActiveTab(tabFromUrl || 'All');
  }, [tabFromUrl]);

  React.useEffect(() => {
    setCurrentPage(1);
    setSearchTerm('');
  }, [activeTab]);

  const allTabs = React.useMemo(() => {
    const allTabNames = new Set<string>(['All', 'Vacant', 'Active Check-ins', 'Reserved', 'Cleaning in Progress', 'Maintenance', 'Do Not Disturb']);
    roomStatusesData?.forEach((status: any) => allTabNames.add(status.name));

    const sortedTabs = Array.from(allTabNames);
    const preferredOrder = ['All', 'Vacant', 'Active Check-ins', 'Reserved', 'Cleaning in Progress', 'Maintenance', 'Do Not Disturb'];

    sortedTabs.sort((a, b) => {
        const indexA = preferredOrder.indexOf(a);
        const indexB = preferredOrder.indexOf(b);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.localeCompare(b);
    });

    return sortedTabs;
  }, [roomStatusesData]);

  const roomCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    allTabs.forEach(tab => {
        if (tab === 'All') {
            counts[tab] = (props.rooms || []).reduce((acc: number, r: Room) => acc + (r.roomNumbers?.length || 0), 0);
        } else if (tab === 'Reserved') {
            const allReservations = (props.allBookingsData || []).filter((b: Booking) => b.status === 'Booked' || b.status === 'Reserved');
            counts[tab] = allReservations.length;
        } else {
            counts[tab] = individualRoomsByStatus[tab]?.length || 0;
        }
    });
    return counts;
}, [allTabs, props.rooms, individualRoomsByStatus, props.allBookingsData]);


  React.useEffect(() => {
    const calculateVisibleTabs = () => {
      if (tabsContainerRef.current) {
        const containerWidth = tabsContainerRef.current.offsetWidth;
        const moreButtonWidth = 100;
        const averageTabWidth = 150;
        const maxVisible = Math.floor((containerWidth - moreButtonWidth) / averageTabWidth);
        setVisibleTabsCount(Math.max(1, maxVisible));
      }
    };

    calculateVisibleTabs();
    window.addEventListener('resize', calculateVisibleTabs);
    return () => window.removeEventListener('resize', calculateVisibleTabs);
  }, [allTabs.length]);

  const visibleTabs = React.useMemo(() => allTabs.slice(0, visibleTabsCount), [allTabs, visibleTabsCount]);
  const hiddenTabs = React.useMemo(() => allTabs.slice(visibleTabsCount), [allTabs, visibleTabsCount]);

  const filteredItems = React.useMemo(() => {
    let baseItems: any[] = [];
    if (activeTab === 'All') {
        baseItems = props.rooms || [];
    } else if (activeTab === 'Reserved') {
        baseItems = (props.allBookingsData || []).filter((b: Booking) => b.status === 'Booked' || b.status === 'Reserved');
    } else {
        baseItems = individualRoomsByStatus[activeTab] || [];
    }

    if (!searchTerm) return baseItems;

    const lowerCaseSearch = searchTerm.toLowerCase();

    if (activeTab === 'All') {
      return (baseItems as Room[]).filter(room =>
        room.name.toLowerCase().includes(lowerCaseSearch) ||
        (room.roomNumbers || []).some(num => num.includes(lowerCaseSearch))
      );
    }

    if (activeTab === 'Reserved') {
      return (baseItems as Booking[]).filter(b =>
        (b.guestName.toLowerCase().includes(lowerCaseSearch)) ||
        (b.roomNumber && b.roomNumber.includes(lowerCaseSearch))
      );
    }

    return (baseItems as IndividualRoom[]).filter(room =>
      room.roomNumber.toLowerCase().includes(lowerCaseSearch) ||
      room.name.toLowerCase().includes(lowerCaseSearch) ||
      (room.currentBooking?.guestName || '').toLowerCase().includes(lowerCaseSearch)
    );
  }, [activeTab, props.rooms, individualRoomsByStatus, props.allBookingsData, searchTerm]);


  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i}><Skeleton className="h-80 w-full" /></Card>
          ))}
        </div>
      );
    }

    const paginatedItems = getPaginatedItems(filteredItems, currentPage);
    const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);

    if (paginatedItems.length === 0) {
      return (
        <div className="py-20">
          <EmptyState
            icon={Bed}
            title={searchTerm ? `No results for "${searchTerm}"` : `No items in ${activeTab}`}
            description={searchTerm ? "Try a different search term." : "There are no items currently in this state."}
          />
        </div>
      );
    }

    return (
      <>
        <RoomGrid
            items={paginatedItems}
            activeTab={activeTab}
            {...props}
        />
        <PaginationControls currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
      </>
    );
  };

  const handleTabChange = (tabValue: string) => {
    router.push(`/bookings?tab=${tabValue}`);
  };

  return (
    <>
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div ref={tabsContainerRef} className="flex items-center gap-4">
          <TabsList>
            {visibleTabs.map((tab) => {
              const count = roomCounts[tab] ?? 0;
              const shouldBlink = count > 0 && tab !== 'All' && tab !== 'Vacant' && activeTab !== tab;
              return (
                <TabsTrigger key={tab} value={tab} className="flex items-center gap-2">
                  <DynamicIcon iconName={tab} className="h-4 w-4" />
                  {tab}
                  {count > 0 && (<Badge variant={activeTab === tab ? 'default' : 'secondary'} className={cn("rounded-full px-2", shouldBlink && 'blinking-red-badge')}>{count}</Badge>)}
                </TabsTrigger>
              );
            })}
            {hiddenTabs.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1"><MoreHorizontal className="h-4 w-4" /> More</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {hiddenTabs.map((tab) => {
                    const count = roomCounts[tab] ?? 0;
                    return (
                      <DropdownMenuItem key={tab} onSelect={() => handleTabChange(tab)} className={cn(activeTab === tab && 'bg-accent')}>
                        <div className="flex items-center gap-2">
                          <DynamicIcon iconName={tab} className="h-4 w-4" />
                          <span>{tab}</span>
                          {count > 0 && <Badge variant={activeTab === tab ? 'default' : 'secondary'} className="rounded-full px-2">{count}</Badge>}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </TabsList>
        </div>
        <div className="mt-4">
          <div className="relative mb-4 md:w-80">
              <Input placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
              <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Search className="h-4 w-4" />
              </span>
          </div>
          {renderTabContent()}
        </div>
      </Tabs>
    </>
  );
}
