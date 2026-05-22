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

        // Seed admin user (password: Admin@123)
        // Hash pre-computed: BCrypt.Net.BCrypt.HashPassword("Admin@123")
        var adminId = Guid.Parse("00000000-0000-0000-0000-000000000001");
        var seedDate = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        mb.Entity<User>().HasData(new User
        {
            Id = adminId,
            Email = "admin@propertymatch.com",
            PasswordHash = "$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
            FullName = "System Admin",
            Role = UserRole.Admin,
            CreatedAt = seedDate,
            IsActive = true
        });

        // Seed dummy agent user (password: Agent@123)
        // Hash pre-computed: BCrypt.Net.BCrypt.HashPassword("Agent@123")
        var agentUserId = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var agentId = Guid.Parse("00000000-0000-0000-0000-000000000010");
        mb.Entity<User>().HasData(new User
        {
            Id = agentUserId,
            Email = "agent@propertymatch.com",
            PasswordHash = "$2a$11$K7rYPGMCHMbGLcRz4l5Ka.rUWs7NCe/iPoLFKEEFyFx3g7oa3f/Gq",
            FullName = "Demo Agent",
            Role = UserRole.Agent,
            CreatedAt = seedDate,
            IsActive = true
        });
        mb.Entity<Agent>().HasData(new Agent
        {
            Id = agentId,
            UserId = agentUserId,
            Status = AgentStatus.Verified,
            VerifiedAt = seedDate
        });

        // Seed 10 dummy listings
        var listings = new[]
        {
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Name = "Skyline Residences",        Rooms = 3, Toilets = 2, Lat = 3.1478, Lng = 101.6953, Address = "Jalan Ampang, Kuala Lumpur",       ResidencyType = ResidencyType.Condo,     Price = 2800m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Name = "The Greenfield",             Rooms = 4, Toilets = 3, Lat = 3.0738, Lng = 101.5183, Address = "Subang Jaya, Selangor",          ResidencyType = ResidencyType.Landed,    Price = 4200m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Name = "Casa Mia Studio",            Rooms = 1, Toilets = 1, Lat = 3.1579, Lng = 101.7123, Address = "Chow Kit, Kuala Lumpur",         ResidencyType = ResidencyType.Studio,    Price = 1100m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Name = "Mont Kiara Suites",          Rooms = 2, Toilets = 2, Lat = 3.1720, Lng = 101.6500, Address = "Mont Kiara, Kuala Lumpur",       ResidencyType = ResidencyType.Condo,     Price = 3200m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), Name = "Bangsar Bungalow",           Rooms = 5, Toilets = 4, Lat = 3.1310, Lng = 101.6720, Address = "Bangsar, Kuala Lumpur",          ResidencyType = ResidencyType.Landed,    Price = 8500m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000006"), Name = "Petaling Jaya Urban Flat",   Rooms = 2, Toilets = 1, Lat = 3.1073, Lng = 101.6067, Address = "Section 14, Petaling Jaya",      ResidencyType = ResidencyType.Apartment, Price = 1600m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000007"), Name = "Damansara Heights Manor",    Rooms = 4, Toilets = 3, Lat = 3.1483, Lng = 101.6393, Address = "Damansara Heights, Kuala Lumpur",ResidencyType = ResidencyType.Townhouse, Price = 5600m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000008"), Name = "Cheras Link Home",           Rooms = 3, Toilets = 2, Lat = 3.0790, Lng = 101.7347, Address = "Cheras, Kuala Lumpur",           ResidencyType = ResidencyType.Landed,    Price = 2300m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000009"), Name = "KLCC Tower View",            Rooms = 2, Toilets = 2, Lat = 3.1579, Lng = 101.7123, Address = "KLCC, Kuala Lumpur",             ResidencyType = ResidencyType.Condo,     Price = 4500m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000010"), Name = "Sri Hartamas Corner Lot",    Rooms = 3, Toilets = 3, Lat = 3.1680, Lng = 101.6404, Address = "Sri Hartamas, Kuala Lumpur",     ResidencyType = ResidencyType.Landed,    Price = 3800m },
        };

        foreach (var l in listings)
        {
            mb.Entity<Listing>().HasData(new Listing
            {
                Id = l.Id, AgentId = agentId, Name = l.Name,
                Rooms = l.Rooms, Toilets = l.Toilets,
                Lat = l.Lat, Lng = l.Lng, Address = l.Address,
                ResidencyType = l.ResidencyType, Price = l.Price,
                Status = ListingStatus.Active, CreatedAt = seedDate
            });
        }
    }
}
