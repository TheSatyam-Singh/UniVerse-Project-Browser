using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;

namespace Universe.Windows;

public sealed partial class MainWindow : Window
{
    private readonly TabHost tabs;

    public MainWindow()
    {
        InitializeComponent();
        Title = "UniVerse Project Browser";
        AppWindow.Resize(new Windows.Graphics.SizeInt32(1280, 800));
        AppWindow.SetIcon(Path.Combine(AppContext.BaseDirectory, "Assets", "AppIcon.ico"));
        tabs = new TabHost(RootCanvas, UiWebView);
        SizeChanged += OnSizeChanged;
        Closed += OnClosed;
        _ = InitializeAsync();
    }

    private async Task InitializeAsync()
    {
        try
        {
            await tabs.InitializeAsync();
        }
        catch (Exception error)
        {
            ContentDialog dialog = new()
            {
                Title = "UniVerse Project Browser could not start",
                Content = "Microsoft Edge WebView2 is required and could not be initialised. Install the Evergreen WebView2 Runtime and try again." + Environment.NewLine + Environment.NewLine + error.Message,
                CloseButtonText = "Close",
                XamlRoot = Content.XamlRoot,
            };
            _ = await dialog.ShowAsync();
            Close();
        }
    }

    private void OnSizeChanged(object sender, WindowSizeChangedEventArgs args)
    {
        UiWebView.Width = args.Size.Width;
        UiWebView.Height = args.Size.Height;
    }

    private void OnClosed(object sender, WindowEventArgs args)
    {
        tabs.Dispose();
    }
}
