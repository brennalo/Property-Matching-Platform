using System.Text.RegularExpressions;

namespace PropertyMatch.API.Services;

public static class LppehLicenseValidator
{
    public static string Normalize(string licenseNumber)
    {
        return licenseNumber.Trim().ToUpper().Replace(" ", "");
    }
    public static bool IsValid(string? licenseNumber)
    {
        if (string.IsNullOrWhiteSpace(licenseNumber))
            return false;

        var license = Normalize(licenseNumber);

        return Regex.IsMatch(license, @"^(REN|E|REA|PEA|PPM|PM|PV|V)[0-9]{4,6}$");
    }

    public static string? GenerateSearchUrl(string? licenseNumber)
    {
        if (string.IsNullOrWhiteSpace(licenseNumber))
            return null;

        var license = licenseNumber.Trim().ToUpper();

        var match = Regex.Match(
            license,
            @"^(REN|E|REA|PEA|PPM|PM|PV|V)(\d+)$"
        );

        if (!match.Success)
            return null;

        var prefix = match.Groups[1].Value;
        var registrationNo = match.Groups[2].Value;

        var category = prefix == "REN"
            ? "negotiator"
            : "member";

        return $"https://bis.lpeph.gov.my/search?category={category}&name=&registration_no={registrationNo}";
    }
}