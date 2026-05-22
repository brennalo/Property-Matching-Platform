using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PropertyMatch.API.Data;
using PropertyMatch.API.DTOs;
using PropertyMatch.API.Middleware;
using PropertyMatch.API.Models;

namespace PropertyMatch.API.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(AppDbContext db, JwtService jwt) : ControllerBase
{
    [HttpPost("register")]
    public async Task<IActionResult> Register([FromBody] RegisterRequest req)
    {
        if (await db.Users.AnyAsync(u => u.Email == req.Email))
            return Conflict(new { message = "Email already registered" });

        if (req.Role == UserRole.Admin)
            return BadRequest(new { message = "Cannot register as admin" });

        var user = new User
        {
            Email = req.Email.ToLowerInvariant(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            FullName = req.FullName,
            Role = req.Role
        };

        db.Users.Add(user);

        if (req.Role == UserRole.Agent)
        {
            db.Agents.Add(new Agent { UserId = user.Id });
        }

        await db.SaveChangesAsync();
        return Ok(new { message = "Registered successfully. " + (req.Role == UserRole.Agent ? "Await admin verification before posting listings." : "") });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == req.Email.ToLowerInvariant());
        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password" });

        if (!user.IsActive)
            return Unauthorized(new { message = "Account is inactive" });

        var token = jwt.GenerateToken(user);

        Response.Cookies.Append("auth_token", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = true,
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddDays(7)
        });

        return Ok(new AuthResponse(user.Id, user.Email, user.FullName, user.Role));
    }

    [HttpPost("logout")]
    public IActionResult Logout()
    {
        Response.Cookies.Delete("auth_token");
        return Ok(new { message = "Logged out" });
    }

    [HttpGet("me")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public async Task<IActionResult> Me()
    {
        var userId = User.GetUserId();
        var user = await db.Users.FindAsync(userId);
        if (user == null) return NotFound();
        return Ok(new AuthResponse(user.Id, user.Email, user.FullName, user.Role));
    }
}
