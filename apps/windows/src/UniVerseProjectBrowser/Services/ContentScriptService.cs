using System.Text.Json;
using Microsoft.Web.WebView2.Core;

namespace UniVerseProjectBrowser.Services;

public sealed class ContentScriptService
{
    public static ContentScriptService Shared { get; } = new ContentScriptService();

    private static readonly string[] YouTubeHosts = { "youtube.com", "www.youtube.com", "music.youtube.com" };

    private static readonly string[] ShortsSelectors =
    {
        "ytd-reel-shelf-renderer",
        "ytd-rich-item-renderer:has(a[href^=\"/shorts/\"])",
        "ytd-video-renderer:has(a[href^=\"/shorts/\"])",
        "yt-lockup-view-model:has(a[href^=\"/shorts/\"])",
        "ytd-guide-entry-renderer:has(a[href^=\"/shorts\"])",
        "ytd-mini-guide-entry-renderer:has(a[href^=\"/shorts\"])",
        "yt-tab-shape[tab-title=\"Shorts\"]"
    };

    private bool _registered;

    public async Task RegisterScriptsAsync(CoreWebView2 core)
    {
        if (_registered)
        {
            return;
        }
        _registered = true;
        await core.AddScriptToExecuteOnDocumentCreatedAsync(WebkitMessageHandlerShim());
        if (SettingsService.Shared.CosmeticFilteringEnabled)
        {
            var config = ContentBlockingService.Shared.BuildCosmeticConfigJson();
            await core.AddScriptToExecuteOnDocumentCreatedAsync("window.__nookCosmeticConfig = " + config + ";");
            await core.AddScriptToExecuteOnDocumentCreatedAsync(await ReadScriptAsync("nook-cosmetic.js"));
        }
        var youTubeGuard = HostGuard(YouTubeHosts);
        await core.AddScriptToExecuteOnDocumentCreatedAsync(WrapInGuard(youTubeGuard, await ReadScriptAsync("youtube-sponsorblock.js")));
        await core.AddScriptToExecuteOnDocumentCreatedAsync(WrapInGuard(youTubeGuard, await ReadScriptAsync("youtube-tweaks.js") + YouTubeTweaksCall()));
        var downloadSites = SettingsService.Shared.SocialDownloadSites
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var sitesJson = JsonSerializer.Serialize(downloadSites);
        await core.AddScriptToExecuteOnDocumentCreatedAsync("const NOOK_DOWNLOAD_SITES = " + sitesJson + ";\n" + await ReadScriptAsync("social-image-download.js"));
        await core.AddScriptToExecuteOnDocumentCreatedAsync(await ReadScriptAsync("social-video-source.js"));
        await core.AddScriptToExecuteOnDocumentCreatedAsync(WrapInGuard(HostGuard("facebook.com"), await ReadScriptAsync("facebook-sponsored-blocker.js")));
        await core.AddScriptToExecuteOnDocumentCreatedAsync(WrapInGuard(HostGuard("instagram.com"), await ReadScriptAsync("instagram-sponsored-blocker.js")));
        await core.AddScriptToExecuteOnDocumentCreatedAsync(WrapInGuard(HostGuard("x.com", "twitter.com"), await ReadScriptAsync("twitter-ad-blocker.js")));
    }

    public async Task InjectHostCosmeticsAsync(CoreWebView2 core, string host)
    {
        if (!SettingsService.Shared.CosmeticFilteringEnabled)
        {
            return;
        }
        var config = ContentBlockingService.Shared.BuildCosmeticConfigJsonForHost(host);
        var script = "if(window.__nookCosmeticConfig===undefined){window.__nookCosmeticConfig=" + config + ";}";
        await core.ExecuteScriptAsync(script);
    }

    private static string WebkitMessageHandlerShim()
    {
        return "if(!window.webkit){window.webkit={messageHandlers:{}};}"
            + "window.webkit.messageHandlers.nookSponsorBlock={postMessage:function(m){chrome.webview.postMessage({handler:'nookSponsorBlock',message:m});}};"
            + "window.webkit.messageHandlers.nookSocialImageDownload={postMessage:function(m){chrome.webview.postMessage({handler:'nookSocialImageDownload',message:m});}};";
    }

    private static string HostGuard(params string[] hosts)
    {
        var pattern = string.Join("|", hosts.Select(host => RegexEscape(host)));
        return "(^|\\.)(" + pattern + ")$";
    }

    private static string RegexEscape(string host)
    {
        return host.Replace(".", "\\.", StringComparison.Ordinal);
    }

    private static string WrapInGuard(string hostPattern, string script)
    {
        return "if(new RegExp(" + JsonSerializer.Serialize(hostPattern) + ").test(location.hostname)){\n" + script + "\n}";
    }

    private static string YouTubeTweaksCall()
    {
        var settings = SettingsService.Shared;
        var css = settings.YouTubeHideShorts
            ? string.Join("\n", ShortsSelectors.Select(selector => selector + " { display: none !important; }"))
            : string.Empty;
        var call = new
        {
            css,
            frameThumbnails = settings.YouTubeFrameThumbnails,
            noHoverPreview = settings.YouTubeNoHoverPreview
        };
        return "\n(" + JsonSerializer.Serialize(call) + ");";
    }

    private static async Task<string> ReadScriptAsync(string fileName)
    {
        var path = Path.Combine(AppContext.BaseDirectory, "ContentScripts", fileName);
        return await File.ReadAllTextAsync(path);
    }
}
