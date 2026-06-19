using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace PropertyMatch.API.Services;

public class ResendEmailService(HttpClient http, IConfiguration config)
{
    private readonly string _apiKey = config["Resend:ApiKey"]
        ?? throw new InvalidOperationException("Resend:ApiKey not configured");

    private readonly string _fromEmail = config["Resend:FromEmail"] ?? "noreply@propertymatch.com";
    private readonly string _appUrl = config["App:BaseUrl"] ?? "http://localhost:5000";

    public async Task SendAsync(string toEmail, string subject, string htmlContent)
    {
        var body = new
        {
            from = $"PropertyMatch <{_fromEmail}>",
            to = new[] { toEmail },
            subject,
            html = htmlContent,
        };
        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);
        request.Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
        var response = await http.SendAsync(request);
        if (!response.IsSuccessStatusCode)
        {
            var err = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Resend API error: {err}");
        }
    }

    /// <summary>
    /// Sends an email verification link to the user.
    /// </summary>
    public async Task SendVerificationEmailAsync(string toEmail, string fullName, string token)
    {
        var verifyUrl = $"{_appUrl}/api/auth/verify-email?token={token}";

        var html = $"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; background: #0f0f0e; color: #e8e4de; padding: 40px;">
              <div style="max-width: 520px; margin: 0 auto; background: #1c1b19; border-radius: 12px; padding: 36px; border: 1px solid #2e2d2b;">
                <h1 style="font-size: 1.6rem; color: #e8a045; margin-bottom: 8px;">PropertyMatch</h1>
                <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">Verify your email</h2>
                <p style="color: #b0aa9f; margin-bottom: 24px;">
                  Hi {fullName}, thanks for registering. Click the button below to verify your email address.
                  This link expires in <strong style="color: #e8e4de;">24 hours</strong>.
                </p>
                <a href="{verifyUrl}"
                   style="display: inline-block; background: #e8a045; color: #0f0f0e; padding: 13px 28px;
                          border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 0.95rem;">
                  Verify Email
                </a>
                <p style="margin-top: 28px; font-size: 0.8rem; color: #6b6560;">
                  Or copy this link into your browser:<br/>
                  <span style="color: #e8a045; word-break: break-all;">{verifyUrl}</span>
                </p>
                <p style="margin-top: 20px; font-size: 0.75rem; color: #6b6560;">
                  If you did not create an account, you can safely ignore this email.
                </p>
              </div>
            </body>
            </html>
            """;

        await SendAsync(toEmail, "Verify your PropertyMatch email", html);

    }

    /// <summary>
    /// Sends a 24-hour reminder to the tenant before their viewing.
    /// Call this from a background job (e.g. Hangfire or a hosted service).
    /// </summary>
    public async Task SendViewingReminderToTenantAsync(
        string toEmail, string tenantName,
        string listingName, string listingAddress, DateTime scheduledAt)
    {
        var malaysiaTime = TimeZoneInfo.ConvertTimeFromUtc(
            scheduledAt,
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Kuala_Lumpur"));

        var html = $"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #0f0f0e; color: #e8e4de; padding: 40px;">
          <div style="max-width: 520px; margin: 0 auto; background: #1c1b19; border-radius: 12px; padding: 36px; border: 1px solid #2e2d2b;">
            <h1 style="font-size: 1.6rem; color: #e8a045; margin-bottom: 8px;">PropertyMatch</h1>
            <h2 style="font-size: 1.1rem; font-weight: 600; margin-bottom: 20px;">⏰ Viewing Tomorrow</h2>
            <p style="color: #b0aa9f; margin-bottom: 24px;">
              Hi {tenantName}, this is a reminder that your property viewing is <strong style="color:#e8e4de;">tomorrow</strong>.
            </p>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b; width:40%;">Property</td>
                  <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{listingName}</td></tr>
              <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Address</td>
                  <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{listingAddress}</td></tr>
              <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Date</td>
                  <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{malaysiaTime:dddd, d MMMM yyyy}</td></tr>
              <tr><td style="color:#6b6560; padding:8px 0;">Time</td>
                  <td style="padding:8px 0;">{malaysiaTime:h:mm tt} MYT</td></tr>
            </table>
            <p style="font-size: 0.8rem; color: #6b6560;">
              Please arrive on time. If you need to reschedule, contact the agent directly through PropertyMatch.
            </p>
          </div>
        </body>
        </html>
        """;

        await SendAsync(toEmail, "⏰ Reminder: Property Viewing Tomorrow", html);
    }

    /// <summary>
    /// Sends a rejection notification to the tenant with optional reason.
    /// </summary>
    public async Task SendViewingRejectedToTenantAsync(
        string toEmail, string tenantName,
        string listingName, DateTime scheduledAt, string? reason)
    {
        var malaysiaTime = TimeZoneInfo.ConvertTimeFromUtc(
            scheduledAt,
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Kuala_Lumpur"));

        var reasonRow = string.IsNullOrWhiteSpace(reason) ? "" : $"""
        <tr><td style="color:#6b6560; padding:8px 0;">Reason</td>
            <td style="padding:8px 0; color:#e8a045;">{reason}</td></tr>
        """;

        var html = $"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #0f0f0e; color: #e8e4de; padding: 40px;">
          <div style="max-width: 520px; margin: 0 auto; background: #1c1b19; border-radius: 12px; padding: 36px; border: 1px solid #2e2d2b;">
            <h1 style="font-size: 1.6rem; color: #e8a045; margin-bottom: 8px;">PropertyMatch</h1>
            <div style="background:#3a1a1a; border:1px solid #6b2b2b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
              <span style="color:#e85555; font-weight:700;">✗ Viewing Declined</span>
            </div>
            <p style="color:#b0aa9f; margin-bottom:24px;">
              Hi {tenantName}, the agent has declined your viewing request for <strong style="color:#e8e4de;">{listingName}</strong>
              scheduled for {malaysiaTime:d MMMM yyyy} at {malaysiaTime:h:mm tt} MYT.
            </p>
            <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
              {reasonRow}
            </table>
            <p style="font-size:0.8rem; color:#6b6560;">
              You can search for other listings or contact the agent to reschedule via PropertyMatch.
            </p>
          </div>
        </body>
        </html>
        """;

        await SendAsync(toEmail, "Your Viewing Request Was Declined", html);
    }

/// <summary>
    /// Sends a rejection notification to the tenant with optional reason.
    /// </summary>
    public async Task SendViewingConfirmedToTenantAsync(
        string toEmail, string tenantName,
        string listingName, String address, DateTime scheduledAt)
    {
        var malaysiaTime = TimeZoneInfo.ConvertTimeFromUtc(
            scheduledAt,
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Kuala_Lumpur"));


        var html = $"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: Arial, sans-serif; background: #0f0f0e; color: #e8e4de; padding: 40px;">
          <div style="max-width: 520px; margin: 0 auto; background: #1c1b19; border-radius: 12px; padding: 36px; border: 1px solid #2e2d2b;">
            <h1 style="font-size: 1.6rem; color: #e8a045; margin-bottom: 8px;">PropertyMatch</h1>
            <div style="background:#3a1a1a; border:1px solid #6b2b2b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
              <span style="color:#e85555; font-weight:700;">✗ Viewing Declined</span>
            </div>
            <p style="color:#b0aa9f; margin-bottom:24px;">
              Hi {tenantName}, the agent has confirmed your viewing request for <strong style="color:#e8e4de;">{listingName}</strong> at {address}
              scheduled for {malaysiaTime:d MMMM yyyy} at {malaysiaTime:h:mm tt} MYT.
            </p>
          </div>
        </body>
        </html>
        """;

        await SendAsync(toEmail, "Confirmed: Your Viewing Request has been Confirmed", html);
    }
}
