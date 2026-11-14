using Microsoft.UI;
using Microsoft.UI.Xaml.Media;
using Windows.UI;

namespace UniVerseProjectBrowser.ViewModels;

public sealed class TabViewModel : ViewModelBase
{
    private string _title = "New Tab";
    private string _url = string.Empty;
    private bool _isActive;
    private bool _isPinned;
    private bool _isLoading;
    private bool _canGoBack;
    private bool _canGoForward;

    public TabViewModel(string profileId)
    {
        Id = Guid.NewGuid();
        ProfileId = profileId;
    }

    public Guid Id { get; }

    public string ProfileId { get; }

    public string Title
    {
        get => _title;
        set
        {
            SetProperty(ref _title, value);
            RaisePropertyChanged(nameof(ShortTitle));
        }
    }

    public string ShortTitle => Title.Length > 18 ? Title[..18] + "…" : Title;

    public string Url
    {
        get => _url;
        set => SetProperty(ref _url, value);
    }

    public bool IsActive
    {
        get => _isActive;
        set => SetProperty(ref _isActive, value);
    }

    public bool IsPinned
    {
        get => _isPinned;
        set => SetProperty(ref _isPinned, value);
    }

    public bool IsLoading
    {
        get => _isLoading;
        set => SetProperty(ref _isLoading, value);
    }

    public bool CanGoBack
    {
        get => _canGoBack;
        set => SetProperty(ref _canGoBack, value);
    }

    public bool CanGoForward
    {
        get => _canGoForward;
        set => SetProperty(ref _canGoForward, value);
    }
}

public sealed class ProfileViewModel : ViewModelBase
{
    private string _name;
    private bool _isActive;

    public ProfileViewModel(string name, string[] colors)
    {
        Id = Guid.NewGuid();
        _name = name;
        Colors = colors.Length > 0 ? colors : new[] { "#6C5CE7" };
    }

    public Guid Id { get; }

    public string Name
    {
        get => _name;
        set
        {
            SetProperty(ref _name, value);
            RaisePropertyChanged(nameof(Initial));
        }
    }

    public string[] Colors { get; }

    public string Initial => string.IsNullOrEmpty(Name) ? "?" : Name[..1].ToUpperInvariant();

    public bool IsActive
    {
        get => _isActive;
        set => SetProperty(ref _isActive, value);
    }

    public SolidColorBrush ProfileBrush => new(FromHex(Colors[0]));

    public static Color FromHex(string hex)
    {
        var clean = hex.TrimStart('#');
        if (clean.Length == 6 && uint.TryParse(clean, System.Globalization.NumberStyles.HexNumber, null, out var rgb))
        {
            return Color.FromArgb(0xFF, (byte)((rgb >> 16) & 0xFF), (byte)((rgb >> 8) & 0xFF), (byte)(rgb & 0xFF));
        }
        return Colors.Indigo;
    }
}
