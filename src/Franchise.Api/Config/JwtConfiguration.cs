using Microsoft.Extensions.Configuration;

public class JwtConfiguration
{
    public string Secret { get; set; } = string.Empty;
    public int AccessTokenExpirationMinutes { get; set; } = 30;
}
