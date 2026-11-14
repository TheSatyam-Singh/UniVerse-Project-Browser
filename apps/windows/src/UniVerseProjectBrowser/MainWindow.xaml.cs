using Microsoft.UI;
using Microsoft.UI.Windowing;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using UniVerseProjectBrowser.Services;
using UniVerseProjectBrowser.ViewModels;
using Windows.Graphics;
using Windows.System;

namespace UniVerseProjectBrowser;

public sealed partial class MainWindow : Window
{
    public MainWindow(BrowserViewModel? viewModel = null)
    {
        ViewModel = viewModel ?? App.SharedViewModel;
        InitializeComponent();
        Sidebar.Browser = ViewModel;
        ViewModel.Panes.CollectionChanged += (_, _) => RebuildPanes();
        ExtendsContentIntoTitleBar = true;
        SetTitleBar(TitleBarElement);
        Activated += (_, _) => BrowserEngine.NewTabRequestHandler = url => ViewModel.NewTab(url);
        ResizeToDefault();
        AddKeyboardShortcuts();
        RebuildPanes();
        Sidebar.FocusAddressBarRequested += (_, _) => Sidebar.FocusAddressBar();
    }

    public BrowserViewModel ViewModel { get; }

    private void ResizeToDefault()
    {
        var display = DisplayArea.GetFromWindowId(Win32Interop.GetWindowIdFromWindow(Win32Interop.GetWindowHandle(this)), DisplayAreaFallback.Primary);
        var workArea = display.WorkArea;
        var width = Math.Min(1440, workArea.Width - 80);
        var height = Math.Min(900, workArea.Height - 80);
        AppWindow.Resize(new SizeInt32(width, height));
        AppWindow.Move(new PointInt32((workArea.Width - width) / 2, (workArea.Height - height) / 2));
    }

    private void AddKeyboardShortcuts()
    {
        AddShortcut(VirtualKey.T, VirtualKeyModifiers.Control, () => ViewModel.NewTab());
        AddShortcut(VirtualKey.W, VirtualKeyModifiers.Control, () => ViewModel.CloseActiveTab());
        AddShortcut(VirtualKey.L, VirtualKeyModifiers.Control, () => Sidebar.FocusAddressBar());
        AddShortcut(VirtualKey.R, VirtualKeyModifiers.Control, () => ViewModel.ActivePane?.Reload());
        AddShortcut(VirtualKey.N, VirtualKeyModifiers.Control | VirtualKeyModifiers.Shift, () => ViewModel.NewWindow());
    }

    private void AddShortcut(VirtualKey key, VirtualKeyModifiers modifiers, Action action)
    {
        var accelerator = new KeyboardAccelerator { Key = key, Modifiers = modifiers };
        accelerator.Invoked += (_, _) => action();
        KeyboardAccelerators.Add(accelerator);
    }

    private void RebuildPanes()
    {
        PaneHost.Children.Clear();
        PaneHost.ColumnDefinitions.Clear();
        PaneHost.RowDefinitions.Clear();
        if (ViewModel.SplitOrientation == SplitOrientation.Vertical)
        {
            for (var i = 0; i < ViewModel.Panes.Count; i++)
            {
                PaneHost.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            }
            for (var i = 0; i < ViewModel.Panes.Count; i++)
            {
                var pane = new BrowserPaneView { Pane = ViewModel.Panes[i] };
                Grid.SetColumn(pane, i);
                PaneHost.Children.Add(pane);
            }
        }
        else
        {
            for (var i = 0; i < ViewModel.Panes.Count; i++)
            {
                PaneHost.RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
            }
            for (var i = 0; i < ViewModel.Panes.Count; i++)
            {
                var pane = new BrowserPaneView { Pane = ViewModel.Panes[i] };
                Grid.SetRow(pane, i);
                PaneHost.Children.Add(pane);
            }
        }
    }

    private void BackButton_Click(object sender, RoutedEventArgs e) => ViewModel.ActivePane?.GoBack();

    private void ForwardButton_Click(object sender, RoutedEventArgs e) => ViewModel.ActivePane?.GoForward();

    private void ReloadButton_Click(object sender, RoutedEventArgs e) => ViewModel.ActivePane?.Reload();

    private void SplitButton_Click(object sender, RoutedEventArgs e) => ViewModel.ToggleSplit();

    private void NewTabButton_Click(object sender, RoutedEventArgs e) => ViewModel.NewTab();
}
