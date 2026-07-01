using System.Text;
using Amazon.Extensions.NETCore.Setup;
using Amazon.S3;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using PropertyMatch.API.Data;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Services;
using Stripe;
using OfficeOpenXml;
using Microsoft.Extensions.Options;
using Microsoft.AspNetCore.Http.Features;
using PropertyMatch.API.Models;


var builder = WebApplication.CreateBuilder(args);
// Read from appsettings.json, but allow overrides from environment variables
// Load configuration
builder.Configuration
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true)
    .AddEnvironmentVariables();


// Set EPPlus license for non‑commercial use
ExcelPackage.License.SetNonCommercialPersonal("PropertyMatch");

// ── Database ───────────────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// ── JWT Auth ───────────────────────────────────────────────────────────────
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

// ── CORS ────────────────────────────────────────────────────────────────
builder.Services.AddCors(opt =>
    opt.AddPolicy("Frontend", policy =>
        policy
            .WithOrigins(
                builder.Configuration["Cors:AllowedOrigin"] ?? "http://localhost:5173",
                "http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials()));

// ── AWS S3 ───────────────────────────────────────────────────────────────
var useS3 = builder.Configuration.GetValue<bool>("Storage:UseS3", false);
if (useS3)
{
    builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());
    builder.Services.AddAWSService<IAmazonS3>();
}



// Add AWS services

// ── Application Services ───────────────────────────────────────────────────
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<MatchingService>();
builder.Services.AddScoped<GoogleRoutesService>();
builder.Services.AddScoped<GooglePlacesService>();
builder.Services.AddScoped<StripeService>();
builder.Services.AddScoped<S3Service>();
builder.Services.AddScoped<GroqService>();
builder.Services.AddScoped<ResendEmailService>();
builder.Services.AddScoped<AvailabilityService>();
builder.Services.AddHttpClient();
builder.Services.AddDefaultAWSOptions(builder.Configuration.GetAWSOptions());
builder.Services.AddAWSService<IAmazonS3>();
builder.Services.Configure<FormOptions>(options =>
{
    options.ValueLengthLimit = int.MaxValue;
    options.MultipartBodyLengthLimit = 25 * 1024 * 1024; // 25MB
    options.MemoryBufferThreshold = int.MaxValue;
});

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// ── Stripe ────────────────────────────────────────────────────────────────────
StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];

var app = builder.Build();

// Debug: check if AWS config loaded
var awsOptions = app.Services.GetRequiredService<IOptions<AWSOptions>>();
Console.WriteLine($"AWS Region: {awsOptions.Value.Region}");

// ── Auto-migrate ────────────────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var dbCtx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await dbCtx.Database.MigrateAsync();

    const string adminEmail = "admin@propertymatch.com";
    if (!await dbCtx.Users.AnyAsync(u => u.Email == adminEmail))
    {
        var adminId = Guid.Parse("00000000-0000-0000-0000-000000000001"); // fixed so it's stable
        dbCtx.Users.Add(new User
        {
            Id = adminId,
            FullName = "Admin",
            Email = adminEmail,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Role = UserRole.Admin,
            Status = UserStatus.Verified,
            CreatedAt = DateTime.UtcNow,
        });
        await dbCtx.SaveChangesAsync();
    }
}

app.UseCors("Frontend");

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Static files and SPA fallback come AFTER API routes
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

app.Run();