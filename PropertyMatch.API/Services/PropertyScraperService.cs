using HtmlAgilityPack;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

/// <summary>
/// PropertyScraperService — stub implementation.
/// 
/// This file provides the scaffolding for real web scraping.
/// To activate a scraper: implement the TODO section in each platform scraper,
/// replacing the CSS selectors with the current ones from the target site.
///
/// USAGE CAUTION:
///   - Respect each platform's robots.txt and ToS.
///   - Add 2s delay between requests to avoid IP bans.
///   - Cache results for 24h (do not re-scrape the same listing).
///   - Use a rotating user-agent string.
/// </summary>
public class PropertyScraperService(HttpClient http, ILogger<PropertyScraperService> logger)
{
    private static readonly string[] UserAgents =
    [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/121.0 Safari/537.36",
    ];

    /// <summary>
    /// Aggregates listings from all supported platforms.
    /// Toggle platforms by commenting/uncommenting below.
    /// </summary>
    public async Task<List<ScrapedListingDto>> ScrapeAllAsync(string? location = null)
    {
        var results = new List<ScrapedListingDto>();
        var tasks = new List<Task<List<ScrapedListingDto>>>
        {
            ScrapePropertyGuruAsync(location),
            ScrapeIPropertyAsync(location),
            ScrapeMudahAsync(location),
        };

        var batches = await Task.WhenAll(tasks);
        foreach (var batch in batches) results.AddRange(batch);

        logger.LogInformation("Scraped {Count} listings from all platforms", results.Count);
        return results;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PLATFORM 1: PropertyGuru (propertyguru.com.my)
    // ──────────────────────────────────────────────────────────────────────────
    private async Task<List<ScrapedListingDto>> ScrapePropertyGuruAsync(string? location)
    {
        var results = new List<ScrapedListingDto>();

        // TODO: Update URL pattern if PropertyGuru changes routing
        var url = string.IsNullOrEmpty(location)
            ? "https://www.propertyguru.com.my/property-for-rent"
            : $"https://www.propertyguru.com.my/property-for-rent?market=residential&freetext={Uri.EscapeDataString(location)}";

        try
        {
            var html = await FetchHtmlAsync(url);
            if (html == null) return results;

            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            // TODO: Inspect PropertyGuru's current DOM and update these selectors
            // As of 2024: listings are in <div class="listing-card"> elements
            var listingNodes = doc.DocumentNode
                .SelectNodes("//div[contains(@class,'listing-card')]");

            if (listingNodes == null) return results;

            foreach (var node in listingNodes.Take(20))
            {
                try
                {
                    // TODO: Update these XPath selectors to match current DOM
                    var name    = node.SelectSingleNode(".//h3[contains(@class,'title')]")?.InnerText.Trim();
                    var priceStr = node.SelectSingleNode(".//span[contains(@class,'price')]")?.InnerText.Trim();
                    var address = node.SelectSingleNode(".//span[contains(@class,'location')]")?.InnerText.Trim();
                    var link    = node.SelectSingleNode(".//a[@href]")?.GetAttributeValue("href", "");

                    if (name == null || priceStr == null) continue;

                    results.Add(new ScrapedListingDto(
                        Name: name,
                        Address: address ?? "Unknown",
                        Price: ParsePrice(priceStr),
                        Rooms: ParseRoomsFromText(node.InnerText),
                        Toilets: ParseToiletsFromText(node.InnerText),
                        ResidencyType: ResidencyType.Condo, // TODO: parse from DOM
                        Lat: 0, Lng: 0, // TODO: scrape lat/lng from detail page or use geocoding
                        SourceUrl: link?.StartsWith("http") == true ? link : $"https://www.propertyguru.com.my{link}",
                        SourcePlatform: "PropertyGuru"
                    ));
                }
                catch (Exception ex)
                {
                    logger.LogWarning("PropertyGuru: Failed to parse listing node — {Msg}", ex.Message);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError("PropertyGuru scrape failed: {Msg}", ex.Message);
        }

        return results;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PLATFORM 2: iProperty (iproperty.com.my)
    // ──────────────────────────────────────────────────────────────────────────
    private async Task<List<ScrapedListingDto>> ScrapeIPropertyAsync(string? location)
    {
        var results = new List<ScrapedListingDto>();

        var url = string.IsNullOrEmpty(location)
            ? "https://www.iproperty.com.my/rent/"
            : $"https://www.iproperty.com.my/rent/?q={Uri.EscapeDataString(location)}";

        try
        {
            var html = await FetchHtmlAsync(url);
            if (html == null) return results;

            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            // TODO: Update selectors — iProperty uses React-rendered HTML
            // You may need Playwright/Puppeteer for JavaScript-rendered content
            var listingNodes = doc.DocumentNode
                .SelectNodes("//div[contains(@class,'listing-item')]");

            if (listingNodes == null)
            {
                logger.LogWarning("iProperty: No listing nodes found — page may be JS-rendered. Consider using Playwright.");
                return results;
            }

            foreach (var node in listingNodes.Take(20))
            {
                try
                {
                    // TODO: Update these selectors
                    var name     = node.SelectSingleNode(".//h2")?.InnerText.Trim();
                    var priceStr = node.SelectSingleNode(".//p[contains(@class,'price')]")?.InnerText.Trim();
                    var address  = node.SelectSingleNode(".//p[contains(@class,'address')]")?.InnerText.Trim();
                    var link     = node.SelectSingleNode(".//a")?.GetAttributeValue("href", "");

                    if (name == null || priceStr == null) continue;

                    results.Add(new ScrapedListingDto(
                        Name: name,
                        Address: address ?? "Unknown",
                        Price: ParsePrice(priceStr),
                        Rooms: ParseRoomsFromText(node.InnerText),
                        Toilets: ParseToiletsFromText(node.InnerText),
                        ResidencyType: ResidencyType.Apartment,
                        Lat: 0, Lng: 0,
                        SourceUrl: link?.StartsWith("http") == true ? link : $"https://www.iproperty.com.my{link}",
                        SourcePlatform: "iProperty"
                    ));
                }
                catch (Exception ex)
                {
                    logger.LogWarning("iProperty: Failed to parse node — {Msg}", ex.Message);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError("iProperty scrape failed: {Msg}", ex.Message);
        }

        return results;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // PLATFORM 3: Mudah.my
    // ──────────────────────────────────────────────────────────────────────────
    private async Task<List<ScrapedListingDto>> ScrapeMudahAsync(string? location)
    {
        var results = new List<ScrapedListingDto>();

        var url = string.IsNullOrEmpty(location)
            ? "https://www.mudah.my/malaysia/houses-for-rent"
            : $"https://www.mudah.my/malaysia/houses-for-rent?q={Uri.EscapeDataString(location)}";

        try
        {
            var html = await FetchHtmlAsync(url);
            if (html == null) return results;

            var doc = new HtmlDocument();
            doc.LoadHtml(html);

            // TODO: Mudah uses SSR with JSON-LD data — easier to parse than DOM
            // Look for <script type="application/ld+json"> blocks and parse those
            var jsonLdNodes = doc.DocumentNode
                .SelectNodes("//script[@type='application/ld+json']");

            if (jsonLdNodes != null)
            {
                // TODO: Parse JSON-LD structured data for listings
                // Example structure: { "@type": "Product", "name": "...", "offers": { "price": ... } }
                logger.LogInformation("Mudah: Found {Count} JSON-LD blocks — implement parser here", jsonLdNodes.Count);
            }

            // Fallback: DOM scraping
            var listingNodes = doc.DocumentNode
                .SelectNodes("//li[contains(@class,'list-item')]");

            if (listingNodes == null) return results;

            foreach (var node in listingNodes.Take(20))
            {
                try
                {
                    // TODO: Update selectors
                    var name     = node.SelectSingleNode(".//h2|.//h3")?.InnerText.Trim();
                    var priceStr = node.SelectSingleNode(".//*[contains(@class,'price')]")?.InnerText.Trim();
                    var link     = node.SelectSingleNode(".//a")?.GetAttributeValue("href", "");

                    if (name == null) continue;

                    results.Add(new ScrapedListingDto(
                        Name: name,
                        Address: "Malaysia",
                        Price: ParsePrice(priceStr ?? "0"),
                        Rooms: ParseRoomsFromText(node.InnerText),
                        Toilets: ParseToiletsFromText(node.InnerText),
                        ResidencyType: ResidencyType.Landed,
                        Lat: 0, Lng: 0,
                        SourceUrl: link?.StartsWith("http") == true ? link : $"https://www.mudah.my{link}",
                        SourcePlatform: "Mudah"
                    ));
                }
                catch (Exception ex)
                {
                    logger.LogWarning("Mudah: Failed to parse node — {Msg}", ex.Message);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError("Mudah scrape failed: {Msg}", ex.Message);
        }

        return results;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Shared helpers
    // ──────────────────────────────────────────────────────────────────────────
    private async Task<string?> FetchHtmlAsync(string url)
    {
        try
        {
            var rng = new Random();
            http.DefaultRequestHeaders.Clear();
            http.DefaultRequestHeaders.Add("User-Agent", UserAgents[rng.Next(UserAgents.Length)]);
            http.DefaultRequestHeaders.Add("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8");
            http.DefaultRequestHeaders.Add("Accept-Language", "en-US,en;q=0.5");

            var response = await http.GetAsync(url);
            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("FetchHtml: {StatusCode} for {Url}", response.StatusCode, url);
                return null;
            }

            await Task.Delay(2000); // polite crawling delay
            return await response.Content.ReadAsStringAsync();
        }
        catch (Exception ex)
        {
            logger.LogError("FetchHtml failed for {Url}: {Msg}", url, ex.Message);
            return null;
        }
    }

    private static decimal ParsePrice(string raw)
    {
        var cleaned = System.Text.RegularExpressions.Regex.Replace(raw, @"[^\d.]", "");
        return decimal.TryParse(cleaned, out var price) ? price : 0;
    }

    private static int ParseRoomsFromText(string text)
    {
        var match = System.Text.RegularExpressions.Regex.Match(text, @"(\d+)\s*(bed|room|br)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success && int.TryParse(match.Groups[1].Value, out var n) ? n : 0;
    }

    private static int ParseToiletsFromText(string text)
    {
        var match = System.Text.RegularExpressions.Regex.Match(text, @"(\d+)\s*(bath|toilet|wc)", System.Text.RegularExpressions.RegexOptions.IgnoreCase);
        return match.Success && int.TryParse(match.Groups[1].Value, out var n) ? n : 0;
    }
}

public record ScrapedListingDto(
    string Name, string Address, decimal Price,
    int Rooms, int Toilets, ResidencyType ResidencyType,
    double Lat, double Lng,
    string SourceUrl, string SourcePlatform);
