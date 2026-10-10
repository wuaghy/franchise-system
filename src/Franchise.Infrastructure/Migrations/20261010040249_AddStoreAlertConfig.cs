using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Franchise.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddStoreAlertConfig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ManagerEmail",
                table: "Stores",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TelegramChatId",
                table: "Stores",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ManagerEmail",
                table: "Stores");

            migrationBuilder.DropColumn(
                name: "TelegramChatId",
                table: "Stores");
        }
    }
}
