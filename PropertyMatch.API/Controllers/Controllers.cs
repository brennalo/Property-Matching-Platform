using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;
using PropertyMatch.API.Services;

namespace PropertyMatch.API.Controllers;

// ── Match ─────────────────────────────────────────────────────────────────────
[ApiController]
[Route("api/match")]
[Authorize(Roles = "Tenant")]
public class MatchController(MatchingService matching, AppDbContext db) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Match([FromBody] MatchRequest req)
    {
        var tenantId = User.GetUserId();

        db.SearchLogs.Add(new SearchLog
        {
            TenantId = tenantId,
            SearchedAt = DateTime.UtcNow,
            Snapshot = System.Text.Json.JsonSerializer.Serialize(req)
        });

        await db.SaveChangesAsync();

        var results = await matching.MatchAsync(req, tenantId);
        return Ok(results);
    }
}

// ── Lifestyle Templates ───────────────────────────────────────────────────────
[ApiController]
[Route("api/lifestyle-templates")]
[Authorize(Roles = "Tenant")]
public class LifestyleTemplatesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = User.GetUserId();
        var templates = await db.LifestyleTemplates
            .Where(t => t.TenantId == userId)
            .OrderByDescending(t => t.CreatedAt)
            .ToListAsync();

        return Ok(templates.Select(t => new TemplateResponse(t.Id, t.Name, t.PlaceTypes, t.CreatedAt)));
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateTemplateRequest req)
    {
        var userId = User.GetUserId();
        var template = new LifestyleTemplate
        {
            TenantId = userId,
            Name = req.Name,
            PlaceTypes = req.PlaceTypes.Distinct().ToList()
        };
        db.LifestyleTemplates.Add(template);
        await db.SaveChangesAsync();
        return Ok(new TemplateResponse(template.Id, template.Name, template.PlaceTypes, template.CreatedAt));
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] CreateTemplateRequest req)
    {
        var userId = User.GetUserId();
        var template = await db.LifestyleTemplates.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == userId);
        if (template == null) return NotFound();

        template.Name = req.Name;
        template.PlaceTypes = req.PlaceTypes.Distinct().ToList();
        await db.SaveChangesAsync();
        return Ok(new TemplateResponse(template.Id, template.Name, template.PlaceTypes, template.CreatedAt));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        var template = await db.LifestyleTemplates.FirstOrDefaultAsync(t => t.Id == id && t.TenantId == userId);
        if (template == null) return NotFound();

        db.LifestyleTemplates.Remove(template);
        await db.SaveChangesAsync();
        return Ok(new { message = "Template deleted" });
    }
}

// ── Viewing Schedules ─────────────────────────────────────────────────────────
[ApiController]
[Route("api/schedules")]
[Authorize]
public class SchedulesController(AppDbContext db, ResendEmailService _resendEmailService) : ControllerBase
{
    // Tenant: book a viewing
    [HttpPost]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> Create([FromBody] CreateScheduleRequest req)
    {
        var tenantId = User.GetUserId();

        // Load listing with agent + user so we can send email
        var listing = await db.Listings
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .FirstOrDefaultAsync(l => l.Id == req.ListingId);
        if (listing == null) return NotFound(new { message = "Listing not found" });
        if (listing.Status != ListingStatus.Active)
            return BadRequest(new { message = "Listing is not active" });

        var scheduledAtUtc = req.ScheduledAt.ToUniversalTime();

        // Check for double-booking (FindAsync won't work — Id is the PK now)
        var exists = await db.ViewingSchedules
            .AnyAsync(v => v.ListingId == req.ListingId && v.ScheduledAt == scheduledAtUtc);
        if (exists)
            return Conflict(new { message = "This time slot is already booked" });

        var tenant = await db.Users.FindAsync(tenantId);
        if (tenant == null) return NotFound(new { message = "Tenant not found" });

        var schedule = new ViewingSchedule
        {
            Id = Guid.NewGuid(),
            ListingId = req.ListingId,
            ScheduledAt = scheduledAtUtc,
            TenantId = tenantId,
            Status = ScheduleStatus.Pending
        };

        db.ViewingSchedules.Add(schedule);
        await db.SaveChangesAsync();

        // Email agent: new viewing request (fire-and-forget)
        try
        {
            await _resendEmailService.SendViewingRequestToAgentAsync(
                listing.Agent.User.Email, listing.Agent.User.FullName,
                tenant.FullName, tenant.Email,
                listing.Name, listing.Address, schedule.ScheduledAt);
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[Email] Agent notification failed: {ex}");
        }

        return Ok(new { message = "Viewing scheduled successfully" });
    }

