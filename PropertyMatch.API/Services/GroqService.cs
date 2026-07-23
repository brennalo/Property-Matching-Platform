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
            //model = "meta-llama/llama-4-scout-17b-16e-instruct",
            model = "qwen/qwen3.6-27b",
            messages = new object[]
            {
            new
        {
            role = "system",
            content = "You are an image classifier. You MUST respond with ONLY a raw JSON object. No thinking, no explanation, no markdown. Just JSON."
        },
        new
        {
            role = "user",
            content = new object[]
            {
                new { type = "text", text = "Classify this image. Return ONLY this JSON: {\"isProperty\": true/false, \"isAppropriate\": true/false, \"reason\": \"one sentence\"}. isProperty is true if the image shows any residential property interior or exterior. isAppropriate is true if no explicit content." },
                new { type = "image_url", image_url = new { url = dataUrl } }
            }
        }
    },
            temperature = 0.1,
            max_tokens = 1024
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

        // DEBUG: log raw response
        System.Diagnostics.Debug.WriteLine($"[Groq Vision Raw Response]: {text}");
        Console.Error.WriteLine($"[Groq Vision Raw Response]: {text}");

        // Strip thinking tags if present — try closing tag first, then fallback to last } in raw text
        var thinkEnd = text.IndexOf("</think>");
        if (thinkEnd != -1)
        {
            text = text.Substring(thinkEnd + 8).Trim();
        }
        else
        {
            // Model cut off mid-think — extract JSON directly from raw text
            var fallbackStart = text.LastIndexOf("{\"isProperty\"");
            if (fallbackStart == -1) fallbackStart = text.LastIndexOf("{\"is");
            if (fallbackStart != -1)
                text = text.Substring(fallbackStart);
        }

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
        catch (Exception ex)
        {
            Console.Error.WriteLine($"[Groq Vision Parse Error]: {ex.Message} | Raw JSON: {jsonStr}");
            return (false, "Could not parse image verification result");
        }
    }
}