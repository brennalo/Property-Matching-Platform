using PropertyMatch.API.Models;
using PropertyMatch.API.Services;

namespace PropertyMatch.API.DTOs;

// ── Auth ────────────────────────────────────────────────────────────────

public record RegisterRequest(
    string Email,
    string Password,
    string FullName,
    UserRole Role,
    string? LicenseNumber = null);   // agents only

public record LoginRequest(string Email, string Password);

public record AuthResponse(
    Guid UserId,
    string Email,
    string FullName,
    UserRole Role,
    UserStatus Status,       // Pending | Verified | Blocked
    DateTime? VerifiedAt);

public record ResendVerificationRequest(string Email);

// ── Listings ───────────────────────────────────────────────────────────────

public record CreateListingRequest(
    string Name, int Rooms, int Toilets,
    double Lat, double Lng, string Address,
    ResidencyType ResidencyType, decimal Price);

public record UpdateListingRequest(
    string? Name, int? Rooms, int? Toilets,
    double? Lat, double? Lng, string? Address,
    ResidencyType? ResidencyType, decimal? Price);

// For batch upload
public record BatchListingRequest(
    string PropertyName, int Bedrooms, int Bathrooms, int Toilets,
    string Address, decimal Price, string Type,
    double Latitude, double Longitude, string Description);

public record BatchListingResponse(
    int SuccessCount, int FailureCount, List<string> Errors);

// Image DTO with caption
public record ImageDto(
    Guid Id, string Url, int DisplayOrder, string? Caption);

public record ListingResponse(
    Guid Id, Guid AgentId, string AgentName,
    string Name, int Rooms, int Toilets,
    double Lat, double Lng, string Address,
    ResidencyType ResidencyType, decimal Price,
    ListingStatus Status, DateTime CreatedAt,
    List<ImageDto> Images,
    string? SourceUrl, string? SourcePlatform);

// Image reorder request
public record ReorderImageRequest(
    Guid ImageId, int DisplayOrder);

// Image upload with caption
public record ImageUploadWithCaptionRequest(
    string? Caption);

// ── Match ────────────────────────────────────────────────────────────────

public record PlaceLocationDto(string Name, double Lat, double Lng);

public record ModeCommuteResult(
    TransportMode Mode,
    int DurationMinutes,
    double DistanceKm,
    string? EncodedPolyline,
    List<TransitStep>? TransitSteps);

public record MatchRequest(
    int? Rooms, int? Toilets,
    ResidencyType? ResidencyType,
    decimal? PriceMin, decimal? PriceMax,
    string WorkplaceAddress,
    double WorkplaceLat, double WorkplaceLng,
    List<TransportMode> TransportModes,
    int MaxCommuteMinutes,
    Guid? LifestyleTemplateId);

public record MatchedListingResponse(
    ListingResponse Listing,
    double NumericScore,
    double CommuteScore,
    double LifestyleScore,
    double TotalScore,
    int? CommuteMinutes,
    Dictionary<string, List<PlaceLocationDto>> LifestylePlaces,
    List<ModeCommuteResult> CommuteRoutes);

// ── Lifestyle Templates ───────────────────────────────────────────────────────

public record CreateTemplateRequest(string Name, List<string> PlaceTypes);
public record TemplateResponse(Guid Id, string Name, List<string> PlaceTypes, DateTime CreatedAt);

// ── Schedules ──────────────────────────────────────────────────────────────

public record CreateScheduleRequest(Guid ListingId, DateTime ScheduledAt);

public record ScheduleResponse(
    Guid ListingId, string ListingName, string ListingAddress,
    Guid TenantId, string TenantName,
    DateTime ScheduledAt, ScheduleStatus Status);

public record BookedSlotResponse(DateTime ScheduledAt, ScheduleStatus Status);

// ── Availability Template & Exception ──────────────────────────────────────────────────────────────

public record AvailabilityTemplateRequest(
    int DayOfWeek,
    string StartTime,
    string EndTime,
    int? SlotDurationMinutes = null,
    DateTime? ValidFrom = null,
    DateTime? ValidTo = null,
    Guid? ListingId = null
);

public record AvailabilityTemplateResponse(
    Guid Id,
    int DayOfWeek,
    string StartTime,
    string EndTime,
    int SlotDurationMinutes,
    DateTime? ValidFrom,
    DateTime? ValidTo,
    Guid? ListingId,
    bool IsActive,
    DateTime CreatedAt
);

public record AvailabilityExceptionRequest(
    DateTime ExceptionFrom,
    DateTime ExceptionTo,
    string Type,
    string? StartTime = null,
    string? EndTime = null,
    string? Reason = null,
    Guid? ListingId = null
);

public record AvailabilityExceptionResponse(
    Guid Id,
    DateTime ExceptionFrom,
    DateTime ExceptionTo,
    string Type,
    string? StartTime,
    string? EndTime,
    string? Reason,
    Guid? ListingId,
    DateTime CreatedAt
);

public record AvailableSlotDto(
    DateTime Date,
    string StartTime,
    string EndTime,
    bool IsBooked
);


public record AgentAvailabilitySummaryResponse(
    List<AvailabilityTemplateResponse> Templates,
    List<AvailabilityExceptionResponse> Exceptions
);

// ── Payments ───────────────────────────────────────────────────────────────

public record CreateCheckoutRequest(Guid ListingId);
public record CheckoutResponse(string CheckoutUrl, string SessionId);

// ── Admin ───────────────────────────────────────────────────────────────

public record AnalyticsResponse(
    int TotalAgents, int TotalUsers, int TotalListings,
    int TotalSchedules, int TotalPayments, int BlockedAgents);

public record AgentDetailResponse(
    Guid UserId, string FullName, string Email,
    UserStatus Status,
    DateTime CreatedAt, DateTime? VerifiedAt,
    int ListingCount, string? LicenseNumber, int TokenBalance,
    string? LppehSearchUrl);

public record UpdateAgentStatusRequest(UserStatus Status);

public record AgentProfileDto(string FullName, string Email, string Status, int TokenBalance);
public record ListingStatsDto(int Active, int PendingPayment, int Draft, int Inactive);
public record AppointmentStatsDto(int Total, int Pending, int Confirmed, int Cancelled);
public record UpcomingViewingDto(Guid ListingId, string ListingName, DateTime ScheduledAt, string Status, string TenantName);
public record TopListingDto(Guid ListingId, string ListingName, int AppointmentCount);
public record PendingPaymentListingDto(Guid Id, string Name, decimal Price, DateTime CreatedAt);
public record AgentDashboardResponse(
    AgentProfileDto Profile,
    ListingStatsDto Listings,
    AppointmentStatsDto Appointments,
    List<UpcomingViewingDto> UpcomingViewings,
    List<TopListingDto> TopListings,
    List<PendingPaymentListingDto> PendingPayments
);