    // Tenant: view own schedules
    [HttpGet("mine")]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> GetMine()
    {
        var tenantId = User.GetUserId();
        var schedules = await db.ViewingSchedules
            .Include(v => v.Listing)
            .Include(v => v.Tenant)
            .Where(v => v.TenantId == tenantId)
            .OrderBy(v => v.ScheduledAt)
            .ToListAsync();

        return Ok(schedules.Select(MapResponse));
    }

    // Agent: view schedules for own listings (calendar)
    [HttpGet("agent")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetAgentSchedules()
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        var schedules = await db.ViewingSchedules
            .Include(v => v.Listing)
            .Include(v => v.Tenant)
            .Where(v => v.Listing.AgentId == agent.UserId)
            .OrderBy(v => v.ScheduledAt)
            .ToListAsync();

        return Ok(schedules.Select(MapResponse));
    }

    // Agent: confirm or cancel a schedule
    [HttpPatch("{listingId}/{scheduledAt}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> UpdateStatus(
        Guid listingId,
        DateTime scheduledAt,
        [FromBody] UpdateScheduleStatusRequest req)
    {
        var schedule = await db.ViewingSchedules
            .Include(v => v.Listing)
            .Include(v => v.Tenant)
            .FirstOrDefaultAsync(v =>
                v.ListingId == listingId &&
                v.ScheduledAt == scheduledAt.ToUniversalTime());

        if (schedule == null) return NotFound();

        // Require a reason for cancellation
        if (req.Status == ScheduleStatus.Cancelled && string.IsNullOrWhiteSpace(req.Reason))
            return BadRequest(new { message = "A reason is required for cancellation." });

        schedule.Status = req.Status;
        if (!string.IsNullOrWhiteSpace(req.Reason))
            schedule.Reason = req.Reason;

        await db.SaveChangesAsync();

        // Send email notifications
        if (req.Status == ScheduleStatus.Confirmed)
        {
            try
            {
                await _resendEmailService.SendViewingConfirmedToTenantAsync(
                    schedule.Tenant.Email, schedule.Tenant.FullName,
                    schedule.Listing.Name, schedule.Listing.Address,
                    schedule.ScheduledAt);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Email] Confirmation email failed: {ex}");
            }
        }
        else if (req.Status == ScheduleStatus.Cancelled)
        {
            try
            {
                await _resendEmailService.SendViewingRejectedToTenantAsync(
                    schedule.Tenant.Email, schedule.Tenant.FullName,
                    schedule.Listing.Name, schedule.ScheduledAt, req.Reason);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Email] Rejection email failed: {ex}");
            }
        }

        return Ok(new { message = "Schedule updated" });
    }

    private static ScheduleResponse MapResponse(ViewingSchedule v) => new(
        v.Id,
        v.ListingId,
        v.Listing?.Name ?? "",
        v.Listing?.Address ?? "",
        v.TenantId,
        v.Tenant?.FullName ?? "",
        v.ScheduledAt,
        v.Status,
        v.Reason);
}
//// ── Payments ──────────────────────────────────────────────────────────────────
//[ApiController]
//[Route("api/payments")]
//public class PaymentsController(StripeService stripe, IConfiguration config) : ControllerBase
//{
//    [HttpPost("checkout")]
//    [Authorize(Roles = "Agent")]
//    public async Task<IActionResult> CreateCheckout([FromBody] CreateCheckoutRequest req)
//    {
//        var userId = User.GetUserId();

