using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PropertyMatch.API.Migrations
{
    /// <inheritdoc />
    public partial class RemoveVerifiedAtFromAgent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "VerifiedAt",
                table: "Agents");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "VerifiedAt",
                table: "Agents",
                type: "timestamp with time zone",
                nullable: true);
        }
    }
}
