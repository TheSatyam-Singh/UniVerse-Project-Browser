using System.Text.Json;
using Windows.Storage.Pickers;
using WinRT.Interop;

namespace UniVerseProjectBrowser.Services;

public sealed class SyncService
{
    public static SyncService Shared { get; } = new SyncService();

    private FileSystemWatcher? _watcher;

    public string? FolderPath => string.IsNullOrEmpty(SettingsService.Shared.SyncFolderPath)
        ? null
        : SettingsService.Shared.SyncFolderPath;

    public event EventHandler<string>? FolderChanged;

    public async Task<string?> PickFolderAsync(nint windowHandle)
    {
        var picker = new FolderPicker();
        InitializeWithWindow.Initialize(picker, windowHandle);
        picker.FileTypeFilter.Add("*");
        var folder = await picker.PickSingleFolderAsync();
        if (folder is null)
        {
            return null;
        }
        SettingsService.Shared.SyncFolderPath = folder.Path;
        StartWatching(folder.Path);
        return folder.Path;
    }

    public void StartWatching(string folderPath)
    {
        StopWatching();
        _watcher = new FileSystemWatcher(folderPath, "*.json")
        {
            EnableRaisingEvents = true,
            IncludeSubdirectories = false
        };
        _watcher.Changed += (_, e) => FolderChanged?.Invoke(this, e.FullPath);
        _watcher.Created += (_, e) => FolderChanged?.Invoke(this, e.FullPath);
    }

    public void StopWatching()
    {
        _watcher?.Dispose();
        _watcher = null;
    }

    public async Task WriteDeviceTabsAsync(string deviceName, IReadOnlyList<(string Url, string Title)> tabs)
    {
        var folder = FolderPath;
        if (folder is null || !SettingsService.Shared.SyncEnabled)
        {
            return;
        }
        var record = new
        {
            universeWindowsV1Unencrypted = true,
            n = deviceName,
            tabs = tabs.Select(tab => new { u = tab.Url, t = tab.Title }).ToArray()
        };
        var path = Path.Combine(folder, "device-tabs-" + Environment.MachineName + ".json");
        await File.WriteAllTextAsync(path, JsonSerializer.Serialize(record));
    }

    public async Task<IReadOnlyList<JsonElement>> ReadRecordsAsync(string fileName)
    {
        var folder = FolderPath;
        if (folder is null)
        {
            return Array.Empty<JsonElement>();
        }
        var path = Path.Combine(folder, fileName);
        if (!File.Exists(path))
        {
            return Array.Empty<JsonElement>();
        }
        var text = await File.ReadAllTextAsync(path);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.ValueKind == JsonValueKind.Array
            ? document.RootElement.EnumerateArray().Select(element => element.Clone()).ToArray()
            : new[] { document.RootElement.Clone() };
    }
}