//        var db = HttpContext.RequestServices.GetRequiredService<AppDbContext>();
//        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
//        if (agent == null) return NotFound();

//        var baseUrl = $"{Request.Scheme}://{Request.Host}";
//        var (url, sessionId) = await stripe.CreateListingCheckoutAsync(
//            agent.Id, req.ListingId,
//            successUrl: $"{baseUrl}/agent/listings?payment=success",
//            cancelUrl:  $"{baseUrl}/agent/listings?payment=cancelled");

//        return Ok(new CheckoutResponse(url, sessionId));
//    }

//    // Stripe webhook — no auth, uses Stripe-Signature header
//    [HttpPost("webhook")]
//    [AllowAnonymous]
//    public async Task<IActionResult> Webhook()
//    {
//        var json = await new StreamReader(Request.Body).ReadToEndAsync();
//        var signature = Request.Headers["Stripe-Signature"].FirstOrDefault() ?? "";

//        try
//        {
//            await stripe.HandleWebhookAsync(json, signature, config);
//            return Ok();
//        }
//        catch (InvalidOperationException ex)
//        {
//            return BadRequest(new { message = ex.Message });
//        }
//    }
//}

// ── Admin ─────────────────────────────────────────────────────────────────────
[ApiController]
[Route("api/admin")]
[Authorize(Roles = "Admin")]
public class AdminController(AppDbContext db) : ControllerBase
{
    [HttpGet("analytics")]
    public async Task<IActionResult> GetAnalytics()
    {
        var totalAgents = await db.Agents.CountAsync();
        var totalUsers = await db.Users.CountAsync(u => u.Role == UserRole.Tenant);
        var totalListings = await db.Listings.CountAsync();
        var totalSchedules = await db.ViewingSchedules.CountAsync();
        var totalPayments = await db.Payments.CountAsync(p => p.Status == "succeeded");
        var blockedAgents = await db.Users.CountAsync(u => u.Role == UserRole.Agent && u.Status == UserStatus.Blocked);

        return Ok(new AnalyticsResponse(
            totalAgents, totalUsers, totalListings,
            totalSchedules, totalPayments, blockedAgents));
    }

    [HttpGet("agents")]
    public async Task<IActionResult> GetAgents([FromQuery] UserStatus? status)
    {
        var query = db.Agents
            .Include(a => a.User)
            .Include(a => a.Listings)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(a => a.User.Status == status.Value);

        var agents = await query
            .OrderByDescending(a => a.User.CreatedAt)
            .ToListAsync();

        return Ok(agents.Select(a =>
        {
            var lppehUrl = LppehLicenseValidator.GenerateSearchUrl(a.LicenseNumber);

            return new AgentDetailResponse(
                a.UserId, a.User.FullName, a.User.Email,
                a.User.Status,
                a.User.CreatedAt, a.User.VerifiedAt,
                a.Listings.Count, a.LicenseNumber, a.TokenBalance,
                lppehUrl);
        }));
    }

    [HttpPut("agents/{id}/status")]
    public async Task<IActionResult> UpdateAgentStatus(Guid id, [FromBody] UpdateAgentStatusRequest req)
    {
        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == id);
        if (agent == null) return NotFound();

        // Admin will only approve agents after email verification
        if (req.Status == UserStatus.Verified && agent.User.Status == UserStatus.Pending)
        {
            return BadRequest(new { message = "Agent must verify email before admin approval." });
        }

        agent.User.Status = req.Status;

        if (req.Status == UserStatus.Verified && agent.User.VerifiedAt == null)
            agent.User.VerifiedAt = DateTime.UtcNow;

        if (req.Status == UserStatus.Blocked)
        {
            var listings = db.Listings.Where(l => l.AgentId == id);
            await listings.ForEachAsync(l => l.Status = ListingStatus.Inactive);
        }

