using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PropertyMatch.API.Models;

public enum UserRole { Tenant, Agent, Admin }
public enum UserStatus { Pending, Unapproved, Verified, Blocked }
public enum ListingStatus { Draft, Active, Inactive, Booked }
public enum ScheduleStatus { Pending, Confirmed, Cancelled }
public enum ResidencyType { Landed, Condo, Apartment, Townhouse, Studio, MasterRoom, SharedRoom }
public enum TransportMode { Driving, Walking, Transit, Bicycling }

// ── User ────────────────────────────────────────────────────────────────

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(255)]
    public string Email { get; set; } = "";

    [Required]
    public string PasswordHash { get; set; } = "";

    [Required, MaxLength(100)]
    public string FullName { get; set; } = "";

    public UserRole Role { get; set; } = UserRole.Tenant;
    public UserStatus Status { get; set; } = UserStatus.Pending;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? VerifiedAt { get; set; }

    // Navigation
    public Agent? Agent { get; set; }
    public ICollection<EmailVerification> EmailVerifications { get; set; } = [];
    public ICollection<LifestyleTemplate> LifestyleTemplates { get; set; } = [];
    public ICollection<ViewingSchedule> ViewingSchedules { get; set; } = [];
    public ICollection<Conversation> Conversations { get; set; } = [];
    public ICollection<Message> SentMessages { get; set; } = [];
    public ICollection<FavouriteListing> FavouriteListings { get; set; } = [];
    public ICollection<ViewHistory> ViewHistory { get; set; } = [];
    public ICollection<SearchLog> SearchLogs { get; set; } = [];
    public ICollection<Models.Review> Reviews { get; set; } = new List<Models.Review>();
    public ICollection<Feedback> Feedbacks { get; set; } = [];
}

// ── Email Verification ───────────────────────────────────────────────────────

public class EmailVerification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Token { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}

// ── Agent ────────────────────────────────────────────────────────────────
// UserId is BOTH the primary key AND the foreign key to Users.

public class Agent
{
    // PK = FK (one-to-one, UserId owns the row)
    public Guid UserId { get; set; }

    public string? StripeCustomerId { get; set; }
    public int TokenBalance { get; set; } = 0;
    public string? LicenseNumber { get; set; }
    public string? ContactNo { get; set; }
    public decimal? Ratings { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<Listing> Listings { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];
    public ICollection<AvailabilityTemplate> AvailabilityTemplates { get; set; } = new List<AvailabilityTemplate>();
    public ICollection<AvailabilityException> AvailabilityExceptions { get; set; } = new List<AvailabilityException>();
    public ICollection<Conversation> Conversations { get; set; } = [];
    public ICollection<Models.Review> Reviews { get; set; } = new List<Models.Review>();
}

// ── Listing ───────────────────────────────────────────────────────────────

public class Listing
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AgentId { get; set; }   // FK → Agents.UserId

    [Required, MaxLength(300)] public string Name { get; set; } = "";
    public int Rooms { get; set; }
    public int Toilets { get; set; }
    public double Lat { get; set; }
    public double Lng { get; set; }

    [Required, MaxLength(500)] public string Address { get; set; } = "";

    public ResidencyType ResidencyType { get; set; }

    [Column(TypeName = "decimal(12,2)")]
    public decimal Price { get; set; }
    public string? Amenities { get; set; }
    public string? Description { get; set; }
    public ListingStatus Status { get; set; } = ListingStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public Agent Agent { get; set; } = null!;
    public ICollection<ListingImage> Images { get; set; } = [];
    public ICollection<ViewingSchedule> ViewingSchedules { get; set; } = [];
    public ICollection<AvailabilityException> AvailabilityExceptions { get; set; } = new List<AvailabilityException>();
    public ICollection<FavouriteListing> FavouritedBy { get; set; } = [];
    public ICollection<Conversation> Conversations { get; set; } = [];
    public ICollection<ViewHistory> ViewHistory { get; set; } = [];
}

// ── Listing Image ─────────────────────────────────────────────────────────

public class ListingImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ListingId { get; set; }
    [Required] public string S3Url { get; set; } = "";
    public int DisplayOrder { get; set; }
    [MaxLength(30)] public string? Caption { get; set; }

    public Listing Listing { get; set; } = null!;
}

// ── Agent Availability Template────────────────────────────────────────────────────────

public class AvailabilityTemplate
{
    public Guid Id { get; set; }
    public Guid AgentId { get; set; }


    public int DayOfWeek { get; set; } // 0=Sunday, 1=Monday, ..., 6=Saturday
    public string StartTime { get; set; } = "09:00"; // HH:mm
    public string EndTime { get; set; } = "17:00";
    public int SlotDurationMinutes { get; set; } = 60;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Agent? Agent { get; set; }

}

// ── Agent Availability Exception────────────────────────────────────────────────────────

public enum ExceptionType
{
    Blocked,
    CustomHours
}

public class AvailabilityException
{
    public Guid Id { get; set; }
    public Guid AgentId { get; set; }
    public Guid? ListingId { get; set; }

    public DateTime ExceptionFrom { get; set; }
    public DateTime ExceptionTo { get; set; }
    public ExceptionType Type { get; set; } = ExceptionType.Blocked;

