using Microsoft.UI.Xaml.Controls;
using UniVerseProjectBrowser.Services;
using UniVerseProjectBrowser.ViewModels;

namespace UniVerseProjectBrowser.Controls;

public sealed partial class BrowserPaneView : UserControl
{
    private BrowserEngine? _engine;
    private WebView2? _webView;
    private string? _engineProfileId;
    private PaneViewModel? _pane;
    private TabViewModel? _shownTab;
    private bool _isLoaded;

    public BrowserPaneView()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            _isLoaded = true;
            if (_pane is not null)
            {
                EnsureEngineFor(_pane.Tab);
            }
        };
        Unloaded += (_, _) =>
        {
            _isLoaded = false;
            TearDownEngine();
        };
    }

    public PaneViewModel? Pane
    {
        get => _pane;
        set
        {
            if (_pane is not null)
            {
                _pane.PropertyChanged -= Pane_PropertyChanged;
            }
            _pane = value;
            if (_pane is not null)
            {
                _pane.PropertyChanged += Pane_PropertyChanged;
                if (_isLoaded)
                {
                    EnsureEngineFor(_pane.Tab);
                }
            }
        }
    }

    private void Pane_PropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(PaneViewModel.Tab) && _pane is not null && _isLoaded)
        {
            EnsureEngineFor(_pane.Tab);
        }
    }

    private void Tab_PropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(TabViewModel.IsLoading) && _shownTab is not null)
        {
            LoadingRing.IsActive = _shownTab.IsLoading;
        }
    }

    private async void EnsureEngineFor(TabViewModel tab)
    {
        if (_shownTab is not null)
        {
            _shownTab.PropertyChanged -= Tab_PropertyChanged;
        }
        _shownTab = tab;
        _shownTab.PropertyChanged += Tab_PropertyChanged;
        LoadingRing.IsActive = tab.IsLoading;
        if (_engine is not null && _engineProfileId == tab.ProfileId)
        {
            _engine.Retarget(tab);
            return;
        }
        TearDownEngine();
        _webView = new WebView2();
        WebViewHost.Children.Add(_webView);
        _engine = new BrowserEngine(_webView, tab);
        _engineProfileId = tab.ProfileId;
        _pane!.GoBackAction = () => _engine.GoBack();
        _pane.GoForwardAction = () => _engine.GoForward();
        _pane.ReloadAction = () => _engine.Reload();
        _pane.NavigateAction = url => _engine.Navigate(url);
        await _engine.InitializeAsync();
        if (!string.IsNullOrEmpty(tab.Url))
        {
            _engine.Navigate(tab.Url);
        }
    }

    private void TearDownEngine()
    {
        if (_engine is not null)
        {
            _engine.Dispose();
            _engine = null;
        }
        if (_webView is not null)
        {
            WebViewHost.Children.Remove(_webView);
            _webView = null;
        }
        _engineProfileId = null;
    }
}
