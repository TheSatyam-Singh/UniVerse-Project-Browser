using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace UniVerseProjectBrowser.Services;

public sealed class SponsorBlockService
{
    public static SponsorBlockService Shared { get; } = new SponsorBlockService();

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };

    private readonly Dictionary<string, (DateTimeOffset FetchedAt, string SegmentsJson)> _cache = new(StringComparer.Ordinal);

    public string[] DefaultCategories { get; } = { "sponsor", "intro", "outro", "selfpromo", "interaction", "music_offtopic" };

    public string[] EnabledCategories
    {
        get
        {
            var configured = SettingsService.Shared.SponsorBlockCategories
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            return configured.Length > 0 ? configured : DefaultCategories;
        }
    }

    public static string? ExtractVideoId(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed))
        {
            return null;
        }
        var host = parsed.Host.ToLowerInvariant();
        if (host == "youtu.be")
        {
            var id = parsed.AbsolutePath.Trim('/');
            return id.Length == 11 ? id : null;
        }
        if (host is "youtube.com" or "www.youtube.com" or "music.youtube.com")
        {
            if (parsed.AbsolutePath.StartsWith("/shorts/", StringComparison.Ordinal))
            {
                var id = parsed.AbsolutePath["/shorts/".Length..].Split('/')[0];
                return id.Length == 11 ? id : null;
            }
            if (parsed.AbsolutePath == "/watch")
            {
                var id = QueryValue(parsed.Query, "v");
                return id is not null && id.Length == 11 ? id : null;
            }
        }
        return null;
    }

    private static string? QueryValue(string query, string name)
    {
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var equals = pair.IndexOf('=');
            if (equals < 0)
            {
                continue;
            }
            if (pair[..equals] == name)
            {
                return Uri.UnescapeDataString(pair[(equals + 1)..]);
            }
        }
        return null;
    }

    public async Task FetchAndDeliverAsync(CoreWebView2 core, string videoId)
    {
        if (!SettingsService.Shared.SponsorBlockEnabled)
        {
            return;
        }
        var segmentsJson = await FetchSegmentsJsonAsync(videoId);
        if (segmentsJson is null)
        {
            return;
        }
        var options = EnabledCategories.ToDictionary(category => category, _ => "auto");
        var script = "if(window.__nookSponsorBlock){window.__nookSponsorBlock.receiveSegments("
            + segmentsJson + "," + JsonSerializer.Serialize(options) + ");}";
        await core.ExecuteScriptAsync(script);
    }

    private async Task<string?> FetchSegmentsJsonAsync(string videoId)
    {
        if (_cache.TryGetValue(videoId, out var cached) && DateTimeOffset.UtcNow - cached.FetchedAt < TimeSpan.FromHours(1))
        {
            return cached.SegmentsJson;
        }
        var fullHash = Convert.ToHexString(SHA256.HashData(System.Text.Encoding.UTF8.GetBytes(videoId))).ToLowerInvariant();
        var prefix = fullHash[..4];
        var categoriesJson = JsonSerializer.Serialize(EnabledCategories);
        var url = "https://sponsor.ajay.app/api/skipSegments/" + prefix + "?categories=" + Uri.EscapeDataString(categoriesJson);
        string body;
        try
        {
            body = await Http.GetStringAsync(url);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            return null;
        }
        string? segmentsJson = null;
        try
        {
            using var document = JsonDocument.Parse(body);
            foreach (var entry in document.RootElement.EnumerateArray())
            {
                if (!entry.TryGetProperty("videoID", out var entryHash))
                {
                    continue;
                }
                if (!string.Equals(entryHash.GetString(), fullHash, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                if (entry.TryGetProperty("segments", out var segments))
                {
                    segmentsJson = segments.GetRawText();
                }
                break;
            }
        }
        catch (JsonException)
        {
            return null;
        }
        if (segmentsJson is null)
        {
            return null;
        }
        _cache[videoId] = (DateTimeOffset.UtcNow, segmentsJson);
        return segmentsJson;
    }
}
