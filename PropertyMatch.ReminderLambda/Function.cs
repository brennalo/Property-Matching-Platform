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
        var ec2Url = Environment.GetEnvironmentVariable("EC2_API_URL");
        var secret = Environment.GetEnvironmentVariable("INTERNAL_SECRET");

        var payload = new
        {
            tenantEmail = v.TenantEmail,
            tenantName = v.TenantName,
            listingName = v.ListingName,
            listingAddress = v.ListingAddress,
            scheduledAt = v.ScheduledAt
        };

        var request = new HttpRequestMessage(
            HttpMethod.Post, $"{ec2Url}/api/internal/send-reminder");
        request.Headers.Add("X-Internal-Secret", secret);
        request.Content = new StringContent(
            JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        var response = await Http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"EC2 relay failed for {v.TenantEmail}");

        context.Logger.LogInformation($"Reminder queued for {v.TenantEmail}");
    }

    private record ViewingRow(
        string TenantEmail,
        string TenantName,
        string ListingName,
        string ListingAddress,
        DateTime ScheduledAt);
}