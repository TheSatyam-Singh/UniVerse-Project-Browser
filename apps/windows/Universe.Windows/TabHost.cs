using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using System;
using System.Collections.Generic;
using System.IO;
using System.Text.Json;
using System.Threading.Tasks;

namespace Universe.Windows;

public sealed class TabHost : IDisposable
{
    private readonly Canvas canvas;
    private readonly WebView2 uiWebView;
    private CoreWebView2Environment? environment;
    private readonly Dictionary<string, TabPage> tabs = new();
    private readonly List<HistoryEntry> history = new();
    private bool disposed;

    public TabHost(Canvas canvas, WebView2 uiWebView)
    {
        this.canvas = canvas;
        this.uiWebView = uiWebView;
    }

    public async Task InitializeAsync()
    {
        string userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "UniVerse Project Browser", "WebView2");
        environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
        await uiWebView.EnsureCoreWebView2Async(environment);
        string webUiFolder = Path.Combine(AppContext.BaseDirectory, "Assets", "WebUI");
        uiWebView.CoreWebView2.SetVirtualHostNameToFolderMapping("universe.app", webUiFolder, CoreWebView2HostResourceAccessKind.Allow);
        uiWebView.CoreWebView2.AddHostObjectToScript("universeEngine", new EngineBridge(this));
        uiWebView.CoreWebView2.WebMessageReceived += OnUiMessage;
        uiWebView.CoreWebView2.Navigate("https://universe.app/index.html");
    }

    public string HandleEngineCall(string domain, string name, string profile, string argsJson)
    {
        string call = domain + "." + name;
        if (call == "tabs.strips") return "{\"rev\":0,\"cmd\":null,\"strips\":[]}";
        if (call == "tabs.lastTabPolicy") return "{\"closesWindow\":false}";
        if (call == "history.query") return HistoryQueryJson(argsJson);
        if (call == "history.add") return HistoryAddJson(profile, argsJson);
        if (call == "history.watch") return "{}";
        if (call == "bookmarks.tree") return "{\"bar\":{\"id\":\"bar\",\"k\":\"f\",\"t\":\"Bookmarks bar\",\"a\":0,\"c\":[]},\"other\":{\"id\":\"other\",\"k\":\"f\",\"t\":\"Other bookmarks\",\"a\":0,\"c\":[]}}";
        if (call == "bookmarks.watch") return "{}";
        if (call == "favicons.get") return "{\"pages\":{},\"icons\":{}}";
        if (call == "favicons.fetch") return "null";
        if (call == "extensions.list") return "{\"extensions\":[]}";
        if (call == "search.engines") return "{\"list\":{\"engines\":[]}}";
        throw new InvalidOperationException(call + " is not on Windows yet");
    }

    public string CreateTab(string tabId, string profile)
    {
        if (tabs.ContainsKey(tabId)) return "{\"ok\":true}";
        if (environment == null) return "{\"ok\":false,\"error\":\"engine not ready\"}";
        WebView2 view = new() { DefaultBackgroundColor = Microsoft.UI.Colors.White, Visibility = Visibility.Collapsed };
        canvas.Children.Add(view);
        TabPage page = new(tabId, view, this);
        tabs[tabId] = page;
        _ = page.InitializeAsync(environment);
        return "{\"ok\":true}";
    }

    public void DestroyTab(string tabId)
    {
        if (!tabs.TryGetValue(tabId, out TabPage? page)) return;
        tabs.Remove(tabId);
        canvas.Children.Remove(page.View);
        page.Dispose();
    }

    public void Navigate(string tabId, string url)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.Navigate(url);
    }

    public void GoBack(string tabId)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.GoBack();
    }

    public void GoForward(string tabId)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.GoForward();
    }

    public void Reload(string tabId)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.Reload();
    }

    public void Stop(string tabId)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.Stop();
    }

    public void SetTabVisible(string tabId, bool visible)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.SetVisible(visible);
    }

    public void SetMuted(string tabId, bool muted)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.SetMuted(muted);
    }

    public void ZoomStep(string tabId, int direction)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) page.ZoomStep(direction);
    }

    public Task<string> Evaluate(string tabId, string code)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) return page.Evaluate(code);
        return Task.FromResult("null");
    }

    public string NavigationEntries(string tabId)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) return page.NavigationEntriesJson();
        return "[]";
    }

    public string GetSecurityInfo(string tabId)
    {
        if (tabs.TryGetValue(tabId, out TabPage? page)) return page.SecurityInfoJson();
        return "null";
    }

    public void PositionTab(string tabId, double x, double y, double width, double height)
    {
        if (!tabs.TryGetValue(tabId, out TabPage? page)) return;
        page.SetRect(x, y, width, height);
    }

    public void PostEngineEvent(string domain, string name, string dataJson)
    {
        CoreWebView2? core = uiWebView.CoreWebView2;
        if (core == null) return;
        string json = "{\"kind\":\"engine-event\",\"domain\":" + JsonSerializer.Serialize(domain) + ",\"name\":" + JsonSerializer.Serialize(name) + ",\"data\":" + dataJson + "}";
        core.PostWebMessageAsJson(json);
    }

    public void PostToUi(string json)
    {
        uiWebView.CoreWebView2?.PostWebMessageAsJson(json);
    }

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;
        foreach (TabPage page in tabs.Values)
        {
            canvas.Children.Remove(page.View);
            page.Dispose();
        }
        tabs.Clear();
    }

    private void OnUiMessage(CoreWebView2 sender, CoreWebView2WebMessageReceivedEventArgs args)
    {
        string json = args.WebMessageAsJson;
        using JsonDocument doc = JsonDocument.Parse(json);
        JsonElement root = doc.RootElement;
        if (!root.TryGetProperty("kind", out JsonElement kindElement)) return;
        if (kindElement.GetString() != "tab-rect") return;
        string tabId = root.GetProperty("tabId").GetString() ?? "";
        double x = root.GetProperty("x").GetDouble();
        double y = root.GetProperty("y").GetDouble();
        double width = root.GetProperty("width").GetDouble();
        double height = root.GetProperty("height").GetDouble();
        PositionTab(tabId, x, y, width, height);
    }

    private string HistoryQueryJson(string argsJson)
    {
        int maxUrls = 500;
        try
        {
            using JsonDocument doc = JsonDocument.Parse(argsJson);
            if (doc.RootElement.TryGetProperty("maxUrls", out JsonElement max)) maxUrls = max.GetInt32();
        }
        catch (JsonException) { }
        List<object> entries = new();
        int start = Math.Max(0, history.Count - maxUrls);
        for (int i = history.Count - 1; i >= start; i--)
        {
            HistoryEntry entry = history[i];
            entries.Add(new { u = entry.Url, t = entry.Title, n = entry.Count, v = entry.Times });
        }
        return JsonSerializer.Serialize(new { entries });
    }

    private string HistoryAddJson(string profile, string argsJson)
    {
        int added = 0;
        try
        {
            using JsonDocument doc = JsonDocument.Parse(argsJson);
            if (!doc.RootElement.TryGetProperty("pages", out JsonElement pages)) return "{\"added\":0}";
            foreach (JsonElement page in pages.EnumerateArray())
            {
                string url = page.GetProperty("u").GetString() ?? "";
                string title = page.GetProperty("t").GetString() ?? "";
                List<long> times = new();
                if (page.TryGetProperty("v", out JsonElement v))
                {
                    foreach (JsonElement time in v.EnumerateArray()) times.Add(time.GetInt64());
                }
                if (times.Count == 0) times.Add(DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
                RecordVisit(profile, url, title, times[0]);
                added++;
            }
        }
        catch (JsonException) { }
        return "{\"added\":" + added + "}";
    }

    private void RecordVisit(string profile, string url, string title, long at)
    {
        if (!url.StartsWith("http://", StringComparison.Ordinal) && !url.StartsWith("https://", StringComparison.Ordinal)) return;
        HistoryEntry? existing = null;
        foreach (HistoryEntry entry in history)
        {
            if (entry.Url == url) existing = entry;
        }
        if (existing == null)
        {
            existing = new HistoryEntry(url, title);
            history.Add(existing);
        }
        existing.Title = title;
        existing.Count++;
        existing.Times.Add(at);
        string batch = JsonSerializer.Serialize(new
        {
            profile,
            kind = "batch",
            changes = new[] { new { kind = "visit", at, u = url, t = title, n = existing.Count } },
        });
        PostEngineEvent("history", "history.changed", batch);
    }

    private sealed class HistoryEntry
    {
        public HistoryEntry(string url, string title)
        {
            Url = url;
            Title = title;
        }

        public string Url { get; }
        public string Title { get; set; }
        public int Count { get; set; }
        public List<long> Times { get; } = new();
    }

    private sealed class TabPage : IDisposable
    {
        private readonly TabHost host;
        private readonly List<NavigationEntry> entries = new();
        private int entryIndex = -1;
        private bool loading;
        private bool visible;
        private bool hasRect;
        private string? pendingUrl;
        private int httpStatus;
        private bool disposed;

        public TabPage(string tabId, WebView2 view, TabHost host)
        {
            TabId = tabId;
            View = view;
            this.host = host;
        }

        public string TabId { get; }
        public WebView2 View { get; }
        public bool IsLoading => loading;
        public int HttpStatus => httpStatus;

        public async Task InitializeAsync(CoreWebView2Environment environment)
        {
            await View.EnsureCoreWebView2Async(environment);
            CoreWebView2 core = View.CoreWebView2;
            core.NavigationStarting += OnNavigationStarting;
            core.NavigationCompleted += OnNavigationCompleted;
            core.SourceChanged += OnSourceChanged;
            core.DocumentTitleChanged += OnDocumentTitleChanged;
            core.HistoryChanged += OnHistoryChanged;
            core.FaviconChanged += OnFaviconChanged;
            core.ProcessFailed += OnProcessFailed;
            if (pendingUrl != null)
            {
                core.Navigate(pendingUrl);
                pendingUrl = null;
            }
        }

        public void Navigate(string url)
        {
            if (View.CoreWebView2 == null) pendingUrl = url;
            else View.CoreWebView2.Navigate(url);
        }

        public void GoBack()
        {
            if (View.CoreWebView2?.CanGoBack == true) View.CoreWebView2.GoBack();
        }

        public void GoForward()
        {
            if (View.CoreWebView2?.CanGoForward == true) View.CoreWebView2.GoForward();
        }

        public void Reload()
        {
            View.CoreWebView2?.Reload();
        }

        public void Stop()
        {
            View.CoreWebView2?.Stop();
        }

        public void SetVisible(bool value)
        {
            visible = value;
            ApplyVisibility();
        }

        public void SetMuted(bool muted)
        {
            if (View.CoreWebView2 != null) View.CoreWebView2.IsMuted = muted;
        }

        public void ZoomStep(int direction)
        {
            _ = direction;
        }

        public Task<string> Evaluate(string code)
        {
            if (View.CoreWebView2 == null) return Task.FromResult("null");
            return View.CoreWebView2.ExecuteScriptAsync(code);
        }

        public string NavigationEntriesJson()
        {
            List<object> list = new();
            for (int i = 0; i < entries.Count; i++)
            {
                NavigationEntry entry = entries[i];
                list.Add(new { url = entry.Url, title = entry.Title, current = i == entryIndex });
            }
            return JsonSerializer.Serialize(list);
        }

        public string SecurityInfoJson()
        {
            string url = View.CoreWebView2?.Source ?? "";
            string level = url.StartsWith("https://", StringComparison.Ordinal) ? "secure" : "none";
            string? origin = null;
            if (Uri.TryCreate(url, UriKind.Absolute, out Uri? uri)) origin = uri.GetLeftPart(UriPartial.Authority);
            return JsonSerializer.Serialize(new { level, url, origin });
        }

        public void SetRect(double x, double y, double width, double height)
        {
            hasRect = width > 0 && height > 0;
            Canvas.SetLeft(View, x);
            Canvas.SetTop(View, y);
            View.Width = Math.Max(0, width);
            View.Height = Math.Max(0, height);
            ApplyVisibility();
        }

        public void Dispose()
        {
            if (disposed) return;
            disposed = true;
            View.Close();
        }

        private void ApplyVisibility()
        {
            View.Visibility = visible && hasRect ? Visibility.Visible : Visibility.Collapsed;
        }

        private void OnNavigationStarting(CoreWebView2 sender, CoreWebView2NavigationStartingEventArgs args)
        {
            loading = true;
            host.PostToUi(JsonSerializer.Serialize(new { kind = "tab-progress", tabId = TabId, progress = 0.3 }));
            host.PostTabNavigation(this);
        }

        private void OnNavigationCompleted(CoreWebView2 sender, CoreWebView2NavigationCompletedEventArgs args)
        {
            loading = false;
            httpStatus = args.HttpStatusCode;
            host.PostToUi(JsonSerializer.Serialize(new { kind = "tab-progress", tabId = TabId, progress = 1 }));
            host.PostTabNavigation(this);
            if (!args.IsSuccess)
            {
                host.PostToUi(JsonSerializer.Serialize(new { kind = "tab-load-error", tabId = TabId, url = sender.Source, code = (int)args.WebErrorStatus, message = args.WebErrorStatus.ToString() }));
                return;
            }
            string url = sender.Source;
            if (url.StartsWith("http://", StringComparison.Ordinal) || url.StartsWith("https://", StringComparison.Ordinal))
            {
                host.RecordVisit("", url, sender.DocumentTitle, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());
            }
        }

        private void OnSourceChanged(CoreWebView2 sender, object args)
        {
            host.PostTabNavigation(this);
        }

        private void OnDocumentTitleChanged(CoreWebView2 sender, object args)
        {
            host.PostTabNavigation(this);
        }

        private void OnHistoryChanged(CoreWebView2 sender, object args)
        {
            host.PostTabNavigation(this);
        }

        private void OnFaviconChanged(CoreWebView2 sender, object args)
        {
            string? uri = sender.FaviconUri;
            if (!string.IsNullOrEmpty(uri)) host.PostToUi(JsonSerializer.Serialize(new { kind = "tab-favicon", tabId = TabId, uri }));
        }

        private void OnProcessFailed(CoreWebView2 sender, CoreWebView2ProcessFailedEventArgs args)
        {
            string reason = args.ProcessFailedKind == CoreWebView2ProcessFailedKind.RenderProcessUnresponsive ? "unresponsive" : "crashed";
            host.PostToUi(JsonSerializer.Serialize(new { kind = "tab-crashed", tabId = TabId, reason }));
        }
    }

    private void PostTabNavigation(TabPage page)
    {
        CoreWebView2? core = page.View.CoreWebView2;
        if (core == null) return;
        string url = core.Source;
        string title = core.DocumentTitle;
        bool canGoBack = core.CanGoBack;
        bool canGoForward = core.CanGoForward;
        string? favicon = core.FaviconUri;
        string json = "{\"kind\":\"tab-navigation\",\"tabId\":" + JsonSerializer.Serialize(page.TabId) + ",\"state\":{\"url\":" + JsonSerializer.Serialize(url) + ",\"title\":" + JsonSerializer.Serialize(title) + ",\"canGoBack\":" + JsonSerializer.Serialize(canGoBack) + ",\"canGoForward\":" + JsonSerializer.Serialize(canGoForward) + ",\"isLoading\":" + JsonSerializer.Serialize(page.IsLoading) + ",\"faviconUri\":" + JsonSerializer.Serialize(favicon) + ",\"themeColor\":null,\"httpStatus\":" + JsonSerializer.Serialize(page.HttpStatus) + "}}";
        PostToUi(json);
    }

    private sealed record NavigationEntry(string Url, string Title);
}
