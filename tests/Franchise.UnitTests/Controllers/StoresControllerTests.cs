using FluentAssertions;
using Franchise.Api.Controllers;
using Franchise.Application.Common.Models;
using Franchise.Application.DTOs.Stores;
using Franchise.Domain.Entities;
using Franchise.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Franchise.UnitTests.Controllers;

public class StoresControllerTests
{
    // Helper tạo DbContext chạy trên RAM (mỗi hàm test có một DB riêng biệt hoàn toàn)
    private AppDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private StoresController CreateController(AppDbContext context)
    {
        var controller = new StoresController(context)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        return controller;
    }

    [Fact]
    public async Task GetStores_ShouldReturnPagedStores_WhenSearchQueryMatches()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var franchisee = new Franchisee { Id = Guid.NewGuid(), CompanyName = "F&B Group", TaxCode = "010101" };
        context.Franchisees.Add(franchisee);

        context.Stores.AddRange(
            new Store { Id = Guid.NewGuid(), FranchiseeId = franchisee.Id, Code = "HL-01", Name = "Highlands Ben Thanh", Address = "Q1", PhoneNumber = "0901" },
            new Store { Id = Guid.NewGuid(), FranchiseeId = franchisee.Id, Code = "PL-01", Name = "Phuc Long Tran Hung Dao", Address = "Q5", PhoneNumber = "0902" },
            new Store { Id = Guid.NewGuid(), FranchiseeId = franchisee.Id, Code = "HL-02", Name = "Highlands Landmark 81", Address = "Binh Thanh", PhoneNumber = "0903" }
        );
        await context.SaveChangesAsync();

        var controller = CreateController(context);
        var query = new StoreQueryParameters { Search = "Highlands", Page = 1, PageSize = 10 };

        // Act
        var actionResult = await controller.GetStores(query);

        // Assert
        var okResult = actionResult.Should().BeOfType<OkObjectResult>().Subject;
        var pagedData = okResult.Value.Should().BeOfType<PagedResult<StoreResponse>>().Subject;

        pagedData.TotalCount.Should().Be(2); // Chỉ có 2 quán Highlands
        pagedData.Items.Should().OnlyContain(s => s.Name.Contains("Highlands"));
    }

    [Fact]
    public async Task GetStoreById_ShouldReturn404ProblemDetails_WhenStoreNotFound()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var controller = CreateController(context);
        var nonExistentId = Guid.NewGuid();

        // Act
        var actionResult = await controller.GetStoreById(nonExistentId);

        // Assert
        var problemResult = actionResult.Should().BeOfType<ObjectResult>().Subject;
        problemResult.StatusCode.Should().Be(404);

        var details = problemResult.Value.Should().BeOfType<ProblemDetails>().Subject;
        details.Title.Should().Be("Not Found");
        details.Detail.Should().Contain(nonExistentId.ToString());
    }

    [Fact]
    public async Task CreateStore_ShouldReturn409Conflict_WhenStoreCodeAlreadyExists()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var franchisee = new Franchisee { Id = Guid.NewGuid(), CompanyName = "F&B Group", TaxCode = "010101" };
        context.Franchisees.Add(franchisee);
        context.Stores.Add(new Store { FranchiseeId = franchisee.Id, Code = "HL-LELOI", Name = "Highlands Le Loi", Address = "Q1", PhoneNumber = "0901" });
        await context.SaveChangesAsync();

        var controller = CreateController(context);
        var duplicateRequest = new CreateStoreRequest("HL-LELOI", "Chi nhánh trùng mã", "Địa chỉ", "0909");

        // Act
        var actionResult = await controller.CreateStore(duplicateRequest);

        // Assert
        var conflictResult = actionResult.Should().BeOfType<ObjectResult>().Subject;
        conflictResult.StatusCode.Should().Be(409);

        var details = conflictResult.Value.Should().BeOfType<ProblemDetails>().Subject;
        details.Title.Should().Be("Conflict");
        details.Detail.Should().Contain("HL-LELOI");
    }

    [Fact]
    public async Task CreateStore_ShouldReturn201Created_WhenRequestIsValid()
    {
        // Arrange
        using var context = CreateInMemoryDbContext();
        var controller = CreateController(context);
        var validRequest = new CreateStoreRequest("NEW-STORE-01", "Chi Nhánh Mới Mở", "123 Vo Van Tan", "0909123456");

        // Act
        var actionResult = await controller.CreateStore(validRequest);

        // Assert
        var createdResult = actionResult.Should().BeOfType<CreatedAtActionResult>().Subject;
        createdResult.StatusCode.Should().Be(201);

        var response = createdResult.Value.Should().BeOfType<StoreResponse>().Subject;
        response.Code.Should().Be("NEW-STORE-01");
        response.Name.Should().Be("Chi Nhánh Mới Mở");

        // Kiểm tra database ảo thực sự đã lưu bản ghi
        var storeInDb = await context.Stores.FirstOrDefaultAsync(s => s.Code == "NEW-STORE-01");
        storeInDb.Should().NotBeNull();
    }
}
