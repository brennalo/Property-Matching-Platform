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
    public async Task<List<MatchedListingResponse>> MatchAsync(MatchRequest req, Guid? tenantId)
    {
        var cfg = (tenantId.HasValue
            ? await db.ScoringConfig.FirstOrDefaultAsync(sc => sc.UserId == tenantId.Value)
            : null) ?? new ScoringConfig();

        var listings = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .Where(l => l.Status == ListingStatus.Active)
            .ToListAsync();

        List<string> placeTypes = [];
        if (req.LifestyleTemplateId.HasValue)
        {
            var template = await db.LifestyleTemplates
                .FirstOrDefaultAsync(t => t.Id == req.LifestyleTemplateId.Value);
            placeTypes = template?.PlaceTypes ?? [];
        }

        var modes = (req.TransportModes?.Count > 0
            ? req.TransportModes.Distinct().ToList()
            : [TransportMode.Driving]);

        var scoredTasks = listings.Select(l => ScoreListingAsync(l, req, modes, placeTypes, cfg));
        var scored = await Task.WhenAll(scoredTasks);

        return [.. scored.OrderByDescending(r => r.TotalScore)];
    }

    private async Task<MatchedListingResponse> ScoreListingAsync(
        Listing listing, MatchRequest req,
        List<TransportMode> modes, List<string> placeTypes, ScoringConfig cfg)
    {
        // ── Numeric score (40%) ───────────────────────────────────────────────
        // Weights redistributed to make room for area scoring (total still = 100):
        //   Rooms       : 20  (was 25)
        //   Toilets     : 12  (was 15)
        //   Type        : 18  (was 20)
        //   Price       : 35  (was 40)
        //   Area        : 15  (new)
        //   ──────────────────
        //   Total max   : 100
        double numericScore = 0;

        // Rooms (max 20)
        if (req.Rooms.HasValue)
        {
            var diff = Math.Abs(listing.Rooms - req.Rooms.Value);
            numericScore += diff == 0 ? 20 : diff == 1 ? 12 : 0;
        }
        else numericScore += 20;

        // Toilets (max 12)
        if (req.Toilets.HasValue)
        {
            var diff = Math.Abs(listing.Toilets - req.Toilets.Value);
            numericScore += diff == 0 ? 12 : diff == 1 ? 6 : 0;
        }
        else numericScore += 12;

        // Residency type (max 18)
        if (req.ResidencyTypes is { Count: > 0 })
            numericScore += req.ResidencyTypes.Contains(listing.ResidencyType) ? 18 : 0;
        else numericScore += 18;

        // Price (max 35)
        if (req.PriceMin.HasValue || req.PriceMax.HasValue)
        {
            var min = req.PriceMin ?? 0;
            var max = req.PriceMax ?? decimal.MaxValue;
            if (listing.Price >= min && listing.Price <= max) numericScore += 35;
            else if (listing.Price <= max * 1.10m) numericScore += 18;
        }
        else numericScore += 35;

        // Area (max 15) — case-insensitive substring match on listing.Address
        if (req.Areas is { Count: > 0 })
        {
            var addrLower = listing.Address.ToLowerInvariant();
            var anyMatch = req.Areas.Any(a => addrLower.Contains(a.Trim().ToLowerInvariant()));
            numericScore += anyMatch ? 15 : 0;
        }
        else numericScore += 15;

        numericScore = Math.Min(numericScore, 100);

        // ── Commute score (30%) — all modes in parallel ───────────────────────
        double commuteScore = 50;
        int? bestMinutes = null;

        var routeMap = await routes.GetRoutesAsync(
            listing.Lat, listing.Lng,
            req.WorkplaceLat, req.WorkplaceLng,
            modes);

        var commuteRoutes = routeMap
            .Select(kv => new ModeCommuteResult(
                kv.Key,
                kv.Value.DurationMinutes,
                kv.Value.DistanceKm,
                kv.Value.EncodedPolyline,
                kv.Value.TransitSteps))
            .ToList();

        if (routeMap.Count > 0)
        {
            var best = routeMap.MinBy(kv => kv.Value.DurationMinutes);
            bestMinutes = best.Value.DurationMinutes;

            var ratio = req.MaxCommuteMinutes > 0
                ? (double)bestMinutes.Value / req.MaxCommuteMinutes
                : 1.0;
            commuteScore = Math.Max(0, 100 * (1 - Math.Min(ratio, 1.0)));
        }

        // ── Lifestyle score (30%) ─────────────────────────────────────────────
        double lifestyleScore = 0;
        Dictionary<string, List<PlaceLocation>> lifestylePlaces = [];

        if (placeTypes.Count > 0)
        {
            lifestylePlaces = await places.GetLifestylePlacesAsync(
                listing.Lat, listing.Lng, placeTypes, cfg.LifestyleRadiusMeters);

            var categoryScores = placeTypes.Select(pt =>
            {
                var count = lifestylePlaces.TryGetValue(pt, out var list) ? list.Count : 0;
                return Math.Min(count / 3.0, 1.0) * 100;
            });
            lifestyleScore = categoryScores.Average();
        }
        else lifestyleScore = 50;

        var total = (numericScore * cfg.WeightNumeric)
                  + (commuteScore * cfg.WeightCommute)
                  + (lifestyleScore * cfg.WeightLifestyle);

        // Map PlaceLocation (service model) → PlaceLocationDto (response DTO)
        var lifestylePlacesDto = lifestylePlaces.ToDictionary(
            kv => kv.Key,
            kv => kv.Value.Select(p => new PlaceLocationDto(p.Name, p.Lat, p.Lng)).ToList());

        return new MatchedListingResponse(
            MapToResponse(listing),
            Math.Round(numericScore, 1),
            Math.Round(commuteScore, 1),
            Math.Round(lifestyleScore, 1),
            Math.Round(total, 1),
            bestMinutes,
            lifestylePlacesDto,
            commuteRoutes);
    }

    private static ListingResponse MapToResponse(Listing l) => new(
    l.Id, l.AgentId, l.Agent?.User?.FullName ?? "Agent",
    l.Name, l.Rooms, l.Toilets,
    l.Lat, l.Lng, l.Address,
    l.ResidencyType, l.Price, l.Amenities, l.Description, l.Status,
    l.CreatedAt,
    l.Images.OrderBy(i => i.DisplayOrder)
        .Select(i => new ImageDto(i.Id, i.S3Url, i.DisplayOrder, i.Caption))
        .ToList());
}
