

import type { Timestamp } from 'firebase/firestore';

export enum Section {
  HERO = 'hero',
  ACCOMMODATIONS = 'accommodations',
  TESTIMONIALS = 'testimonials',
  NEWSLETTER = 'newsletter',
  AMENITIES = 'amenities',
  VISION_MISSION = 'vision-mission',
  CHECK_IN_OUT = 'check-in-out',
  IMAGE_WITH_TEXT = 'image-with-text',
  SPACER = 'spacer',
  GALLERY = 'gallery',
  BLANK = 'blank',
}

export interface WebsiteSection {
  id: string;
  type: Section;
  data: any;
}


export interface UserProfile {
  id: string;
  uid: string;
  name: string;
  email: string;
  role: string;
  photoURL?: string;
  monthlySalary?: number;
  perDayRate?: number;
  shift?: 'Morning' | 'Night' | '24hrs';
  permissions: string[];
  branchPermissions?: Record<string, string[]>; // Map of branchId to permissions array for branch-specific access
  assignedBranches?: string[]; // Array of branch IDs user has access to, empty means all branches (admin)
  isActive: boolean;
  phoneNumber?: string | null;
  createdAt?: Timestamp | null;
  isSuperAdmin?: boolean;
}

export type BookingType = 'reservation' | 'checkin' | 'reservation-and-pay';

export interface Booking {
  id: string;
  bookingId?: string;
  guestName: string;
  guestEmail?: string;
  guestPhoneNumber?: string;
  guestPhotoURL?: string;
  guestAddress?: string;
  checkInDate: Timestamp | Date;
  checkOutDate: Timestamp | Date;
  roomId: string;
  roomNumber: string;
  status: 'Booked' | 'Reserved' | 'Active' | 'Checked-in' | 'Checked-out' | 'Cancelled' | 'Refunded';
  amount: number;
  totalAmount?: number;
  createdAt: Timestamp;
  createdByName?: string;
  createdByUid?: string;
  cancelledAt?: Timestamp;
  checkedInByName?: string;
  checkedInByUid?: string;
  checkedOutByName?: string;
  checkedOutByUid?: string;
  collectPayment?: boolean;
  paymentMethod?: string;
  paymentId?: string;
  actualCheckOutDate?: Timestamp | Date;
  checkoutNotes?: string;
  cancelledByUid?: string;
  cancelledByName?: string;
  refundedAt?: Timestamp;
  additionalGuests?: AdditionalGuest[];
  customFields?: Record<string, string | number | boolean>;
  originalAmount?: number;
  discountType?: 'percentage' | 'amount';
  discountValue?: number;
  discountReason?: string;
  customerId?: string;
}

export interface AdditionalGuest {
    name: string;
    phoneNumber?: string;
    photoURL?: string;
}

export interface CleaningQueueItem {
    id: string;
    roomId: string;
    roomNumber: string;
    lastGuestName: string;
    lastGuestPhotoURL?: string;
    bookingId: string;
    checkedOutAt: Timestamp;
    status: 'Pending' | 'In Progress' | 'Completed';
    cleanedBy?: string;
    cleanedAt?: Timestamp;
    lastGuestBookingDetails: Partial<Booking>;
}

export interface MaintenanceQueueItem {
    id: string;
    roomId: string;
    roomNumber: string;
    reason: string;
    reportedBy: string;
    reportedAt: Timestamp;
    status: 'Pending' | 'In Progress' | 'Completed';
    bookingId?: string;
    lastGuestName?: string;
    completedBy?: string;
    completedAt?: Timestamp;
    booking?: Booking | null;
}

export interface IndividualRoom {
    id: string;
    roomNumber: string;
    name: string;
    price: number;
    facilities?: string[];
    status: 'Vacant' | 'Occupied' | 'Cleaning in Progress' | 'Maintenance' | 'Do Not Disturb' | string;
    currentBooking?: Booking | null;
    reservations?: Booking[];
    cleaningQueueItem?: CleaningQueueItem;
    maintenanceQueueItem?: MaintenanceQueueItem;
    statusMeta?: {
        markedBy: string;
        markedAt: Timestamp;
    }
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  roomNumbers?: string[];
  individualRoomStatus?: Record<string, string | null>;
  price: number;
  totalRooms: number;
  availableRooms: number;
  bookedRooms: number;
  description?: string;
  facilities?: string[];
  images?: string[];
  createdAt?: Timestamp;
  promoPrice?: number | null;
  promoType?: 'fixed' | 'percentage';
  promoStartDate?: Timestamp | null;
  promoEndDate?: Timestamp | null;
}

