using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using UniVerseProjectBrowser.ViewModels;

namespace UniVerseProjectBrowser.Controls;

public sealed partial class SidebarView : UserControl
{
    private BrowserViewModel? _browser;

    public SidebarView()
    {
        InitializeComponent();
    }

    public BrowserViewModel? Browser
    {
        get => _browser;
        set
        {
            _browser = value;
            AddressBar.Browser = value;
            AddressBar.Sidebar = Sidebar;
        }
    }

    public SidebarViewModel Sidebar => _browser?.Sidebar ?? App.SharedViewModel.Sidebar;

    public event EventHandler? FocusAddressBarRequested;

    public void FocusAddressBar()
    {
        AddressBar.FocusInput();
    }

    private void Profiles_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (Sidebar.SelectedProfile is not null)
        {
            Sidebar.SwitchProfile(Sidebar.SelectedProfile);
        }
    }

    private void Tabs_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (Sidebar.ActiveTab is not null)
        {
            Sidebar.ActivateTab(Sidebar.ActiveTab);
        }
    }

    private void PinnedGrid_ItemClick(object sender, ItemClickEventArgs e)
    {
        if (e.ClickedItem is TabViewModel tab)
        {
            Sidebar.ActivateTab(tab);
        }
    }

    private void CloseTabButton_Click(object sender, RoutedEventArgs e)
    {
        if (sender is Button button && button.Tag is TabViewModel tab)
        {
            Sidebar.CloseTab(tab);
        }
    }

    private void NewTabButton_Click(object sender, RoutedEventArgs e)
    {
        Sidebar.NewTab();
        FocusAddressBarRequested?.Invoke(this, EventArgs.Empty);
    }

    private void NewProfileButton_Click(object sender, RoutedEventArgs e)
    {
        Sidebar.NewProfile();
    }
}
