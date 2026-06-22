using System.Text;
using System.Text.Json;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

public class GroqService(IConfiguration config, HttpClient httpClient)
{
    public async Task<string> GenerateListingDescriptionAsync(
    string name, int rooms, int toilets, string address,
    ResidencyType residencyType, decimal price, string? extraDetails = null)
    {
        var apiKey = config["Groq:ApiKey"]
            ?? throw new InvalidOperationException("Groq:ApiKey not configured");
        var model = config["Groq:Model"] ?? "llama-3.3-70b-versatile";

        var extraDetailsSection = !string.IsNullOrWhiteSpace(extraDetails)
            ? $"\n- Additional details to include: {extraDetails}"
            : "";

        var prompt = $@"Write a short, appealing property listing description (max 100 words) for a rental property with these details:
        - Name: {name}
        - Type: {residencyType}
        - Bedrooms: {rooms}
        - Bathrooms: {toilets}
        - Address: {address}
        - Monthly Rent: RM{price}{extraDetailsSection}

        Write in a friendly, professional real estate tone. Highlight the property type and location. Naturally weave in the additional details if provided. Do not make up amenities that weren't mentioned. Return only the description text, no headers or extra formatting.";

        var requestBody = new
        {
            model = model,
            messages = new[]
            {
            new { role = "user", content = prompt }
        },
            temperature = 0.7,
            max_tokens = 200
        };

        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
        {
            Content = content
        };
        request.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Groq API error: {response.StatusCode} - {errorBody}");
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseBody);

        var text = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        return text?.Trim() ?? "";
    }

    public async Task<(bool IsValid, string Reason)> CheckImageAsync(byte[] imageBytes, string mimeType)
    {
        var apiKey = config["Groq:ApiKey"]
            ?? throw new InvalidOperationException("Groq:ApiKey not configured");

        var base64Image = Convert.ToBase64String(imageBytes);
        var dataUrl = $"data:{mimeType};base64,{base64Image}";

        var requestBody = new
        {
            model = "meta-llama/llama-4-scout-17b-16e-instruct",
            messages = new object[]
            {
            new
            {
                role = "user",
                content = new object[]
                {
                    new { type = "text", text = "Is this image a photo of a house, apartment, room, or property listing (interior or exterior)? Also check if it contains any inappropriate, vulgar, or explicit content. Respond with ONLY a JSON object in this exact format: {\"isProperty\": true/false, \"isAppropriate\": true/false, \"reason\": \"brief explanation\"}" },
                    new { type = "image_url", image_url = new { url = dataUrl } }
                }
            }
            },
            temperature = 0.2,
            max_tokens = 150
        };

        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.groq.com/openai/v1/chat/completions")
        {
            Content = content
        };
        request.Headers.Add("Authorization", $"Bearer {apiKey}");

        var response = await httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Groq vision API error: {response.StatusCode} - {errorBody}");
        }

        var responseBody = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(responseBody);

        var text = doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? "";

        // Extract JSON from response (in case model adds extra text)
        var jsonStart = text.IndexOf('{');
        var jsonEnd = text.LastIndexOf('}');
        if (jsonStart == -1 || jsonEnd == -1)
            return (false, "Could not verify image content");

        var jsonStr = text.Substring(jsonStart, jsonEnd - jsonStart + 1);

        try
        {
            using var resultDoc = JsonDocument.Parse(jsonStr);
            var isProperty = resultDoc.RootElement.GetProperty("isProperty").GetBoolean();
            var isAppropriate = resultDoc.RootElement.GetProperty("isAppropriate").GetBoolean();
            var reason = resultDoc.RootElement.GetProperty("reason").GetString() ?? "";

            var isValid = isProperty && isAppropriate;
            return (isValid, reason);
        }
        catch
        {
            return (false, "Could not parse image verification result");
        }
    }
}