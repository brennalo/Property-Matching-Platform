using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace PropertyMatch.API.Models;

public enum UserRole { Tenant, Agent, Admin }
public enum UserStatus { Pending, Verified, Blocked }   // replaces IsActive bool
public enum ListingStatus { Draft, PendingPayment, Active, Inactive }
public enum ScheduleStatus { Pending, Confirmed, Cancelled }
public enum ResidencyType { Landed, Condo, Apartment, Townhouse, Studio }
public enum TransportMode { Driving, Walking, Transit, Bicycling }

// ── User ──────────────────────────────────────────────────────────────────────

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
}

// ── Email Verification ────────────────────────────────────────────────────────

public class EmailVerification
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Token { get; set; } = "";   // 32-byte random hex
    public DateTime ExpiresAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
}

// ── Agent ─────────────────────────────────────────────────────────────────────
// UserId is BOTH the primary key AND the foreign key to Users.

public class Agent
{
    // PK = FK (one-to-one, UserId owns the row)
    public Guid UserId { get; set; }

    public string? StripeCustomerId { get; set; }
    public int TokenBalance { get; set; } = 0;
    public string? LicenseNumber { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    public ICollection<Listing> Listings { get; set; } = [];
    public ICollection<Payment> Payments { get; set; } = [];
}

// ── Listing ───────────────────────────────────────────────────────────────────

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

    public ListingStatus Status { get; set; } = ListingStatus.Draft;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public string? SourceUrl { get; set; }
    public string? SourcePlatform { get; set; }

    public Agent Agent { get; set; } = null!;
    public ICollection<ListingImage> Images { get; set; } = [];
    public ICollection<ViewingSchedule> ViewingSchedules { get; set; } = [];
}

// ── Listing Image ─────────────────────────────────────────────────────────────

public class ListingImage
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ListingId { get; set; }
    [Required] public string S3Url { get; set; } = "";
    public int DisplayOrder { get; set; }

    public Listing Listing { get; set; } = null!;
}

// ── Lifestyle Template ────────────────────────────────────────────────────────

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

// ── Viewing Schedule ──────────────────────────────────────────────────────────

public class ViewingSchedule
{
    public Guid ListingId { get; set; }
    public DateTime ScheduledAt { get; set; }
    public Guid TenantId { get; set; }
    public ScheduleStatus Status { get; set; } = ScheduleStatus.Pending;

    public Listing Listing { get; set; } = null!;
    public User Tenant { get; set; } = null!;
}

// ── Payment ───────────────────────────────────────────────────────────────────

public class Payment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AgentId { get; set; }   // FK → Agents.UserId
    public Guid? ListingId { get; set; }

    [Required] public string StripePaymentIntentId { get; set; } = "";
    public string? StripeSessionId { get; set; }

    [Column(TypeName = "decimal(10,2)")]
    public decimal Amount { get; set; }

    [Required, MaxLength(50)]
    public string Status { get; set; } = "pending";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Agent Agent { get; set; } = null!;
}
