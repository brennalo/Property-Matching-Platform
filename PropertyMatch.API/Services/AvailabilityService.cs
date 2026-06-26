using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.Models;
using PropertyMatch.API.DTOs;

namespace PropertyMatch.API.Services;

public class AvailabilityService(AppDbContext db)
{
    // ── Tenant: get available slots ──────────────────────────────────────
    public async Task<List<AvailableSlotDto>> GetAvailableSlotsAsync(
        Guid listingId,
        DateTime fromDate,
        DateTime toDate)
    {
        var listing = await db.Listings
            .Include(l => l.Agent)
            .FirstOrDefaultAsync(l => l.Id == listingId);

        if (listing == null || listing.Agent == null)
            return new List<AvailableSlotDto>();

        var agentId = listing.Agent.UserId;
        var from = fromDate.Date;
        var to = toDate.Date;

        // Get agent‑wide templates (no ListingId)
        var templates = await db.AvailabilityTemplates
            .Where(t => t.AgentId == agentId && t.IsActive)
            .ToListAsync();

        var exceptions = await db.AvailabilityExceptions
            .Where(e => e.AgentId == agentId
                        && (e.ListingId == null || e.ListingId == listingId)
                        && e.ExceptionTo.Date >= from
                        && e.ExceptionFrom.Date <= to)
            .ToListAsync();

        var slots = new List<AvailableSlotDto>();

        for (var date = from; date <= to; date = date.AddDays(1))
        {
            var dateToCheck = date.Date;

            // Check for exception (per‑listing or global)
            var exception = exceptions
                .FirstOrDefault(e => e.ListingId == listingId && e.ExceptionFrom.Date <= dateToCheck && e.ExceptionTo.Date >= dateToCheck)
                ?? exceptions
                .FirstOrDefault(e => e.ListingId == null && e.ExceptionFrom.Date <= dateToCheck && e.ExceptionTo.Date >= dateToCheck);

            if (exception != null)
            {
                if (exception.Type == ExceptionType.Blocked)
                    continue;

                if (!string.IsNullOrEmpty(exception.StartTime) && !string.IsNullOrEmpty(exception.EndTime))
                {
                    var duration = exception.SlotDurationMinutes > 0 ? exception.SlotDurationMinutes : 60;
                    var slotsForDay = GenerateSlotsFromTimeRange(dateToCheck, exception.StartTime, exception.EndTime, duration);
                    slots.AddRange(slotsForDay);
                    continue;
                }
            }

            // ── Use agent‑level template (no ListingId) ──
            var template = templates
                .FirstOrDefault(t => t.DayOfWeek == (int)dateToCheck.DayOfWeek);

            if (template != null)
            {
                var slotsForDay = GenerateSlotsFromTemplate(dateToCheck, template);
                slots.AddRange(slotsForDay);
            }
        }

        return slots;
    }

    // ── Agent: get summary ──────────────────────────────────────────────
    public async Task<AgentAvailabilitySummaryResponse> GetAgentSummaryAsync(Guid agentId)
    {
        var templates = await db.AvailabilityTemplates
            .Where(t => t.AgentId == agentId && t.IsActive)
            .OrderBy(t => t.DayOfWeek)
            .ThenBy(t => t.StartTime)
            .Select(t => new AvailabilityTemplateResponse(
                t.Id,
                t.DayOfWeek,
                t.StartTime,
                t.EndTime,
                t.SlotDurationMinutes,
                t.IsActive,
                t.CreatedAt
            ))
            .ToListAsync();

        var exceptions = await db.AvailabilityExceptions
            .Where(e => e.AgentId == agentId)
            .OrderBy(e => e.ExceptionFrom)
            .Select(e => new AvailabilityExceptionResponse(
                e.Id,
                e.ExceptionFrom,
                e.ExceptionTo,
                e.Type.ToString(),
                e.StartTime,
                e.EndTime,
                e.Reason,
                e.ListingId,
                e.SlotDurationMinutes,
                e.CreatedAt
            ))
            .ToListAsync();

        return new AgentAvailabilitySummaryResponse(templates, exceptions);
    }

