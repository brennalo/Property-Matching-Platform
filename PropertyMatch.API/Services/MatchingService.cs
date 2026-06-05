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
    private const double WeightNumeric = 0.40;
    private const double WeightCommute = 0.30;
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

        // 3. Normalise transport modes — default to Driving if empty
        var modes = (req.TransportModes?.Count > 0
            ? req.TransportModes.Distinct().ToList()
            : [TransportMode.Driving]);

        // 4. Score each listing concurrently
        var scoredTasks = listings.Select(l => ScoreListingAsync(l, req, modes, placeTypes));
        var scored = await Task.WhenAll(scoredTasks);

        // 5. Sort descending by total score
        return [.. scored.OrderByDescending(r => r.TotalScore)];
    }

    private async Task<MatchedListingResponse> ScoreListingAsync(
        Listing listing,
        MatchRequest req,
        List<TransportMode> modes,
        List<string> placeTypes)
    {
        // ── Numeric score (40%) ───────────────────────────────────────────────
        double numericScore = 0;

        if (req.Rooms.HasValue)
        {
            var diff = Math.Abs(listing.Rooms - req.Rooms.Value);
            numericScore += diff == 0 ? 25 : diff == 1 ? 15 : 0;
        }
        else numericScore += 25;

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
            else if (listing.Price <= max * 1.10m)
                numericScore += 20;
        }
        else numericScore += 40;

        numericScore = Math.Min(numericScore, 100);

        // ── Commute score (30%) — query all modes in parallel ─────────────────
        double commuteScore = 50; // fallback if API unavailable
        int? bestMinutes = null;

        var routeMap = await routes.GetRoutesAsync(
            listing.Lat, listing.Lng,
            req.WorkplaceLat, req.WorkplaceLng,
            modes);

        // Build per-mode response list (for frontend polyline rendering)
        var commuteRoutes = routeMap
            .Select(kv => new ModeCommuteResult(
                kv.Key,
                kv.Value.DurationMinutes,
                kv.Value.DistanceKm,
                kv.Value.EncodedPolyline))
            .ToList();

        if (routeMap.Count > 0)
        {
            // Use the shortest-duration mode for scoring
            var best = routeMap.MinBy(kv => kv.Value.DurationMinutes);
            bestMinutes = best.Value.DurationMinutes;

            var ratio = req.MaxCommuteMinutes > 0
                ? (double)bestMinutes.Value / req.MaxCommuteMinutes
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

            var categoryScores = placeTypes.Select(pt =>
            {
                var count = lifestyleCounts.GetValueOrDefault(pt, 0);
                return Math.Min(count / 3.0, 1.0) * 100;
            });
            lifestyleScore = categoryScores.Average();
        }
        else lifestyleScore = 50;

        // ── Weighted total ────────────────────────────────────────────────────
        var total = (numericScore * WeightNumeric)
                  + (commuteScore * WeightCommute)
                  + (lifestyleScore * WeightLifestyle);

        return new MatchedListingResponse(
            MapToResponse(listing),
            Math.Round(numericScore, 1),
            Math.Round(commuteScore, 1),
            Math.Round(lifestyleScore, 1),
            Math.Round(total, 1),
            bestMinutes,
            lifestyleCounts,
            commuteRoutes);
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
