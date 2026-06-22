using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class AddDescriptionToListing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "Listings",
                type: "text",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Description",
                table: "Listings");
        }
    }
}
