using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

public class MatchingService(
    AppDbContext db,
    GoogleRoutesService routes,
    GooglePlacesService places)
{
    // Score weights (must sum to 1.0)
    private const double WeightNumeric  = 0.40;
    private const double WeightCommute  = 0.30;
    private const double WeightLifestyle = 0.30;

    public async Task<List<MatchedListingResponse>> MatchAsync(MatchRequest req, Guid? tenantId)
    {
        // 1. Fetch all active listings with images and agent
        var listings = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .Where(l => l.Status == ListingStatus.Active)
            .ToListAsync();

        // 2. Fetch lifestyle template if provided
        List<string> placeTypes = [];
        if (req.LifestyleTemplateId.HasValue)
        {
            var template = await db.LifestyleTemplates
                .FirstOrDefaultAsync(t => t.Id == req.LifestyleTemplateId.Value);
            placeTypes = template?.PlaceTypes ?? [];
        }

        // 3. Score each listing
        var scoredTasks = listings.Select(l => ScoreListingAsync(l, req, placeTypes));
        var scored = await Task.WhenAll(scoredTasks);

        // 4. Filter out zero-score (hard-fail on numeric) and sort descending
        return scored
            .OrderByDescending(r => r.TotalScore)
            .ToList();
    }

    private async Task<MatchedListingResponse> ScoreListingAsync(
        Listing listing, MatchRequest req, List<string> placeTypes)
    {
        // ── Numeric score (40%) ───────────────────────────────────────────────
        double numericScore = 0;

        if (req.Rooms.HasValue)
        {
            var diff = Math.Abs(listing.Rooms - req.Rooms.Value);
            numericScore += diff == 0 ? 25 : diff == 1 ? 15 : 0;
        }
        else numericScore += 25; // no preference = full points

        if (req.Toilets.HasValue)
        {
            var diff = Math.Abs(listing.Toilets - req.Toilets.Value);
            numericScore += diff == 0 ? 15 : diff == 1 ? 8 : 0;
        }
        else numericScore += 15;

        if (req.ResidencyType.HasValue)
            numericScore += listing.ResidencyType == req.ResidencyType.Value ? 20 : 0;
        else numericScore += 20;

        if (req.PriceMin.HasValue || req.PriceMax.HasValue)
        {
            var min = req.PriceMin ?? 0;
            var max = req.PriceMax ?? decimal.MaxValue;
            if (listing.Price >= min && listing.Price <= max)
                numericScore += 40;
            else if (listing.Price <= max * 1.10m)  // within 10% over
                numericScore += 20;
        }
        else numericScore += 40;

        // Normalise to 0-100
        numericScore = Math.Min(numericScore, 100);

        // ── Commute score (30%) ───────────────────────────────────────────────
        double commuteScore = 50; // default if API unavailable
        int? commuteMinutes = null;

        var minutes = await routes.GetCommuteDurationAsync(
            listing.Lat, listing.Lng,
            req.WorkplaceLat, req.WorkplaceLng,
            req.TransportMode);

        if (minutes.HasValue)
        {
            commuteMinutes = minutes.Value;
            var ratio = req.MaxCommuteMinutes > 0
                ? (double)minutes.Value / req.MaxCommuteMinutes
                : 1.0;
            commuteScore = Math.Max(0, 100 * (1 - Math.Min(ratio, 1.0)));
        }

        // ── Lifestyle score (30%) ─────────────────────────────────────────────
        double lifestyleScore = 0;
        Dictionary<string, int> lifestyleCounts = [];

        if (placeTypes.Count > 0)
        {
            lifestyleCounts = await places.GetLifestyleCountsAsync(
                listing.Lat, listing.Lng, placeTypes);

            // Each category: min(count/3, 1) * 100, then average
            var categoryScores = placeTypes.Select(pt =>
            {
                var count = lifestyleCounts.GetValueOrDefault(pt, 0);
                return Math.Min(count / 3.0, 1.0) * 100;
            });
            lifestyleScore = categoryScores.Average();
        }
        else lifestyleScore = 50; // neutral if no template

        // ── Weighted total ────────────────────────────────────────────────────
        var total = (numericScore * WeightNumeric)
                  + (commuteScore * WeightCommute)
                  + (lifestyleScore * WeightLifestyle);

        var listingDto = MapToResponse(listing);

        return new MatchedListingResponse(
            listingDto,
            Math.Round(numericScore, 1),
            Math.Round(commuteScore, 1),
            Math.Round(lifestyleScore, 1),
            Math.Round(total, 1),
            commuteMinutes,
            lifestyleCounts);
    }

    private static ListingResponse MapToResponse(Listing l) => new(
        l.Id, l.AgentId, l.Agent?.User?.FullName ?? "Agent",
        l.Name, l.Rooms, l.Toilets,
        l.Lat, l.Lng, l.Address,
        l.ResidencyType, l.Price, l.Status,
        l.CreatedAt,
        l.Images.OrderBy(i => i.DisplayOrder).Select(i => i.S3Url).ToList(),
        l.SourceUrl, l.SourcePlatform);
}
