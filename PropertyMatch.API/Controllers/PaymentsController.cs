using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;
using PropertyMatch.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.Middleware;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController(StripeService stripeService, IConfiguration config) : ControllerBase
{
    [HttpGet("config")]
    public IActionResult GetConfig()
    {
        var publishableKey = config["Stripe:PublishableKey"]
            ?? throw new InvalidOperationException("Stripe:PublishableKey not configured");
        return Ok(new { publishableKey });
    }

    [HttpPost("create-checkout-session")]
    public async Task<IActionResult> CreateCheckoutSession([FromBody] CreateCheckoutRequest request)
    {
        try
        {
            var successUrl = $"{Request.Scheme}://{Request.Host}/payment-success?session_id={{CHECKOUT_SESSION_ID}}";
            var cancelUrl = $"{Request.Scheme}://{Request.Host}/payment-cancel";

            var result = await stripeService.CreateTokenCheckoutAsync(
                request.AgentId,
                request.TokenAmount,
                successUrl,
                cancelUrl
            );

            return Ok(new { sessionId = result.SessionId, url = result.CheckoutUrl });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Full error: {ex}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("webhook")]
    public async Task<IActionResult> Webhook()
    {
        var json = await new StreamReader(HttpContext.Request.Body).ReadToEndAsync();
        var stripeSignature = Request.Headers["Stripe-Signature"].ToString();

        try
        {
            await stripeService.HandleWebhookAsync(json, stripeSignature, config);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            Console.WriteLine($"❌ Webhook error: {ex.Message}");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("token-balance")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetTokenBalance()
    {
        var userId = User.GetUserId();
        var db = HttpContext.RequestServices.GetRequiredService<AppDbContext>();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();
        return Ok(new { tokenBalance = agent.TokenBalance });
    }
}

public class CreateCheckoutRequest
{
    public Guid AgentId { get; set; }
    public int TokenAmount { get; set; }
}