using Microsoft.UI.Xaml;
using Microsoft.Windows.AppLifecycle;
using UniVerseProjectBrowser.Services;
using UniVerseProjectBrowser.ViewModels;
using Windows.ApplicationModel.Activation;

namespace UniVerseProjectBrowser;

public partial class App : Application
{
    private Window? _window;
    private UpdateService? _updateService;

    public App()
    {
        InitializeComponent();
    }

    public static BrowserViewModel SharedViewModel { get; } = new BrowserViewModel();

    protected override void OnLaunched(LaunchActivatedEventArgs args)
    {
        _window = new MainWindow();
        _window.Activate();

        if (!string.IsNullOrEmpty(args.Arguments))
        {
            DeepLinkService.HandleLaunchArguments(args.Arguments, SharedViewModel);
        }
        var activation = AppInstance.GetActivatedEventArgs();
        if (activation.Kind == ExtendedActivationKind.Protocol && activation.Data is ProtocolActivatedEventArgs protocolArgs)
        {
            DeepLinkService.HandleUri(protocolArgs.Uri.AbsoluteUri, SharedViewModel);
        }

        _updateService = new UpdateService();
        _updateService.Initialize();
        _updateService.CheckForUpdatesInBackground();
    }
}
