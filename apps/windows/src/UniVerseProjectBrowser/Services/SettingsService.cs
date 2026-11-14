using Windows.Storage;

namespace UniVerseProjectBrowser.Services;

public sealed class SettingsService
{
    public static SettingsService Shared { get; } = new SettingsService();

    private ApplicationDataContainer Store => ApplicationData.Current.LocalSettings;

    public bool AdBlockingEnabled
    {
        get => GetBool(nameof(AdBlockingEnabled), true);
        set => Store.Values[nameof(AdBlockingEnabled)] = value;
    }

    public bool CosmeticFilteringEnabled
    {
        get => GetBool(nameof(CosmeticFilteringEnabled), true);
        set => Store.Values[nameof(CosmeticFilteringEnabled)] = value;
    }

    public bool TrackingParamStripping
    {
        get => GetBool(nameof(TrackingParamStripping), true);
        set => Store.Values[nameof(TrackingParamStripping)] = value;
    }

    public bool SponsorBlockEnabled
    {
        get => GetBool(nameof(SponsorBlockEnabled), true);
        set => Store.Values[nameof(SponsorBlockEnabled)] = value;
    }

    public string SponsorBlockCategories
    {
        get => GetString(nameof(SponsorBlockCategories), "sponsor,intro,outro,selfpromo,interaction,music_offtopic");
        set => Store.Values[nameof(SponsorBlockCategories)] = value;
    }

    public bool YouTubeHideShorts
    {
        get => GetBool(nameof(YouTubeHideShorts), false);
        set => Store.Values[nameof(YouTubeHideShorts)] = value;
    }

    public bool YouTubeNoHoverPreview
    {
        get => GetBool(nameof(YouTubeNoHoverPreview), false);
        set => Store.Values[nameof(YouTubeNoHoverPreview)] = value;
    }

    public bool YouTubeFrameThumbnails
    {
        get => GetBool(nameof(YouTubeFrameThumbnails), true);
        set => Store.Values[nameof(YouTubeFrameThumbnails)] = value;
    }

    public string SocialDownloadSites
    {
        get => GetString(nameof(SocialDownloadSites), "instagram.com,facebook.com,x.com,pinterest.com");
        set => Store.Values[nameof(SocialDownloadSites)] = value;
    }

    public string SyncFolderPath
    {
        get => GetString(nameof(SyncFolderPath), string.Empty);
        set => Store.Values[nameof(SyncFolderPath)] = value;
    }

    public bool SyncEnabled
    {
        get => GetBool(nameof(SyncEnabled), false);
        set => Store.Values[nameof(SyncEnabled)] = value;
    }

    public string UpdateAppcastUrl
    {
        get => GetString(nameof(UpdateAppcastUrl), "https://github.com/TheSatyam-Singh/UniVerse-Project-Browser/releases/latest/download/appcast-windows.xml");
        set => Store.Values[nameof(UpdateAppcastUrl)] = value;
    }

    public string UpdateEdDSAPublicKey
    {
        get => GetString(nameof(UpdateEdDSAPublicKey), string.Empty);
        set => Store.Values[nameof(UpdateEdDSAPublicKey)] = value;
    }

    private bool GetBool(string key, bool defaultValue)
    {
        return Store.Values.TryGetValue(key, out var value) && value is bool flag ? flag : defaultValue;
    }

    private string GetString(string key, string defaultValue)
    {
        return Store.Values.TryGetValue(key, out var value) && value is string text ? text : defaultValue;
    }
}
