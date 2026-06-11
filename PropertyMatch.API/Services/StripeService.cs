//using Stripe;
//using Stripe.Checkout;
//using PropertyMatch.API.Data;
//using PropertyMatch.API.Models;
//using Microsoft.EntityFrameworkCore;

//namespace PropertyMatch.API.Services;

//public class StripeService(AppDbContext db, IConfiguration config)
//{
//    private const decimal ListingFeeAmount = 5000; // RM 50.00 (in sen / smallest unit)

//    /// <summary>
//    /// Creates a Stripe Checkout Session for an agent to pay the listing fee.
//    /// On success, the webhook activates the listing.
//    /// </summary>
//    public async Task<(string CheckoutUrl, string SessionId)> CreateListingCheckoutAsync(
//        Guid agentId, Guid listingId, string successUrl, string cancelUrl)
//    {
//        var agent = await db.Agents
//            .Include(a => a.User)
//            .FirstOrDefaultAsync(a => a.Id == agentId)
//            ?? throw new InvalidOperationException("Agent not found");

//        // Ensure Stripe customer exists
//        if (string.IsNullOrEmpty(agent.StripeCustomerId))
//        {
//            var customerService = new CustomerService();
//            var customer = await customerService.CreateAsync(new CustomerCreateOptions
//            {
//                Email = agent.User.Email,
//                Name = agent.User.FullName,
//                Metadata = new Dictionary<string, string> { { "agentId", agentId.ToString() } }
//            });
//            agent.StripeCustomerId = customer.Id;
//            await db.SaveChangesAsync();
//        }

//        var options = new SessionCreateOptions
//        {
//            Customer = agent.StripeCustomerId,
//            PaymentMethodTypes = ["card"],
//            LineItems =
//            [
//                new SessionLineItemOptions
//                {
//                    PriceData = new SessionLineItemPriceDataOptions
//                    {
//                        Currency = "myr",
//                        UnitAmount = (long)ListingFeeAmount,
//                        ProductData = new SessionLineItemPriceDataProductDataOptions
//                        {
//                            Name = "PropertyMatch Listing Fee",
//                            Description = "One-time fee to activate a property listing"
//                        }
//                    },
//                    Quantity = 1
//                }
//            ],
//            Mode = "payment",
//            SuccessUrl = successUrl,
//            CancelUrl = cancelUrl,
//            Metadata = new Dictionary<string, string>
//            {
//                { "agentId", agentId.ToString() },
//                { "listingId", listingId.ToString() }
//            }
//        };

//        var sessionService = new SessionService();
//        var session = await sessionService.CreateAsync(options);

//        // Record payment as pending
//        db.Payments.Add(new Payment
//        {
//            AgentId = agentId,
//            ListingId = listingId,
//            StripeSessionId = session.Id,
//            StripePaymentIntentId = session.PaymentIntentId ?? "pending",
//            Amount = ListingFeeAmount / 100,
//            Status = "pending"
//        });
//        await db.SaveChangesAsync();

//        return (session.Url, session.Id);
//    }

//    /// <summary>
//    /// Handles Stripe webhook events.
//    /// Called by PaymentsController with the raw request body and Stripe-Signature header.
//    /// </summary>
//    public async Task HandleWebhookAsync(string json, string stripeSignature, IConfiguration config)
//    {
//        var webhookSecret = config["Stripe:WebhookSecret"]
//            ?? throw new InvalidOperationException("Stripe:WebhookSecret not configured");

//        Event stripeEvent;
//        try
//        {
//            stripeEvent = EventUtility.ConstructEvent(json, stripeSignature, webhookSecret);
//        }
//        catch (StripeException)
//        {
//            throw new InvalidOperationException("Invalid Stripe signature");
//        }

//        if (stripeEvent.Type == "checkout.session.completed")
//        {
//            var session = stripeEvent.Data.Object as Session;
//            if (session == null) return;

//            var listingIdStr = session.Metadata.GetValueOrDefault("listingId");
//            var agentIdStr   = session.Metadata.GetValueOrDefault("agentId");

//            if (!Guid.TryParse(listingIdStr, out var listingId) ||
//                !Guid.TryParse(agentIdStr, out var agentId)) return;

//            // Activate the listing
//            var listing = await db.Listings.FindAsync(listingId);
//            if (listing != null)
//            {
//                listing.Status = ListingStatus.Active;
//            }

//            // Update payment record
//            var payment = await db.Payments
//                .FirstOrDefaultAsync(p => p.StripeSessionId == session.Id);
//            if (payment != null)
//            {
//                payment.Status = "succeeded";
//                payment.StripePaymentIntentId = session.PaymentIntentId ?? payment.StripePaymentIntentId;
//            }

