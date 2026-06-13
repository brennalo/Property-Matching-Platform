using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Models;

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
    public DbSet<AgentAvailability> AgentAvailabilities => Set<AgentAvailability>();

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

        // ── AgentAvailability ─────────────────────────────────────────────────
        mb.Entity<AgentAvailability>()
            .HasOne(a => a.Agent)
            .WithMany(a => a.Availabilities)
            .HasForeignKey(a => a.AgentId);

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
        mb.Entity<AgentAvailability>().HasIndex(a => a.AgentId);
    }
}
