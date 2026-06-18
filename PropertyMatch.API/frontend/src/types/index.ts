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
  | "Studio";
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
  sourceUrl: string | null;
  sourcePlatform: string | null;
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
  residencyType?: ResidencyType;
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

export interface AgentAvailability {
  id: string;
  agentId: string;
  startTime: string;
  endTime: string;
  validFromDate: string;
  validToDate: string;
  reason?: string | null;
  createdAt: string;
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
