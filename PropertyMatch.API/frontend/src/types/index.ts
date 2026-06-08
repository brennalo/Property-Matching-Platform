export type UserRole = 'Tenant' | 'Agent' | 'Admin'
export type AgentStatus = 'Pending' | 'Verified' | 'Blocked'
export type ListingStatus = 'Draft' | 'PendingPayment' | 'Active' | 'Inactive'
export type ScheduleStatus = 'Pending' | 'Confirmed' | 'Cancelled'
export type ResidencyType = 'Landed' | 'Condo' | 'Apartment' | 'Townhouse' | 'Studio'
export type TransportMode = 'Driving' | 'Walking' | 'Transit' | 'Bicycling'

export interface AuthUser {
    userId: string
    email: string
    fullName: string
    role: UserRole
}

export interface Listing {
    id: string
    agentId: string
    agentName: string
    name: string
    rooms: number
    toilets: number
    lat: number
    lng: number
    address: string
    residencyType: ResidencyType
    price: number
    status: ListingStatus
    createdAt: string
    imageUrls: string[]
    sourceUrl: string | null
    sourcePlatform: string | null
}

/** One step inside a transit route — mirrors TransitStep C# record */
export interface TransitStep {
    type: 'TRANSIT' | 'WALK'
    durationMinutes: number
    distanceKm: number
    polylineEncoded: string | null
    // Transit-only (null for WALK steps)
    lineName: string | null
    lineColor: string | null        // hex e.g. '#008000'
    lineTextColor: string | null
    vehicleType: string | null      // BUS | SUBWAY | RAIL …
    vehicleIcon: string | null      // emoji
    departureStop: string | null
    arrivalStop: string | null
    numStops: number | null
    headSign: string | null
}

export interface ModeCommuteResult {
    mode: TransportMode
    durationMinutes: number
    distanceKm: number
    encodedPolyline: string | null
    transitSteps: TransitStep[] | null  // only populated for Transit mode
}

export interface MatchedListing {
    listing: Listing
    numericScore: number
    commuteScore: number
    lifestyleScore: number
    totalScore: number
    commuteMinutes: number | null
    lifestyleCounts: Record<string, number>
    commuteRoutes: ModeCommuteResult[]
}

export interface LifestyleTemplate {
    id: string
    name: string
    placeTypes: string[]
    createdAt: string
}

export interface ViewingSchedule {
    listingId: string
    listingName: string
    listingAddress: string
    tenantId: string
    tenantName: string
    scheduledAt: string
    status: ScheduleStatus
}

/** A single booked time slot — from /api/schedules/listing/{id}/slots */
export interface BookedSlot {
    scheduledAt: string    // ISO datetime UTC
    status: ScheduleStatus
}

export interface MatchRequest {
    rooms?: number
    toilets?: number
    residencyType?: ResidencyType
    priceMin?: number
    priceMax?: number
    workplaceAddress: string
    workplaceLat: number
    workplaceLng: number
    transportModes: TransportMode[]
    maxCommuteMinutes: number
    lifestyleTemplateId?: string
}

export interface Analytics {
    totalAgents: number
    totalUsers: number
    totalListings: number
    totalSchedules: number
    totalPayments: number
    blockedAgents: number
}

export interface AgentDetail {
    agentId: string
    userId: string
    fullName: string
    email: string
    status: AgentStatus
    createdAt: string
    verifiedAt: string | null
    listingCount: number
}

export const PLACE_TYPE_OPTIONS: { value: string; label: string; emoji: string }[] = [
    { value: 'cafe', label: 'Café', emoji: '☕' },
    { value: 'gym', label: 'Gym', emoji: '🏋️' },
    { value: 'restaurant', label: 'Restaurant', emoji: '🍽️' },
    { value: 'supermarket', label: 'Supermarket', emoji: '🛒' },
    { value: 'pharmacy', label: 'Pharmacy', emoji: '💊' },
    { value: 'hospital', label: 'Hospital', emoji: '🏥' },
    { value: 'park', label: 'Park', emoji: '🌳' },
    { value: 'school', label: 'School', emoji: '🏫' },
    { value: 'library', label: 'Library', emoji: '📚' },
    { value: 'shopping_mall', label: 'Shopping Mall', emoji: '🛍️' },
    { value: 'night_club', label: 'Nightclub', emoji: '🎵' },
    { value: 'bar', label: 'Bar', emoji: '🍺' },
    { value: 'convenience_store', label: 'Convenience Store', emoji: '🏪' },
    { value: 'movie_theater', label: 'Cinema', emoji: '🎬' },
    { value: 'laundry', label: 'Laundry', emoji: '👕' },
    { value: 'atm', label: 'ATM', emoji: '🏧' },
]