    // ── Agent: add templates ─────────────────────────────────────────────
    public async Task AddTemplatesAsync(Guid agentId, List<AvailabilityTemplateRequest> requests)
    {
        // Templates are now agent‑wide – no per‑listing variants.
        // Remove existing templates for this agent (optional, but matches previous logic).
        var existingTemplates = db.AvailabilityTemplates
            .Where(t => t.AgentId == agentId);
        db.AvailabilityTemplates.RemoveRange(existingTemplates);
        await db.SaveChangesAsync();

        foreach (var req in requests)
        {
            if (string.IsNullOrEmpty(req.StartTime) || string.IsNullOrEmpty(req.EndTime))
                continue;
            if (req.StartTime.CompareTo(req.EndTime) >= 0)
                continue;

            var template = new AvailabilityTemplate
            {
                AgentId = agentId,
                DayOfWeek = req.DayOfWeek,
                StartTime = req.StartTime,
                EndTime = req.EndTime,
                SlotDurationMinutes = req.SlotDurationMinutes ?? 60,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            db.AvailabilityTemplates.Add(template);
        }
        await db.SaveChangesAsync();
    }

    // ── Agent: add exceptions ─────────────────────────────────────────────
    public async Task AddExceptionsAsync(Guid agentId, List<AvailabilityExceptionRequest> requests)
    {
        foreach (var req in requests)
        {
            var exception = new AvailabilityException
            {
                AgentId = agentId,
                ListingId = req.ListingId,
                ExceptionFrom = DateTime.SpecifyKind(req.ExceptionFrom, DateTimeKind.Utc),
                ExceptionTo = DateTime.SpecifyKind(req.ExceptionTo, DateTimeKind.Utc),
                Type = req.Type == "custom_hours" ? ExceptionType.CustomHours : ExceptionType.Blocked,
                StartTime = req.StartTime,
                EndTime = req.EndTime,
                Reason = req.Reason,
                SlotDurationMinutes = req.SlotDurationMinutes ?? 60,
                CreatedAt = DateTime.UtcNow
            };
            db.AvailabilityExceptions.Add(exception);
        }
        await db.SaveChangesAsync();
    }

    // ── Agent: delete template ────────────────────────────────────────────
    public async Task DeleteTemplateAsync(Guid templateId, Guid agentId)
    {
        var template = await db.AvailabilityTemplates
            .FirstOrDefaultAsync(t => t.Id == templateId && t.AgentId == agentId);
        if (template != null)
        {
            db.AvailabilityTemplates.Remove(template);
            await db.SaveChangesAsync();
        }
    }

    // ── Agent: delete exception ────────────────────────────────────────────
    public async Task DeleteExceptionAsync(Guid exceptionId, Guid agentId)
    {
        var exception = await db.AvailabilityExceptions
            .FirstOrDefaultAsync(e => e.Id == exceptionId && e.AgentId == agentId);
        if (exception != null)
        {
            db.AvailabilityExceptions.Remove(exception);
            await db.SaveChangesAsync();
        }
    }

    // ── Private helpers ──────────────────────────────────────────────────
    private List<AvailableSlotDto> GenerateSlotsFromTimeRange(DateTime date, string startTime, string endTime, int durationMinutes)
    {
        var slots = new List<AvailableSlotDto>();
        var start = TimeSpan.Parse(startTime);
        var end = TimeSpan.Parse(endTime);
        var duration = TimeSpan.FromMinutes(durationMinutes);

        for (var time = start; time < end; time = time.Add(duration))
        {
            slots.Add(new AvailableSlotDto(
                date,
                time.ToString(@"hh\:mm"),
                time.Add(duration).ToString(@"hh\:mm"),
                false
            ));
        }
        return slots;
    }

    private List<AvailableSlotDto> GenerateSlotsFromTemplate(DateTime date, AvailabilityTemplate template)
    {
        return GenerateSlotsFromTimeRange(date, template.StartTime, template.EndTime, template.SlotDurationMinutes);
    }
}