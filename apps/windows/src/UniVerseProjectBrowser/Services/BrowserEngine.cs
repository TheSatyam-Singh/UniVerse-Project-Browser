using System.Text.Json;
using Microsoft.UI.Xaml.Controls;
using Microsoft.Web.WebView2.Core;
using UniVerseProjectBrowser.ViewModels;
using Windows.Storage;

namespace UniVerseProjectBrowser.Services;

public sealed class BrowserEngine : IDisposable
{
    private readonly WebView2 _webView;
    private TabViewModel _tab;
    private CoreWebView2? _core;
    private string? _pendingUrl;
    private bool _disposed;

    public BrowserEngine(WebView2 webView, TabViewModel tab)
    {
        _webView = webView;
        _tab = tab;
        ProfileId = tab.ProfileId;
    }

    public static Func<string, TabViewModel?>? NewTabRequestHandler { get; set; }

    public string ProfileId { get; }

    public async Task InitializeAsync()
    {
        var userDataFolder = Path.Combine(ApplicationData.Current.LocalFolder.Path, "WebView2", _tab.ProfileId);
        var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);
        await _webView.EnsureCoreWebView2Async(environment);
        _core = _webView.CoreWebView2;
        await ContentBlockingService.Shared.InitializeAsync();
        ContentBlockingService.Shared.Attach(_core);
        await ContentScriptService.Shared.RegisterScriptsAsync(_core);
        _core.NavigationStarting += OnNavigationStarting;
        _core.NavigationCompleted += OnNavigationCompleted;
        _core.DocumentTitleChanged += OnDocumentTitleChanged;
        _core.SourceChanged += OnSourceChanged;
        _core.NewWindowRequested += OnNewWindowRequested;
        _core.WebMessageReceived += OnWebMessageReceived;
        if (_pendingUrl is not null)
        {
            var url = _pendingUrl;
            _pendingUrl = null;
            Navigate(url);
        }
    }

    public void Navigate(string url)
    {
        _tab.Url = url;
        if (_core is null)
        {
            _pendingUrl = url;
            return;
        }
        _core.Navigate(url);
    }

    public void Retarget(TabViewModel tab)
    {
        _tab = tab;
        if (_core is null)
        {
            _pendingUrl = tab.Url;
            return;
        }
        if (!string.IsNullOrEmpty(tab.Url) && !string.Equals(_core.Source, tab.Url, StringComparison.OrdinalIgnoreCase))
        {
            _core.Navigate(tab.Url);
        }
    }

    public void GoBack()
    {
        if (_core?.CanGoBack == true)
        {
            _core.GoBack();
        }
    }

    public void GoForward()
    {
        if (_core?.CanGoForward == true)
        {
            _core.GoForward();
        }
    }

    public void Reload()
    {
        _core?.Reload();
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }
        _disposed = true;
        if (_core is not null)
        {
            _core.NavigationStarting -= OnNavigationStarting;
            _core.NavigationCompleted -= OnNavigationCompleted;
            _core.DocumentTitleChanged -= OnDocumentTitleChanged;
            _core.SourceChanged -= OnSourceChanged;
            _core.NewWindowRequested -= OnNewWindowRequested;
            _core.WebMessageReceived -= OnWebMessageReceived;
        }
        _webView.Close();
    }

    private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
    {
        _tab.IsLoading = true;
        if (e.Uri.StartsWith("universe://", StringComparison.OrdinalIgnoreCase))
        {
            e.Cancel = true;
            DeepLinkService.HandleUri(e.Uri, App.SharedViewModel);
            return;
        }
        if (SettingsService.Shared.TrackingParamStripping && _core is not null)
        {
            var cleaned = OmniboxService.CleanUrl(e.Uri);
            if (!string.Equals(cleaned, e.Uri, StringComparison.Ordinal))
            {
                e.Cancel = true;
                _core.Navigate(cleaned);
            }
        }
    }

    private async void OnNavigationCompleted(object? sender, CoreWebView2NavigationCompletedEventArgs e)
    {
        _tab.IsLoading = false;
        if (_core is null)
        {
            return;
        }
        _tab.Title = _core.DocumentTitle;
        _tab.CanGoBack = _core.CanGoBack;
        _tab.CanGoForward = _core.CanGoForward;
        if (Uri.TryCreate(_core.Source, UriKind.Absolute, out var uri))
        {
            await ContentScriptService.Shared.InjectHostCosmeticsAsync(_core, uri.Host);
            var videoId = SponsorBlockService.ExtractVideoId(_core.Source);
            if (videoId is not null)
            {
                await SponsorBlockService.Shared.FetchAndDeliverAsync(_core, videoId);
            }
        }
    }

    private void OnDocumentTitleChanged(object? sender, object e)
    {
        if (_core is not null && !string.IsNullOrEmpty(_core.DocumentTitle))
        {
            _tab.Title = _core.DocumentTitle;
        }
    }

    private void OnSourceChanged(object? sender, CoreWebView2SourceChangedEventArgs e)
    {
        if (_core is not null)
        {
            _tab.Url = _core.Source;
            _tab.CanGoBack = _core.CanGoBack;
            _tab.CanGoForward = _core.CanGoForward;
        }
    }

    private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
    {
        e.Handled = true;
        NewTabRequestHandler?.Invoke(e.Uri);
    }

    private async void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        string message;
        try
        {
            message = e.WebMessageAsJson;
        }
        catch (ArgumentException)
        {
            return;
        }
        try
        {
            using var document = JsonDocument.Parse(message);
            if (!document.RootElement.TryGetProperty("handler", out var handlerElement))
            {
                return;
            }
            var handler = handlerElement.GetString();
            if (handler == "nookSocialImageDownload" && document.RootElement.TryGetProperty("message", out var mediaElement))
            {
                var mediaUrl = mediaElement.GetString();
                if (!string.IsNullOrEmpty(mediaUrl))
                {
                    await DownloadMediaAsync(mediaUrl);
                }
            }
        }
        catch (JsonException)
        {
            return;
        }
    }

    private static async Task DownloadMediaAsync(string mediaUrl)
    {
        try
        {
            using var http = new HttpClient { Timeout = TimeSpan.FromMinutes(5) };
            var bytes = await http.GetByteArrayAsync(mediaUrl);
            var downloads = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), "Downloads");
            Directory.CreateDirectory(downloads);
            var name = Path.GetFileName(new Uri(mediaUrl).AbsolutePath);
            if (string.IsNullOrEmpty(name))
            {
                name = "universe-download";
            }
            var path = Path.Combine(downloads, name);
            if (File.Exists(path))
            {
                path = Path.Combine(downloads, Path.GetFileNameWithoutExtension(name) + "-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + Path.GetExtension(name));
            }
            await File.WriteAllBytesAsync(path, bytes);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException or UriFormatException)
        {
            return;
        }
    }
}
