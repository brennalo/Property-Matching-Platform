using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/reviews")]
public class ReviewsController(AppDbContext db) : ControllerBase
{
    // POST /api/reviews – tenant creates a review
    [HttpPost]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> Create([FromBody] CreateReviewRequest req)
    {
        var tenantId = User.GetUserId();

        // Validate source
        if (req.ViewingScheduleId == null && req.ConversationId == null)
            return BadRequest(new { message = "Must provide either ViewingScheduleId or ConversationId." });

        // Check if tenant already reviewed this source
        if (req.ViewingScheduleId.HasValue)
        {
            var exists = await db.Reviews
                .AnyAsync(r => r.TenantId == tenantId && r.ViewingScheduleId == req.ViewingScheduleId);
            if (exists)
                return Conflict(new { message = "You have already reviewed this viewing." });

            // Verify the viewing belongs to this tenant and is confirmed and past
            var viewing = await db.ViewingSchedules
                .Include(v => v.Listing)
                .ThenInclude(l => l.Agent)
                .FirstOrDefaultAsync(v => v.Id == req.ViewingScheduleId);
            if (viewing == null)
                return NotFound(new { message = "Viewing not found." });
            if (viewing.TenantId != tenantId)
                return Forbid();
            if (viewing.Status != ScheduleStatus.Confirmed)
                return BadRequest(new { message = "Only confirmed viewings can be reviewed." });
            if (viewing.ScheduledAt > DateTime.UtcNow)
                return BadRequest(new { message = "Cannot review a future viewing." });

            var agentId = viewing.Listing.Agent.UserId;

            var review = new Review
            {
                AgentId = agentId,
                TenantId = tenantId,
                Rating = req.Rating,
                ReviewText = req.ReviewText,
                ViewingScheduleId = req.ViewingScheduleId,
                CreatedAt = DateTime.UtcNow
            };
            db.Reviews.Add(review);
            await db.SaveChangesAsync();

            return Ok(new { message = "Review submitted successfully." });
        }
        else // Conversation review
        {
            var conv = await db.Conversations
                .Include(c => c.Agent)
                .FirstOrDefaultAsync(c => c.Id == req.ConversationId);
            if (conv == null)
                return NotFound(new { message = "Conversation not found." });
            if (conv.TenantId != tenantId)
                return Forbid();

            // Check if already reviewed this conversation
            var exists = await db.Reviews
                .AnyAsync(r => r.TenantId == tenantId && r.ConversationId == req.ConversationId);
            if (exists)
                return Conflict(new { message = "You have already reviewed this conversation." });

            var review = new Review
            {
                AgentId = conv.AgentId,
                TenantId = tenantId,
                Rating = req.Rating,
                ReviewText = req.ReviewText,
                ConversationId = req.ConversationId,
                CreatedAt = DateTime.UtcNow
            };
            db.Reviews.Add(review);
            await db.SaveChangesAsync();

            return Ok(new { message = "Review submitted successfully." });
        }
    }

