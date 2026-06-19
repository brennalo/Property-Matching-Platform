using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

public class ViewingReminderService(IServiceScopeFactory scopeFactory, ILogger<ViewingReminderService> logger)
    : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Run every 30 minutes
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(30));
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken))
        {
            try { await SendRemindersAsync(); }
            catch (Exception ex) { logger.LogError(ex, "Reminder service error"); }
        }
    }

    private async Task SendRemindersAsync()
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var email = scope.ServiceProvider.GetRequiredService<ResendEmailService>();

        // Window: 23.5 to 24.5 hours from now
        var from = DateTime.UtcNow.AddHours(23.5);
        var to = DateTime.UtcNow.AddHours(24.5);

        var upcoming = await db.ViewingSchedules
            .Include(v => v.Listing)
            .Include(v => v.Tenant)
            .Where(v => v.Status == ScheduleStatus.Confirmed
                     && v.ScheduledAt >= from
                     && v.ScheduledAt <= to)
            .ToListAsync();

        foreach (var v in upcoming)
        {
            _ = email.SendViewingReminderToTenantAsync(
                v.Tenant.Email, v.Tenant.FullName,
                v.Listing.Name, v.Listing.Address, v.ScheduledAt)
                .ContinueWith(t =>
                {
                    if (t.IsFaulted)
                        Console.Error.WriteLine($"[Reminder] Failed for {v.Tenant.Email}: {t.Exception}");
                });
        }
    }
}