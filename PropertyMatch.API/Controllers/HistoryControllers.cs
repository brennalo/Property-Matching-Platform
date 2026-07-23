using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;
using Microsoft.AspNetCore.SignalR;
using PropertyMatch.API.Hubs;

namespace PropertyMatch.API.Controllers;

// ── Favourites ────────────────────────────────────────────────────────────────
[ApiController]
[Route("api/favourites")]
[Authorize(Roles = "Tenant")]
public class FavouritesController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetFavourites()
    {
        var tenantId = User.GetUserId();
        var favs = await db.FavouriteListings
            .Where(f => f.TenantId == tenantId)
            .Include(f => f.Listing).ThenInclude(l => l.Images)
            .Include(f => f.Listing).ThenInclude(l => l.Agent).ThenInclude(a => a.User)
            .OrderByDescending(f => f.SavedAt)
            .ToListAsync();

        return Ok(favs.Select(f => new FavouriteResponse(
            f.ListingId, f.Listing.Name, f.Listing.Address,
            f.Listing.Price, f.Listing.ResidencyType.ToString(),
            f.Listing.Rooms, f.Listing.Toilets,
            f.Listing.Images.OrderBy(i => i.DisplayOrder).FirstOrDefault()?.S3Url,
            f.Listing.Agent.User.FullName, f.SavedAt)));
    }

    [HttpPost("{listingId}")]
    public async Task<IActionResult> Add(Guid listingId)
    {
        var tenantId = User.GetUserId();
        var exists = await db.FavouriteListings
            .AnyAsync(f => f.TenantId == tenantId && f.ListingId == listingId);
        if (exists) return Ok(new { message = "Already saved" });

        db.FavouriteListings.Add(new FavouriteListing
        {
            TenantId = tenantId,
            ListingId = listingId
        });
        await db.SaveChangesAsync();
        return Ok(new { message = "Saved" });
    }

    [HttpDelete("{listingId}")]
    public async Task<IActionResult> Remove(Guid listingId)
    {
        var tenantId = User.GetUserId();
        var fav = await db.FavouriteListings
            .FirstOrDefaultAsync(f => f.TenantId == tenantId && f.ListingId == listingId);
        if (fav == null) return NotFound();
        db.FavouriteListings.Remove(fav);
        await db.SaveChangesAsync();
        return Ok(new { message = "Removed" });
    }

    [HttpGet("{listingId}/status")]
    public async Task<IActionResult> GetStatus(Guid listingId)
    {
        var tenantId = User.GetUserId();
        var saved = await db.FavouriteListings
            .AnyAsync(f => f.TenantId == tenantId && f.ListingId == listingId);
        return Ok(new { saved });
    }
}

// ── Search Logs / History ─────────────────────────────────────────────────────
[ApiController]
[Route("api/search-history")]
[Authorize(Roles = "Tenant")]
public class SearchHistoryController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetHistory()
    {
        var tenantId = User.GetUserId();
        var logs = await db.SearchLogs
            .Where(s => s.TenantId == tenantId)
            .OrderByDescending(s => s.SearchedAt)
            .Take(50)
            .ToListAsync();

        return Ok(logs.Select(s => new SearchLogResponse(s.SearchedAt, s.Snapshot)));
    }

    // Called internally from MatchController after each search
    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SaveSearchLogRequest req)
    {
        var tenantId = User.GetUserId();
        db.SearchLogs.Add(new SearchLog
        {
            TenantId = tenantId,
            SearchedAt = DateTime.UtcNow,
            Snapshot = req.Snapshot
        });
        await db.SaveChangesAsync();
        return Ok();
    }
}

