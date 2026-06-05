using PropertyMatch.API.Models;

namespace PropertyMatch.API.DTOs;

// ── Auth ──────────────────────────────────────────────────────────────────────
public record RegisterRequest(string Email, string Password, string FullName, UserRole Role);
public record LoginRequest(string Email, string Password);
public record AuthResponse(Guid UserId, string Email, string FullName, UserRole Role);

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

/// <summary>
/// Per-mode commute result returned alongside the matched listing.
/// </summary>
public record ModeCommuteResult(
    TransportMode Mode,
    int DurationMinutes,
    double DistanceKm,
    string? EncodedPolyline);   // null when Routes API unavailable

public record MatchRequest(
    int? Rooms, int? Toilets,
    ResidencyType? ResidencyType,
    decimal? PriceMin, decimal? PriceMax,
    string WorkplaceAddress,
    double WorkplaceLat, double WorkplaceLng,
    /// <summary>One or more transport modes. Best (shortest) duration used for scoring.</summary>
    List<TransportMode> TransportModes,
    int MaxCommuteMinutes,
    Guid? LifestyleTemplateId);

public record MatchedListingResponse(
    ListingResponse Listing,
    double NumericScore,
    double CommuteScore,
    double LifestyleScore,
    double TotalScore,
    /// <summary>Shortest commute across all selected modes (null if API unavailable).</summary>
    int? CommuteMinutes,
    Dictionary<string, int> LifestyleCounts,
    /// <summary>Per-mode results for frontend route display.</summary>
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

// ── Payments ──────────────────────────────────────────────────────────────────
public record CreateCheckoutRequest(Guid ListingId);
public record CheckoutResponse(string CheckoutUrl, string SessionId);

// ── Admin ─────────────────────────────────────────────────────────────────────
public record AnalyticsResponse(
    int TotalAgents, int TotalUsers, int TotalListings,
    int TotalSchedules, int TotalPayments, int BlockedAgents);

public record AgentDetailResponse(
    Guid AgentId, Guid UserId, string FullName, string Email,
    AgentStatus Status, DateTime CreatedAt, DateTime? VerifiedAt,
    int ListingCount);

public record UpdateAgentStatusRequest(AgentStatus Status);
