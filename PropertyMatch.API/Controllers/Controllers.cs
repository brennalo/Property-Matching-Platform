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
public class MatchController(MatchingService matching) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Match([FromBody] MatchRequest req)
    {
        var tenantId = User.GetUserId();
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
public class SchedulesController(AppDbContext db) : ControllerBase
{
    // Tenant: book a viewing
    [HttpPost]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> Create([FromBody] CreateScheduleRequest req)
    {
        var tenantId = User.GetUserId();

        // Check listing exists and is agent-owned (agent listing has no SourceUrl)
        var listing = await db.Listings.FindAsync(req.ListingId);
        if (listing == null) return NotFound(new { message = "Listing not found" });
        if (listing.SourceUrl != null)
            return BadRequest(new { message = "Cannot schedule viewing for scraped listings. Use the source link." });
        if (listing.Status != ListingStatus.Active)
            return BadRequest(new { message = "Listing is not active" });

        // Check for double-booking
        var exists = await db.ViewingSchedules.FindAsync(req.ListingId, req.ScheduledAt);
        if (exists != null)
            return Conflict(new { message = "This time slot is already booked" });

        var schedule = new ViewingSchedule
        {
            ListingId = req.ListingId,
            ScheduledAt = req.ScheduledAt.ToUniversalTime(),
            TenantId = tenantId,
            Status = ScheduleStatus.Pending
        };

        db.ViewingSchedules.Add(schedule);
        await db.SaveChangesAsync();
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
    public async Task<IActionResult> UpdateStatus(Guid listingId, DateTime scheduledAt, [FromBody] ScheduleStatus status)
    {
        var schedule = await db.ViewingSchedules.FindAsync(listingId, scheduledAt.ToUniversalTime());
        if (schedule == null) return NotFound();
        schedule.Status = status;
        await db.SaveChangesAsync();
        return Ok(new { message = "Schedule updated" });
    }

    private static ScheduleResponse MapResponse(ViewingSchedule v) => new(
        v.ListingId, v.Listing?.Name ?? "", v.Listing?.Address ?? "",
        v.TenantId, v.Tenant?.FullName ?? "",
        v.ScheduledAt, v.Status);
}

// ── Payments ──────────────────────────────────────────────────────────────────
[ApiController]
[Route("api/payments")]
public class PaymentsController(StripeService stripe, IConfiguration config) : ControllerBase
{
    [HttpPost("checkout")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> CreateCheckout([FromBody] CreateCheckoutRequest req)
    {
        var userId = User.GetUserId();

        var db = HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var (url, sessionId) = await stripe.CreateListingCheckoutAsync(
            agent.UserId, req.ListingId,
            successUrl: $"{baseUrl}/agent/listings?payment=success",
            cancelUrl: $"{baseUrl}/agent/listings?payment=cancelled");

        return Ok(new CheckoutResponse(url, sessionId));
    }

    // Stripe webhook — no auth, uses Stripe-Signature header
    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<IActionResult> Webhook()
    {
        var json = await new StreamReader(Request.Body).ReadToEndAsync();
        var signature = Request.Headers["Stripe-Signature"].FirstOrDefault() ?? "";

        try
        {
            await stripe.HandleWebhookAsync(json, signature, config);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }
}

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

        return Ok(agents.Select(a => new AgentDetailResponse(
            a.UserId, a.User.FullName, a.User.Email,
            a.User.Status,
            a.User.CreatedAt, a.User.VerifiedAt,
            a.Listings.Count, a.LicenseNumber, a.TokenBalance)));
    }

    [HttpPut("agents/{id}/status")]
    public async Task<IActionResult> UpdateAgentStatus(Guid id, [FromBody] UpdateAgentStatusRequest req)
    {
        // id = UserId (Agent PK)
        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == id);
        if (agent == null) return NotFound();

        // Approval/blocking lives entirely on User.Status
        agent.User.Status = req.Status;

        if (req.Status == UserStatus.Verified && agent.User.VerifiedAt == null)
            agent.User.VerifiedAt = DateTime.UtcNow;

        // Block all listings when agent is blocked
        if (req.Status == UserStatus.Blocked)
        {
            var listings = db.Listings.Where(l => l.AgentId == id);
            await listings.ForEachAsync(l => l.Status = ListingStatus.Inactive);
        }

        // Reactivate listings when reinstated
        if (req.Status == UserStatus.Verified)
        {
            var listings = db.Listings.Where(l => l.AgentId == id && l.Status == ListingStatus.Inactive);
            await listings.ForEachAsync(l => l.Status = ListingStatus.Active);
        }

        await db.SaveChangesAsync();
        return Ok(new { message = $"Agent status updated to {req.Status}" });
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
