using System.Text;
using System.Text.Json;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

// ── DTOs for route data returned to frontend ──────────────────────────────────

public record RouteResult(
    int DurationMinutes,
    double DistanceKm,
    string? EncodedPolyline,
    List<TransitStep>? TransitSteps);   // only populated for Transit mode

public record TransitStep(
    string Type,            // "TRANSIT" | "WALK"
    int DurationMinutes,
    double DistanceKm,
    string? PolylineEncoded,
    // Transit-specific fields (null for walk steps)
    string? LineName,       // e.g. "T589", "PYL"
    string? LineColor,      // hex e.g. "#008000"
    string? LineTextColor,
    string? VehicleType,    // BUS, SUBWAY, RAIL, TRAM, FERRY …
    string? VehicleIcon,    // emoji derived from vehicle type
    string? DepartureStop,
    string? ArrivalStop,
    int? NumStops,
    string? HeadSign);      // direction / destination shown on vehicle

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

    private static string VehicleEmoji(string? type) => type?.ToUpperInvariant() switch
    {
        "BUS" => "🚌",
        "SUBWAY" => "🚇",
        "RAIL" => "🚆",
        "TRAM" => "🚊",
        "FERRY" => "⛴️",
        "CABLE_CAR" => "🚡",
        "GONDOLA_LIFT" => "🚠",
        "FUNICULAR" => "🚞",
        _ => "🚌"
    };

    public async Task<RouteResult?> GetRouteAsync(
        double originLat, double originLng,
        double destLat, double destLng,
        TransportMode mode)
    {
        // Build field mask — request transit steps for TRANSIT mode
        var fieldMask = mode == TransportMode.Transit
            ? "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline," +
              "routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration," +
              "routes.legs.steps.travelMode,routes.legs.steps.polyline.encodedPolyline," +
              "routes.legs.steps.transitDetails"
            : "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline";

        var body = new
        {
            origin = new { location = new { latLng = new { latitude = originLat, longitude = originLng } } },
            destination = new { location = new { latLng = new { latitude = destLat, longitude = destLng } } },
            travelMode = ToGoogleMode(mode),
            computeAlternativeRoutes = false,
            languageCode = "en-US",
            units = "METRIC"
        };

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"https://routes.googleapis.com/directions/v2:computeRoutes?key={_apiKey}");

        request.Headers.Add("X-Goog-FieldMask", fieldMask);
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

            // Duration
            var durationStr = route.GetProperty("duration").GetString() ?? "0s";
            var seconds = int.Parse(durationStr.TrimEnd('s'));
            var minutes = (int)Math.Ceiling(seconds / 60.0);

            // Distance
            var distanceMetres = route.TryGetProperty("distanceMeters", out var dmEl) ? dmEl.GetInt32() : 0;
            var distanceKm = Math.Round(distanceMetres / 1000.0, 2);

            // Overview polyline
            string? polyline = null;
            if (route.TryGetProperty("polyline", out var polyEl) &&
                polyEl.TryGetProperty("encodedPolyline", out var encEl))
                polyline = encEl.GetString();

            // Transit steps (only for Transit mode)
            List<TransitStep>? transitSteps = null;
            if (mode == TransportMode.Transit &&
                route.TryGetProperty("legs", out var legsEl) &&
                legsEl.GetArrayLength() > 0 &&
                legsEl[0].TryGetProperty("steps", out var stepsEl))
            {
                transitSteps = [];
                foreach (var step in stepsEl.EnumerateArray())
                {
                    var stepMode = step.TryGetProperty("travelMode", out var tmEl)
                        ? tmEl.GetString() ?? "WALK" : "WALK";

                    var stepSecs = 0;
                    if (step.TryGetProperty("staticDuration", out var sdEl))
                    {
                        var sdStr = sdEl.GetString() ?? "0s";
                        stepSecs = int.Parse(sdStr.TrimEnd('s'));
                    }
                    var stepMin = (int)Math.Ceiling(stepSecs / 60.0);

                    var stepMetres = step.TryGetProperty("distanceMeters", out var sdmEl)
                        ? sdmEl.GetInt32() : 0;
                    var stepKm = Math.Round(stepMetres / 1000.0, 2);

                    string? stepPolyline = null;
                    if (step.TryGetProperty("polyline", out var spEl) &&
                        spEl.TryGetProperty("encodedPolyline", out var speEl))
                        stepPolyline = speEl.GetString();

                    // Transit-specific details
                    string? lineName = null, lineColor = null, lineTextColor = null,
                            vehicleType = null, vehicleIcon = null,
                            departureStop = null, arrivalStop = null, headSign = null;
                    int? numStops = null;

                    if (stepMode == "TRANSIT" && step.TryGetProperty("transitDetails", out var td))
                    {
                        // Stop names
                        if (td.TryGetProperty("stopDetails", out var sd))
                        {
                            if (sd.TryGetProperty("departureStop", out var ds) &&
                                ds.TryGetProperty("name", out var dsn))
                                departureStop = dsn.GetString();

                            if (sd.TryGetProperty("arrivalStop", out var as_) &&
                                as_.TryGetProperty("name", out var asn))
                                arrivalStop = asn.GetString();
                        }

                        // Line info
                        if (td.TryGetProperty("transitLine", out var tl))
                        {
                            // Short name (e.g. "T589") or long name
                            if (tl.TryGetProperty("nameShort", out var ns))
                                lineName = ns.GetString();
                            else if (tl.TryGetProperty("name", out var nl))
                                lineName = nl.GetString();

                            if (tl.TryGetProperty("color", out var col))
                                lineColor = col.GetString();

                            if (tl.TryGetProperty("textColor", out var tc))
                                lineTextColor = tc.GetString();

                            // Vehicle
                            if (tl.TryGetProperty("vehicle", out var vh))
                            {
                                if (vh.TryGetProperty("type", out var vt))
                                    vehicleType = vt.GetString();
                                vehicleIcon = VehicleEmoji(vehicleType);
                            }
                        }

                        if (td.TryGetProperty("headsign", out var hs))
                            headSign = hs.GetString();

                        if (td.TryGetProperty("stopCount", out var sc))
                            numStops = sc.GetInt32();
                    }

                    transitSteps.Add(new TransitStep(
                        stepMode == "TRANSIT" ? "TRANSIT" : "WALK",
                        stepMin, stepKm, stepPolyline,
                        lineName, lineColor, lineTextColor,
                        vehicleType, vehicleIcon,
                        departureStop, arrivalStop,
                        numStops, headSign));
                }
            }

            return new RouteResult(minutes, distanceKm, polyline, transitSteps);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Queries all modes in parallel and returns a map keyed by mode.</summary>
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