export interface RoomType {
    id: string;
    name: string;
    iconName?: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  items: { id: string, name: string; quantity: number, price: number, images?: string[] | null }[];
  status: 'Pending' | 'Preparing' | 'Completed' | 'Billed';
  totalPrice: number;
  bookingId?: string;
  guestName: string;
  guestEmail?: string;
  roomNumber: string;
  phoneNumber: string;
  source: 'staff' | 'guest';
  createdAt: Timestamp;
  preparingAt?: Timestamp;
  preparingByUid?: string;
  preparingByName?: string;
  completedAt?: Timestamp;
  completedByUid?: string;
  completedByName?: string;
  billedAt?: Timestamp;
  billedByUid?: string;
  billedByName?: string;
}

export interface LaundryOrder {
    id: string;
    orderNumber: string;
    roomNumber: string;
    guestName: string;
    bookingId?: string;
    items: {
        serviceId: string;
        serviceName: string;
        name: string;
        quantity: number;
        price: number;
    }[];
    totalPrice: number;
    status: 'Pending' | 'In-Progress' | 'Washed' | 'Completed' | 'Delivered';
    notes?: string;
    createdAt: Timestamp;
    staffId?: string;
    staffName?: string;
    billedAt?: Timestamp;
    billedByUid?: string;
    billedByName?: string;
    source: 'staff' | 'guest';
}

export interface StockItem {
  id: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
  category: string;
  costPrice?: number;
  sellingPrice: number;
  supplierId?: string;
  supplier?: string;
  imageUrl?: string;
  description?: string;
  sku?: string;
  barcode?: string;
  hideFromPOS?: boolean;
  expiryDate?: Timestamp | Date | string | null;
  images?: string[];
  held?: number;
  promoPrice?: number;
  promoType?: 'fixed' | 'percentage';
  promoStartDate?: Timestamp | Date;
  promoEndDate?: Timestamp | Date;
  branchId?: string;
}

export interface ServiceItem {
    id: string;
    name: string;
    price: number;
    category: string;
    description?: string;
    isService: true;
    images?: string[];
    branchId?: string;
}

export type UnifiedItem = (StockItem | ServiceItem) & {
    sourceType: 'Stock' | 'Service';
    isService: boolean;
    price: number;
    sellQuantity: number;
    printedQuantity?: number;
    sellingPrice?: number;
};

export interface CartItem extends StockItem {
  sellQuantity: number;
  printedQuantity?: number;
  price?: number;
}

export interface SalaryDeduction {
  id: string;
  amount: number;
  notes: string;
  date: Timestamp;
  processedBy: string;
  processedByUid: string;
  userId: string;
  userName: string;
  status?: 'Active' | 'Reversed';
}

export interface SalaryReward {
    id: string;
    amount: number;
    notes: string;
    date: Timestamp;
    processedBy: string;
    processedByUid: string;
    userId: string;
    userName: string;
    celebrated: boolean;
}

export interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: Timestamp;
  paymentMethod: string;
  staffId: string;
  staffName: string;
  status: 'Recorded' | 'Voided';
  recordedBy?: string;
  recordedByUid?: string;
}

export interface StockAuditLog {
  id: string;
  changeType: 'Login' | 'Create' | 'Update' | 'Delete' | 'Restock' | 'Sale' | 'Refund' | 'Transfer';
  collectionName?: string;
  documentId?: string;
  timestamp: Timestamp;
  userId: string;
  userName: string;
  details: Record<string, any>;
  changes?: { field: string, before: any, after: any }[];
  itemId?: string;
  itemName?: string;
  notes?: string;
  keywords?: string[];
}

export interface GuestReport {
  id: string;
  bookingId: string;
  guestName: string;
  roomNumber: string;
  report: string;
  status: 'new' | 'viewed' | 'resolved';
  timestamp: Timestamp;
}

export type NotificationType =
  | 'SALARY_DEDUCTION'
  | 'SALARY_PAYMENT'
  | 'STOCK_ALERT'
  | 'GUEST_REPORT'
  | 'REWARD'
  | 'GENERAL';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  notes?: string;
  createdAt: Timestamp;
  read: boolean;
  status?: 'Reversed';
  link?: string; // Optional link to a relevant page
  deductionId?: string;
  rewardId?: string;
}

