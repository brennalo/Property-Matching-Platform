using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;
using PropertyMatch.API.Services;
using System.IO.Compression;
using OfficeOpenXml;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/listings")]
[Authorize]
public class ListingsController(AppDbContext db, S3Service s3, GroqService groq) : ControllerBase
{
    // ── GET: all active listings ──────────────────────────────────────────
    [HttpGet]
    [AllowAnonymous]
    public async Task<IActionResult> GetAll()
    {
        var listings = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .Where(l => l.Status == ListingStatus.Active)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
        return Ok(listings.Select(MapResponse));
    }

    // ── GET: agent's own listings ──────────────────────────────────────────
    [HttpGet("mine")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GetMine()
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound();

        var listings = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .Where(l => l.AgentId == agent.UserId)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();
        return Ok(listings.Select(MapResponse));
    }

    // ── GET: single listing ──────────────────────────────────────────────────
    [HttpGet("{id}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id)
    {
        var listing = await db.Listings
            .Include(l => l.Images)
            .Include(l => l.Agent).ThenInclude(a => a.User)
            .FirstOrDefaultAsync(l => l.Id == id);
        if (listing == null) return NotFound();
        return Ok(MapResponse(listing));
    }

    // ── POST: create single listing ────────────────────────────────────────
    [HttpPost]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Create([FromBody] CreateListingRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound(new { message = "Agent profile not found" });

        if (agent.User.Status != UserStatus.Verified)
            return Forbid();

        if (agent.TokenBalance < 1)
            return BadRequest(new { message = "Insufficient tokens. Please top up." });

        agent.TokenBalance -= 1;

        var listing = new Listing
        {
            AgentId = agent.UserId,
            Name = req.Name,
            Rooms = req.Rooms,
            Toilets = req.Toilets,
            Lat = req.Lat,
            Lng = req.Lng,
            Address = req.Address,
            ResidencyType = req.ResidencyType,
            Price = req.Price,
            Description = req.Description,
            Amenities = req.Amenities,
            Status = ListingStatus.Active
        };

        db.Listings.Add(listing);
        await db.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = listing.Id },
            new { listing.Id, message = "Listing created and is now active." });
    }

    // ── POST: batch create from Excel (JSON) ──────────────────────────────
    [HttpPost("batch")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> BatchCreate([FromBody] List<BatchListingRequest> requests)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound(new { message = "Agent profile not found" });

        if (agent.User.Status != UserStatus.Verified)
            return Forbid();

        var requiredTokens = requests.Count;
        if (agent.TokenBalance < requiredTokens)
            return BadRequest(new
            {
                message = $"Insufficient tokens. This batch requires {requiredTokens} tokens but you only have {agent.TokenBalance}."
            });

        var successCount = 0;
        var errors = new List<string>();

        foreach (var req in requests)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(req.PropertyName))
                    throw new Exception("PropertyName is required");
                if (string.IsNullOrWhiteSpace(req.Address))
                    throw new Exception("Address is required");
                if (!Enum.TryParse<ResidencyType>(req.Type, out var residencyType))
                    throw new Exception($"Invalid Type: {req.Type}");

                var listing = new Listing
                {
                    AgentId = agent.UserId,
                    Name = req.PropertyName,
                    Rooms = req.Bedrooms,
                    Toilets = req.Bathrooms,
                    Lat = req.Latitude,
                    Lng = req.Longitude,
                    Address = req.Address,
                    ResidencyType = residencyType,
                    Price = req.Price,
                    Status = ListingStatus.Active,
                    Description = req.Description,
                    Amenities = req.Amenities
                };

