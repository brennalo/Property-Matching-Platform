using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/availability")]
[Authorize]
public class AvailabilityController(AppDbContext db) : ControllerBase
{
    // GET /api/availability/mine — agent gets their own availability rules
    [HttpGet("mine")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetMine()
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        var availabilities = await db.AgentAvailabilities
            .Where(a => a.AgentId == agent.UserId)
            .OrderBy(a => a.ValidFromDate)
            .ThenBy(a => a.StartTime)
            .ToListAsync();

        return Ok(new AgentAvailabilityListResponse(
            availabilities.Select(MapResponse).ToList()));
    }

    // GET /api/availability/{agentId} — public, get agent's availability for a specific date (optional)
    [HttpGet("{agentId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByAgentId(Guid agentId, [FromQuery] DateTime? forDate = null)
    {
        var query = db.AgentAvailabilities.Where(a => a.AgentId == agentId);
        if (forDate.HasValue)
        {
            var date = forDate.Value.Date;
            query = query.Where(a => a.ValidFromDate <= date && a.ValidToDate >= date);
        }
        var availabilities = await query
            .OrderBy(a => a.ValidFromDate)
            .ThenBy(a => a.StartTime)
            .ToListAsync();

        return Ok(new AgentAvailabilityListResponse(
            availabilities.Select(MapResponse).ToList()));
    }

    // POST /api/availability — add a single availability slot (date‑bound)
    [HttpPost]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Create([FromBody] AgentAvailabilityRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        if (!IsValidTimeFormat(req.StartTime) || !IsValidTimeFormat(req.EndTime))
            return BadRequest(new { message = "Invalid time format. Use HH:mm" });

        if (req.StartTime.CompareTo(req.EndTime) >= 0)
            return BadRequest(new { message = "Start time must be before end time" });

        if (req.ValidFromDate > req.ValidToDate)
            return BadRequest(new { message = "ValidFromDate must be <= ValidToDate" });

        var fromDateUtc = DateTime.SpecifyKind(req.ValidFromDate.Date, DateTimeKind.Utc);
        var toDateUtc = DateTime.SpecifyKind(req.ValidToDate.Date, DateTimeKind.Utc);

        var availability = new AgentAvailability
        {
            AgentId = agent.UserId,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
            ValidFromDate = fromDateUtc,
            ValidToDate = toDateUtc,
            Reason = req.Reason,
            CreatedAt = DateTime.UtcNow
        };

        db.AgentAvailabilities.Add(availability);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetMine), MapResponse(availability));
    }

    // POST /api/availability/batch — add multiple slots at once
    [HttpPost("batch")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> BatchCreate([FromBody] List<AgentAvailabilityRequest> requests)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        var created = new List<AgentAvailabilityResponse>();

        foreach (var req in requests)
        {
            // Validate time format
            if (!IsValidTimeFormat(req.StartTime) || !IsValidTimeFormat(req.EndTime))
                continue;
            
            // Validate start time < end time
            if (req.StartTime.CompareTo(req.EndTime) >= 0)
                return BadRequest(new { message = "Start time must be before end time" });
            
            // Validate date range
            if (req.ValidFromDate > req.ValidToDate)
                continue;

            var fromDateUtc = DateTime.SpecifyKind(req.ValidFromDate.Date, DateTimeKind.Utc);
            var toDateUtc = DateTime.SpecifyKind(req.ValidToDate.Date, DateTimeKind.Utc);

            var availability = new AgentAvailability
            {
                AgentId = agent.UserId,
                StartTime = req.StartTime,
                EndTime = req.EndTime,
                ValidFromDate = fromDateUtc,
                ValidToDate = toDateUtc,
                Reason = req.Reason,
                CreatedAt = DateTime.UtcNow
            };

            db.AgentAvailabilities.Add(availability);
            created.Add(MapResponse(availability));
        }

        await db.SaveChangesAsync();
        return Ok(new { message = $"Created {created.Count} availability slots", slots = created });
    }

    // DELETE /api/availability/{id} — remove an availability slot
    [HttpDelete("{id}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var availability = await db.AgentAvailabilities
            .FirstOrDefaultAsync(a => a.Id == id && a.AgentId == agent!.UserId);

        if (availability == null) return NotFound();

        db.AgentAvailabilities.Remove(availability);
        await db.SaveChangesAsync();
        return Ok(new { message = "Availability slot deleted" });
    }

    private static AgentAvailabilityResponse MapResponse(AgentAvailability a) => new(
        a.Id, a.AgentId, a.StartTime, a.EndTime,
        a.ValidFromDate, a.ValidToDate, a.Reason, a.CreatedAt);

    private static bool IsValidTimeFormat(string time)
    {
        return System.Text.RegularExpressions.Regex.IsMatch(time, @"^\d{2}:\d{2}$");
    }
}