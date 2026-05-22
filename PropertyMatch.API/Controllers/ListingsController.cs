using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;
using PropertyMatch.API.Services;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/listings")]
[Authorize]
public class ListingsController(AppDbContext db, S3Service s3) : ControllerBase
{
    // GET /api/listings — public, returns all active listings (for tenants)
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var listings = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .Where(l => l.Status == ListingStatus.Active)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return Ok(listings.Select(MapResponse));
    }

    // GET /api/listings/mine — agent's own listings (all statuses)
    [HttpGet("mine")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetMine()
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        var listings = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .Where(l => l.AgentId == agent.Id)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        return Ok(listings.Select(MapResponse));
    }

    // GET /api/listings/{id}
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var listing = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (listing == null) return NotFound();
        return Ok(MapResponse(listing));
    }

    // POST /api/listings — agent creates listing (status = PendingPayment)
    [HttpPost]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Create([FromBody] CreateListingRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);

        if (agent == null) return NotFound(new { message = "Agent profile not found" });
        if (agent.Status != AgentStatus.Verified)
            return Forbid();

        var listing = new Listing
        {
            AgentId = agent.Id,
            Name = req.Name,
            Rooms = req.Rooms,
            Toilets = req.Toilets,
            Lat = req.Lat,
            Lng = req.Lng,
            Address = req.Address,
            ResidencyType = req.ResidencyType,
            Price = req.Price,
            Status = ListingStatus.PendingPayment
        };

        db.Listings.Add(listing);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = listing.Id },
            new { listing.Id, message = "Listing created. Proceed to payment to activate." });
    }

    // PUT /api/listings/{id}
    [HttpPut("{id}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateListingRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var listing = await db.Listings.FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent!.Id);

        if (listing == null) return NotFound();

        if (req.Name != null)         listing.Name = req.Name;
        if (req.Rooms.HasValue)       listing.Rooms = req.Rooms.Value;
        if (req.Toilets.HasValue)     listing.Toilets = req.Toilets.Value;
        if (req.Lat.HasValue)         listing.Lat = req.Lat.Value;
        if (req.Lng.HasValue)         listing.Lng = req.Lng.Value;
        if (req.Address != null)      listing.Address = req.Address;
        if (req.ResidencyType.HasValue) listing.ResidencyType = req.ResidencyType.Value;
        if (req.Price.HasValue)       listing.Price = req.Price.Value;

        await db.SaveChangesAsync();
        return Ok(new { message = "Listing updated" });
    }

    // POST /api/listings/{id}/images — multipart upload
    [HttpPost("{id}/images")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> UploadImages(Guid id, [FromForm] List<IFormFile> files)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var listing = await db.Listings.FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent!.Id);

        if (listing == null) return NotFound();
        if (files.Count == 0) return BadRequest(new { message = "No files provided" });

        var urls = await s3.UploadListingImagesAsync(id, files);
        return Ok(new { urls });
    }

    // DELETE /api/listings/{id}
    [HttpDelete("{id}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var listing = await db.Listings
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent!.Id);

        if (listing == null) return NotFound();

        await s3.DeleteListingImagesAsync(id);
        db.Listings.Remove(listing);
        await db.SaveChangesAsync();
        return Ok(new { message = "Listing deleted" });
    }

    private static ListingResponse MapResponse(Listing l) => new(
        l.Id, l.AgentId, l.Agent?.User?.FullName ?? "",
        l.Name, l.Rooms, l.Toilets,
        l.Lat, l.Lng, l.Address,
        l.ResidencyType, l.Price, l.Status, l.CreatedAt,
        l.Images.OrderBy(i => i.DisplayOrder).Select(i => i.S3Url).ToList(),
        l.SourceUrl, l.SourcePlatform);
}
