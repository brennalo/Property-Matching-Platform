using Microsoft.AspNetCore.Mvc;
using PropertyMatch.API.Services;
using Stripe.Forwarding;

[ApiController]
[Route("api/internal")]
public class InternalController : ControllerBase
{
    private readonly ResendEmailService _email;
    private readonly IConfiguration _config;

    public InternalController(ResendEmailService email, IConfiguration config)
    {
        _email = email;
        _config = config;
    }

    [HttpPost("send-reminder")]
    public async Task<IActionResult> SendReminder([FromBody] ReminderRequest req)
    {
        // check secret header
        var expectedSecret = _config["Internal:Secret"];
        var providedSecret = Request.Headers["X-Internal-Secret"].ToString();

        if (string.IsNullOrEmpty(providedSecret) || providedSecret != expectedSecret)
            return Unauthorized("Invalid internal secret");

        await _email.SendViewingReminderToTenantAsync(
            req.TenantEmail,
            req.TenantName,
            req.ListingName,
            req.ListingAddress,
            req.ScheduledAt);

        return Ok();
    }
}

public class ReminderRequest
{
    public string TenantEmail { get; set; } = "";
    public string TenantName { get; set; } = "";
    public string ListingName { get; set; } = "";
    public string ListingAddress { get; set; } = "";
    public DateTime ScheduledAt { get; set; }
}