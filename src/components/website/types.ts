

import type { Timestamp } from 'firebase/firestore';

export interface Room {
  id: string;
  name: string;
  description: string;
  price: number;
  capacity?: number;
  totalRooms?: number;
  images?: string[];
  facilities?: string[];
  roomNumbers?: string[];
  rating?: number;
  beds?: number;
  bathrooms?: number;
  size?: number;
}

export interface Amenity {
  id: string;
  icon: string;
  label: string;
  description?: string;
}

export interface Review {
  id: string;
  author: string;
  role: string;
  avatar: {
    imageUrl: string;
    description: string;
    imageHint: string;
  };
  rating: number;
  title: string;
  content: string;
  isFeatured?: boolean;
}

export interface Settings {
    businessName?: string;
    businessAddress?: string;
    businessPhone?: string;
    businessEmail?: string;
    businessWebsite?: string;
    currency?: string;
    businessLogoUrl?: string;
    websiteData?: any;
    [key: string]: any;
}

export interface SiteData {
  hero: {
    title: string;
    subtitle: string;
    buttonText: string;
    videoUrl: string;
  };
  rooms: Room[];
  amenities: Amenity[];
  reviews: Review[];
  footer: {
    address: string;
    phone: string;
    email: string;
  };
}
