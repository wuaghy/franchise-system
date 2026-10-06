using FluentAssertions;
using Franchise.Infrastructure.Services;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace Franchise.UnitTests.Services;

public class DistributedCacheServiceTests
{
    private readonly DistributedCacheService _sut;
    private readonly IDistributedCache _distributedCache;

    public DistributedCacheServiceTests()
    {
        var memoryCacheOptions = Options.Create(new MemoryDistributedCacheOptions());
        _distributedCache = new MemoryDistributedCache(memoryCacheOptions);
        _sut = new DistributedCacheService(_distributedCache, NullLogger<DistributedCacheService>.Instance);
    }

    private record TestUser(string Id, string Name, string Role);

    [Fact]
    public async Task GetAsync_WhenKeyDoesNotExist_ShouldReturnDefault()
    {
        // Act
        var result = await _sut.GetAsync<TestUser>("user:unknown");

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task SetAsync_And_GetAsync_ShouldStoreAndRetrieveValue()
    {
        // Arrange
        var user = new TestUser("U1", "Nguyen Van A", "StoreManager");

        // Act
        await _sut.SetAsync("user:U1", user, TimeSpan.FromMinutes(5));
        var retrieved = await _sut.GetAsync<TestUser>("user:U1");

        // Assert
        retrieved.Should().NotBeNull();
        retrieved!.Id.Should().Be("U1");
        retrieved.Name.Should().Be("Nguyen Van A");
        retrieved.Role.Should().Be("StoreManager");
    }

    [Fact]
    public async Task RemoveAsync_ShouldEvictItemFromCache()
    {
        // Arrange
        var user = new TestUser("U2", "Tran Thi B", "Barista");
        await _sut.SetAsync("user:U2", user, TimeSpan.FromMinutes(5));

        // Act
        await _sut.RemoveAsync("user:U2");
        var retrieved = await _sut.GetAsync<TestUser>("user:U2");

        // Assert
        retrieved.Should().BeNull();
    }

    [Fact]
    public async Task RemoveByPrefixAsync_ShouldRemoveAllKeysMatchingPrefix()
    {
        // Arrange
        await _sut.SetAsync("catalog:item:1", new { Name = "Espresso" });
        await _sut.SetAsync("catalog:item:2", new { Name = "Latte" });
        await _sut.SetAsync("order:item:1", new { Amount = 50000 });

        // Act
        await _sut.RemoveByPrefixAsync("catalog:item:");

        // Assert
        (await _sut.GetAsync<object>("catalog:item:1")).Should().BeNull();
        (await _sut.GetAsync<object>("catalog:item:2")).Should().BeNull();
        (await _sut.GetAsync<object>("order:item:1")).Should().NotBeNull();
    }

    [Fact]
    public async Task GetOrCreateAsync_WhenNotCached_ShouldCallFactoryAndCache()
    {
        // Arrange
        var factoryCallCount = 0;
        Task<TestUser> Factory()
        {
            factoryCallCount++;
            return Task.FromResult(new TestUser("U3", "Le Van C", "Cashier"));
        }

        // Act - First call: Cache miss, factory executed
        var result1 = await _sut.GetOrCreateAsync("user:U3", Factory, TimeSpan.FromMinutes(10));
        // Act - Second call: Cache hit, factory should NOT be called
        var result2 = await _sut.GetOrCreateAsync("user:U3", Factory, TimeSpan.FromMinutes(10));

        // Assert
        result1.Name.Should().Be("Le Van C");
        result2.Name.Should().Be("Le Van C");
        factoryCallCount.Should().Be(1);
    }
}
