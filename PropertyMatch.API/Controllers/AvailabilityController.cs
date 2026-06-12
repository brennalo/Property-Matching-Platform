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
            .OrderBy(a => a.DayOfWeek)
            .ThenBy(a => a.StartTime)
            .ToListAsync();

        return Ok(new AgentAvailabilityListResponse(
            availabilities.Select(MapResponse).ToList()));
    }

    // GET /api/availability/{agentId} — public, get agent's availability for display
    [HttpGet("{agentId}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetByAgentId(Guid agentId)
    {
        var availabilities = await db.AgentAvailabilities
            .Where(a => a.AgentId == agentId)
            .OrderBy(a => a.DayOfWeek)
            .ThenBy(a => a.StartTime)
            .ToListAsync();

        return Ok(new AgentAvailabilityListResponse(
            availabilities.Select(MapResponse).ToList()));
    }

    // POST /api/availability — add a new availability slot
    [HttpPost]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Create([FromBody] AgentAvailabilityRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        // Validate time format (HH:mm)
        if (!IsValidTimeFormat(req.StartTime) || !IsValidTimeFormat(req.EndTime))
            return BadRequest(new { message = "Invalid time format. Use HH:mm" });

        // Validate day of week
        if (req.DayOfWeek < 0 || req.DayOfWeek > 6)
            return BadRequest(new { message = "DayOfWeek must be 0-6" });

        var availability = new AgentAvailability
        {
            AgentId = agent.UserId,
            DayOfWeek = req.DayOfWeek,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
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
            if (!IsValidTimeFormat(req.StartTime) || !IsValidTimeFormat(req.EndTime))
                continue;
            if (req.DayOfWeek < 0 || req.DayOfWeek > 6)
                continue;

            var availability = new AgentAvailability
            {
                AgentId = agent.UserId,
                DayOfWeek = req.DayOfWeek,
                StartTime = req.StartTime,
                EndTime = req.EndTime,
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
        a.Id, a.AgentId, a.DayOfWeek, a.StartTime, a.EndTime, a.CreatedAt);

    private static bool IsValidTimeFormat(string time)
    {
        return System.Text.RegularExpressions.Regex.IsMatch(time, @"^\d{2}:\d{2}$");
    }
}