    // GET /api/reviews/agent – get all reviews for the logged-in agent
    [HttpGet("agent")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetAgentReviews()
    {
        var agentId = User.GetUserId();
        var reviews = await db.Reviews
            .Include(r => r.Tenant)
            .Include(r => r.ViewingSchedule).ThenInclude(vs => vs.Listing)
            .Include(r => r.Conversation).ThenInclude(c => c.Listing)
            .Where(r => r.AgentId == agentId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewResponse(
                r.Id,
                r.AgentId,
                r.Tenant.FullName,  // tenant name
                r.Rating,
                r.ReviewText,
                r.CreatedAt,
                r.ViewingScheduleId != null ? "Viewing" : "Conversation",
                r.ViewingScheduleId != null
                    ? r.ViewingSchedule.Listing.Name
                    : r.Conversation.Listing.Name
            ))
            .ToListAsync();

        var avg = reviews.Count > 0 ? reviews.Average(r => r.Rating) : 0;

        return Ok(new AgentReviewSummary(avg, reviews.Count, reviews));
    }

    // GET /api/reviews/agent/{agentId}/public – public view of an agent's reviews
    [HttpGet("agent/{agentId}/public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetPublicReviews(Guid agentId)
    {
        var reviews = await db.Reviews
            .Include(r => r.Tenant)
            .Include(r => r.ViewingSchedule).ThenInclude(vs => vs.Listing)
            .Include(r => r.Conversation).ThenInclude(c => c.Listing)
            .Where(r => r.AgentId == agentId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewResponse(
                r.Id,
                r.AgentId,
                r.Tenant.FullName,
                r.Rating,
                r.ReviewText,
                r.CreatedAt,
                r.ViewingScheduleId != null ? "Viewing" : "Conversation",
                r.ViewingScheduleId != null
                    ? r.ViewingSchedule.Listing.Name
                    : r.Conversation.Listing.Name
            ))
            .ToListAsync();

        var avg = reviews.Count > 0 ? reviews.Average(r => r.Rating) : 0;
        return Ok(new AgentReviewSummary(avg, reviews.Count, reviews));
    }

    // GET /api/reviews/tenant – get all reviews written by the logged-in tenant
    [HttpGet("tenant")]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> GetMyReviews()
    {
        var tenantId = User.GetUserId();
        var reviews = await db.Reviews
            .Include(r => r.Agent).ThenInclude(a => a.User)
            .Include(r => r.ViewingSchedule).ThenInclude(vs => vs.Listing)
            .Include(r => r.Conversation).ThenInclude(c => c.Listing)
            .Where(r => r.TenantId == tenantId)
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new ReviewResponse(
                r.Id,
                r.AgentId,
                r.Agent.User.FullName,
                r.Rating,
                r.ReviewText,
                r.CreatedAt,
                r.ViewingScheduleId != null ? "Viewing" : "Conversation",
                r.ViewingScheduleId != null
                    ? r.ViewingSchedule.Listing.Name
                    : r.Conversation.Listing.Name
            ))
            .ToListAsync();
        return Ok(reviews);
    }

    // GET /api/reviews/tenant/by-source – get a specific review by source for editing
    [HttpGet("tenant/by-source")]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> GetReviewBySource(
        [FromQuery] Guid? viewingScheduleId,
        [FromQuery] Guid? conversationId)
    {
        if (viewingScheduleId == null && conversationId == null)
            return BadRequest(new { message = "Must provide either viewingScheduleId or conversationId." });

        var tenantId = User.GetUserId();
        Review? review = null;
        string listingName = "";
        if (viewingScheduleId.HasValue)
        {
            review = await db.Reviews
                .Include(r => r.ViewingSchedule).ThenInclude(vs => vs.Listing)
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.ViewingScheduleId == viewingScheduleId);
            if (review?.ViewingSchedule != null)
                listingName = review.ViewingSchedule.Listing.Name;
        }
        else if (conversationId.HasValue)
        {
            review = await db.Reviews
                .Include(r => r.Conversation).ThenInclude(c => c.Listing)
                .FirstOrDefaultAsync(r => r.TenantId == tenantId && r.ConversationId == conversationId);
            if (review?.Conversation != null)
                listingName = review.Conversation.Listing.Name;
        }

        if (review == null)
            return NotFound();

        return Ok(new ReviewResponse(
            review.Id,
            review.AgentId,
            "",  // not needed for editing
            review.Rating,
            review.ReviewText,
            review.CreatedAt,
            review.ViewingScheduleId != null ? "Viewing" : "Conversation",
            listingName
        ));
    }

    // PUT /api/reviews/{id} – update an existing review
    [HttpPut("{id}")]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateReviewRequest req)
    {
        var tenantId = User.GetUserId();
        var review = await db.Reviews
            .FirstOrDefaultAsync(r => r.Id == id && r.TenantId == tenantId);

        if (review == null)
            return NotFound();

        review.Rating = req.Rating;
        review.ReviewText = req.ReviewText;
        await db.SaveChangesAsync();

        return Ok(new { message = "Review updated successfully." });
    }
}