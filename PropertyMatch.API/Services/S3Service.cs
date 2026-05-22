//below code are using S3 bucket, commented to test local storage version first without needing to use credit
//using Amazon.S3;
//using Amazon.S3.Transfer;
//using Microsoft.EntityFrameworkCore;
//using PropertyMatch.API.Data;
//using PropertyMatch.API.Models;

//namespace PropertyMatch.API.Services;

//public class S3Service(IAmazonS3 s3, IConfiguration config, AppDbContext db)
//{
//    private readonly string _bucket = config["AWS:BucketName"]
//        ?? throw new InvalidOperationException("AWS:BucketName not configured");

//    /// <summary>
//    /// Uploads images for a listing to S3. Validates file type and size.
//    /// Returns list of saved S3 URLs.
//    /// </summary>
//    public async Task<List<string>> UploadListingImagesAsync(
//        Guid listingId, IEnumerable<IFormFile> files)
//    {
//        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
//        var urls = new List<string>();
//        var order = db.ListingImages.Count(i => i.ListingId == listingId);

//        foreach (var file in files)
//        {
//            if (!allowed.Contains(file.ContentType))
//                throw new InvalidOperationException($"File type {file.ContentType} not allowed");

//            if (file.Length > 5 * 1024 * 1024)
//                throw new InvalidOperationException("File exceeds 5MB limit");

//            var ext = Path.GetExtension(file.FileName);
//            var key = $"listings/{listingId}/{Guid.NewGuid()}{ext}";

//            using var stream = file.OpenReadStream();
//            var uploadRequest = new TransferUtilityUploadRequest
//            {
//                BucketName = _bucket,
//                Key = key,
//                InputStream = stream,
//                ContentType = file.ContentType,
//                CannedACL = S3CannedACL.PublicRead
//            };

//            var transfer = new TransferUtility(s3);
//            await transfer.UploadAsync(uploadRequest);

//            var url = $"https://{_bucket}.s3.amazonaws.com/{key}";
//            urls.Add(url);

//            db.ListingImages.Add(new ListingImage
//            {
//                ListingId = listingId,
//                S3Url = url,
//                DisplayOrder = order++
//            });
//        }

//        await db.SaveChangesAsync();
//        return urls;
//    }

//    public async Task DeleteListingImagesAsync(Guid listingId)
//    {
//        var images = db.ListingImages.Where(i => i.ListingId == listingId);
//        foreach (var image in images)
//        {
//            var key = new Uri(image.S3Url).AbsolutePath.TrimStart('/');
//            await s3.DeleteObjectAsync(_bucket, key);
//        }
//        db.ListingImages.RemoveRange(images);
//        await db.SaveChangesAsync();
//    }
//}

using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Services;

public class S3Service(AppDbContext db, IConfiguration config, IWebHostEnvironment env)
{
    private readonly string _uploadPath = Path.Combine(env.WebRootPath, "uploads");

    public async Task<List<string>> UploadListingImagesAsync(
        Guid listingId, IEnumerable<IFormFile> files)
    {
        var allowed = new[] { "image/jpeg", "image/png", "image/webp" };
        var urls = new List<string>();
        var order = db.ListingImages.Count(i => i.ListingId == listingId);

        // Create uploads folder if it doesn't exist
        var listingFolder = Path.Combine(_uploadPath, listingId.ToString());
        Directory.CreateDirectory(listingFolder);

        foreach (var file in files)
        {
            if (!allowed.Contains(file.ContentType))
                throw new InvalidOperationException($"File type not allowed");

            if (file.Length > 5 * 1024 * 1024)
                throw new InvalidOperationException("File exceeds 5MB limit");

            var ext = Path.GetExtension(file.FileName);
            var fileName = $"{Guid.NewGuid()}{ext}";
            var filePath = Path.Combine(listingFolder, fileName);

            using var stream = new FileStream(filePath, FileMode.Create);
            await file.CopyToAsync(stream);

            // URL that ASP.NET will serve from wwwroot/uploads
            var url = $"/uploads/{listingId}/{fileName}";
            urls.Add(url);

            db.ListingImages.Add(new ListingImage
            {
                ListingId = listingId,
                S3Url = url,
                DisplayOrder = order++
            });
        }

        await db.SaveChangesAsync();
        return urls;
    }

    public async Task DeleteListingImagesAsync(Guid listingId)
    {
        var images = db.ListingImages.Where(i => i.ListingId == listingId);

        var listingFolder = Path.Combine(_uploadPath, listingId.ToString());
        if (Directory.Exists(listingFolder))
            Directory.Delete(listingFolder, recursive: true);

        db.ListingImages.RemoveRange(images);
        await db.SaveChangesAsync();
    }
}
