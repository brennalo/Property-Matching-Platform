using System.Text;
using System.Text.Json;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

/// <summary>Result from a single-mode route request.</summary>
public record RouteResult(int DurationMinutes, double DistanceKm, string? EncodedPolyline);

public class GoogleRoutesService(HttpClient http, IConfiguration config)
{
    private readonly string _apiKey = config["Google:ApiKey"]
        ?? throw new InvalidOperationException("Google:ApiKey not configured");

    private static string ToGoogleMode(TransportMode mode) => mode switch
    {
        TransportMode.Driving => "DRIVE",
        TransportMode.Walking => "WALK",
        TransportMode.Transit => "TRANSIT",
        TransportMode.Bicycling => "BICYCLE",
        _ => "DRIVE"
    };

    /// <summary>
    /// Fetches duration, distance and encoded polyline for a single transport mode.
    /// Returns null when the Routes API is unavailable or returns an error.
    /// </summary>
    public async Task<RouteResult?> GetRouteAsync(
        double originLat, double originLng,
        double destLat, double destLng,
        TransportMode mode)
    {
        var body = new
        {
            origin = new { location = new { latLng = new { latitude = originLat, longitude = originLng } } },
            destination = new { location = new { latLng = new { latitude = destLat, longitude = destLng } } },
            travelMode = ToGoogleMode(mode),
            computeAlternativeRoutes = false,
            routeModifiers = new { avoidTolls = false },
            languageCode = "en-US",
            units = "METRIC"
        };

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://routes.googleapis.com/directions/v2:computeRoutes?key={_apiKey}");

        // Request duration, distance AND the overview polyline
        request.Headers.Add("X-Goog-FieldMask",
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline");

        request.Content = new StringContent(
            JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        try
        {
            var response = await http.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("routes", out var routesEl)) return null;
            if (routesEl.GetArrayLength() == 0) return null;

            var route = routesEl[0];

            // Duration: "123s"
            var durationStr = route.GetProperty("duration").GetString() ?? "0s";
            var seconds = int.Parse(durationStr.TrimEnd('s'));
            var minutes = (int)Math.Ceiling(seconds / 60.0);

            // Distance: metres as integer
            var distanceMetres = route.TryGetProperty("distanceMeters", out var dmEl)
                ? dmEl.GetInt32() : 0;
            var distanceKm = Math.Round(distanceMetres / 1000.0, 2);

            // Encoded polyline (may be absent for some modes/regions)
            string? polyline = null;
            if (route.TryGetProperty("polyline", out var polyEl) &&
                polyEl.TryGetProperty("encodedPolyline", out var encEl))
            {
                polyline = encEl.GetString();
            }

            return new RouteResult(minutes, distanceKm, polyline);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// Queries all requested modes in parallel and returns results keyed by mode.
    /// </summary>
    public async Task<Dictionary<TransportMode, RouteResult>> GetRoutesAsync(
        double originLat, double originLng,
        double destLat, double destLng,
        IEnumerable<TransportMode> modes)
    {
        var tasks = modes.Distinct().Select(async m =>
            (Mode: m, Result: await GetRouteAsync(originLat, originLng, destLat, destLng, m)));

        var results = await Task.WhenAll(tasks);

        return results
            .Where(r => r.Result != null)
            .ToDictionary(r => r.Mode, r => r.Result!);
    }
}