// ── View History ──────────────────────────────────────────────────────────────
[ApiController]
[Route("api/view-history")]
[Authorize(Roles = "Tenant")]
public class ViewHistoryController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetHistory()
    {
        var tenantId = User.GetUserId();
        var history = await db.ViewHistory
            .Where(v => v.TenantId == tenantId)
            .Include(v => v.Listing).ThenInclude(l => l.Images)
            .Include(v => v.Listing).ThenInclude(l => l.Agent).ThenInclude(a => a.User)
            .OrderByDescending(v => v.ViewedAt)
            .Take(50)
            .ToListAsync();

        return Ok(history.Select(v => new ViewHistoryResponse(
            v.ListingId, v.Listing.Name, v.Listing.Address,
            v.Listing.Price, v.Listing.ResidencyType.ToString(),
            v.Listing.Images.OrderBy(i => i.DisplayOrder).FirstOrDefault()?.S3Url,
            v.Listing.Agent.User.FullName, v.ViewedAt)));
    }

    [HttpPost("{listingId}")]
    public async Task<IActionResult> Track(Guid listingId)
    {
        var tenantId = User.GetUserId();
        // Insert a new record each time (multiple views recorded)
        db.ViewHistory.Add(new ViewHistory
        {
            TenantId = tenantId,
            ListingId = listingId,
            ViewedAt = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return Ok();
    }
}

// ── Conversations ─────────────────────────────────────────────────────────────
[ApiController]
[Route("api/conversations")]
[Authorize]
public class ConversationsController(AppDbContext db, IHubContext<ChatHub> hub) : ControllerBase
{
    // Tenant: open or get existing conversation for a listing
    [HttpPost("open")]
    [Authorize(Roles = "Tenant")]
    public async Task<IActionResult> OpenConversation([FromBody] OpenConversationRequest req)
    {
        var tenantId = User.GetUserId();

        // Load listing to get agentId
        var listing = await db.Listings.FindAsync(req.ListingId);
        if (listing == null) return NotFound("Listing not found");

        // Return existing if already exists
        var existing = await db.Conversations
            .FirstOrDefaultAsync(c => c.TenantId == tenantId && c.ListingId == req.ListingId);
        if (existing != null)
            return Ok(new { conversationId = existing.Id });

        var conv = new Conversation
        {
            TenantId = tenantId,
            ListingId = req.ListingId,
            AgentId = listing.AgentId
        };
        db.Conversations.Add(conv);
        await db.SaveChangesAsync();
        return Ok(new { conversationId = conv.Id });
    }

    // Get all conversations for current user (tenant or agent)
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var userId = User.GetUserId();
        var role = User.FindFirst("role")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;

        IQueryable<Conversation> query = db.Conversations
            .Include(c => c.Listing)
            .Include(c => c.Tenant)
            .Include(c => c.Agent).ThenInclude(a => a.User)
            .Include(c => c.Messages.OrderByDescending(m => m.CreatedAt).Take(1));

        if (role == "Tenant")
            query = query.Where(c => c.TenantId == userId);
        else if (role == "Agent")
            query = query.Where(c => c.AgentId == userId);

        var convs = await query.OrderByDescending(c => c.LastMessageAt).ToListAsync();

        return Ok(convs.Select(c =>
        {
            var lastMsg = c.Messages.FirstOrDefault();
            int unread = 0;
            if (role == "Tenant")
            {
                var lastRead = c.TenantLastReadAt ?? DateTime.MinValue;
                unread = c.Messages.Count(m => m.CreatedAt > lastRead && m.SenderRole != "Tenant");
            }
            else if (role == "Agent")
            {
                var lastRead = c.AgentLastReadAt ?? DateTime.MinValue;
                unread = c.Messages.Count(m => m.CreatedAt > lastRead && m.SenderRole != "Agent");
            }

            return new ConversationSummaryResponse(
                c.Id,
                c.Listing.Name,    // display name = listing name
                c.Tenant.FullName,
                c.Agent.User.FullName,
                lastMsg?.Content,
                lastMsg?.CreatedAt,
                unread,
                c.ListingId,
                c.AgentId
            );
        }));
    }

    // Get messages in a conversation
    [HttpGet("{id}/messages")]
    public async Task<IActionResult> GetMessages(Guid id)
    {
        var userId = User.GetUserId();
        var conv = await db.Conversations
            .Include(c => c.Messages.OrderBy(m => m.CreatedAt))
            .FirstOrDefaultAsync(c => c.Id == id &&
                (c.TenantId == userId || c.AgentId == userId));
        if (conv == null) return NotFound();

        // Mark as read
        var role = User.FindFirst("role")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value;
        if (role == "Tenant") conv.TenantLastReadAt = DateTime.UtcNow;
        else if (role == "Agent") conv.AgentLastReadAt = DateTime.UtcNow;

        foreach (var m in conv.Messages.Where(m => !m.IsRead && m.SenderRole != role))
            m.IsRead = true;

        await db.SaveChangesAsync();

        return Ok(conv.Messages.Select(m => new MessageResponse(
            m.Id, m.SenderId, m.SenderRole, m.Content, m.IsRead, m.CreatedAt)));
    }

    // Send a message
    [HttpPost("{id}/messages")]
    public async Task<IActionResult> SendMessage(Guid id, [FromBody] SendMessageRequest req)
    {
        var userId = User.GetUserId();
        var role = User.FindFirst("role")?.Value ?? User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "";

        var conv = await db.Conversations
            .FirstOrDefaultAsync(c => c.Id == id &&
                (c.TenantId == userId || c.AgentId == userId));
        if (conv == null) return NotFound();

        var msg = new Message
        {
            ConversationId = id,
            SenderId = userId,
            SenderRole = role,
            Content = req.Content
        };
        db.Messages.Add(msg);
        conv.LastMessageAt = DateTime.UtcNow;
        await db.SaveChangesAsync();

        var response = new MessageResponse(
            msg.Id, msg.SenderId, msg.SenderRole, msg.Content, msg.IsRead, msg.CreatedAt);

        await hub.Clients.Group(id.ToString()).SendAsync("NewMessage", response);

        // Notify both participants to refresh their conversation list
        await hub.Clients.Group($"user-{conv.TenantId}").SendAsync("ConversationUpdated");
        await hub.Clients.Group($"user-{conv.AgentId}").SendAsync("ConversationUpdated");

        return Ok(response);
    }

    [HttpDelete("{id:guid}")]
    [Authorize]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();

        var conversation = await db.Conversations
            .Include(c => c.Messages)
            .FirstOrDefaultAsync(c => c.Id == id);

        if (conversation == null)
            return NotFound();

        // Only participants may delete
        if (conversation.TenantId != userId &&
            conversation.AgentId != userId)
        {
            return Forbid();
        }

        db.Messages.RemoveRange(conversation.Messages);
        db.Conversations.Remove(conversation);

        await db.SaveChangesAsync();

        return Ok(new
        {
            message = "Conversation deleted."
        });
    }
}

