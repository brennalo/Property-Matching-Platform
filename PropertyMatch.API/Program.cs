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

var builder = WebApplication.CreateBuilder(args);

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

// ── Application Services ───────────────────────────────────────────────────
builder.Services.AddScoped<JwtService>();
builder.Services.AddScoped<MatchingService>();
builder.Services.AddScoped<GoogleRoutesService>();
builder.Services.AddScoped<GooglePlacesService>();
builder.Services.AddScoped<StripeService>();
builder.Services.AddScoped<S3Service>();
builder.Services.AddScoped<ResendEmailService>();
builder.Services.AddScoped<AvailabilityService>();
builder.Services.AddHostedService<ViewingReminderService>();
builder.Services.AddHttpClient();

builder.Services.AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.Converters.Add(
            new System.Text.Json.Serialization.JsonStringEnumConverter());
    });

// ── Stripe ────────────────────────────────────────────────────────────────────
StripeConfiguration.ApiKey = builder.Configuration["Stripe:SecretKey"];

var app = builder.Build();

// ── Auto-migrate ────────────────────────────────────────────────────────────
// using (var scope = app.Services.CreateScope())
// {
//     var dbCtx = scope.ServiceProvider.GetRequiredService<AppDbContext>();
//     dbCtx.Database.Migrate();
// }

app.UseCors("Frontend");

// ── Serve React SPA from wwwroot ───────────────────────────────────────────
// Vite dist/ is copied here by the .csproj BeforeTargets="Build" step.
app.UseDefaultFiles();   // serves index.html for /
app.UseStaticFiles();    // serves JS/CSS/assets
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapFallbackToFile("index.html");

app.Run();