//            await db.SaveChangesAsync();
//        }
//    }
//}

using Stripe;
using Stripe.Checkout;
using PropertyMatch.API.Data;
using PropertyMatch.API.Models;
using Microsoft.EntityFrameworkCore;

namespace PropertyMatch.API.Services;

public class StripeService(AppDbContext db, IConfiguration config)
{
    /// <summary>
    /// Creates a Stripe Checkout Session for an agent to top up tokens.
    /// 1 token = RM1 = 100 sen
    /// </summary>
    public async Task<(string CheckoutUrl, string SessionId)> CreateTokenCheckoutAsync(
        Guid agentId, int tokenAmount, string successUrl, string cancelUrl)
    {
        if (tokenAmount < 1)
            throw new InvalidOperationException("Token amount must be at least 1");

        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.Id == agentId)
            ?? throw new InvalidOperationException("Agent not found");

        // Ensure Stripe customer exists
        if (string.IsNullOrEmpty(agent.StripeCustomerId))
        {
            var customerService = new CustomerService();
            var customer = await customerService.CreateAsync(new CustomerCreateOptions
            {
                Email = agent.User.Email,
                Name = agent.User.FullName,
                Metadata = new Dictionary<string, string> { { "agentId", agentId.ToString() } }
            });
            agent.StripeCustomerId = customer.Id;
            await db.SaveChangesAsync();
        }

        var amountInSen = tokenAmount * 100; // RM1 per token

        var options = new SessionCreateOptions
        {
            Customer = agent.StripeCustomerId,
            PaymentMethodTypes = ["card"],
            LineItems =
            [
                new SessionLineItemOptions
                {
                    PriceData = new SessionLineItemPriceDataOptions
                    {
                        Currency = "myr",
                        UnitAmount = amountInSen,
                        ProductData = new SessionLineItemPriceDataProductDataOptions
                        {
                            Name = $"PropertyMatch Tokens x{tokenAmount}",
                            Description = $"Top up {tokenAmount} token(s) — each token allows 1 property listing"
                        }
                    },
                    Quantity = 1
                }
            ],
            Mode = "payment",
            SuccessUrl = successUrl,
            CancelUrl = cancelUrl,
            Metadata = new Dictionary<string, string>
            {
                { "agentId", agentId.ToString() },
                { "tokenAmount", tokenAmount.ToString() }
            }
        };

        var sessionService = new SessionService();
        var session = await sessionService.CreateAsync(options);

        // Record payment as pending
        db.Payments.Add(new Payment
        {
            AgentId = agentId,
            TokensPurchased = tokenAmount,
            StripeSessionId = session.Id,
            StripePaymentIntentId = session.PaymentIntentId ?? "pending",
            Amount = tokenAmount, // RM1 per token
            Status = "pending"
        });
        await db.SaveChangesAsync();

        return (session.Url, session.Id);
    }

    /// <summary>
    /// Handles Stripe webhook events.
    /// On checkout.session.completed → credit tokens to agent wallet.
    /// </summary>
    public async Task HandleWebhookAsync(string json, string stripeSignature, IConfiguration config)
    {
        var webhookSecret = config["Stripe:WebhookSecret"]
            ?? throw new InvalidOperationException("Stripe:WebhookSecret not configured");

        Event stripeEvent;
        try
        {
            stripeEvent = EventUtility.ConstructEvent(json, stripeSignature, webhookSecret);
        }
        catch (StripeException)
        {
            throw new InvalidOperationException("Invalid Stripe signature");
        }

        if (stripeEvent.Type == "checkout.session.completed")
        {
            var session = stripeEvent.Data.Object as Session;
            if (session == null) return;

            var agentIdStr = session.Metadata.GetValueOrDefault("agentId");
            var tokenAmountStr = session.Metadata.GetValueOrDefault("tokenAmount");

            if (!Guid.TryParse(agentIdStr, out var agentId)) return;
            if (!int.TryParse(tokenAmountStr, out var tokenAmount)) return;

            // Credit tokens to agent wallet
            var agent = await db.Agents.FindAsync(agentId);
            if (agent != null)
            {
                agent.TokenBalance += tokenAmount;
            }

            // Update payment record
            var payment = await db.Payments
                .FirstOrDefaultAsync(p => p.StripeSessionId == session.Id);
            if (payment != null)
            {
                payment.Status = "succeeded";
                payment.StripePaymentIntentId = session.PaymentIntentId ?? payment.StripePaymentIntentId;
            }

            await db.SaveChangesAsync();
        }
    }
}
