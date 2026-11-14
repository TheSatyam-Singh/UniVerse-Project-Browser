using System.Collections.ObjectModel;
using UniVerseProjectBrowser.Services;

namespace UniVerseProjectBrowser.ViewModels;

public enum SplitOrientation
{
    Vertical,
    Horizontal
}

public sealed class PaneViewModel : ViewModelBase
{
    private TabViewModel _tab;

    public PaneViewModel(TabViewModel tab)
    {
        Id = Guid.NewGuid();
        _tab = tab;
    }

    public Guid Id { get; }

    public TabViewModel Tab
    {
        get => _tab;
        set => SetProperty(ref _tab, value);
    }

    public Action? GoBackAction { get; set; }

    public Action? GoForwardAction { get; set; }

    public Action? ReloadAction { get; set; }

    public Action<string>? NavigateAction { get; set; }

    public void GoBack() => GoBackAction?.Invoke();

    public void GoForward() => GoForwardAction?.Invoke();

    public void Reload() => ReloadAction?.Invoke();

    public void Navigate(string url) => NavigateAction?.Invoke(url);
}

public sealed class SidebarViewModel : ViewModelBase
{
    private TabViewModel? _activeTab;
    private ProfileViewModel? _selectedProfile;

    public SidebarViewModel()
    {
        var defaultProfile = new ProfileViewModel("Personal", new[] { "#6C5CE7", "#00CEC9", "#FD79A8" }) { IsActive = true };
        Profiles.Add(defaultProfile);
        _selectedProfile = defaultProfile;
    }

    public event EventHandler<TabViewModel?>? ActiveTabChanged;

    public ObservableCollection<ProfileViewModel> Profiles { get; } = new();

    public ObservableCollection<TabViewModel> Tabs { get; } = new();

    public ObservableCollection<TabViewModel> PinnedTabs { get; } = new();

    public TabViewModel? ActiveTab
    {
        get => _activeTab;
        set
        {
            if (_activeTab != value)
            {
                if (_activeTab is not null)
                {
                    _activeTab.IsActive = false;
                }
                _activeTab = value;
                if (_activeTab is not null)
                {
                    _activeTab.IsActive = true;
                }
                RaisePropertyChanged();
                ActiveTabChanged?.Invoke(this, _activeTab);
            }
        }
    }

    public ProfileViewModel? SelectedProfile
    {
        get => _selectedProfile;
        set => SetProperty(ref _selectedProfile, value);
    }

    public TabViewModel NewTab(string url = "")
    {
        var profileId = SelectedProfile?.Id.ToString() ?? Profiles[0].Id.ToString();
        var tab = new TabViewModel(profileId) { Url = url };
        Tabs.Add(tab);
        ActiveTab = tab;
        return tab;
    }

    public void ActivateTab(TabViewModel tab)
    {
        ActiveTab = tab;
    }

    public void CloseTab(TabViewModel tab)
    {
        var wasActive = ActiveTab == tab;
        Tabs.Remove(tab);
        PinnedTabs.Remove(tab);
        if (wasActive)
        {
            ActiveTab = Tabs.Count > 0 ? Tabs[^1] : PinnedTabs.Count > 0 ? PinnedTabs[^1] : null;
        }
        if (Tabs.Count == 0 && PinnedTabs.Count == 0)
        {
            NewTab();
        }
    }

    public void PinTab(TabViewModel tab)
    {
        tab.IsPinned = true;
        Tabs.Remove(tab);
        if (!PinnedTabs.Contains(tab))
        {
            PinnedTabs.Add(tab);
        }
    }

    public void UnpinTab(TabViewModel tab)
    {
        tab.IsPinned = false;
        PinnedTabs.Remove(tab);
        if (!Tabs.Contains(tab))
        {
            Tabs.Add(tab);
        }
    }

