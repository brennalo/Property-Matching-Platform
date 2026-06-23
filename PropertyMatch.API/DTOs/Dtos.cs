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
    ResidencyType ResidencyType, decimal Price,
    string? Description = null);

public record UpdateListingRequest(
    string? Name,
    int? Rooms,
    int? Toilets,
    double? Lat,
    double? Lng,
    string? Address,
    ResidencyType? ResidencyType,
    decimal? Price,
    string? Description,
    string? Amenities
);

public record UpdateListingStatusRequest(ListingStatus Status);

// For batch upload
public record BatchListingRequest(
    string PropertyName, int Bedrooms, int Bathrooms, int Toilets,
    string Address, decimal Price, string Type,
    double Latitude, double Longitude, string Description,
    string Amenities);

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
    string? Amenities, string? Description,
    ListingStatus Status, DateTime CreatedAt,
    List<ImageDto> Images);

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
    List<ResidencyType>? ResidencyTypes,
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

// ── Description ───────────────────────────────────────────────────────
public record GenerateDescriptionRequest(
    string Name, int Rooms, int Toilets,
    string Address, ResidencyType ResidencyType, decimal Price,
    string? ExtraDetails = null);

public record GenerateDescriptionResponse(string Description);

// ── Lifestyle Templates ───────────────────────────────────────────────────────

public record CreateTemplateRequest(string Name, List<string> PlaceTypes);
public record TemplateResponse(Guid Id, string Name, List<string> PlaceTypes, DateTime CreatedAt);

// ── Schedules ──────────────────────────────────────────────────────────────

public record CreateScheduleRequest(Guid ListingId, DateTime ScheduledAt);

public record ScheduleResponse(
    Guid Id,
    Guid ListingId,
    string ListingName,
    string ListingAddress,
    Guid TenantId,
    string TenantName,
    DateTime ScheduledAt,
    ScheduleStatus Status,
    string? Reason
);

public record UpdateScheduleStatusRequest(
    ScheduleStatus Status,
    string? Reason = null
);

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
    Guid? ListingId = null,
    int? SlotDurationMinutes = null
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
    int SlotDurationMinutes,
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

public record TenantDetailResponse(
    Guid UserId,
    string FullName,
    string Email,
    UserStatus Status,
    DateTime CreatedAt,
    DateTime? VerifiedAt,
    int TotalViewings,
    int PendingViewings,
    int ConfirmedViewings,
    int CancelledViewings,
    DateTime? LastViewingAt
);

public record UpdateTenantStatusRequest(UserStatus Status);

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

// ── Favourites ────────────────────────────────────────────────────────────────
public record FavouriteResponse(
    Guid ListingId, string Name, string Address,
    decimal Price, string ResidencyType,
    int Rooms, int Toilets,
    string? ThumbnailUrl,
    string AgentName, DateTime SavedAt);

// ── Search Logs ───────────────────────────────────────────────────────────────
public record SearchLogResponse(DateTime SearchedAt, string Snapshot);
public record SaveSearchLogRequest(string Snapshot);

// ── View History ──────────────────────────────────────────────────────────────
public record ViewHistoryResponse(
    Guid ListingId, string Name, string Address,
    decimal Price, string ResidencyType,
    string? ThumbnailUrl, string AgentName, DateTime ViewedAt);

// ── Conversations ─────────────────────────────────────────────────────────────
public record OpenConversationRequest(Guid ListingId);

public record ConversationSummaryResponse(
    Guid Id, string ListingName,
    string TenantName, string AgentName,
    string? LastMessage, DateTime? LastMessageAt,
    int UnreadCount, Guid ListingId,
    Guid AgentId);

public record MessageResponse(
    Guid Id, Guid SenderId, string SenderRole,
    string Content, bool IsRead, DateTime CreatedAt);

public record SendMessageRequest(string Content);

// ── Browse / Landing Page ─────────────────────────────────────────────────────
public record BrowseListingResponse(
    Guid Id, string Name, string Address,
    double Lat, double Lng,
    decimal Price, string ResidencyType,
    int Rooms, int Toilets,
    string? Amenities, string? Description,
    List<string> Images,
    string AgentName, string? AgentLicense, string? AgentContact,
    int ViewingCount);

// ── Agent public profile (for listing detail page) ────────────────────────────
public record AgentPublicProfileResponse(
    Guid AgentId, string FullName,
    string? LicenseNumber, string? ContactNo, decimal? Ratings);

// ── Reviews ────────────────────────────────────────────────────────────────
public record CreateReviewRequest(
    int Rating,                      // 1-5
    string ReviewText,
    Guid? ViewingScheduleId = null,
    Guid? ConversationId = null
);

public record ReviewResponse(
    Guid Id,
    Guid AgentId,
    string AgentName,
    int Rating,
    string ReviewText,
    DateTime CreatedAt,
    string Source,
    string ListingName
);

public record AgentReviewSummary(
    double AverageRating,
    int TotalReviews,
    List<ReviewResponse> Reviews
);

public record UpdateReviewRequest(
    int Rating,
    string ReviewText
);
// ── Feedback ────────────────────────────
public record CreateFeedbackRequest(string Description);
public record FeedbackResponse(
    Guid Id,
    Guid TenantId,
    string TenantName,
    string TenantEmail,
    string Description,
    string Status,
    DateTime CreatedAt
);
public record UpdateFeedbackStatusRequest(string Status);

// ── Reports ────────────────────────────
public record CreateReportRequest(
    string Item,
    Guid ItemId,
    string Description
);

public record ReportResponse(
    Guid Id,
    Guid TenantId,
    string TenantName,
    string TenantEmail,
    string Item,
    Guid ItemId,
    string ItemName,
    string Description,
    string Status,
    DateTime CreatedAt
);

public record UpdateReportStatusRequest(string Status);
