using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.Models;
using PropertyMatch.API.DTOs;

namespace PropertyMatch.API.Services;

public class AvailabilityService(AppDbContext db)
{
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

        // Fetch all templates (listing‑specific + agent‑level) in ONE query
        var templates = await db.AvailabilityTemplates
            .Where(t => t.AgentId == agentId
                        && t.IsActive
                        && (t.ListingId == null || t.ListingId == listingId)
                        && (t.ValidFrom == null || t.ValidFrom <= toDate)
                        && (t.ValidTo == null || t.ValidTo >= fromDate))
            .ToListAsync();

        // Fetch all exceptions (listing‑specific + agent‑level) in ONE query
        var exceptions = await db.AvailabilityExceptions
            .Where(e => e.AgentId == agentId
                        && (e.ListingId == null || e.ListingId == listingId)
                        && e.ExceptionTo >= fromDate
                        && e.ExceptionFrom <= toDate)
            .ToListAsync();

            Console.WriteLine($"Loaded {exceptions.Count} exceptions for agent {agentId}");

        var slots = new List<AvailableSlotDto>();

        for (var date = fromDate; date <= toDate; date = date.AddDays(1))
        {
            // Check exceptions first (listing‑specific, then agent‑level)
            var exception = exceptions
                .FirstOrDefault(e => e.ListingId == listingId && e.ExceptionFrom <= date && e.ExceptionTo >= date)
                ?? exceptions
                .FirstOrDefault(e => e.ListingId == null && e.ExceptionFrom <= date && e.ExceptionTo >= date);

            if (exception != null)
            {
                if (exception.Type == ExceptionType.Blocked)
                    continue;

                if (!string.IsNullOrEmpty(exception.StartTime) && !string.IsNullOrEmpty(exception.EndTime))
                {
                    var slotsForDay = GenerateSlotsFromTimeRange(date, exception.StartTime, exception.EndTime, 60);
                    slots.AddRange(slotsForDay);
                    continue;
                }
            }

            // Then templates
            var template = templates
                .FirstOrDefault(t => t.ListingId == listingId
                                     && t.DayOfWeek == (int)date.DayOfWeek
                                     && (t.ValidFrom == null || t.ValidFrom <= date)
                                     && (t.ValidTo == null || t.ValidTo >= date))
                ?? templates
                .FirstOrDefault(t => t.ListingId == null
                                     && t.DayOfWeek == (int)date.DayOfWeek
                                     && (t.ValidFrom == null || t.ValidFrom <= date)
                                     && (t.ValidTo == null || t.ValidTo >= date));

            if (template != null)
            {
                var slotsForDay = GenerateSlotsFromTemplate(date, template);
                slots.AddRange(slotsForDay);
            }
        }

        return slots;
    }

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
        var slots = new List<AvailableSlotDto>();
        var start = TimeSpan.Parse(template.StartTime);
        var end = TimeSpan.Parse(template.EndTime);
        var duration = TimeSpan.FromMinutes(template.SlotDurationMinutes);

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

    public async Task<AgentAvailabilitySummaryResponse> GetAgentSummaryAsync(Guid agentId)
    {
        var templates = await db.AvailabilityTemplates
            .Where(t => t.AgentId == agentId && t.IsActive)
            .OrderBy(t => t.DayOfWeek)
            .ThenBy(t => t.ListingId == null ? 0 : 1)
            .ThenBy(t => t.StartTime)
            .Select(t => new AvailabilityTemplateResponse(
                t.Id,
                t.DayOfWeek,
                t.StartTime,
                t.EndTime,
                t.SlotDurationMinutes,
                t.ValidFrom,
                t.ValidTo,
                t.ListingId,
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
                e.CreatedAt
            ))
            .ToListAsync();

        return new AgentAvailabilitySummaryResponse(templates, exceptions);
    }

    public async Task AddTemplatesAsync(Guid agentId, List<AvailabilityTemplateRequest> requests)
{
    // Delete all existing agent‑level templates (ListingId == null)
    var existingTemplates = db.AvailabilityTemplates
        .Where(t => t.AgentId == agentId && t.ListingId == null);
    db.AvailabilityTemplates.RemoveRange(existingTemplates);
    await db.SaveChangesAsync();

    foreach (var req in requests)
    {
        // Skip invalid entries
        if (string.IsNullOrEmpty(req.StartTime) || string.IsNullOrEmpty(req.EndTime))
            continue;
        if (req.StartTime.CompareTo(req.EndTime) >= 0)
            continue;

        var template = new AvailabilityTemplate
        {
            AgentId = agentId,
            ListingId = req.ListingId,
            DayOfWeek = req.DayOfWeek,
            StartTime = req.StartTime,
            EndTime = req.EndTime,
            SlotDurationMinutes = req.SlotDurationMinutes ?? 60,
            ValidFrom = req.ValidFrom.HasValue ? DateTime.SpecifyKind(req.ValidFrom.Value, DateTimeKind.Utc) : null,
            ValidTo = req.ValidTo.HasValue ? DateTime.SpecifyKind(req.ValidTo.Value, DateTimeKind.Utc) : null,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        db.AvailabilityTemplates.Add(template);
    }
    await db.SaveChangesAsync();
}

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
                CreatedAt = DateTime.UtcNow
            };
            db.AvailabilityExceptions.Add(exception);
        }
        await db.SaveChangesAsync();
    }

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
}