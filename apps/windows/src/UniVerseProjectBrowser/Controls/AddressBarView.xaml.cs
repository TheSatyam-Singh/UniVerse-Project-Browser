using System.ComponentModel;
using System.Runtime.CompilerServices;
using Microsoft.UI.Xaml;
using Microsoft.UI.Xaml.Controls;
using Microsoft.UI.Xaml.Input;
using UniVerseProjectBrowser.Services;
using UniVerseProjectBrowser.ViewModels;
using Windows.System;

namespace UniVerseProjectBrowser.Controls;

public sealed partial class AddressBarView : UserControl, INotifyPropertyChanged
{
    private string _addressText = string.Empty;
    private SidebarViewModel? _sidebar;

    public AddressBarView()
    {
        InitializeComponent();
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public BrowserViewModel? Browser { get; set; }

    public SidebarViewModel? Sidebar
    {
        get => _sidebar;
        set
        {
            if (_sidebar is not null)
            {
                _sidebar.ActiveTabChanged -= Sidebar_ActiveTabChanged;
            }
            _sidebar = value;
            if (_sidebar is not null)
            {
                _sidebar.ActiveTabChanged += Sidebar_ActiveTabChanged;
                AddressText = _sidebar.ActiveTab?.Url ?? string.Empty;
                Input.Text = AddressText;
            }
        }
    }

    public string AddressText
    {
        get => _addressText;
        set
        {
            if (_addressText != value)
            {
                _addressText = value;
                OnPropertyChanged();
            }
        }
    }

    public void FocusInput()
    {
        Input.Focus(FocusState.Programmatic);
        Input.SelectAll();
    }

    private void OnPropertyChanged([CallerMemberName] string? propertyName = null)
    {
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }

    private void Sidebar_ActiveTabChanged(object? sender, TabViewModel? tab)
    {
        AddressText = tab?.Url ?? string.Empty;
        Input.Text = AddressText;
    }

    private void Commit()
    {
        var target = OmniboxService.Resolve(Input.Text);
        Browser?.NavigateActiveTab(target);
    }

    private void GoButton_Click(object sender, RoutedEventArgs e) => Commit();

    private void Input_KeyDown(object sender, KeyRoutedEventArgs e)
    {
        if (e.Key == VirtualKey.Enter)
        {
            Commit();
            e.Handled = true;
        }
        else if (e.Key == VirtualKey.Escape)
        {
            AddressText = Sidebar?.ActiveTab?.Url ?? string.Empty;
            Input.Text = AddressText;
        }
    }

    private void Input_GotFocus(object sender, RoutedEventArgs e)
    {
        Input.SelectAll();
    }
}