    public void SwitchProfile(ProfileViewModel profile)
    {
        foreach (var existing in Profiles)
        {
            existing.IsActive = existing == profile;
        }
        SelectedProfile = profile;
        var first = Tabs.FirstOrDefault(t => t.ProfileId == profile.Id.ToString())
            ?? PinnedTabs.FirstOrDefault(t => t.ProfileId == profile.Id.ToString());
        if (first is not null)
        {
            ActiveTab = first;
        }
        else
        {
            NewTab();
        }
    }

    public void NewProfile()
    {
        var profile = new ProfileViewModel($"Profile {Profiles.Count + 1}", new[] { "#00B894", "#0984E3", "#E17055" });
        Profiles.Add(profile);
        SwitchProfile(profile);
    }
}

public sealed class BrowserViewModel : ViewModelBase
{
    private SplitOrientation _splitOrientation = SplitOrientation.Vertical;
    private PaneViewModel? _lastFocusedPane;
    private bool _suppressRetarget;

    public BrowserViewModel()
    {
        Sidebar = new SidebarViewModel();
        Sidebar.ActiveTabChanged += (_, tab) =>
        {
            if (tab is not null)
            {
                RaisePropertyChanged(nameof(ActiveTabTitle));
                SyncActivePane(tab);
            }
        };
        var firstTab = Sidebar.NewTab();
        Panes.Add(new PaneViewModel(firstTab));
        _lastFocusedPane = Panes[0];
    }

    public SidebarViewModel Sidebar { get; }

    public ObservableCollection<PaneViewModel> Panes { get; } = new();

    public SplitOrientation SplitOrientation
    {
        get => _splitOrientation;
        set => SetProperty(ref _splitOrientation, value);
    }

    public PaneViewModel? ActivePane
    {
        get
        {
            if (_lastFocusedPane is not null && Panes.Contains(_lastFocusedPane))
            {
                return _lastFocusedPane;
            }
            return Panes.Count > 0 ? Panes[0] : null;
        }
    }

    public string ActiveTabTitle => Sidebar.ActiveTab?.Title ?? "UniVerse Project Browser";

    public TabViewModel NewTab(string url = "")
    {
        var tab = Sidebar.NewTab(url);
        SyncActivePane(tab);
        return tab;
    }

    public void CloseActiveTab()
    {
        if (Sidebar.ActiveTab is not null)
        {
            Sidebar.CloseTab(Sidebar.ActiveTab);
        }
    }

    public void NavigateActiveTab(string url)
    {
        if (Sidebar.ActiveTab is null)
        {
            NewTab(url);
            return;
        }
        Sidebar.ActiveTab.Url = url;
        SyncActivePane(Sidebar.ActiveTab);
        ActivePane?.Navigate(url);
    }

    public void ToggleSplit()
    {
        if (Panes.Count >= 3)
        {
            SplitOrientation = SplitOrientation == SplitOrientation.Vertical
                ? SplitOrientation.Horizontal
                : SplitOrientation.Vertical;
            return;
        }
        _suppressRetarget = true;
        try
        {
            var tab = Sidebar.NewTab();
            Panes.Add(new PaneViewModel(tab));
            _lastFocusedPane = Panes[^1];
        }
        finally
        {
            _suppressRetarget = false;
        }
    }

    public void RemoveSplitPane(PaneViewModel pane)
    {
        if (Panes.Count <= 1)
        {
            return;
        }
        Panes.Remove(pane);
    }

    public void NewWindow()
    {
        var window = new MainWindow(new BrowserViewModel());
        window.Activate();
    }

    private void SyncActivePane(TabViewModel tab)
    {
        if (_suppressRetarget)
        {
            return;
        }
        var pane = Panes.FirstOrDefault(p => p.Tab == tab);
        if (pane is not null)
        {
            _lastFocusedPane = pane;
            RaisePropertyChanged(nameof(ActivePane));
            return;
        }
        var active = ActivePane;
        if (active is not null)
        {
            active.Tab = tab;
            _lastFocusedPane = active;
            RaisePropertyChanged(nameof(ActivePane));
        }
    }
}
