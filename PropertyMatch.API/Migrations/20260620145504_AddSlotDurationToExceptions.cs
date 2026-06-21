using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class AddSlotDurationToExceptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SourcePlatform",
                table: "Listings");

            migrationBuilder.DropColumn(
                name: "SourceUrl",
                table: "Listings");

            // migrationBuilder.AddColumn<int>(
            //     name: "SlotDurationMinutes",
            //     table: "AvailabilityExceptions",
            //     type: "integer",
            //     nullable: false,
            //     defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // migrationBuilder.DropColumn(
            //     name: "SlotDurationMinutes",
            //     table: "AvailabilityExceptions");

            migrationBuilder.AddColumn<string>(
                name: "SourcePlatform",
                table: "Listings",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SourceUrl",
                table: "Listings",
                type: "text",
                nullable: true);
        }
    }
}
