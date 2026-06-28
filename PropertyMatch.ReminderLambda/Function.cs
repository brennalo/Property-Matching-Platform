using Amazon.Lambda.Core;
using Npgsql;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

[assembly: LambdaSerializer(typeof(Amazon.Lambda.Serialization.SystemTextJson.DefaultLambdaJsonSerializer))]

namespace PropertyMatch.ReminderLambda;

public class Function
{
    private static readonly HttpClient Http = new();

    private readonly string _connString = Environment.GetEnvironmentVariable("DB_CONNECTION")!;
    private readonly string _resendKey = Environment.GetEnvironmentVariable("RESEND_API_KEY")!;
    private readonly string _fromEmail = Environment.GetEnvironmentVariable("RESEND_FROM_EMAIL")
                                          ?? "noreply@propertymatch.com";

    public async Task FunctionHandler(object input, ILambdaContext context)
    {
        var from = DateTime.UtcNow.AddHours(23.5);
        var to = DateTime.UtcNow.AddHours(24.5);

        context.Logger.LogInformation($"Checking viewings between {from:u} and {to:u}");

        var viewings = await GetUpcomingViewingsAsync(from, to);
        context.Logger.LogInformation($"Found {viewings.Count} viewing(s) to remind");

        var tasks = viewings.Select(v =>
            SendReminderAsync(v, context).ContinueWith(t =>
            {
                if (t.IsFaulted)
                    context.Logger.LogError(
                        $"Failed for {v.TenantEmail}: {t.Exception?.GetBaseException().Message}");
            })
        );

        await Task.WhenAll(tasks);
    }

    private async Task<List<ViewingRow>> GetUpcomingViewingsAsync(DateTime from, DateTime to)
    {
        var rows = new List<ViewingRow>();
        await using var conn = new NpgsqlConnection(_connString);
        await conn.OpenAsync();

        await using var cmd = new NpgsqlCommand(@"
            SELECT
                u.""Email""         AS tenant_email,
                u.""FullName""      AS tenant_name,
                l.""Name""          AS listing_name,
                l.""Address""       AS listing_address,
                vs.""ScheduledAt""
            FROM ""ViewingSchedules"" vs
            JOIN ""Listings"" l ON l.""Id"" = vs.""ListingId""
            JOIN ""Users"" u    ON u.""Id"" = vs.""TenantId""
            WHERE vs.""Status""      = 'Confirmed'
              AND vs.""ScheduledAt"" >= @from
              AND vs.""ScheduledAt"" <  @to", conn);

        cmd.Parameters.AddWithValue("from", from);
        cmd.Parameters.AddWithValue("to", to);

        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            rows.Add(new ViewingRow(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetDateTime(4)));
        }
        return rows;
    }

    private async Task SendReminderAsync(ViewingRow v, ILambdaContext context)
    {
        var malaysiaTime = TimeZoneInfo.ConvertTimeFromUtc(
            v.ScheduledAt,
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Kuala_Lumpur"));

        var html = $"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; background: #0f0f0e; color: #e8e4de; padding: 40px;">
              <div style="max-width: 520px; margin: 0 auto; background: #1c1b19; border-radius: 12px; padding: 36px; border: 1px solid #2e2d2b;">
                <h1 style="font-size: 1.6rem; color: #e8a045; margin-bottom: 8px;">PropertyMatch</h1>
                <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">Viewing Tomorrow</h2>
                <p style="color: #b0aa9f; margin-bottom: 24px;">
                  Hi {v.TenantName}, this is a reminder that your property viewing is
                  <strong style="color:#e8e4de;">tomorrow</strong>.
                </p>
                <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                  <tr>
                    <td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b; width:40%;">Property</td>
                    <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{v.ListingName}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Address</td>
                    <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{v.ListingAddress}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Date</td>
                    <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{malaysiaTime:dddd, d MMMM yyyy}</td>
                  </tr>
                  <tr>
                    <td style="color:#6b6560; padding:8px 0;">Time</td>
                    <td style="padding:8px 0;">{malaysiaTime:h:mm tt} MYT</td>
                  </tr>
                </table>
                <p style="font-size: 0.8rem; color: #6b6560;">
                  Please arrive on time. If you need to reschedule, contact the agent directly through PropertyMatch.
                </p>
              </div>
            </body>
            </html>
            """;

        var payload = new
        {
            from = $"PropertyMatch <{_fromEmail}>",
            to = new[] { v.TenantEmail },
            subject = "Reminder: Property Viewing Tomorrow",
            html
        };

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _resendKey);
        request.Content = new StringContent(
            JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await Http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Resend error for {v.TenantEmail}: {err}");
        }

        context.Logger.LogInformation($"Reminder sent to {v.TenantEmail}");
    }

    private record ViewingRow(
        string TenantEmail,
        string TenantName,
        string ListingName,
        string ListingAddress,
        DateTime ScheduledAt);
}