    public string? StartTime { get; set; } // only for CustomHours
    public string? EndTime { get; set; }   // only for CustomHours
    public string? Reason { get; set; }
    public int SlotDurationMinutes { get; set; } = 60;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;


    public Agent? Agent { get; set; }
    public Listing? Listing { get; set; }
}

// ── Lifestyle Template ───────────────────────────────────────────────────────

public class LifestyleTemplate
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }

    [Required, MaxLength(100)]
    public string Name { get; set; } = "";

    public List<string> PlaceTypes { get; set; } = [];
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Tenant { get; set; } = null!;
}

// ── Viewing Schedule ────────────────────────────────────────────────────────

public class ViewingSchedule
{
    public Guid Id { get; set; }
    public Guid ListingId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public Guid TenantId { get; set; }
    public ScheduleStatus Status { get; set; } = ScheduleStatus.Pending;
    public string? Reason { get; set; }

    // Navigation
    public Listing Listing { get; set; } = null!;
    public User Tenant { get; set; } = null!;
    public ICollection<Models.Review> Reviews { get; set; } = new List<Models.Review>();
}

// ── Payment ───────────────────────────────────────────────────────────

public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AgentId { get; set; }   // FK → Agents.UserId
    public int TokensPurchased { get; set; } = 0;
    [Required] public string StripePaymentIntentId { get; set; } = "";
    public string? StripeSessionId { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "pending";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Agent Agent { get; set; } = null!;
}

// ── Review ────────────────────────────────────────────────────────────────
public class Review
{
    public Guid Id { get; set; }
    public Guid AgentId { get; set; }
    public Guid TenantId { get; set; }
    public int Rating { get; set; }  // 1-5
    public string ReviewText { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Guid? ViewingScheduleId { get; set; }
    public Guid? ConversationId { get; set; }

    // Navigation
    public Agent Agent { get; set; } = null!;
    public User Tenant { get; set; } = null!;
    public ViewingSchedule? ViewingSchedule { get; set; }
    public Conversation? Conversation { get; set; }
}

// ── SearchLog ─────────────────────────────────────────────────────────────
public class SearchLog
{
    public Guid TenantId { get; set; }
    public DateTime SearchedAt { get; set; } = DateTime.UtcNow;
    public string Snapshot { get; set; } = "{}";  // JSON string

    public User Tenant { get; set; } = null!;
}

// ── ViewHistory ───────────────────────────────────────────────────────────
public class ViewHistory
{
    public Guid TenantId { get; set; }
    public Guid ListingId { get; set; }
    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

    public User Tenant { get; set; } = null!;
    public Listing Listing { get; set; } = null!;
}

// ── FavouriteListing ──────────────────────────────────────────────────────
public class FavouriteListing
{
    public Guid TenantId { get; set; }
    public Guid ListingId { get; set; }
    public DateTime SavedAt { get; set; } = DateTime.UtcNow;

    public User Tenant { get; set; } = null!;
    public Listing Listing { get; set; } = null!;
}

// ── Conversation ──────────────────────────────────────────────────────────
public class Conversation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public Guid ListingId { get; set; }
    public Guid AgentId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime LastMessageAt { get; set; } = DateTime.UtcNow;
    public DateTime? TenantLastReadAt { get; set; }
    public DateTime? AgentLastReadAt { get; set; }

    public User Tenant { get; set; } = null!;
    public Listing Listing { get; set; } = null!;
    public Agent Agent { get; set; } = null!;
    public ICollection<Message> Messages { get; set; } = [];
    public ICollection<Models.Review> Reviews { get; set; } = new List<Models.Review>();
}

// ── Message ───────────────────────────────────────────────────────────────
public class Message
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ConversationId { get; set; }
    public Guid SenderId { get; set; }
    public string SenderRole { get; set; } = "";
    public string Content { get; set; } = "";
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Conversation Conversation { get; set; } = null!;
    public User Sender { get; set; } = null!;
}

// ── Feedback ──────────────────────────────────────────────────────────────
public class Feedback
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Subject { get; set; } = "";
    public string Description { get; set; } = "";
    public string? AdminComment { get; set; }
    public string Status { get; set; } = "Open";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public User Tenant { get; set; } = null!;
} // push?

// ── Report ────────────────────────────────────────────────────────────────
public class Report
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid TenantId { get; set; }
    public string Item { get; set; } = "";   // "agent" or "listing"
    public Guid ItemId { get; set; }
    public string Description { get; set; } = "";
    public string Status { get; set; } = "Open";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Tenant { get; set; } = null!;

    public ICollection<ReportEvidenceImage> EvidenceImages { get; set; } = [];
}
public class ReportEvidenceImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ReportId { get; set; }
    public string S3Url { get; set; } = "";
    public DateTime UploadedAt { get; set; } = DateTime.UtcNow;

    public Report Report { get; set; } = null!;
}

public class ScoringConfig
{
    public int Id { get; set; } = 1; // singleton row
    public double WeightNumeric { get; set; } = 0.40;
    public double WeightCommute { get; set; } = 0.30;
    public double WeightLifestyle { get; set; } = 0.30;
    public int LifestyleRadiusMeters { get; set; } = 800;
}