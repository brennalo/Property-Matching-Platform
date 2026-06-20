using System.Text.Json;

namespace PropertyMatch.API.Services;

public record PlaceLocation(string Name, double Lat, double Lng);

public class GooglePlacesService(HttpClient http, IConfiguration config)
{
    private readonly string _apiKey = config["Google:ApiKey"]
        ?? throw new InvalidOperationException("Google:ApiKey not configured");

    /// <summary>
    /// Returns places of a given type within 800m of a location.
    /// place_type examples: "cafe", "gym", "restaurant", "pharmacy", "supermarket"
    /// </summary>
    public async Task<List<PlaceLocation>> GetNearbyPlacesAsync(double lat, double lng, string placeType, int radiusMeter)
    {
        // Using Places API (New) - Nearby Search
        var url = $"https://places.googleapis.com/v1/places:searchNearby?key={_apiKey}";

        var body = new
        {
            includedTypes = new[] { placeType },
            maxResultCount = 20,
            locationRestriction = new
            {
                circle = new
                {
                    center = new { latitude = lat, longitude = lng },
                    radius = (double)radiusMeter
                }
            }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-Goog-FieldMask", "places.displayName,places.location");
        request.Content = new StringContent(
            JsonSerializer.Serialize(body),
            System.Text.Encoding.UTF8, "application/json");

        try
        {
            var response = await http.SendAsync(request);
            if (!response.IsSuccessStatusCode) return [];

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("places", out var places))
                return [];

            var result = new List<PlaceLocation>();
            foreach (var place in places.EnumerateArray())
            {
                var name = place.TryGetProperty("displayName", out var dn) &&
                           dn.TryGetProperty("text", out var t)
                    ? t.GetString() ?? placeType
                    : placeType;

                if (!place.TryGetProperty("location", out var loc)) continue;
                var placeLat = loc.GetProperty("latitude").GetDouble();
                var placeLng = loc.GetProperty("longitude").GetDouble();

                result.Add(new PlaceLocation(name, placeLat, placeLng));
            }
            return result;
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// For a lifestyle template, fetch all categories in parallel.
    /// Returns a dict of placeType -> list of places (frontend derives count from list length).
    /// </summary>
    public async Task<Dictionary<string, List<PlaceLocation>>> GetLifestylePlacesAsync(
        double lat, double lng, List<string> placeTypes,int radiusMeter)
    {
        var tasks = placeTypes.Select(async pt => (pt, await GetNearbyPlacesAsync(lat, lng, pt,radiusMeter)));
        var results = await Task.WhenAll(tasks);
        return results.ToDictionary(r => r.pt, r => r.Item2);
    }
}