        if (req.Status == UserStatus.Verified)
        {
            var listings = db.Listings.Where(l => l.AgentId == id && l.Status == ListingStatus.Inactive);
            await listings.ForEachAsync(l => l.Status = ListingStatus.Active);
        }

        await db.SaveChangesAsync();
        return Ok(new { message = $"Agent status updated to {req.Status}" });
    }

    [HttpGet("tenants")]
    public async Task<IActionResult> GetTenants([FromQuery] UserStatus? status)
    {
        var query = db.Users
            .Include(u => u.ViewingSchedules)
            .Where(u => u.Role == UserRole.Tenant)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(u => u.Status == status.Value);

        var tenants = await query
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();

        return Ok(tenants.Select(t => new TenantDetailResponse(
            t.Id,
            t.FullName,
            t.Email,
            t.Status,
            t.CreatedAt,
            t.VerifiedAt,
            t.ViewingSchedules.Count,
            t.ViewingSchedules.Count(v => v.Status == ScheduleStatus.Pending),
            t.ViewingSchedules.Count(v => v.Status == ScheduleStatus.Confirmed),
            t.ViewingSchedules.Count(v => v.Status == ScheduleStatus.Cancelled),
            t.ViewingSchedules
                .OrderByDescending(v => v.ScheduledAt)
                .Select(v => (DateTime?)v.ScheduledAt)
                .FirstOrDefault()
        )));
    }

    [HttpPut("tenants/{id}/status")]
    public async Task<IActionResult> UpdateTenantStatus(Guid id, [FromBody] UpdateTenantStatusRequest req)
    {
        var tenant = await db.Users
            .FirstOrDefaultAsync(u => u.Id == id && u.Role == UserRole.Tenant);

        if (tenant == null) return NotFound();

        tenant.Status = req.Status;

        if (req.Status == UserStatus.Verified && tenant.VerifiedAt == null)
            tenant.VerifiedAt = DateTime.UtcNow;

        await db.SaveChangesAsync();

        return Ok(new { message = $"Tenant status updated to {req.Status}" });
    }

    [HttpGet("listings")]
    public async Task<IActionResult> GetAllListings()
    {
        var listings = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return Ok(listings.Select(l => new
        {
            l.Id,
            l.Name,
            l.Status,
            l.Price,
            l.CreatedAt,
            Agent = l.Agent?.User?.FullName
        }));
    }

    // ── Advanced Analytics Endpoints ─────────────────────────────────────────

    [HttpGet("analytics/top-listings")]
    public async Task<IActionResult> GetTopListings([FromQuery] int top = 10)
    {
        var topListings = await db.ViewingSchedules
            .GroupBy(v => v.ListingId)
            .Select(g => new
            {
                listingId = g.Key,
                listingName = g.First().Listing.Name,
                agentName = g.First().Listing.Agent.User.FullName,
                appointmentCount = g.Count()
            })
            .OrderByDescending(x => x.appointmentCount)
            .Take(top)
            .ToListAsync();

        return Ok(topListings);
    }

    [HttpGet("analytics/monthly-revenue")]
    public async Task<IActionResult> GetMonthlyRevenue()
    {
        var revenue = await db.Payments
            .Where(p => p.Status == "succeeded")
            .GroupBy(p => new { p.CreatedAt.Year, p.CreatedAt.Month })
            .Select(g => new
            {
                year = g.Key.Year,
                month = g.Key.Month,
                total = g.Sum(p => p.Amount)
            })
            .OrderBy(x => x.year).ThenBy(x => x.month)
            .ToListAsync();

        return Ok(revenue);
    }

    [HttpGet("analytics/agent-performance")]
    public async Task<IActionResult> GetAgentPerformance([FromQuery] int top = 10)
    {
        var agents = await db.Agents
            .Select(a => new
            {
                agentName = a.User.FullName,
                listingCount = a.Listings.Count(l => l.Status == ListingStatus.Active),
                appointmentCount = a.Listings.Sum(l => l.ViewingSchedules.Count),
                revenue = a.Payments.Where(p => p.Status == "succeeded").Sum(p => p.Amount)
            })
            .OrderByDescending(a => a.appointmentCount)
            .Take(top)
            .ToListAsync();

        return Ok(agents);
    }

    [HttpGet("analytics/listing-status")]
    public async Task<IActionResult> GetListingStatusDistribution()
    {
        var statusCounts = await db.Listings
            .GroupBy(l => l.Status)
            .Select(g => new
            {
                status = g.Key.ToString(),
                count = g.Count()
            })
            .ToListAsync();

        return Ok(statusCounts);
    }

    [HttpGet("analytics/avg-price-by-type")]
    public async Task<IActionResult> GetAvgPriceByType()
    {
        var result = await db.Listings
            .Where(l => l.Status == ListingStatus.Active)
            .GroupBy(l => l.ResidencyType)
            .Select(g => new
            {
                type = g.Key.ToString(),
                avgPrice = g.Average(l => l.Price),
                count = g.Count()   // ← add this
            })
            .OrderByDescending(x => x.avgPrice)
            .ToListAsync();

        return Ok(result);
    }

    [HttpGet("analytics/conversion-rate")]
    public async Task<IActionResult> GetConversionRate()
    {
        int totalListings = await db.Listings.CountAsync();
        int paidListings = await db.Listings.CountAsync(l => l.Status == ListingStatus.Active);
        double conversionRate = totalListings == 0 ? 0 : (double)paidListings / totalListings * 100;
        return Ok(new { totalListings, paidListings, conversionRate });
    }

    [HttpGet("analytics/search-to-schedule-rate")]
    public async Task<IActionResult> GetSearchToScheduleRate()
    {
        var totalSearches = await db.SearchLogs.CountAsync();
        var totalSchedules = await db.ViewingSchedules.CountAsync();

        var rate = totalSearches == 0
            ? 0
            : (double)totalSchedules / totalSearches * 100;

        return Ok(new
        {
            totalSearches,
            totalSchedules,
            rate
        });
    }

    [HttpGet("analytics/token-buying")]
    public async Task<IActionResult> GetTokenBuying()
    {
        var succeeded = db.Payments.Where(p => p.Status == "succeeded");

        var totalPurchases = await succeeded.CountAsync();
        var totalTokensSold = await succeeded.SumAsync(p => p.TokensPurchased);
        var totalRevenue = await succeeded.SumAsync(p => p.Amount);

        return Ok(new
        {
            totalPurchases,
            totalTokensSold,
            totalRevenue,
            averageTokensPerPurchase = totalPurchases == 0
                ? 0
                : (double)totalTokensSold / totalPurchases
        });
    }

    [HttpGet("analytics/search-demand-locations")]
    public async Task<IActionResult> GetSearchDemandLocations()
    {
        var logs = await db.SearchLogs
            .OrderByDescending(s => s.SearchedAt)
            .ToListAsync();

        var parsed = logs.Select(s =>
        {
            try
            {
                using var doc = System.Text.Json.JsonDocument.Parse(s.Snapshot);
                var root = doc.RootElement;

                var address = root.TryGetProperty("workplaceAddress", out var addr)
                    ? addr.GetString()
                    : "Unknown";

                var lat = root.TryGetProperty("workplaceLat", out var latEl)
                    ? latEl.GetDouble()
                    : 0;

                var lng = root.TryGetProperty("workplaceLng", out var lngEl)
                    ? lngEl.GetDouble()
                    : 0;

                return new
                {
                    Address = address ?? "Unknown",
                    Lat = Math.Round(lat, 3),
                    Lng = Math.Round(lng, 3)
                };
            }
            catch
            {
                return null;
            }
        })
        .Where(x => x != null && x.Lat != 0 && x.Lng != 0)
        .GroupBy(x => new { x!.Lat, x.Lng, x.Address })
        .Select(g => new
        {
            workplaceAddress = g.Key.Address,
            lat = g.Key.Lat,
            lng = g.Key.Lng,
            searchCount = g.Count()
        })
        .OrderByDescending(x => x.searchCount)
        .Take(20)
        .ToList();

        return Ok(parsed);
    }
}

