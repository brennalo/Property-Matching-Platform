using System.Text.Json;

namespace PropertyMatch.API.Services;

public class GooglePlacesService(HttpClient http, IConfiguration config)
{
    private readonly string _apiKey = config["Google:ApiKey"]
        ?? throw new InvalidOperationException("Google:ApiKey not configured");

    private const int RadiusMeters = 800; // Fixed 800m radius

    /// <summary>
    /// Counts the number of places of a given type within 800m of a location.
    /// place_type examples: "cafe", "gym", "restaurant", "pharmacy", "supermarket"
    /// </summary>
    public async Task<int> CountNearbyPlacesAsync(double lat, double lng, string placeType)
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
                    radius = (double)RadiusMeters
                }
            }
        };

        var request = new HttpRequestMessage(HttpMethod.Post, url);
        request.Headers.Add("X-Goog-FieldMask", "places.id");
        request.Content = new StringContent(
            JsonSerializer.Serialize(body),
            System.Text.Encoding.UTF8, "application/json");

        try
        {
            var response = await http.SendAsync(request);
            if (!response.IsSuccessStatusCode) return 0;

            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);

            if (!doc.RootElement.TryGetProperty("places", out var places))
                return 0;

            return places.GetArrayLength();
        }
        catch
        {
            return 0;
        }
    }

    /// <summary>
    /// For a lifestyle template, count all categories in parallel.
    /// Returns a dict of placeType -> count.
    /// </summary>
    public async Task<Dictionary<string, int>> GetLifestyleCountsAsync(
        double lat, double lng, List<string> placeTypes)
    {
        var tasks = placeTypes.Select(async pt => (pt, await CountNearbyPlacesAsync(lat, lng, pt)));
        var results = await Task.WhenAll(tasks);
        return results.ToDictionary(r => r.pt, r => r.Item2);
    }
}
