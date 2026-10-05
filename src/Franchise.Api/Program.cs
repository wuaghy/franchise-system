using System.Diagnostics;
using Franchise.Api.ExceptionHandling;
using Franchise.Api.Hubs;
using Franchise.Api.Services;
using Franchise.Application;
using Franchise.Application.Common.Interfaces;
using Franchise.Infrastructure;
using Franchise.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;

var builder = WebApplication.CreateBuilder(args);

// 1. Đăng ký các tầng Clean Architecture
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

// 2. Web API, ProblemDetails & Global Exception Handler
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = c =>
    {
        c.ProblemDetails.Instance = $"{c.HttpContext.Request.Method} {c.HttpContext.Request.Path}";
        c.ProblemDetails.Extensions["traceId"] = Activity.Current?.Id ?? c.HttpContext.TraceIdentifier;
    };
});
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

// 3. Real-time SignalR Hub & Notification Service
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = true;
});
builder.Services.AddScoped<IRealtimeNotificationService, RealtimeNotificationService>();
builder.Services.AddSingleton<HubConfiguration>();
builder.Services.AddScoped<FranchiseHub>();

// 4. CORS Policy hỗ trợ SignalR WebSockets
builder.Services.AddCors(options =>
{
    options.AddPolicy("SignalRCorsPolicy", policy =>
    {
        policy.SetIsOriginAllowed(_ => true)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// --- Pipeline: đặt SỚM NHẤT để bọc được mọi middleware phía sau ---
app.UseExceptionHandler();
app.UseStatusCodePages();

// 5. TỰ ĐỘNG TẠO BẢNG TRONG DATABASE KHI KHỞI ĐỘNG (Auto-Migration)
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    // Tự động kiểm tra và tạo bảng nếu chưa có
    dbContext.Database.Migrate();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("SignalRCorsPolicy");
app.UseAuthorization();

app.MapControllers();
app.MapHub<FranchiseHub>("/hubs/franchise");

app.Run();
