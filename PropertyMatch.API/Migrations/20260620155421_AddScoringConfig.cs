using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace PropertyMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class AddScoringConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {

            migrationBuilder.CreateTable(
                name: "ScoringConfig",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    WeightNumeric = table.Column<double>(type: "double precision", nullable: false),
                    WeightCommute = table.Column<double>(type: "double precision", nullable: false),
                    WeightLifestyle = table.Column<double>(type: "double precision", nullable: false),
                    LifestyleRadiusMeters = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScoringConfig", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "ScoringConfig",
                columns: new[] { "Id", "LifestyleRadiusMeters", "WeightCommute", "WeightLifestyle", "WeightNumeric" },
                values: new object[] { 1, 800, 0.29999999999999999, 0.29999999999999999, 0.40000000000000002 });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScoringConfig");

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
