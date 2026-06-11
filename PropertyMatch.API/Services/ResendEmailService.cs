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

        var body = new
        {
            from = $"PropertyMatch <{_fromEmail}>",
            to = new[] { toEmail },
            subject = "Verify your PropertyMatch email",
            html,
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
}
