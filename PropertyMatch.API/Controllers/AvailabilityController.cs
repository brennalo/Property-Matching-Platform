using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Services;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/availability")]
public class AvailabilityV2Controller(AvailabilityService availability) : ControllerBase
{
    // ── Agent endpoints ──────────────────────────────────────────────

    [HttpGet("summary")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetSummary()
    {
        var agentId = User.GetUserId();
        var summary = await availability.GetAgentSummaryAsync(agentId);
        return Ok(summary);
    }

    [HttpPost("templates")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> AddTemplates([FromBody] List<AvailabilityTemplateRequest> requests)
    {
        var agentId = User.GetUserId();
        await availability.AddTemplatesAsync(agentId, requests);
        return Ok(new { message = "Templates added successfully" });
    }

    [HttpPost("exceptions")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> AddExceptions([FromBody] List<AvailabilityExceptionRequest> requests)
    {
        var agentId = User.GetUserId();
        await availability.AddExceptionsAsync(agentId, requests);
        return Ok(new { message = "Exceptions added successfully" });
    }

    [HttpDelete("templates/{id}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> DeleteTemplate(Guid id)
    {
        var agentId = User.GetUserId();
        await availability.DeleteTemplateAsync(id, agentId);
        return Ok(new { message = "Template deleted" });
    }

    [HttpDelete("exceptions/{id}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> DeleteException(Guid id)
    {
        var agentId = User.GetUserId();
        await availability.DeleteExceptionAsync(id, agentId);
        return Ok(new { message = "Exception deleted" });
    }

    // ── Tenant endpoints ──────────────────────────────────────────────

    [HttpGet("slots")]
    [AllowAnonymous]
    public async Task<IActionResult> GetSlots(
        [FromQuery] Guid listingId,
        [FromQuery] DateTime from,
        [FromQuery] DateTime to)
    {
        if (from > to)
            return BadRequest(new { message = "From date must be before To date" });

        var slots = await availability.GetAvailableSlotsAsync(listingId, from, to);
        return Ok(slots);
    }
}