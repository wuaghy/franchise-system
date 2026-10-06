using FluentAssertions;
using Franchise.Infrastructure.Services;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace Franchise.UnitTests.Services;

public class VietQrServiceTests
{
    [Fact]
    public void GeneratePaymentQrUrl_ShouldConstructValidNapas247Url()
    {
        // Arrange
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "VietQR:BankCode", "vietinbank" },
            { "VietQR:AccountNumber", "100878137043" },
            { "VietQR:AccountName", "NGUYEN QUANG HUY" },
            { "VietQR:Template", "compact2" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var sut = new VietQrService(config);

        // Act
        var url = sut.GeneratePaymentQrUrl(54000m, "ORD-20261006-1234");

        // Assert
        url.Should().StartWith("https://img.vietqr.io/image/vietinbank-100878137043-compact2.png");
        url.Should().Contain("amount=54000");
        url.Should().Contain("addInfo=ORD-20261006-1234");
        url.Should().Contain("accountName=NGUYEN+QUANG+HUY");
    }

    [Fact]
    public void GetBankInfo_ShouldReturnConfiguredParameters()
    {
        // Arrange
        var inMemorySettings = new Dictionary<string, string?>
        {
            { "VietQR:BankCode", "vietinbank" },
            { "VietQR:AccountNumber", "100878137043" },
            { "VietQR:AccountName", "NGUYEN QUANG HUY" },
            { "VietQR:Template", "compact2" }
        };
        var config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var sut = new VietQrService(config);

        // Act
        var info = sut.GetBankInfo();

        // Assert
        info.BankCode.Should().Be("vietinbank");
        info.AccountNumber.Should().Be("100878137043");
        info.AccountName.Should().Be("NGUYEN QUANG HUY");
    }
}
