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
    /// Notifies the agent when a tenant books a viewing slot.
    /// </summary>
    public async Task SendViewingRequestToAgentAsync(
        string agentEmail, string agentName,
        string tenantName, string tenantEmail,
        string listingName, string listingAddress, DateTime scheduledAt)
    {
        var myt = TimeZoneInfo.ConvertTimeFromUtc(
            scheduledAt,
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Kuala_Lumpur"));

        var html = $"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; background: #0f0f0e; color: #e8e4de; padding: 40px;">
              <div style="max-width: 520px; margin: 0 auto; background: #1c1b19; border-radius: 12px; padding: 36px; border: 1px solid #2e2d2b;">
                <h1 style="font-size: 1.6rem; color: #e8a045; margin-bottom: 8px;">PropertyMatch</h1>
                <div style="background:#1a2a1a; border:1px solid #2b6b2b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
                  <span style="color:#4caf50; font-weight:700;">📅 New Viewing Request</span>
                </div>
                <p style="color: #b0aa9f; margin-bottom: 24px;">
                  Hi {agentName}, <strong style="color:#e8e4de;">{tenantName}</strong> has requested a viewing for one of your listings.
                </p>
                <table style="width:100%; border-collapse:collapse; margin-bottom:24px;">
                  <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b; width:40%;">Property</td>
                      <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{listingName}</td></tr>
                  <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Address</td>
                      <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{listingAddress}</td></tr>
                  <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Date</td>
                      <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{myt:dddd, d MMMM yyyy}</td></tr>
                  <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Time</td>
                      <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{myt:h:mm tt} MYT</td></tr>
                  <tr><td style="color:#6b6560; padding:8px 0; border-bottom:1px solid #2e2d2b;">Tenant</td>
                      <td style="padding:8px 0; border-bottom:1px solid #2e2d2b;">{tenantName}</td></tr>
                  <tr><td style="color:#6b6560; padding:8px 0;">Tenant Email</td>
                      <td style="padding:8px 0;">{tenantEmail}</td></tr>
                </table>
                <p style="font-size: 0.8rem; color: #6b6560;">Log in to PropertyMatch to confirm or decline this request.</p>
              </div>
            </body>
            </html>
            """;

        await SendAsync(agentEmail, $"New Viewing Request — {listingName}", html);
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
                <div style="background:#1a2a1a; border:1px solid #2b6b2b; border-radius:8px; padding:12px 16px; margin-bottom:20px;">
                  <span style="color:#4caf50; font-weight:700;">✓ Viewing Confirmed</span>
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
    /// <summary>
    /// Sends a payment invoice to the agent after a successful token top-up.
    /// </summary>
    public async Task SendPaymentInvoiceAsync(
        string toEmail, string agentName,
        int tokensPurchased, decimal amountPaid,
        int newBalance, DateTime purchasedAt)
    {
        var myt = TimeZoneInfo.ConvertTimeFromUtc(
            purchasedAt,
            TimeZoneInfo.FindSystemTimeZoneById("Asia/Kuala_Lumpur"));

        decimal pricePerToken = tokensPurchased switch
        {
            >= 100 => 0.05m,
            >= 50 => 0.07m,
            _ => 0.10m
        };

        var invoiceNumber = $"PM-{purchasedAt:yyyyMMdd}-{tokensPurchased}";

        var html = $"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: Arial, sans-serif; background: #0f0f0e; color: #e8e4de; padding: 40px;">
              <div style="max-width: 560px; margin: 0 auto; background: #1c1b19; border-radius: 12px; padding: 36px; border: 1px solid #2e2d2b;">

                <!-- Header -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 1px solid #2e2d2b; padding-bottom: 20px;">
                  <div>
                    <h1 style="font-size: 1.6rem; color: #e8a045; margin: 0 0 4px 0;">PropertyMatch</h1>
                    <p style="color: #6b6560; font-size: 0.8rem; margin: 0;">propertymatch.com</p>
                  </div>
                  <div style="text-align: right;">
                    <p style="font-size: 1.1rem; font-weight: 700; color: #e8e4de; margin: 0 0 4px 0;">INVOICE</p>
                    <p style="font-size: 0.78rem; color: #6b6560; margin: 0;">#{invoiceNumber}</p>
                  </div>
                </div>

                <!-- Confirmation banner -->
                <div style="background: #1a2a1a; border: 1px solid #2b6b2b; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px;">
                  <span style="color: #4caf50; font-weight: 700;">✓ Payment Successful — Tokens Credited</span>
                </div>

                <!-- Billed to -->
                <div style="margin-bottom: 24px;">
                  <p style="font-size: 0.75rem; color: #6b6560; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Billed To</p>
                  <p style="font-weight: 600; color: #e8e4de; margin: 0 0 2px 0;">{agentName}</p>
                  <p style="font-size: 0.82rem; color: #b0aa9f; margin: 0;">{toEmail}</p>
                </div>

                <!-- Date -->
                <div style="margin-bottom: 24px;">
                  <p style="font-size: 0.75rem; color: #6b6560; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 6px 0;">Date of Purchase</p>
                  <p style="font-size: 0.9rem; color: #e8e4de; margin: 0;">{myt:dddd, d MMMM yyyy} at {myt:h:mm tt} MYT</p>
                </div>

                <!-- Line items table -->
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                  <thead>
                    <tr style="border-bottom: 1px solid #2e2d2b;">
                      <th style="text-align: left; padding: 8px 0; font-size: 0.75rem; color: #6b6560; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                      <th style="text-align: center; padding: 8px 0; font-size: 0.75rem; color: #6b6560; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                      <th style="text-align: right; padding: 8px 0; font-size: 0.75rem; color: #6b6560; text-transform: uppercase; letter-spacing: 0.5px;">Unit Price</th>
                      <th style="text-align: right; padding: 8px 0; font-size: 0.75rem; color: #6b6560; text-transform: uppercase; letter-spacing: 0.5px;">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style="border-bottom: 1px solid #2e2d2b;">
                      <td style="padding: 12px 0; color: #e8e4de; font-size: 0.9rem;">
                        PropertyMatch Tokens
                        <br/><span style="font-size: 0.78rem; color: #b0aa9f;">1 token = 1 property listing</span>
                      </td>
                      <td style="padding: 12px 0; text-align: center; color: #e8e4de;">{tokensPurchased}</td>
                      <td style="padding: 12px 0; text-align: right; color: #e8e4de;">RM {pricePerToken:0.0000}</td>
                      <td style="padding: 12px 0; text-align: right; color: #e8e4de;">RM {amountPaid:0.00}</td>
                    </tr>
                  </tbody>
                </table>

                <!-- Total -->
                <div style="border-top: 2px solid #e8a045; padding-top: 14px; margin-bottom: 28px;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 0.9rem; color: #b0aa9f;">Total Paid</span>
                    <span style="font-size: 1.3rem; font-weight: 700; color: #e8a045;">RM {amountPaid:0.00}</span>
                  </div>
                </div>

                <!-- Token balance update -->
                <div style="background: #1a1f2e; border: 1px solid #2b3a6b; border-radius: 8px; padding: 14px 16px; margin-bottom: 28px;">
                  <p style="font-size: 0.78rem; color: #6b6560; margin: 0 0 4px 0; text-transform: uppercase; letter-spacing: 0.5px;">Updated Token Balance</p>
                  <p style="font-size: 1.2rem; font-weight: 700; color: #e8a045; margin: 0;">
                    {newBalance} tokens
                    <span style="font-size: 0.8rem; font-weight: 400; color: #b0aa9f; margin-left: 8px;">+{tokensPurchased} added</span>
                  </p>
                </div>

                <!-- Footer -->
                <p style="font-size: 0.78rem; color: #6b6560; margin: 0; line-height: 1.6;">
                  Thank you for using PropertyMatch. This invoice is automatically generated upon successful payment.
                  Tokens are non-refundable once credited to your account.
                </p>

              </div>
            </body>
            </html>
            """;

        await SendAsync(toEmail, $"PropertyMatch Invoice — {tokensPurchased} Tokens Purchased", html);
    }
}