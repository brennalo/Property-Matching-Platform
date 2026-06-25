using Amazon.S3;
using Amazon.S3.Model;
using Amazon.S3.Transfer;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

public class S3Service
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IWebHostEnvironment _env;
    private readonly IAmazonS3? _s3Client;
    private readonly bool _useS3;
    private readonly string _uploadPath;
    private readonly string? _bucket;
    private const int MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

    public S3Service(AppDbContext db, IConfiguration config, IWebHostEnvironment env, IAmazonS3? s3Client = null)
    {
        _db = db;
        _config = config;
        _env = env;
        _s3Client = s3Client;

        // Check if S3 is enabled
        _useS3 = _config.GetValue<bool>("Storage:UseS3", false);

        if (_useS3)
        {
            _bucket = _config["Storage:S3:BucketName"]
                ?? throw new InvalidOperationException("Storage:S3:BucketName not configured");
        }
        else
        {
            _uploadPath = Path.Combine(_env.WebRootPath, "uploads");
        }
    }

    /// <summary>
    /// Uploads images for a listing. If S3 is enabled, uploads to S3.
    /// Otherwise, saves locally to wwwroot/uploads.
    /// Returns list of URLs (S3 URLs or local /uploads/ paths).
    /// </summary>
    public async Task<List<string>> UploadListingImagesAsync(
        Guid listingId, IEnumerable<IFormFile> files)
    {
        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
        var urls = new List<string>();
        var order = _db.ListingImages.Count(i => i.ListingId == listingId);

        // Enforce 15-image cap
        var totalAfterUpload = order + files.Count();
        if (totalAfterUpload > 15)
            throw new InvalidOperationException("Cannot exceed 15 images per listing");

        foreach (var file in files)
        {
            if (!allowed.Contains(file.ContentType))
                throw new InvalidOperationException($"File type {file.ContentType} not allowed");

            if (file.Length > MAX_FILE_SIZE_BYTES)
                throw new InvalidOperationException($"File {file.FileName} exceeds 20MB limit");

            var ext = Path.GetExtension(file.FileName);
            var fileName = $"{Guid.NewGuid()}{ext}";
            string url;

            if (_useS3 && _s3Client != null)
            {
                // Upload to S3
                var key = $"listings/{listingId}/{fileName}";

                using var stream = file.OpenReadStream();
                var uploadRequest = new PutObjectRequest
                {
                    BucketName = _bucket,
                    Key = key,
                    InputStream = stream,
                    ContentType = file.ContentType,

                };

                await _s3Client.PutObjectAsync(uploadRequest);
                url = $"https://{_bucket}.s3.ap-southeast-5.amazonaws.com/{key}";
            }
            else
            {
                // Upload locally
                var listingFolder = Path.Combine(_uploadPath, listingId.ToString());
                Directory.CreateDirectory(listingFolder);

                var filePath = Path.Combine(listingFolder, fileName);
                using var stream = new FileStream(filePath, FileMode.Create);
                await file.CopyToAsync(stream);
                // URL that ASP.NET will serve from wwwroot/uploads
                url = $"/uploads/{listingId}/{fileName}";
            }

            urls.Add(url);

            _db.ListingImages.Add(new ListingImage
            {
                ListingId = listingId,
                S3Url = url,
                DisplayOrder = order++,
                Caption = null
            });
        }

        await _db.SaveChangesAsync();
        return urls;
    }

    /// <summary>
    /// Deletes all images for a listing from S3 or local storage.
    /// </summary>
    public async Task DeleteListingImagesAsync(Guid listingId)
    {
        var images = _db.ListingImages.Where(i => i.ListingId == listingId).ToList();

        if (_useS3 && _s3Client != null)
        {
            // Delete from S3
            foreach (var image in images)
            {
                try
                {
                    var key = new Uri(image.S3Url).AbsolutePath.TrimStart('/').TrimStart('\\');
                    if (key.StartsWith(_bucket + "/"))
                        key = key.Substring(_bucket.Length + 1);

                    await _s3Client.DeleteObjectAsync(_bucket, key);
                }
                catch
                {
                    // Continue even if S3 delete fails
                }
            }
        }
        else
        {
            // Delete from local storage
            var listingFolder = Path.Combine(_uploadPath, listingId.ToString());
            if (Directory.Exists(listingFolder))
                Directory.Delete(listingFolder, recursive: true);
        }

        _db.ListingImages.RemoveRange(images);
        await _db.SaveChangesAsync();
    }

    /// <summary>
    /// Deletes a single image from S3 or local storage.
    /// </summary>
    public async Task DeleteImageAsync(Guid imageId)
    {
        var image = await _db.ListingImages.FirstOrDefaultAsync(i => i.Id == imageId);
        if (image == null) return;

        if (_useS3 && _s3Client != null)
        {
            try
            {
                var key = new Uri(image.S3Url).AbsolutePath.TrimStart('/').TrimStart('\\');
                if (key.StartsWith(_bucket + "/"))
                    key = key.Substring(_bucket.Length + 1);

                await _s3Client.DeleteObjectAsync(_bucket, key);
            }
            catch { }
        }
        else
        {
            try
            {
                var filePath = Path.Combine(_env.WebRootPath, image.S3Url.TrimStart('/').Replace('/', Path.DirectorySeparatorChar));
                if (File.Exists(filePath))
                    File.Delete(filePath);
            }
            catch { }
        }

        _db.ListingImages.Remove(image);
        await _db.SaveChangesAsync();
    }

    public async Task<string> UploadImageFromStreamAsync(
    Guid listingId,
    string filename,
    Stream stream,
    string contentType)
{
    var ext = Path.GetExtension(filename);
    var safeName = $"{Guid.NewGuid()}{ext}";
    string url;

    if (_useS3 && _s3Client != null)
    {
        var key = $"listings/{listingId}/{safeName}";
        var uploadRequest = new PutObjectRequest
        {
            BucketName = _bucket,
            Key = key,
            InputStream = stream,
            ContentType = contentType,

        };
        await _s3Client.PutObjectAsync(uploadRequest);
        url = $"https://{_bucket}.s3.ap-southeast-5.amazonaws.com/{key}";
    }
    else
    {
        // Local fallback
        var uploadsFolder = Path.Combine(_env.WebRootPath, "uploads", listingId.ToString());
        Directory.CreateDirectory(uploadsFolder);
        var filePath = Path.Combine(uploadsFolder, safeName);
        using var fileStream = new FileStream(filePath, FileMode.Create);
        await stream.CopyToAsync(fileStream);
        url = $"/uploads/{listingId}/{safeName}";
    }

    return url;
}
}