                db.Listings.Add(listing);
                agent.TokenBalance -= 1;
                await db.SaveChangesAsync();
                successCount++;
            }
            catch (Exception ex)
            {
                errors.Add($"Row failed: {req.PropertyName} — {ex.Message}");
            }
        }

        return Ok(new BatchListingResponse(successCount, errors.Count, errors, new List<Guid>()));
    }

    // ── PUT: update listing ──────────────────────────────────────────────────
    [HttpPut("{id}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateListingRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var listing = await db.Listings.FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent!.UserId);
        if (listing == null) return NotFound();

        if (req.Name != null) listing.Name = req.Name;
        if (req.Rooms.HasValue) listing.Rooms = req.Rooms.Value;
        if (req.Toilets.HasValue) listing.Toilets = req.Toilets.Value;
        if (req.Lat.HasValue) listing.Lat = req.Lat.Value;
        if (req.Lng.HasValue) listing.Lng = req.Lng.Value;
        if (req.Address != null) listing.Address = req.Address;
        if (req.ResidencyType.HasValue) listing.ResidencyType = req.ResidencyType.Value;
        if (req.Price.HasValue) listing.Price = req.Price.Value;
        if (req.Description != null) listing.Description = req.Description;
        if (req.Amenities != null) listing.Amenities = req.Amenities;

        await db.SaveChangesAsync();
        return Ok(new { message = "Listing updated" });
    }

    // ── PATCH: update status ──────────────────────────────────────────────────
    [HttpPatch("{id}/status")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> UpdateStatus(Guid id, [FromBody] UpdateListingStatusRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound(new { message = "Agent not found" });

        var listing = await db.Listings.FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent.UserId);
        if (listing == null) return NotFound(new { message = "Listing not found" });

        if (req.Status != ListingStatus.Active && req.Status != ListingStatus.Booked)
            return BadRequest(new { message = "Only Active or Booked status is allowed." });

        listing.Status = req.Status;
        await db.SaveChangesAsync();
        return Ok(new { message = $"Listing marked as {req.Status}" });
    }

    // ── POST: upload images ──────────────────────────────────────────────────
    [HttpPost("{id}/images")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> UploadImages(Guid id, [FromForm] List<IFormFile> files)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var listing = await db.Listings.FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent!.UserId);
        if (listing == null) return NotFound();
        if (files.Count == 0) return BadRequest(new { message = "No files provided" });

        var urls = await s3.UploadListingImagesAsync(id, files);
        return Ok(new { urls });
    }

    // ── PUT: reorder images ──────────────────────────────────────────────────
    [HttpPut("{id}/images/reorder")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> ReorderImages(Guid id, [FromBody] List<ReorderImageRequest> requests)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var listing = await db.Listings
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent!.UserId);
        if (listing == null) return NotFound();

        foreach (var req in requests)
        {
            var image = listing.Images.FirstOrDefault(i => i.Id == req.ImageId);
            if (image != null) image.DisplayOrder = req.DisplayOrder;
        }
        await db.SaveChangesAsync();
        return Ok(new { message = "Images reordered" });
    }

    // ── PUT: update image caption ──────────────────────────────────────────────
    [HttpPut("{id}/images/{imageId}/caption")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> UpdateImageCaption(Guid id, Guid imageId, [FromBody] ImageUploadWithCaptionRequest req)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var image = await db.ListingImages
            .Include(i => i.Listing)
            .FirstOrDefaultAsync(i => i.Id == imageId && i.Listing.Id == id && i.Listing.AgentId == agent!.UserId);
        if (image == null) return NotFound();

        image.Caption = req.Caption;
        await db.SaveChangesAsync();
        return Ok(new { message = "Caption updated" });
    }

    // ── DELETE: single image ──────────────────────────────────────────────────
    [HttpDelete("{id}/images/{imageId}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> DeleteImage(Guid id, Guid imageId)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var image = await db.ListingImages
            .Include(i => i.Listing)
            .FirstOrDefaultAsync(i => i.Id == imageId && i.Listing.Id == id && i.Listing.AgentId == agent!.UserId);
        if (image == null) return NotFound();

        await s3.DeleteImageAsync(imageId);
        return Ok(new { message = "Image deleted" });
    }

    // ── DELETE: listing ──────────────────────────────────────────────────────
    [HttpDelete("{id}")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var userId = User.GetUserId();
        var agent = await db.Agents.FirstOrDefaultAsync(a => a.UserId == userId);
        var listing = await db.Listings
            .Include(l => l.Images)
            .FirstOrDefaultAsync(l => l.Id == id && l.AgentId == agent!.UserId);
        if (listing == null) return NotFound();

        await s3.DeleteListingImagesAsync(id);
        db.Listings.Remove(listing);
        await db.SaveChangesAsync();
        return Ok(new { message = "Listing deleted" });
    }

    // ── POST: generate description using AI ──────────────────────────────────
    [HttpPost("generate-description")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> GenerateDescription([FromBody] GenerateDescriptionRequest req)
    {
        try
        {
            var description = await groq.GenerateListingDescriptionAsync(
                req.Name, req.Rooms, req.Toilets, req.Address, req.ResidencyType, req.Price, req.ExtraDetails);
            return Ok(new GenerateDescriptionResponse(description));
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.Message });
        }
    }

    // ── GET: agent public profile ──────────────────────────────────────────────
    [HttpGet("agents/{agentId}/public")]
    [AllowAnonymous]
    public async Task<IActionResult> GetAgentPublic(Guid agentId)
    {
        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == agentId);
        if (agent == null) return NotFound();

        return Ok(new AgentPublicProfileResponse(
            agent.UserId, agent.User.FullName,
            agent.LicenseNumber, agent.ContactNo, agent.Ratings));
    }

    // ── GET: ZIP template download ──────────────────────────────────────────────
    [HttpGet("batch-template-zip")]
    [AllowAnonymous]
    public async Task<IActionResult> DownloadBatchTemplateZip()
    {
        using var memoryStream = new MemoryStream();
        using (var zip = new ZipArchive(memoryStream, ZipArchiveMode.Create, true))
        {
            // ── 1. Create Excel file ──
            using var package = new ExcelPackage();
            var worksheet = package.Workbook.Worksheets.Add("Listings");

            string[] headers = { "PropertyName", "Bedrooms", "Bathrooms", "Toilets", "Address", "Price", "Type", "Latitude", "Longitude", "Description", "Amenities", "ImageFilenames", "ImageCaptions" };
            for (int col = 1; col <= headers.Length; col++)
            {
                worksheet.Cells[1, col].Value = headers[col - 1];
                worksheet.Cells[1, col].Style.Font.Bold = true;
            }

            worksheet.Cells[2, 1].Value = "Example Property";
            worksheet.Cells[2, 2].Value = 3;
            worksheet.Cells[2, 3].Value = 2;
            worksheet.Cells[2, 4].Value = 2;
            worksheet.Cells[2, 5].Value = "Jalan Ampang, KL";
            worksheet.Cells[2, 6].Value = 2500;
            worksheet.Cells[2, 7].Value = "Condo";
            worksheet.Cells[2, 8].Value = 3.1478;
            worksheet.Cells[2, 9].Value = 101.6953;
            worksheet.Cells[2, 10].Value = "A nice condominium with pool and gym";
            worksheet.Cells[2, 11].Value = "Air conditioner, Bed, Fridge";
            worksheet.Cells[2, 12].Value = "example1.jpg, example2.png";
            worksheet.Cells[2, 13].Value = "Spacious living room, Modern kitchen, Master bedroom";

            var allowedTypes = new[] { "Landed", "Condo", "Apartment", "Townhouse", "Studio", "MasterRoom", "SharedRoom" };
            var validation = worksheet.DataValidations.AddListValidation("G2:G100");
            foreach (var type in allowedTypes)
                validation.Formula.Values.Add(type);
            validation.ShowErrorMessage = true;
            validation.ErrorTitle = "Invalid Property Type";
            validation.Error = "Please select from the dropdown list.";

            worksheet.Cells[1, 1, 1, headers.Length].AutoFitColumns();

            var excelBytes = await package.GetAsByteArrayAsync();

            var excelEntry = zip.CreateEntry("listings.xlsx");
            using (var entryStream = excelEntry.Open())
            {
                await entryStream.WriteAsync(excelBytes, 0, excelBytes.Length);
            }

            // ── 2. Create README.txt at the root ──
            var readmeEntry = zip.CreateEntry("README.txt");
            using (var entryStream = readmeEntry.Open())
            using (var writer = new StreamWriter(entryStream))
            {
                await writer.WriteLineAsync("========================================================");
                await writer.WriteLineAsync("  PropertyMatch – Batch Listing Import Instructions");
                await writer.WriteLineAsync("========================================================");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("1. Edit the 'listings.xlsx' file with your property data.");
                await writer.WriteLineAsync("   - Do NOT change the column headers.");
                await writer.WriteLineAsync("   - For 'Type', pick one from the dropdown list.");
                await writer.WriteLineAsync("   - 'Amenities' should be comma‑separated (e.g., 'Air conditioner, Bed, Fridge').");
                await writer.WriteLineAsync("   - 'ImageFilenames' must match the filenames you place in the 'images/' folder (e.g., 'livingroom.jpg, kitchen.png').");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("2. Add your images to the 'images/' folder.");
                await writer.WriteLineAsync("   - Supported formats: JPG, PNG, WebP, GIF (max 5MB each).");
                await writer.WriteLineAsync("   - Rename your images to simple filenames (no spaces).");
                await writer.WriteLineAsync("   - The filenames must exactly match what you wrote in the 'ImageFilenames' column.");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("3. Save the Excel file and keep it inside the ZIP.");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("4. Upload the entire ZIP file on the 'Batch Import' page.");
                await writer.WriteLineAsync("   - Your listings will be created with 'PendingPayment' status.");
                await writer.WriteLineAsync("   - Images will be attached to each listing automatically.");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("5. After import, you can go to each listing to add captions.");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("========================================================");
            }

            // ── 3. Create images/placeholder.txt with detailed instructions ──
            var folderEntry = zip.CreateEntry("images/placeholder.txt");
            using (var entryStream = folderEntry.Open())
            using (var writer = new StreamWriter(entryStream))
            {
                await writer.WriteLineAsync("========================================================");
                await writer.WriteLineAsync("  How to add images for your listings");
                await writer.WriteLineAsync("========================================================");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("1. Place your image files (JPG, PNG, WebP, GIF) in this folder.");
                await writer.WriteLineAsync("2. Use simple, descriptive filenames (e.g., 'livingroom.jpg', 'kitchen.png').");
                await writer.WriteLineAsync("   - Avoid spaces – use underscores or hyphens.");
                await writer.WriteLineAsync("   - Example: 'bedroom_1.jpg', 'pool_area.png'.");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("3. In the 'listings.xlsx' file, type the exact filenames in the");
                await writer.WriteLineAsync("   'ImageFilenames' column, separated by commas.");
                await writer.WriteLineAsync("   Example: 'livingroom.jpg, kitchen.png, bedroom_1.jpg'");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("4. Each listing can have up to 15 images.");
                await writer.WriteLineAsync("5. The order you list them in the Excel determines their display order.");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("6. After upload, the images will be automatically attached.");
                await writer.WriteLineAsync();
                await writer.WriteLineAsync("Important: Make sure the filenames exactly match!");
                await writer.WriteLineAsync("========================================================");
            }
        }

        memoryStream.Position = 0;
        return File(memoryStream.ToArray(), "application/zip", "batch_template.zip");
    }
    // ── POST: import ZIP (Excel + images) ──────────────────────────────────────
    [HttpPost("batch-zip")]
    [Authorize(Roles = "Agent")]
    public async Task<IActionResult> BatchImportZip(IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded." });

        var userId = User.GetUserId();
        var agent = await db.Agents
            .Include(a => a.User)
            .FirstOrDefaultAsync(a => a.UserId == userId);
        if (agent == null) return NotFound(new { message = "Agent profile not found" });
        if (agent.User.Status != UserStatus.Verified)
            return Forbid();

        using var stream = file.OpenReadStream();
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);

        var excelEntry = archive.Entries.FirstOrDefault(e =>
            e.Name.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) ||
            e.Name.EndsWith(".xls", StringComparison.OrdinalIgnoreCase));
        if (excelEntry == null)
            return BadRequest(new { message = "No Excel file (.xlsx or .xls) found in the ZIP." });

        using var excelStream = excelEntry.Open();
        using var package = new ExcelPackage(excelStream);
        var worksheet = package.Workbook.Worksheets[0];
        if (worksheet.Dimension == null || worksheet.Dimension.Rows < 2)
            return BadRequest(new { message = "Excel file is empty." });

        var rowCount = worksheet.Dimension.Rows;
        var colCount = worksheet.Dimension.Columns;

        // Parse headers (first row)
        var headerMap = new Dictionary<string, int>();
        for (int col = 1; col <= colCount; col++)
        {
            var text = worksheet.Cells[1, col].Text?.Trim(); 
            if (!string.IsNullOrEmpty(text))
                headerMap[text] = col;
        }

        // Build image filename → ZIP entry map
        var imageEntries = archive.Entries
            .Where(e => e.FullName.StartsWith("images/", StringComparison.OrdinalIgnoreCase) && !e.Name.EndsWith("/"))
            .GroupBy(e => e.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);
        
        // DEBUG: Log all found image entries
        var foundNames = imageEntries.Keys.ToList();
        Console.WriteLine("=== Found image entries: " + string.Join(", ", foundNames));
        System.Diagnostics.Debug.WriteLine("Found image entries: " + string.Join(", ", foundNames));

        var createdIds = new List<Guid>();
        var errors = new List<string>();
        var successCount = 0;

        for (int rowIdx = 2; rowIdx <= rowCount; rowIdx++)
        {
            try
            {
                string GetValue(string key)
                {
                    if (!headerMap.TryGetValue(key, out int col)) return "";
                    return worksheet.Cells[rowIdx, col].Text?.Trim() ?? "";
                }

                var propertyName = GetValue("PropertyName");
                var bedrooms = int.TryParse(GetValue("Bedrooms"), out var b) ? b : 0;
                var bathrooms = int.TryParse(GetValue("Bathrooms"), out var bath) ? bath : 0;
                var toilets = int.TryParse(GetValue("Toilets"), out var t) ? t : 0;
                var address = GetValue("Address");
                var price = decimal.TryParse(GetValue("Price"), out var p) ? p : 0;
                var type = GetValue("Type");
                var lat = double.TryParse(GetValue("Latitude"), out var latV) ? latV : 0;
                var lng = double.TryParse(GetValue("Longitude"), out var lngV) ? lngV : 0;
                var description = GetValue("Description");
                var amenities = GetValue("Amenities");
                var imageFilenames = GetValue("ImageFilenames");
                var imageCaptions = GetValue("ImageCaptions");

                if (string.IsNullOrEmpty(propertyName) || string.IsNullOrEmpty(address) || price <= 0)
                {
                    errors.Add($"Row {rowIdx}: Missing required fields (PropertyName, Address, Price).");
                    continue;
                }
                if (!Enum.TryParse<ResidencyType>(type, true, out var residencyType))
                {
                    errors.Add($"Row {rowIdx}: Invalid Type '{type}'.");
                    continue;
                }

                if (agent.TokenBalance < 1)
                {
                    errors.Add($"Row {rowIdx}: Insufficient tokens. Skipping.");
                    continue;
                }
                agent.TokenBalance -= 1;

                var listing = new Listing
                {
                    AgentId = agent.UserId,
                    Name = propertyName,
                    Rooms = bedrooms,
                    Toilets = bathrooms,
                    Lat = lat,
                    Lng = lng,
                    Address = address,
                    ResidencyType = residencyType,
                    Price = price,
                    Status = ListingStatus.Active,
                    Description = description,
                    Amenities = amenities
                };
                db.Listings.Add(listing);
                await db.SaveChangesAsync();
                createdIds.Add(listing.Id);

                if (!string.IsNullOrEmpty(imageFilenames))
                {
                    var filenames = imageFilenames.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    var captions = imageCaptions?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries) 
                                ?? Array.Empty<string>();
                    int order = 0;
                    foreach (var filename in filenames)
                    {
                        if (imageEntries.TryGetValue(filename, out var entry))
                        {
                            using var imageStream = entry.Open();
                            var contentType = GetContentType(Path.GetExtension(entry.Name));
                            var url = await s3.UploadImageFromStreamAsync(listing.Id, filename, imageStream, contentType);
                            
                            // ── Get the caption for this order index ──
                            string caption = (order < captions.Length) ? captions[order] : null;

                            db.ListingImages.Add(new ListingImage
                            {
                                ListingId = listing.Id,
                                S3Url = url,
                                DisplayOrder = order,
                                Caption = caption   // <── now uses the caption
                            });
                            await db.SaveChangesAsync();
                            order++;  // increment after assignment
                        }
                        else
                        {
                            errors.Add($"Row {rowIdx}: Image file '{filename}' not found in images/ folder.");
                        }
                    }
                }

                successCount++;
            }
            catch (Exception ex)
            {
                errors.Add($"Row {rowIdx}: {ex.Message}");
            }
        }

        await db.SaveChangesAsync();

        return Ok(new BatchListingResponse(successCount, errors.Count, errors, createdIds));
    }

    // ── Helper: GetContentType ──────────────────────────────────────────────
    private static string GetContentType(string extension)
    {
        return extension.ToLower() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }

    // ── MapResponse ──────────────────────────────────────────────────────────
    private static ListingResponse MapResponse(Listing l) => new(
        l.Id, l.AgentId, l.Agent?.User?.FullName ?? "",
        l.Name, l.Rooms, l.Toilets,
        l.Lat, l.Lng, l.Address,
        l.ResidencyType, l.Price, l.Amenities, l.Description, l.Status, l.CreatedAt,
        l.Images.OrderBy(i => i.DisplayOrder)
            .Select(i => new ImageDto(i.Id, i.S3Url ?? "", i.DisplayOrder, i.Caption))
            .ToList());
}