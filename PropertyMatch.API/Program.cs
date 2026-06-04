using System.Text;
//using Amazon.S3;
//using Amazon.Extensions.NETCore.Setup;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PropertyMatch.API.Data;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Services;
using PropertyMatch.API.Models;


var builder = WebApplication.CreateBuilder(args);

// ── Database (NeonDB / PostgreSQL) ────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── JWT Auth ──────────────────────────────────────────────────────────────────
var jwtSecret = builder.Configuration["Jwt:Secret"]
    ?? throw new InvalidOperationException("Jwt:Secret must be configured");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        opt.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "PropertyMatch",
            ValidAudience = builder.Configuration["Jwt:Issuer"] ?? "PropertyMatch",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret))
        };

        // Read JWT from httpOnly cookie
        opt.Events = new JwtBearerEvents
        {
            OnMessageReceived = ctx =>
            {
                if (ctx.Request.Cookies.TryGetValue("auth_token", out var token))
                    ctx.Token = token;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

// ── CORS ──────────────────────────────────────────────────────────────────────
builder.Services.AddCors(opt =>
    opt.AddPolicy("Frontend", policy =>
        policy
            .WithOrigins(
                builder.Configuration["Cors:AllowedOrigin"] ?? "http://localhost:5173",
                "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials())); // required for cookies

// ── AWS S3 ────────────────────────────────────────────────────────────────────
//builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());
//builder.Services.AddAWSService<IAmazonS3>();


// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<MatchingService>();
builder.Services.AddScoped<GoogleRoutesService>();
builder.Services.AddScoped<GooglePlacesService>();
builder.Services.AddScoped<StripeService>();
builder.Services.AddScoped<S3Service>();
builder.Services.AddScoped<PropertyScraperService>();
builder.Services.AddHttpClient();



// ── Application Services ──────────────────────────────────────────────────────
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // 1. Forces all Enums (like UserRole.Admin) to output as strings like "Admin"
        options.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
        
        // 2. Enforces camelCase naming consistency matching your frontend assets
        options.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    });

// ── Stripe global key ─────────────────────────────────────────────────────────
Stripe.StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];

var app = builder.Build();

// ── Auto-migrate and data seed on startup ─────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var dbCtx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    
    // 1. Run migrations safely
    dbCtx.Database.Migrate();

    // 2. Safe Seed check (avoids structural migration tracking collisions)
    var adminId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    if (!dbCtx.Users.Any(u => u.Id == adminId))
    {
        var seedDate = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        
        // Add Admin
        dbCtx.Users.Add(new User
        {
            Id = adminId,
            Email = "admin@propertymatch.com",
            PasswordHash = "$2a$11$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
            FullName = "System Admin",
            Role = UserRole.Admin,
            CreatedAt = seedDate,
            IsActive = true
        });

        // Add Agent User
        var agentUserId = Guid.Parse("00000000-0000-0000-0000-000000000002");
        var agentId = Guid.Parse("00000000-0000-0000-0000-000000000010");
        dbCtx.Users.Add(new User
        {
            Id = agentUserId,
            Email = "agent@propertymatch.com",
            PasswordHash = "$2a$11$K7rYPGMCHMbGLcRz4l5Ka.rUWs7NCe/iPoLFKEEFyFx3g7oa3f/Gq",
            FullName = "Demo Agent",
            Role = UserRole.Agent,
            CreatedAt = seedDate,
            IsActive = true
        });

        dbCtx.Agents.Add(new Agent
        {
            Id = agentId,
            UserId = agentUserId,
            Status = AgentStatus.Verified,
            VerifiedAt = seedDate
        });

        // Save users and agents before adding listings (so foreign keys match)
        dbCtx.SaveChanges();

        // Add listings
        var listings = new[]
        {
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), Name = "Skyline Residences", Rooms = 3, Toilets = 2, Lat = 3.1478, Lng = 101.6953, Address = "Jalan Ampang, Kuala Lumpur", ResidencyType = ResidencyType.Condo, Price = 2800m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000002"), Name = "The Greenfield", Rooms = 4, Toilets = 3, Lat = 3.0738, Lng = 101.5183, Address = "Subang Jaya, Selangor", ResidencyType = ResidencyType.Landed, Price = 4200m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000003"), Name = "Casa Mia Studio", Rooms = 1, Toilets = 1, Lat = 3.1579, Lng = 101.7123, Address = "Chow Kit, Kuala Lumpur", ResidencyType = ResidencyType.Studio, Price = 1100m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000004"), Name = "Mont Kiara Suites", Rooms = 2, Toilets = 2, Lat = 3.1720, Lng = 101.6500, Address = "Mont Kiara, Kuala Lumpur", ResidencyType = ResidencyType.Condo, Price = 3200m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000005"), Name = "Bangsar Bungalow", Rooms = 5, Toilets = 4, Lat = 3.1310, Lng = 101.6720, Address = "Bangsar, Kuala Lumpur", ResidencyType = ResidencyType.Landed, Price = 8500m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000006"), Name = "Petaling Jaya Urban Flat", Rooms = 2, Toilets = 1, Lat = 3.1073, Lng = 101.6067, Address = "Section 14, Petaling Jaya", ResidencyType = ResidencyType.Apartment, Price = 1600m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000007"), Name = "Damansara Heights Manor", Rooms = 4, Toilets = 3, Lat = 3.1483, Lng = 101.6393, Address = "Damansara Heights, Kuala Lumpur", ResidencyType = ResidencyType.Townhouse, Price = 5600m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000008"), Name = "Cheras Link Home", Rooms = 3, Toilets = 2, Lat = 3.0790, Lng = 101.7347, Address = "Cheras, Kuala Lumpur", ResidencyType = ResidencyType.Landed, Price = 2300m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000009"), Name = "KLCC Tower View", Rooms = 2, Toilets = 2, Lat = 3.1579, Lng = 101.7123, Address = "KLCC, Kuala Lumpur", ResidencyType = ResidencyType.Condo, Price = 4500m },
            new { Id = Guid.Parse("10000000-0000-0000-0000-000000000010"), Name = "Sri Hartamas Corner Lot", Rooms = 3, Toilets = 3, Lat = 3.1680, Lng = 101.6404, Address = "Sri Hartamas, Kuala Lumpur", ResidencyType = ResidencyType.Landed, Price = 3800m }
        };

        foreach (var l in listings)
        {
            dbCtx.Listings.Add(new Listing
            {
                Id = l.Id,
                AgentId = agentId,
                Name = l.Name,
                Rooms = l.Rooms,
                Toilets = l.Toilets,
                Lat = l.Lat,
                Lng = l.Lng,
                Address = l.Address,
                ResidencyType = l.ResidencyType,
                Price = l.Price,
                Status = ListingStatus.Active,
                CreatedAt = seedDate
            });
        }

        dbCtx.SaveChanges();
    }
}





app.UseStaticFiles();
app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapFallbackToFile("index.html");

app.Run();
