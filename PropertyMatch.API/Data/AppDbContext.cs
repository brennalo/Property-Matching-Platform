using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Agent> Agents => Set<Agent>();
    public DbSet<Listing> Listings => Set<Listing>();
    public DbSet<ListingImage> ListingImages => Set<ListingImage>();
    public DbSet<LifestyleTemplate> LifestyleTemplates => Set<LifestyleTemplate>();
    public DbSet<ViewingSchedule> ViewingSchedules => Set<ViewingSchedule>();
    public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        // Enums as strings
        mb.Entity<User>().Property(u => u.Role).HasConversion<string>();
        mb.Entity<Agent>().Property(a => a.Status).HasConversion<string>();
        mb.Entity<Listing>().Property(l => l.Status).HasConversion<string>();
        mb.Entity<Listing>().Property(l => l.ResidencyType).HasConversion<string>();
        mb.Entity<ViewingSchedule>().Property(v => v.Status).HasConversion<string>();

        // Composite PK on ViewingSchedule
        mb.Entity<ViewingSchedule>().HasKey(v => new { v.ListingId, v.ScheduledAt });

        // LifestyleTemplate: store PlaceTypes as PostgreSQL text array
        mb.Entity<LifestyleTemplate>()
            .Property(t => t.PlaceTypes)
            .HasColumnType("text[]");

        // Relationships
        mb.Entity<Agent>()
            .HasOne(a => a.User).WithOne(u => u.Agent)
            .HasForeignKey<Agent>(a => a.UserId);

        mb.Entity<Listing>()
            .HasOne(l => l.Agent).WithMany(a => a.Listings)
            .HasForeignKey(l => l.AgentId);

        mb.Entity<ListingImage>()
            .HasOne(i => i.Listing).WithMany(l => l.Images)
            .HasForeignKey(i => i.ListingId);

        mb.Entity<ViewingSchedule>()
            .HasOne(v => v.Listing).WithMany(l => l.ViewingSchedules)
            .HasForeignKey(v => v.ListingId);

        mb.Entity<ViewingSchedule>()
            .HasOne(v => v.Tenant).WithMany(u => u.ViewingSchedules)
            .HasForeignKey(v => v.TenantId);

        mb.Entity<Payment>()
            .HasOne(p => p.Agent).WithMany(a => a.Payments)
            .HasForeignKey(p => p.AgentId);

        // Indexes
        mb.Entity<User>().HasIndex(u => u.Email).IsUnique();
        mb.Entity<Listing>().HasIndex(l => l.Status);
        mb.Entity<Listing>().HasIndex(l => l.AgentId);
    }
}
