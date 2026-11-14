using UniVerseProjectBrowser.ViewModels;

namespace UniVerseProjectBrowser.Services;

public static class DeepLinkService
{
    public static void HandleLaunchArguments(string arguments, BrowserViewModel viewModel)
    {
        if (string.IsNullOrEmpty(arguments))
        {
            return;
        }
        foreach (var token in arguments.Split(' ', StringSplitOptions.RemoveEmptyEntries))
        {
            if (token.StartsWith("universe://", StringComparison.OrdinalIgnoreCase))
            {
                HandleUri(token.Trim('"'), viewModel);
                return;
            }
        }
    }

    public static void HandleUri(string uriText, BrowserViewModel viewModel)
    {
        if (!Uri.TryCreate(uriText, UriKind.Absolute, out var uri))
        {
            return;
        }
        var action = uri.Host.ToLowerInvariant();
        var query = ParseQuery(uri.Query);
        switch (action)
        {
            case "open":
                if (query.TryGetValue("url", out var url) && !string.IsNullOrEmpty(url))
                {
                    if (query.TryGetValue("space", out var space) && !string.IsNullOrEmpty(space))
                    {
                        SwitchProfile(viewModel, space);
                    }
                    viewModel.NavigateActiveTab(OmniboxService.Resolve(url));
                }
                break;
            case "search":
                if (query.TryGetValue("q", out var text) && !string.IsNullOrEmpty(text))
                {
                    viewModel.NavigateActiveTab(OmniboxService.Resolve(text));
                }
                break;
            case "space":
                if (query.TryGetValue("name", out var name) && !string.IsNullOrEmpty(name))
                {
                    SwitchProfile(viewModel, name);
                }
                break;
        }
    }

    private static void SwitchProfile(BrowserViewModel viewModel, string name)
    {
        var profile = viewModel.Sidebar.Profiles.FirstOrDefault(p => p.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
        if (profile is not null)
        {
            viewModel.Sidebar.SwitchProfile(profile);
        }
    }

    private static Dictionary<string, string> ParseQuery(string query)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var equals = pair.IndexOf('=');
            if (equals < 0)
            {
                continue;
            }
            result[pair[..equals]] = Uri.UnescapeDataString(pair[(equals + 1)..].Replace('+', ' '));
        }
        return result;
    }
}
