using FluentAssertions;
using Franchise.Application.Common.Models;
using Xunit;

namespace Franchise.UnitTests.Common;

public class PagedResultTests
{
    [Theory]
    [InlineData(25, 10, 3)] // 25 phần tử, 10 item/trang => 3 trang
    [InlineData(20, 10, 2)] // 20 phần tử, 10 item/trang => 2 trang
    [InlineData(0, 10, 0)]  // 0 phần tử => 0 trang
    [InlineData(5, 10, 1)]  // 5 phần tử, 10 item/trang => 1 trang
    public void TotalPages_ShouldCalculateCorrectly(int totalCount, int pageSize, int expectedTotalPages)
    {
        // Arrange & Act
        var result = new PagedResult<string>(new List<string>(), totalCount, pageIndex: 1, pageSize: pageSize);

        // Assert
        result.TotalPages.Should().Be(expectedTotalPages);
    }

    [Fact]
    public void NavigationFlags_FirstPage_ShouldHaveNextPageButNoPreviousPage()
    {
        // Arrange: 30 items, đang ở Trang 1
        var items = new List<int> { 1, 2, 3 };

        // Act
        var result = new PagedResult<int>(items, totalCount: 30, pageIndex: 1, pageSize: 10);

        // Assert
        result.HasPreviousPage.Should().BeFalse();
        result.HasNextPage.Should().BeTrue();
    }

    [Fact]
    public void NavigationFlags_LastPage_ShouldHavePreviousPageButNoNextPage()
    {
        // Arrange: 30 items, đang ở Trang 3 (trang cuối)
        var items = new List<int> { 21, 22, 23 };

        // Act
        var result = new PagedResult<int>(items, totalCount: 30, pageIndex: 3, pageSize: 10);

        // Assert
        result.HasPreviousPage.Should().BeTrue();
        result.HasNextPage.Should().BeFalse();
    }
}
