using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;
using PropertyMatch.API.Services;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    AppDbContext db,
    JwtService jwt,
    ResendEmailService email) : ControllerBase
{
    // ── Register ──────────────────────────────────────────────────────────────

    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (await db.Users.AnyAsync(u => u.Email == req.Email.ToLowerInvariant()))
            return Conflict(new { message = "Email already registered" });

        if (req.Role == UserRole.Admin)
            return BadRequest(new { message = "Cannot register as admin" });

        if (req.Role == UserRole.Agent)
        {
            if (!LppehLicenseValidator.IsValid(req.LicenseNumber))
            {
                return BadRequest(new { message = "Invalid LPPEH registration number format." });
            }
        }

        var user = new User
        {
            Email = req.Email.ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            FullName = req.FullName,
            Role = req.Role,
            Status = UserStatus.Pending,   // always starts Pending
        };

        db.Users.Add(user);

        if (req.Role == UserRole.Agent)
        {
            // Agent row — UserId is PK, starts Pending (awaits email verify + admin approval)
            db.Agents.Add(new Agent
            {
                UserId = user.Id,
                LicenseNumber = LppehLicenseValidator.Normalize(req.LicenseNumber!)
            });
        }

        // Create email verification token (32-byte random hex, 24h TTL)
        var rawToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        db.EmailVerifications.Add(new EmailVerification
        {
            UserId = user.Id,
            Token = rawToken,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
        });

        await db.SaveChangesAsync();

        // Send email (fire and forget in dev — await in prod)
        try
        {
            await email.SendVerificationEmailAsync(user.Email, user.FullName, rawToken);
        }
        catch (Exception ex)
        {
            // Log but don't fail registration — user can request resend
            Console.WriteLine($"[Email] Failed to send verification: {ex.Message}");
        }

        var msg = req.Role == UserRole.Agent
            ? "Registered successfully. Please check your email to verify your account. After verification, await admin approval before posting listings."
            : "Registered successfully. Please check your email to verify your account.";

        return Ok(new { message = msg });
    }

    // ── Verify Email ──────────────────────────────────────────────────────────

    [HttpGet("verify-email")]
    public async Task<IActionResult> VerifyEmail([FromQuery] string token)
    {
        var verification = await db.EmailVerifications
            .Include(ev => ev.User)
            .FirstOrDefaultAsync(ev => ev.Token == token);

        if (verification == null)
            return BadRequest(new { message = "Invalid or already used verification link." });

        if (verification.ExpiresAt < DateTime.UtcNow)
        {
            db.EmailVerifications.Remove(verification);
            await db.SaveChangesAsync();
            return BadRequest(new { message = "Verification link has expired. Please register again or request a new link." });
        }

        var user = verification.User;

        if (user.Status != UserStatus.Pending)
        {
            db.EmailVerifications.Remove(verification);
            await db.SaveChangesAsync();
            // Redirect to login — already verified
            // Redirect to frontend
            var frontendUrl = HttpContext.RequestServices
                .GetRequiredService<IConfiguration>()["App:FrontendUrl"] ?? "http://localhost:5173";
            return Redirect($"{frontendUrl}/login?verified=already");
        }

        // Mark user as email-verified
        if (user.Role == UserRole.Agent)
        {
            // Email verified, but admin has not approved yet
            user.Status = UserStatus.Unapproved;
        }
        else
        {
            // Tenant can be verified directly after email verification
            user.Status = UserStatus.Verified;
            user.VerifiedAt = DateTime.UtcNow;
        }

        // Remove the used token
        db.EmailVerifications.Remove(verification);

        await db.SaveChangesAsync();

        // Redirect to login with success banner
        var frontendUrl2 = HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["App:FrontendUrl"] ?? "http://localhost:5173";
        return Redirect($"{frontendUrl2}/login?verified=true");
    }

    // ── Resend Verification ───────────────────────────────────────────────────

    [HttpPost("resend-verification")]
    public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant());

        // Always return 200 so we don't leak whether an email is registered
        if (user == null || user.Status == UserStatus.Verified || user.Status == UserStatus.Unapproved)
            return Ok(new { message = "If that email exists and is unverified, a new link has been sent." });

        // Delete any existing tokens for this user
        var existing = db.EmailVerifications.Where(ev => ev.UserId == user.Id);
        db.EmailVerifications.RemoveRange(existing);

        var rawToken = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(32));
        db.EmailVerifications.Add(new EmailVerification
        {
            UserId = user.Id,
            Token = rawToken,
            ExpiresAt = DateTime.UtcNow.AddHours(24),
        });

        await db.SaveChangesAsync();

        try { await email.SendVerificationEmailAsync(user.Email, user.FullName, rawToken); }
        catch (Exception ex) { Console.WriteLine($"[Email] Resend failed: {ex.Message}"); }

        return Ok(new { message = "If that email exists and is unverified, a new link has been sent." });
    }

    // ── Login ─────────────────────────────────────────────────────────────────

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant());

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password" });

        if (user.Status == UserStatus.Blocked)
            return Unauthorized(new { message = "Your account has been suspended. Contact support." });

        // Allow login even if Pending — frontend will show the verification banner
        var token = jwt.GenerateToken(user);

        Response.Cookies.Append("auth_token", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = false,   // set true in production
            SameSite = SameSiteMode.Lax,
            Expires = DateTimeOffset.UtcNow.AddDays(7),
        });

        return Ok(new AuthResponse(
            user.Id, user.Email, user.FullName, user.Role,
            user.Status, user.VerifiedAt));
    }

    // ── Logout ────────────────────────────────────────────────────────────────

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("auth_token");
        return Ok(new { message = "Logged out" });
    }

    // ── Me ────────────────────────────────────────────────────────────────────

    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.GetUserId();
        var user = await db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        return Ok(new AuthResponse(
            user.Id, user.Email, user.FullName, user.Role,
            user.Status, user.VerifiedAt));
    }
}
