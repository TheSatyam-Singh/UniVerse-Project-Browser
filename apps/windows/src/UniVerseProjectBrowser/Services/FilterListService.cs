using System.Text.Json;
using Windows.Storage;

namespace UniVerseProjectBrowser.Services;

public sealed class FilterListService
{
    public static FilterListService Shared { get; } = new FilterListService();

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(30) };

    private static readonly string[] SeedDomains =
    {
        "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
        "pagead2.googlesyndication.com", "2mdn.net", "adnxs.com", "adsrvr.org", "rubiconproject.com",
        "pubmatic.com", "openx.net", "criteo.com", "casalemedia.com", "advertising.com",
        "taboola.com", "outbrain.com", "adform.net", "smartadserver.com", "amazon-adsystem.com",
        "media.net", "google-analytics.com", "googletagmanager.com", "ssl.google-analytics.com",
        "stats.g.doubleclick.net", "hotjar.com", "mixpanel.com", "segment.com", "amplitude.com",
        "scorecardresearch.com", "connect.facebook.net", "pixel.facebook.com", "bat.bing.com",
        "clarity.ms", "analytics.tiktok.com", "tr.snapchat.com", "ct.pinterest.com"
    };

    private List<CatalogEntry>? _catalog;
    private bool _initialized;

    public string CacheDirectory => Path.Combine(ApplicationData.Current.LocalFolder.Path, "FilterLists");

    public IReadOnlyList<string> SeedDomainsList => SeedDomains;

    public async Task<IReadOnlyList<CatalogEntry>> GetCatalogAsync()
    {
        if (_catalog is not null)
        {
            return _catalog;
        }
        var catalogPath = Path.Combine(AppContext.BaseDirectory, "FilterLists", "FilterListCatalog.json");
        var entries = new List<CatalogEntry>();
        if (File.Exists(catalogPath))
        {
            await using var stream = File.OpenRead(catalogPath);
            var document = await JsonDocument.ParseAsync(stream);
            if (document.RootElement.TryGetProperty("lists", out var lists))
            {
                foreach (var list in lists.EnumerateArray())
                {
                    var id = list.GetProperty("id").GetString() ?? string.Empty;
                    if (id.Length == 0)
                    {
                        continue;
                    }
                    var off = list.TryGetProperty("off", out var offElement) && offElement.ValueKind == JsonValueKind.True;
                    var updateAfter = 5;
                    if (list.TryGetProperty("updateAfter", out var updateElement) && updateElement.ValueKind == JsonValueKind.Number)
                    {
                        updateAfter = updateElement.GetInt32();
                    }
                    var urls = new List<string>();
                    if (list.TryGetProperty("urls", out var urlsElement))
                    {
                        foreach (var url in urlsElement.EnumerateArray())
                        {
                            var text = url.GetString();
                            if (!string.IsNullOrEmpty(text))
                            {
                                urls.Add(text);
                            }
                        }
                    }
                    entries.Add(new CatalogEntry(id, off, updateAfter, urls));
                }
            }
        }
        _catalog = entries;
        return entries;
    }

    public async Task LoadEngineAsync(FilterEngine engine)
    {
        if (_initialized)
        {
            return;
        }
        _initialized = true;
        var files = await EnsureListsAsync();
        var loadedAny = false;
        foreach (var file in files)
        {
            var lines = await File.ReadAllLinesAsync(file);
            engine.LoadRules(lines);
            loadedAny = true;
        }
        if (!loadedAny)
        {
            engine.LoadRules(SeedDomains.Select(domain => "||" + domain + "^"));
        }
    }

    public async Task<IReadOnlyList<string>> EnsureListsAsync()
    {
        var catalog = await GetCatalogAsync();
        Directory.CreateDirectory(CacheDirectory);
        var ready = new List<string>();
        foreach (var entry in catalog.Where(entry => !entry.Off))
        {
            var cached = Path.Combine(CacheDirectory, entry.Id + ".txt");
            if (IsFresh(cached, entry.UpdateAfterDays))
            {
                ready.Add(cached);
                continue;
            }
            var downloaded = await TryDownloadAsync(entry, cached);
            if (downloaded is not null)
            {
                ready.Add(downloaded);
            }
            else if (File.Exists(cached))
            {
                ready.Add(cached);
            }
        }
        return ready;
    }

    private bool IsFresh(string cachedPath, int updateAfterDays)
    {
        if (!File.Exists(cachedPath))
        {
            return false;
        }
        var age = DateTime.UtcNow - File.GetLastWriteTimeUtc(cachedPath);
        if (age.TotalDays < updateAfterDays)
        {
            return true;
        }
        try
        {
            var expires = ReadExpiresDays(cachedPath);
            if (expires.HasValue && age.TotalDays < expires.Value)
            {
                return true;
            }
        }
        catch (IOException)
        {
            return false;
        }
        return false;
    }

    private static int? ReadExpiresDays(string path)
    {
        using var reader = new StreamReader(path);
        for (var i = 0; i < 40; i++)
        {
            var line = reader.ReadLine();
            if (line is null)
            {
                return null;
            }
            var marker = "! Expires:";
            var at = line.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
            if (at < 0)
            {
                continue;
            }
            var rest = line[(at + marker.Length)..].Trim();
            var digits = new string(rest.TakeWhile(char.IsDigit).ToArray());
            if (int.TryParse(digits, out var days) && days > 0)
            {
                return days;
            }
            return null;
        }
        return null;
    }

    private async Task<string?> TryDownloadAsync(CatalogEntry entry, string cachedPath)
    {
        foreach (var url in entry.Urls)
        {
            try
            {
                var text = await Http.GetStringAsync(url);
                if (!LooksLikeFilterList(text))
                {
                    continue;
                }
                var temp = cachedPath + ".tmp";
                await File.WriteAllTextAsync(temp, text);
                File.Move(temp, cachedPath, overwrite: true);
                return cachedPath;
            }
            catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
            {
                continue;
            }
        }
        return null;
    }

    private static bool LooksLikeFilterList(string text)
    {
        if (text.Length < 5000)
        {
            return false;
        }
        foreach (var line in text.Split('\n'))
        {
            var trimmed = line.Trim();
            if (trimmed.Length == 0)
            {
                continue;
            }
            return trimmed[0] is '[' or '!' or '#';
        }
        return false;
    }

    public sealed record CatalogEntry(string Id, bool Off, int UpdateAfterDays, IReadOnlyList<string> Urls);
}
