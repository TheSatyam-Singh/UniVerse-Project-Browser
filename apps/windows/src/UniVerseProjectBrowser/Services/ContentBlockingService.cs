using Microsoft.Web.WebView2.Core;

namespace UniVerseProjectBrowser.Services;

public sealed class ContentBlockingService
{
    public static ContentBlockingService Shared { get; } = new ContentBlockingService();

    private bool _initialized;

    public FilterEngine Engine { get; } = new FilterEngine();

    public bool IsReady => _initialized;

    public async Task InitializeAsync()
    {
        if (_initialized)
        {
            return;
        }
        _initialized = true;
        await FilterListService.Shared.LoadEngineAsync(Engine);
    }

    public void Attach(CoreWebView2 core)
    {
        core.AddWebResourceRequestedFilter("*", CoreWebView2WebResourceContext.All);
        core.WebResourceRequested += OnWebResourceRequested;
    }

    public string BuildCosmeticConfigJson()
    {
        return Engine.BuildCosmeticConfigJson();
    }

    public string BuildCosmeticConfigJsonForHost(string host)
    {
        return Engine.BuildCosmeticConfigJsonForHost(host);
    }

    private void OnWebResourceRequested(object? sender, CoreWebView2WebResourceRequestedEventArgs e)
    {
        if (!SettingsService.Shared.AdBlockingEnabled)
        {
            return;
        }
        var request = e.Request;
        var resourceType = MapResourceContext(e.ResourceContext);
        var core = (CoreWebView2)sender!;
        var isThirdParty = IsThirdParty(request.Uri, core.Source);
        var decision = Engine.Match(request.Uri, resourceType, isThirdParty);
        if (decision == FilterDecision.Block)
        {
            e.Response = core.Environment.CreateWebResourceResponse(null, 403, "Blocked by UniVerse", "Content-Type: text/plain\r\n");
        }
    }

    private static bool IsThirdParty(string requestUri, string documentUri)
    {
        if (!Uri.TryCreate(requestUri, UriKind.Absolute, out var request)
            || !Uri.TryCreate(documentUri, UriKind.Absolute, out var document))
        {
            return false;
        }
        var requestHost = request.Host;
        var documentHost = document.Host;
        return !requestHost.Equals(documentHost, StringComparison.OrdinalIgnoreCase)
            && !requestHost.EndsWith("." + documentHost, StringComparison.OrdinalIgnoreCase)
            && !documentHost.EndsWith("." + requestHost, StringComparison.OrdinalIgnoreCase);
    }

    private static string MapResourceContext(CoreWebView2WebResourceContext context)
    {
        return context switch
        {
            CoreWebView2WebResourceContext.Document => "document",
            CoreWebView2WebResourceContext.Image => "image",
            CoreWebView2WebResourceContext.Stylesheet => "stylesheet",
            CoreWebView2WebResourceContext.Script => "script",
            CoreWebView2WebResourceContext.Font => "font",
            CoreWebView2WebResourceContext.Media => "media",
            CoreWebView2WebResourceContext.XmlHttpRequest => "xmlhttprequest",
            CoreWebView2WebResourceContext.Fetch => "fetch",
            CoreWebView2WebResourceContext.WebSocket => "websocket",
            _ => "other"
        };
    }
}