export interface Menu {
    id: string;
    name: string;
    description?: string;
    isOrderingEnabled?: boolean;
    buttonColor?: string;
    cartIconColor?: string;
    activeCategoryColor?: string;
    createdAt: Timestamp;
    updatedAt: Timestamp;
    slug?: string;
    logoImageUrl?: string;
    coverImageUrl?: string;
}

export interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    category: string;
    images?: string[];
    promoPrice?: number;
    promoType?: 'fixed' | 'percentage';
    promoStartDate?: Timestamp;
    promoEndDate?: Timestamp;
}


export interface LaundryServiceItem {
    id: string;
    name: string;
    price: number;
    duration: number; // e.g., in hours
}


export interface Payment {
  id: string;
  amount: number;
  transactionDate: Timestamp | Date;
  paymentMethod: 'Cash' | 'Card' | 'Bank Transfer' | 'Mobile Money';
  status: 'Paid' | 'Credit' | 'Refunded';
  type: 'Booking' | 'POS' | 'Service' | 'Additional Charges' | 'Credit Repayment' | 'Gym Membership';
  createdByUid: string;
  createdByName?: string;
  bookingId?: string;
  guestName?: string;
  guestEmail?: string;
  guestPhotoURL?: string;
  roomNumber?: string;
  items?: { name: string; price: number; quantity: number; }[];
  profit?: number;
  refundDetails?: {
    amount: number;
    date: Timestamp;
    reason: string;
    processedByUid: string;
  };
  bookingDetails?: Partial<Booking>;
  notes?: string;
  context?: 'hotel' | 'pos';
  originalPaymentId?: string;
}

export interface BillItem {
    id: string;
    name: string;
    price: number;
    quantity: number;
    isService?: boolean;
    paid?: boolean;
    paymentId?: string;
    images?: string[] | null;
    billId: string;
    printedQuantity?: number; // Tracks how many of this item have been printed
}

export interface Bill {
    id: string;
    items: BillItem[];
    total: number;
    bookingId: string;
    createdAt: Timestamp;
    createdBy: string;
    createdByName: string;
    paid: boolean;
    paymentId?: string;
    paymentMethod?: string;
    paidAt?: Timestamp;
    printStatus?: PrintStatus;
    printedAt?: Timestamp;
    printedBy?: string;
    printedByName?: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phoneNumber: string;
  photoURL?: string;
  bookingIds: string[];
  totalBookings: number;
  lastVisit: Date | Timestamp;
  customFields?: Record<string, any>;
}

export interface BookingFormField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  options?: string[];
  isRequired: boolean;
  saveToCustomer: boolean;
  prefillFromCustomer: boolean;
}

export interface Transfer {
  id: string;
  fromAccount: string;
  toAccount: string;
  amount: number;
  notes?: string;
  transferredAt: Timestamp;
  transferredByUid: string;
  transferredByName: string;
  transferId: string;
  beforeBalances: { from: number, to: number };
  afterBalances: { from: number, to: number };
}

export type PrintStatus = 'pending' | 'printing' | 'printed';

export interface StockSale {
    id: string;
    saleId: string;
    items: {
        itemId: string,
        itemName: string,
        quantity: number,
        sellingPrice: number,
        costPrice?: number,
        isService?: boolean,
    }[];
    totalAmount: number;
    paymentMethod: 'Cash' | 'Card' | 'Credit' | 'Bank Transfer' | 'Mobile Money';
    paymentStatus: 'Paid' | 'Unpaid' | 'Partially Refunded' | 'Refunded';
    soldAt: Timestamp;
    soldByUid: string;
    soldByName: string;
    customerId?: string;
    customerName?: string;
    customerEmail?: string;
    initialPaymentAmount?: number;
    refundedItems?: { itemId: string; quantity: number }[];
    bookingId?: string;
    discountType?: 'percentage' | 'amount';
    discountValue?: number;
    discountReason?: string;
    printStatus?: PrintStatus;
    printedAt?: Timestamp;
    printedBy?: string;
    printedByName?: string;
    context?: 'hotel' | 'pos';
    branchId?: string;
    linkedHeldSaleId?: string;
}