// ── Public: Listing map data ──────────────────────────────────────────────────
[ApiController]
[Route("api/browse")]
public class BrowseController(AppDbContext db) : ControllerBase
{
    /// Returns all active listings with viewing count — for the map landing page
    [HttpGet("listings")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAllForBrowse()
    {
        var listings = await db.Listings
            .Where(l => l.Status == ListingStatus.Active)
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .Include(l => l.ViewingSchedules)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return Ok(listings.Select(l => new BrowseListingResponse(
            l.Id, l.Name, l.Address, l.Lat, l.Lng,
            l.Price, l.ResidencyType.ToString(),
            l.Rooms, l.Toilets,
            l.Amenities, l.Description,
            l.Images.OrderBy(i => i.DisplayOrder).Select(i => i.S3Url).ToList(),
            l.Agent.User.FullName,
            l.Agent.LicenseNumber,
            l.Agent.ContactNo,
            l.ViewingSchedules.Count
        )));
    }

}

[ApiController]
[Route("api/scoring-config")]
[Authorize(Roles = "Tenant")]
public class ScoringConfigController(AppDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var userId = User.GetUserId();
        var cfg = await db.ScoringConfig.FirstOrDefaultAsync(sc => sc.UserId == userId)
            ?? new ScoringConfig
            {
                UserId = userId,
                WeightNumeric = 0.40,
                WeightCommute = 0.30,
                WeightLifestyle = 0.30,
                LifestyleRadiusMeters = 800
            };
        return Ok(cfg);
    }

    [HttpPut]
    public async Task<IActionResult> Update([FromBody] ScoringConfigRequest req)
    {
        var total = req.WeightNumeric + req.WeightCommute + req.WeightLifestyle;
        if (Math.Abs(total - 1.0) > 0.001)
            return BadRequest("Weights must sum to 1.0");

        var userId = User.GetUserId();
        var cfg = await db.ScoringConfig.FirstOrDefaultAsync(sc => sc.UserId == userId);
        if (cfg == null)
        {
            cfg = new ScoringConfig { UserId = userId };
            db.ScoringConfig.Add(cfg);
        }
        cfg.WeightNumeric = req.WeightNumeric;
        cfg.WeightCommute = req.WeightCommute;
        cfg.WeightLifestyle = req.WeightLifestyle;
        cfg.LifestyleRadiusMeters = req.LifestyleRadiusMeters;
        await db.SaveChangesAsync();
        return Ok(cfg);
    }
}

public record ScoringConfigRequest(
    double WeightNumeric, double WeightCommute, double WeightLifestyle,
    int LifestyleRadiusMeters);