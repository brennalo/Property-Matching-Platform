using PropertyMatch.API.Models;
using PropertyMatch.API.Services;

namespace PropertyMatch.API.DTOs;

// ── Auth ──────────────────────────────────────────────────────────────────────

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

// ── Listings ──────────────────────────────────────────────────────────────────

public record CreateListingRequest(
    string Name, int Rooms, int Toilets,
    double Lat, double Lng, string Address,
    ResidencyType ResidencyType, decimal Price);

public record UpdateListingRequest(
    string? Name, int? Rooms, int? Toilets,
    double? Lat, double? Lng, string? Address,
    ResidencyType? ResidencyType, decimal? Price);

public record ListingResponse(
    Guid Id, Guid AgentId, string AgentName,
    string Name, int Rooms, int Toilets,
    double Lat, double Lng, string Address,
    ResidencyType ResidencyType, decimal Price,
    ListingStatus Status, DateTime CreatedAt,
    List<string> ImageUrls,
    string? SourceUrl, string? SourcePlatform);

// ── Match ─────────────────────────────────────────────────────────────────────

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

// ── Schedules ─────────────────────────────────────────────────────────────────

public record CreateScheduleRequest(Guid ListingId, DateTime ScheduledAt);

public record ScheduleResponse(
    Guid ListingId, string ListingName, string ListingAddress,
    Guid TenantId, string TenantName,
    DateTime ScheduledAt, ScheduleStatus Status);

public record BookedSlotResponse(DateTime ScheduledAt, ScheduleStatus Status);

// ── Admin ─────────────────────────────────────────────────────────────────────

public record AnalyticsResponse(
    int TotalAgents, int TotalUsers, int TotalListings,
    int TotalSchedules, int TotalPayments, int BlockedAgents);

public record AgentDetailResponse(
    Guid UserId, string FullName, string Email,
    UserStatus Status,
    DateTime CreatedAt, DateTime? VerifiedAt,
    int ListingCount, string? LicenseNumber, int TokenBalance);

public record UpdateAgentStatusRequest(UserStatus Status);
