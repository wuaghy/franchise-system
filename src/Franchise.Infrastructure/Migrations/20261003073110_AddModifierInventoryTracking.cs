using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Franchise.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class AddModifierInventoryTracking : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "ConsumptionQuantity",
                table: "OrderItemModifiers",
                type: "numeric(12,4)",
                precision: 12,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<Guid>(
                name: "IngredientId",
                table: "OrderItemModifiers",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OrderItemModifiers_IngredientId",
                table: "OrderItemModifiers",
                column: "IngredientId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderItemModifiers_Ingredients_IngredientId",
                table: "OrderItemModifiers",
                column: "IngredientId",
                principalTable: "Ingredients",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderItemModifiers_Ingredients_IngredientId",
                table: "OrderItemModifiers");

            migrationBuilder.DropIndex(
                name: "IX_OrderItemModifiers_IngredientId",
                table: "OrderItemModifiers");

            migrationBuilder.DropColumn(
                name: "ConsumptionQuantity",
                table: "OrderItemModifiers");

            migrationBuilder.DropColumn(
                name: "IngredientId",
                table: "OrderItemModifiers");
        }
    }
}
