using Microsoft.EntityFrameworkCore;
using Microsoft.VisualBasic;
using PropertyMatch.API.Models;
using Stripe;
using System.Reflection.Emit;

namespace PropertyMatch.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<EmailVerification> EmailVerifications => Set<EmailVerification>();
    public DbSet<Agent> Agents => Set<Agent>();
    public DbSet<Listing> Listings => Set<Listing>();
    public DbSet<ListingImage> ListingImages => Set<ListingImage>();
    public DbSet<LifestyleTemplate> LifestyleTemplates => Set<LifestyleTemplate>();
    public DbSet<ViewingSchedule> ViewingSchedules => Set<ViewingSchedule>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<AvailabilityTemplate> AvailabilityTemplates => Set<AvailabilityTemplate>();
    public DbSet<AvailabilityException> AvailabilityExceptions => Set<AvailabilityException>();
    public DbSet<Reviews> Reviews => Set<Reviews>();
    public DbSet<SearchLog> SearchLogs => Set<SearchLog>();
    public DbSet<ViewHistory> ViewHistory => Set<ViewHistory>();
    public DbSet<FavouriteListing> FavouriteListings => Set<FavouriteListing>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Feedback> Feedbacks => Set<Feedback>();
    public DbSet<Report> Reports => Set<Report>();
    public DbSet<ScoringConfig> ScoringConfig => Set<ScoringConfig>();
    protected override void OnModelCreating(ModelBuilder mb)
    {
        // ── Enum → string conversions ─────────────────────────────────────────
        mb.Entity<User>()
            .Property(u => u.Role).HasConversion<string>();
        mb.Entity<User>()
            .Property(u => u.Status).HasConversion<string>();
        mb.Entity<Listing>()
            .Property(l => l.Status).HasConversion<string>();
        mb.Entity<Listing>()
            .Property(l => l.ResidencyType).HasConversion<string>();
        mb.Entity<ViewingSchedule>()
            .Property(v => v.Status).HasConversion<string>();

        // ── Agent: UserId is BOTH PK and FK ──────────────────────────────────
        mb.Entity<Agent>()
            .HasKey(a => a.UserId);
        mb.Entity<Agent>()
            .HasOne(a => a.User)
            .WithOne(u => u.Agent)
            .HasForeignKey<Agent>(a => a.UserId);

        // ── EmailVerification ─────────────────────────────────────────────────
        mb.Entity<EmailVerification>()
            .HasOne(ev => ev.User)
            .WithMany(u => u.EmailVerifications)
            .HasForeignKey(ev => ev.UserId);
        mb.Entity<EmailVerification>()
            .HasIndex(ev => ev.Token).IsUnique();

        // ── Listing FK → Agent.UserId ─────────────────────────────────────────
        mb.Entity<Listing>()
            .HasOne(l => l.Agent)
            .WithMany(a => a.Listings)
            .HasForeignKey(l => l.AgentId);

        // ── ListingImage ──────────────────────────────────────────────────────
        mb.Entity<ListingImage>()
            .HasOne(i => i.Listing)
            .WithMany(l => l.Images)
            .HasForeignKey(i => i.ListingId);
        mb.Entity<ListingImage>()
            .Property(i => i.Caption)
            .HasMaxLength(30);

    // ── Availability Templates ──────────────────────────────────────────────────
    mb.Entity<AvailabilityTemplate>()
        .HasOne(t => t.Agent)
        .WithMany(a => a.AvailabilityTemplates)
        .HasForeignKey(t => t.AgentId)
        .OnDelete(DeleteBehavior.Cascade);

    mb.Entity<AvailabilityTemplate>()
        .HasOne(t => t.Listing)
        .WithMany(l => l.AvailabilityTemplates)
        .HasForeignKey(t => t.ListingId)
        .OnDelete(DeleteBehavior.Cascade);

    mb.Entity<AvailabilityTemplate>()
        .Property(t => t.SlotDurationMinutes)
        .HasDefaultValue(60);

    // ── Availability Exceptions ──────────────────────────────────────────────────
    mb.Entity<AvailabilityException>()
        .HasOne(e => e.Agent)
        .WithMany(a => a.AvailabilityExceptions)
        .HasForeignKey(e => e.AgentId)
        .OnDelete(DeleteBehavior.Cascade);

    mb.Entity<AvailabilityException>()
        .HasOne(e => e.Listing)
        .WithMany(l => l.AvailabilityExceptions)
        .HasForeignKey(e => e.ListingId)
        .OnDelete(DeleteBehavior.Cascade);

    mb.Entity<AvailabilityException>()
        .Property(e => e.Type)
        .HasConversion<string>();


        // ── ViewingSchedule composite PK ──────────────────────────────────────
        mb.Entity<ViewingSchedule>()
            .HasKey(v => new { v.ListingId, v.ScheduledAt });
        mb.Entity<ViewingSchedule>()
            .HasOne(v => v.Listing)
            .WithMany(l => l.ViewingSchedules)
            .HasForeignKey(v => v.ListingId);
        mb.Entity<ViewingSchedule>()
            .HasOne(v => v.Tenant)
            .WithMany(u => u.ViewingSchedules)
            .HasForeignKey(v => v.TenantId);

        // ── Payment FK → Agent.UserId ─────────────────────────────────────────
        mb.Entity<Payment>()
            .HasOne(p => p.Agent)
            .WithMany(a => a.Payments)
            .HasForeignKey(p => p.AgentId);

        // ── LifestyleTemplate ─────────────────────────────────────────────────
        mb.Entity<LifestyleTemplate>()
            .Property(t => t.PlaceTypes)
            .HasColumnType("text[]");

        // ── Indexes ────────────────────────────────────────────────────────────
        mb.Entity<User>().HasIndex(u => u.Email).IsUnique();
        mb.Entity<Listing>().HasIndex(l => l.Status);
        mb.Entity<Listing>().HasIndex(l => l.AgentId);
        mb.Entity<AvailabilityTemplate>()
    .HasIndex(t => new { t.AgentId, t.ListingId })
    .HasDatabaseName("IX_AvailabilityTemplates_AgentId_ListingId");

        mb.Entity<AvailabilityTemplate>()
            .HasIndex(t => t.DayOfWeek)
            .HasDatabaseName("IX_AvailabilityTemplates_DayOfWeek");

        mb.Entity<AvailabilityException>()
            .HasIndex(e => new { e.AgentId, e.ListingId })
            .HasDatabaseName("IX_AvailabilityExceptions_AgentId_ListingId");

        mb.Entity<AvailabilityException>()
            .HasIndex(e => new { e.ExceptionFrom, e.ExceptionTo })
            .HasDatabaseName("IX_AvailabilityExceptions_ExceptionFrom_ExceptionTo");

        // SearchLog composite PK
        mb.Entity<SearchLog>()
            .HasKey(s => new { s.TenantId, s.SearchedAt });

        // ViewHistory composite PK
        mb.Entity<ViewHistory>()
            .HasKey(v => new { v.TenantId, v.ListingId, v.ViewedAt });

        // FavouriteListing composite PK
        mb.Entity<FavouriteListing>()
            .HasKey(f => new { f.TenantId, f.ListingId });

        // Conversation unique constraint
        mb.Entity<Conversation>()
            .HasIndex(c => new { c.TenantId, c.ListingId })
            .IsUnique();

        // Message → Sender (no cascade to avoid multiple cascade paths)
        mb.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany(u => u.SentMessages)
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        mb.Entity<ScoringConfig>().HasData(
            new ScoringConfig { Id = 1 });

        // Feedback
        mb.Entity<Feedback>()
            .HasOne(f => f.Tenant)
            .WithMany(u => u.Feedbacks)
            .HasForeignKey(f => f.TenantId)
            .OnDelete(DeleteBehavior.Cascade);

        mb.Entity<Feedback>()
            .HasIndex(f => f.CreatedAt);

    }
}