export interface StockReturn {
  id: string;
  refundId: string;
  originalSaleId: string;
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
    refundAmount: number;
    sellingPrice?: number;
    originalQuantity?: number;
    remainingQuantity?: number;
  }[];
  totalRefundAmount: number;
  originalTotal?: number;
  remainingAmount?: number;
  reason: string;
  returnedAt: Timestamp;
  returnedByUid: string;
  returnedByName: string;
  customerId?: string;
  customerName?: string;
  source?: 'RunningTable' | 'POS';
  keywords?: string[];
  branchId?: string;
}

export interface DocketHistory {
  id: string;
  originalSaleId: string;
  tableName: string;
  customerName: string;
  customerId?: string;
  heldAt: Timestamp;
  heldByUid: string;
  heldByName: string;
  items: {
    itemId: string;
    itemName: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  actionType: 'Deleted' | 'Reset' | 'Completed';
  actionAt: Timestamp;
  actionByUid: string;
  actionByName: string;
  linkedBillId?: string;
}

export interface SalonService {
    id: string;
    orderNumber: string;
    items: { serviceId: string; serviceName: string; name: string; price: number; }[];
    totalPrice: number;
    paymentMethod: string;
    paymentStatus: 'Paid' | 'Unpaid' | 'Billed';
    status: 'Pending' | 'In-Progress' | 'Completed';
    createdAt: Timestamp;
    staffId: string;
    staffName: string;
    customerId?: string;
    customerName: string;
    roomNumber?: string;
    bookingId?: string;
}

export interface SalonServiceItem {
    id: string;
    name: string;
    price: number;
}

export interface GymMember {
    id: string;
    memberId: number;
    name: string;
    email: string;
    phoneNumber?: string;
    photoURL?: string;
    createdAt: Timestamp;
    expiresAt: Timestamp | Date;
    status?: 'Active' | 'Expired' | 'Refunded';
    membershipFee?: number;
    planId?: string;
    paymentMethod?: string;
}

export interface GymMembershipPlan {
    id: string;
    name: string;
    price: number;
    duration: number; // in days
}

export interface WhatsAppReminder {
    id: string;
    memberId: string;
    memberName: string;
    sentAt: Timestamp;
    sentBy: string;
    message: string;
}

export interface HeldSale {
  id: string;
  name: string;
  heldAt: Timestamp;
  cart: UnifiedItem[];
  customer: Partial<Customer> | null;
  heldByUid: string;
  heldByName: string;
  notes?: string;
  linkedBillId?: string;
  printStatus?: PrintStatus;
  printedAt?: Timestamp;
  printedBy?: string;
  printedByName?: string;
  branchId?: string;
  isCreditSale?: boolean;
  linkedStockSaleId?: string;
  linkedStockSaleNumber?: string;
}

export interface StockCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  createdBy: string;
  branchId?: string;
}

export interface ServiceCategory {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  createdAt: Timestamp;
  createdBy: string;
  branchId?: string;
}

export interface StockSupplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  category?: string;
  notes?: string;
  createdAt: Timestamp;
  createdBy: string;
}

export interface TransferLog {
    id: string;
    items: { id: string; name: string; quantity: number; costPrice: number; sellingPrice: number; subtotal: number; }[];
    totalValue: number;
    transferredBy: string;
    transferredAt: Timestamp;
    supplier?: string;
    invoiceNumber?: string;
    status?: 'Completed' | 'Reversed' | 'Partially Reversed';
    reversedItems?: { id: string, quantity: number }[];
    quantitySold?: number;
    valueSold?: number;
    remainingQuantity?: number;
    remainingValue?: number;
    branchId?: string;
}

export type Transaction = (StockSale | StockReturn) & {
    type: 'Sale' | 'Return';
};

// Types for Website Builder
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

export interface Amenity {
  id: string;
  icon: string;
  label: string;
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

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystemRole?: boolean;
    createdAt?: Timestamp;
    createdBy?: string;
    applicableBranches?: string[]; // Array of branch IDs, empty means all branches (global role)
    isGlobalRole?: boolean; // true if role applies to all branches regardless of applicableBranches
}

export interface Branch {
    id: string;
    name: string;
    address?: string | null;
    phoneNumber?: string | null;
    logoUrl?: string | null; // Branch-specific logo for receipts
    status: 'active' | 'hidden';
    createdAt?: Timestamp | null;
}