// ── Config (public — serves Google Maps key to frontend) ──────────────────────
[ApiController]
[Route("api/config")]
public class ConfigController(IConfiguration config) : ControllerBase
{
    [HttpGet("maps-key")]
    [AllowAnonymous]
    public IActionResult GetMapsKey()
    {
        var key = config["Google:ApiKey"] ?? "";
        return Ok(new { key });
    }
}

// ── Public schedule slots ─────────────────────────────────────────────────────
[ApiController]
[Route("api/schedules")]
public class ScheduleSlotsController(AppDbContext db) : ControllerBase
{
    /// <summary>
    /// Returns all non-cancelled booked time slots for a listing.
    /// Public — no auth required, so the calendar can show unavailable slots.
    /// </summary>
    [HttpGet("listing/{listingId}/slots")]
    [AllowAnonymous]
    public async Task<IActionResult> GetBookedSlots(Guid listingId)
    {
        var slots = await db.ViewingSchedules
            .Where(v => v.ListingId == listingId && v.Status != ScheduleStatus.Cancelled)
            .Select(v => new BookedSlotResponse(v.ScheduledAt, v.Status))
            .ToListAsync();

        return Ok(slots);
    }
}


// ── Agent Dashboard ─────────────────────────────────────────────────────────
[ApiController]
[Route("api/agent/dashboard")]
[Authorize(Roles = "Agent")]
public class AgentDashboardController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetDashboard()
    {
        var userId = User.GetUserId();
        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        // Listings
        var listings = await db.Listings
            .Where(l => l.AgentId == agent.UserId)
            .ToListAsync();

        int activeListings = listings.Count(l => l.Status == ListingStatus.Active);
        int pendingPaymentListings = listings.Count(l => l.Status == ListingStatus.PendingPayment);
        int draftListings = listings.Count(l => l.Status == ListingStatus.Draft);
        int inactiveListings = listings.Count(l => l.Status == ListingStatus.Inactive);

        // Viewing schedules - IMPORTANT: include Listing and Tenant
        var schedules = await db.ViewingSchedules
            .Include(v => v.Listing)
            .Include(v => v.Tenant)
            .Where(v => v.Listing.AgentId == agent.UserId)
            .ToListAsync();

        int totalAppointments = schedules.Count;
        int pendingAppointments = schedules.Count(v => v.Status == ScheduleStatus.Pending);
        int confirmedAppointments = schedules.Count(v => v.Status == ScheduleStatus.Confirmed);
        int cancelledAppointments = schedules.Count(v => v.Status == ScheduleStatus.Cancelled);

        // Upcoming viewings (next 7 days)
        var today = DateTime.UtcNow.Date;
        var upcoming = schedules
            .Where(v => v.ScheduledAt.Date >= today && v.ScheduledAt.Date <= today.AddDays(7))
            .OrderBy(v => v.ScheduledAt)
            .Select(v => new UpcomingViewingDto(
                v.ListingId,
                v.Listing?.Name ?? "",
                v.ScheduledAt,
                v.Status.ToString(),
                v.Tenant?.FullName ?? ""
            ))
            .Take(10)
            .ToList();

        // Top performing listings (most appointments)
        var topListings = schedules
            .GroupBy(v => v.ListingId)
            .Select(g => new
            {
                ListingId = g.Key,
                ListingName = g.First().Listing?.Name ?? "",
                AppointmentCount = g.Count()
            })
            .OrderByDescending(x => x.AppointmentCount)
            .Take(5)
            .Select(x => new TopListingDto(x.ListingId, x.ListingName, x.AppointmentCount))
            .ToList();

        // Payment reminder: listings that need payment
        var pendingPaymentList = listings
            .Where(l => l.Status == ListingStatus.PendingPayment)
            .Select(l => new PendingPaymentListingDto(l.Id, l.Name, l.Price, l.CreatedAt))
            .ToList();

        // Agent profile
        var profile = new AgentProfileDto(
            agent.User.FullName,
            agent.User.Email,
            agent.User.Status.ToString(),
            agent.TokenBalance
        );

        return Ok(new AgentDashboardResponse(
            profile,
            new ListingStatsDto(activeListings, pendingPaymentListings, draftListings, inactiveListings),
            new AppointmentStatsDto(totalAppointments, pendingAppointments, confirmedAppointments, cancelledAppointments),
            upcoming,
            topListings,
            pendingPaymentList
        ));
    }

    [HttpGet("analytics/listings")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetListingAnalytics()
    {
        var agentId = User.GetUserId();

        var analytics = await db.Listings
            .Where(l => l.AgentId == agentId)
            .Select(l => new
            {
                l.Id,
                l.Name,
                ViewCount = db.ViewHistory.Count(v => v.ListingId == l.Id),
                BookingCount = db.ViewingSchedules.Count(vs => vs.ListingId == l.Id),
                ConfirmedCount = db.ViewingSchedules.Count(vs => vs.ListingId == l.Id && vs.Status == ScheduleStatus.Confirmed),
                PendingCount = db.ViewingSchedules.Count(vs => vs.ListingId == l.Id && vs.Status == ScheduleStatus.Pending),
                CancelledCount = db.ViewingSchedules.Count(vs => vs.ListingId == l.Id && vs.Status == ScheduleStatus.Cancelled)
            })
            .OrderByDescending(l => l.ViewCount)
            .ToListAsync();

        return Ok(analytics);
    }
}

