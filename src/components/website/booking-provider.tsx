
'use client';

import React, { createContext, useState, useContext, ReactNode } from 'react';
import type { Room } from './types';
import type { DateRange } from 'react-day-picker';

interface BookingContextType {
  isOpen: boolean;
  room: Partial<Room> | null;
  dateRange: DateRange | undefined;
  availableRooms: Room[] | null;
  setAvailableRooms: (rooms: Room[] | null) => void;
  setDateRange: (dateRange: DateRange | undefined) => void;
  openBooking: (room?: Partial<Room>) => void;
  closeBooking: () => void;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export const useBooking = () => {
  const context = useContext(BookingContext);
  if (!context) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
};

export const BookingProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [room, setRoom] = useState<Partial<Room> | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);

  const openBooking = (selectedRoom?: Partial<Room>) => {
    setRoom(selectedRoom || null);
    setIsOpen(true);
  };

  const closeBooking = () => {
    setIsOpen(false);
  };

  const value = {
    isOpen,
    room,
    dateRange,
    availableRooms,
    setAvailableRooms,
    setDateRange,
    openBooking,
    closeBooking,
  };

  return (
    <BookingContext.Provider value={value}>
      {children}
    </BookingContext.Provider>
  );
};
