export type UserRole = "Tenant" | "Agent" | "Admin";
export type UserStatus = 'Pending' | 'Unapproved' | 'Verified' | 'Blocked'
export type AgentStatus = 'Pending' | 'Unapproved' | 'Verified' | 'Blocked'
export type ListingStatus = "Draft" | "PendingPayment" | "Active" | "Inactive" | "Booked";
export type ScheduleStatus = "Pending" | "Confirmed" | "Cancelled";
export type ResidencyType =
  | "Landed" 
  | "Condo"
  | "Apartment"
  | "Townhouse"
  | "Studio"
  | "MasterRoom"
  | "SharedRoom";
export type TransportMode = "Driving" | "Walking" | "Transit" | "Bicycling";

export interface AuthUser {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  verifiedAt: string | null;
}

export interface ImageDto {
  id: string;
  url: string;
  displayOrder: number;
  caption?: string;
}

export interface Listing {
  id: string;
  agentId: string;
  agentName: string;
  name: string;
  rooms: number;
  toilets: number;
  lat: number;
  lng: number;
  address: string;
  residencyType: ResidencyType;
  price: number;
  status: ListingStatus;
  createdAt: string;
  images: ImageDto[];
  imageUrls: string[];
}

export interface TransitStep {
  type: "TRANSIT" | "WALK";
  durationMinutes: number;
  distanceKm: number;
  polylineEncoded: string | null;
  lineName: string | null;
  lineColor: string | null;
  lineTextColor: string | null;
  vehicleType: string | null;
  vehicleIcon: string | null;
  departureStop: string | null;
  arrivalStop: string | null;
  numStops: number | null;
  headSign: string | null;
}

export interface ModeCommuteResult {
  mode: TransportMode;
  durationMinutes: number;
  distanceKm: number;
  encodedPolyline: string | null;
  transitSteps: TransitStep[] | null;
}

export interface PlaceLocation {
  name: string;
  lat: number;
  lng: number;
}

export interface MatchedListing {
  listing: Listing;
  numericScore: number;
  commuteScore: number;
  lifestyleScore: number;
  totalScore: number;
  commuteMinutes: number | null;
  lifestylePlaces: Record<string, PlaceLocation[]>;
  commuteRoutes: ModeCommuteResult[];
}

export interface LifestyleTemplate {
  id: string;
  name: string;
  placeTypes: string[];
  createdAt: string;
}

export interface ViewingSchedule {
  listingId: string;
  listingName: string;
  listingAddress: string;
  tenantId: string;
  tenantName: string;
  scheduledAt: string;
  status: ScheduleStatus;
}

export interface BookedSlot {
  scheduledAt: string;
  status: ScheduleStatus;
}

export interface MatchRequest {
  rooms?: number;
  toilets?: number;
  residencyTypes?: ResidencyType[];
  priceMin?: number;
  priceMax?: number;
  workplaceAddress: string;
  workplaceLat: number;
  workplaceLng: number;
  transportModes: TransportMode[];
  maxCommuteMinutes: number;
  lifestyleTemplateId?: string;
}

export interface Analytics {
  totalAgents: number;
  totalUsers: number;
  totalListings: number;
  totalSchedules: number;
  totalPayments: number;
  blockedAgents: number;
}
export interface TenantDetail {
    userId: string
    fullName: string
    email: string
    status: UserStatus
    createdAt: string
    verifiedAt: string | null
    totalViewings: number
    pendingViewings: number
    confirmedViewings: number
    cancelledViewings: number
    lastViewingAt: string | null
}

export interface AgentDetail {
  userId: string;
  fullName: string;
  email: string;
  status: UserStatus;
  createdAt: string;
  verifiedAt: string | null;
  listingCount: number;
  licenseNumber: string | null;
  tokenBalance: number;
  lppehSearchUrl: string | null;
}

export interface AvailabilityTemplate {
  id: string;
  dayOfWeek: number; // 0=Sunday, 1=Monday...
  startTime: string; // "09:00"
  endTime: string; // "17:00"
  slotDurationMinutes: number;
  validFrom?: string | null;
  validTo?: string | null;
  isActive: boolean;
  createdAt: string;
  listingId?: string | null;
}

export interface AvailabilityException {
  id: string;
  exceptionFrom: string; // ISO date
  exceptionTo: string;
  type: "blocked" | "custom_hours";
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
  createdAt: string;
  listingId?: string | null;
}

export interface AvailabilityTemplateRequest {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes?: number;
  validFrom?: string | null;
  validTo?: string | null;
}

export interface AvailabilityExceptionRequest {
  exceptionFrom: string;
  exceptionTo: string;
  type: "blocked" | "custom_hours";
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
}

export interface AvailableSlot {
  date: string; // "2025-06-20"
  startTime: string; // "09:00"
  endTime: string; // "10:00"
  isBooked: boolean;
}

export interface BatchListingRow {
  PropertyName: string;
  Bedrooms: number;
  Bathrooms: number;
  Toilets: number;
  Address: string;
  Price: number;
  Type: ResidencyType;
  Latitude: number;
  Longitude: number;
  Description: string;
}

// Place type data lives in placeTypes.ts — re-exported here for convenience
export type { PlaceTypeOption } from "../types/placeTypes";
export {
  POPULAR_PLACE_TYPES,
  ALL_PLACE_TYPES,
  PLACE_TYPE_OPTIONS,
  getPlaceTypeColor,
  getPlaceTypeLabel,
  searchPlaceTypes,
} from "../types/placeTypes";

export interface FavouriteListing {
    listingId: string;
    name: string;
    address: string;
    price: number;
    residencyType: string;
    rooms: number;
    toilets: number;
    thumbnailUrl?: string;
    agentName: string;
    savedAt: string;
}

export interface ViewHistoryItem {
    listingId: string;
    name: string;
    address: string;
    price: number;
    residencyType: string;
    thumbnailUrl?: string;
    agentName: string;
    viewedAt: string;
}

export interface SearchLogItem {
    searchedAt: string;
    snapshot: string; // JSON
}

export interface Conversation {
    id: string;
    listingName: string;
    tenantName: string;
    agentName: string;
    lastMessage?: string;
    lastMessageAt?: string;
    unreadCount: number;
    listingId: string;
}

export interface Message {
    id: string;
    senderId: string;
    senderRole: string;
    content: string;
    isRead: boolean;
    createdAt: string;
}

export interface BrowseListing {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    price: number;
    residencyType: string;
    rooms: number;
    toilets: number;
    amenities?: string;
    description?: string;
    images: string[];
    agentName: string;
    agentLicense?: string;
    agentContact?: string;
    viewingCount: number;
}

export interface AgentPublicProfile {
    agentId: string;
    fullName: string;
    licenseNumber?: string;
    contactNo?: string;
    ratings?: number;
}

export interface ScoringConfig {
    id: number
    weightNumeric: number
    weightCommute: number
    weightLifestyle: number
    lifestyleRadiusMeters: number
}

export interface ScoringConfigRequest {
    weightNumeric: number
    weightCommute: number
    weightLifestyle: number
    lifestyleRadiusMeters: number
}

export interface Feedback {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantEmail: string;
    description: string;
    status: string;
    createdAt: string;
}