// ── Feedback ─────────────────────────────────────────────────────────
[ApiController]
[Route("api/feedback")]
[Authorize]
public class FeedbackController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> SubmitFeedback([FromBody] CreateFeedbackRequest req)
    {
        var tenantId = User.GetUserId();

        if (string.IsNullOrWhiteSpace(req.Subject))
            return BadRequest(new { message = "Feedback subject is required." });

        if (string.IsNullOrWhiteSpace(req.Description))
            return BadRequest(new { message = "Feedback description is required." });

        var feedback = new Feedback
        {
            TenantId = tenantId,
            Subject = req.Subject.Trim(),
            Description = req.Description.Trim(),
            Status = "Open",
            CreatedAt = DateTime.UtcNow
        };

        db.Feedbacks.Add(feedback);
        await db.SaveChangesAsync();

        return Ok(new { message = "Feedback submitted successfully." });
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> GetMyFeedback()
    {
        var tenantId = User.GetUserId();

        var feedbacks = await db.Feedbacks
            .Include(f => f.Tenant)
            .Where(f => f.TenantId == tenantId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FeedbackResponse(
                f.Id,
                f.TenantId,
                f.Tenant.FullName,
                f.Tenant.Email,
                f.Subject,
                f.Description,
                f.AdminComment,
                f.Status,
                f.CreatedAt
            ))
            .ToListAsync();

        return Ok(feedbacks);
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllFeedback()
    {
        var feedbacks = await db.Feedbacks
            .Include(f => f.Tenant)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new FeedbackResponse(
                f.Id,
                f.TenantId,
                f.Tenant.FullName,
                f.Tenant.Email,
                f.Subject,
                f.Description,
                f.AdminComment,
                f.Status,
                f.CreatedAt
            ))
            .ToListAsync();

        return Ok(feedbacks);
    }

    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateFeedbackStatus(Guid id, [FromBody] UpdateFeedbackStatusRequest req)
    {
        var feedback = await db.Feedbacks.FindAsync(id);
        if (feedback == null) return NotFound(new { message = "Feedback not found." });

        var allowedStatuses = new[] { "Open", "Reviewed", "Commented" };

        if (!allowedStatuses.Contains(req.Status))
            return BadRequest(new { message = "Invalid feedback status." });

        feedback.Status = req.Status;
        await db.SaveChangesAsync();

        return Ok(new { message = $"Feedback marked as {req.Status}." });
    }

    [HttpPatch("{id}/comment")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateFeedbackComment(
    Guid id,
    [FromBody] UpdateFeedbackCommentRequest req)
    {
        var feedback = await db.Feedbacks.FindAsync(id);

        if (feedback == null)
            return NotFound(new { message = "Feedback not found." });

        feedback.AdminComment = req.AdminComment.Trim();

        if (feedback.Status != "Commented")
            feedback.Status = "Commented";

        await db.SaveChangesAsync();

        return Ok(new { message = "Admin comment saved." });
    }
}

// ── Reports ─────────────────────────────────────────────────────────
[ApiController]
[Route("api/reports")]
[Authorize]
public class ReportsController(AppDbContext db) : ControllerBase
{
    [HttpPost]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> SubmitReport([FromBody] CreateReportRequest req)
    {
        var tenantId = User.GetUserId();

        if (string.IsNullOrWhiteSpace(req.Description))
            return BadRequest(new { message = "Report description is required." });

        var item = req.Item.Trim().ToLowerInvariant();

        if (item != "listing" && item != "agent")
            return BadRequest(new { message = "Report item must be either listing or agent." });

        if (item == "listing")
        {
            var listingExists = await db.Listings.AnyAsync(l => l.Id == req.ItemId);
            if (!listingExists)
                return NotFound(new { message = "Listing not found." });
        }

        if (item == "agent")
        {
            var agentExists = await db.Agents.AnyAsync(a => a.UserId == req.ItemId);
            if (!agentExists)
                return NotFound(new { message = "Agent not found." });
        }

        var report = new Report
        {
            TenantId = tenantId,
            Item = item,
            ItemId = req.ItemId,
            Description = req.Description.Trim(),
            Status = "Open",
            CreatedAt = DateTime.UtcNow
        };

        db.Reports.Add(report);
        await db.SaveChangesAsync();

        return Ok(new { message = "Report submitted successfully." });
    }

    [HttpGet("admin")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetAllReports()
    {
        var reports = await db.Reports
            .Include(r => r.Tenant)
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync();

        var result = new List<ReportResponse>();

        foreach (var r in reports)
        {
            var itemName = r.Item;

            if (r.Item == "listing")
            {
                itemName = await db.Listings
                    .Where(l => l.Id == r.ItemId)
                    .Select(l => l.Name)
                    .FirstOrDefaultAsync() ?? "Unknown listing";
            }

            if (r.Item == "agent")
            {
                itemName = await db.Agents
                    .Where(a => a.UserId == r.ItemId)
                    .Select(a => a.User.FullName)
                    .FirstOrDefaultAsync() ?? "Unknown agent";
            }

            result.Add(new ReportResponse(
                r.Id,
                r.TenantId,
                r.Tenant.FullName,
                r.Tenant.Email,
                r.Item,
                r.ItemId,
                itemName,
                r.Description,
                r.Status,
                r.CreatedAt
            ));
        }

        return Ok(result);
    }

    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> UpdateReportStatus(Guid id, [FromBody] UpdateReportStatusRequest req)
    {
        var report = await db.Reports.FindAsync(id);
        if (report == null) return NotFound(new { message = "Report not found." });

        var allowedStatuses = new[] { "Open", "Reviewed" };

        if (!allowedStatuses.Contains(req.Status))
            return BadRequest(new { message = "Invalid report status." });

        report.Status = req.Status;
        await db.SaveChangesAsync();

        return Ok(new { message = $"Report marked as {req.Status}." });
    }
}
