using System.Text;
using System.Text.Json;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

public class GoogleRoutesService(HttpClient http, IConfiguration config)
{
    private readonly string _apiKey = config["Google:ApiKey"]
        ?? throw new InvalidOperationException("Google:ApiKey not configured");

    /// <summary>
    /// Returns travel duration in minutes between origin and destination.
    /// Uses Google Routes API (computeRoutes endpoint).
    /// </summary>
    public async Task<int?> GetCommuteDurationAsync(
        double originLat, double originLng,
        double destLat, double destLng,
        TransportMode mode)
    {
        var travelMode = mode switch
        {
            TransportMode.Driving => "DRIVE",
            TransportMode.Walking => "WALK",
            TransportMode.Transit => "TRANSIT",
            TransportMode.Bicycling => "BICYCLE",
            _ => "DRIVE"
        };

        var body = new
        {
            origin = new { location = new { latLng = new { latitude = originLat, longitude = originLng } } },
            destination = new { location = new { latLng = new { latitude = destLat, longitude = destLng } } },
            travelMode,
            computeAlternativeRoutes = false,
            routeModifiers = new { avoidTolls = false },
            languageCode = "en-US",
            units = "METRIC"
        };

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://routes.googleapis.com/directions/v2:computeRoutes?key={_apiKey}");

        request.Headers.Add("X-Goog-FieldMask", "routes.duration");
        request.Content = new StringContent(
            JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");

        try
        {
            var response = await http.SendAsync(request);
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            var routes = doc.RootElement.GetProperty("routes");
            if (routes.GetArrayLength() == 0) return null;

            // Duration comes back as "123s"
            var durationStr = routes[0].GetProperty("duration").GetString() ?? "0s";
            var seconds = int.Parse(durationStr.TrimEnd('s'));
            return (int)Math.Ceiling(seconds / 60.0);
        }
        catch
        {
            return null;
        }
    }
}
