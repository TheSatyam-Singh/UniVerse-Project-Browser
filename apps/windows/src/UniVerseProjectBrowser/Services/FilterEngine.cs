using System.Text.Json;
using System.Text.RegularExpressions;

namespace UniVerseProjectBrowser.Services;

public enum FilterDecision
{
    NoMatch,
    Block,
    Allow
}

public sealed class FilterEngine
{
    private readonly HashSet<string> _blockedHosts = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _allowedHosts = new(StringComparer.OrdinalIgnoreCase);
    private readonly List<NetworkRule> _networkRules = new();
    private readonly List<CosmeticRule> _cosmeticRules = new();
    private readonly List<RemoveParamRule> _removeParamRules = new();
    private readonly Dictionary<string, Regex> _regexCache = new(StringComparer.Ordinal);
    private int _loadedLines;
    private int _skippedLines;

    public int BlockedHostCount => _blockedHosts.Count;

    public int NetworkRuleCount => _networkRules.Count;

    public int CosmeticRuleCount => _cosmeticRules.Count;

    public int LoadedLines => _loadedLines;

    public int SkippedLines => _skippedLines;

    public void LoadRules(IEnumerable<string> lines)
    {
        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.Length == 0 || line[0] == '!' || line[0] == '[')
            {
                continue;
            }
            _loadedLines++;
            if (!TryParseLine(line))
            {
                _skippedLines++;
            }
        }
    }

    public FilterDecision Match(string url, string resourceType, bool isThirdParty)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed))
        {
            return FilterDecision.NoMatch;
        }
        var host = parsed.Host;
        if (HostSetMatches(_allowedHosts, host))
        {
            return FilterDecision.Allow;
        }
        if (HostSetMatches(_blockedHosts, host))
        {
            return FilterDecision.Block;
        }
        foreach (var rule in _networkRules)
        {
            if (!rule.MatchesResource(resourceType, isThirdParty))
            {
                continue;
            }
            if (!rule.MatchesUrl(url, host, GetRegex))
            {
                continue;
            }
            return rule.IsException ? FilterDecision.Allow : FilterDecision.Block;
        }
        return FilterDecision.NoMatch;
    }

    public IReadOnlyList<string> RemoveParamsFor(string url, string resourceType, bool isThirdParty)
    {
        var names = new List<string>();
        foreach (var rule in _removeParamRules)
        {
            if (!rule.MatchesResource(resourceType, isThirdParty))
            {
                continue;
            }
            if (rule.Domains.Count > 0)
            {
                if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed))
                {
                    continue;
                }
                if (!rule.Domains.Any(domain => HostMatchesDomain(parsed.Host, domain)))
                {
                    continue;
                }
            }
            if (rule.ParamName is null)
            {
                names.Add("*");
            }
            else if (!names.Contains(rule.ParamName))
            {
                names.Add(rule.ParamName);
            }
        }
        return names;
    }

    public string BuildCosmeticConfigJson(int maxSelectors = 2000)
    {
        var selectors = _cosmeticRules
            .Where(rule => rule.Domain is null)
            .Select(rule => rule.Selector)
            .Distinct(StringComparer.Ordinal)
            .Take(maxSelectors)
            .ToArray();
        return JsonSerializer.Serialize(new { css = selectors });
    }

    public string BuildCosmeticConfigJsonForHost(string host, int maxSelectors = 500)
    {
        var selectors = _cosmeticRules
            .Where(rule => rule.Domain is null || HostMatchesDomain(host, rule.Domain))
            .Select(rule => rule.Selector)
            .Distinct(StringComparer.Ordinal)
            .Take(maxSelectors)
            .ToArray();
        return JsonSerializer.Serialize(new { css = selectors });
    }

    private static bool HostSetMatches(HashSet<string> set, string host)
    {
        var current = host;
        while (true)
        {
            if (set.Contains(current))
            {
                return true;
            }
            var dot = current.IndexOf('.');
            if (dot < 0)
            {
                return false;
            }
            current = current[(dot + 1)..];
        }
    }

    private static bool HostMatchesDomain(string host, string domain)
    {
        return host.Equals(domain, StringComparison.OrdinalIgnoreCase)
            || host.EndsWith("." + domain, StringComparison.OrdinalIgnoreCase);
    }

    private Regex? GetRegex(string pattern)
    {
        if (_regexCache.TryGetValue(pattern, out var cached))
        {
            return cached;
        }
        if (_regexCache.Count >= 2000)
        {
            return null;
        }
        var regex = new Regex(WildcardToRegex(pattern), RegexOptions.IgnoreCase | RegexOptions.Compiled);
        _regexCache[pattern] = regex;
        return regex;
    }

    private static string WildcardToRegex(string pattern)
    {
        var anchored = pattern.StartsWith("^", StringComparison.Ordinal);
        var body = anchored ? pattern[1..] : pattern;
        var escaped = Regex.Escape(body);
        escaped = escaped.Replace("\\*", ".*", StringComparison.Ordinal);
        escaped = escaped.Replace("\\^", "(?:[^a-zA-Z0-9_.%-]|$)", StringComparison.Ordinal);
        return anchored ? "^" + escaped : escaped;
    }

    private bool TryParseLine(string line)
    {
        var cosmeticIndex = line.IndexOf("##", StringComparison.Ordinal);
        if (cosmeticIndex >= 0)
        {
            return TryParseCosmetic(line[..cosmeticIndex], line[(cosmeticIndex + 2)..]);
        }
        if (line.Contains("#$#", StringComparison.Ordinal) || line.Contains("#@#", StringComparison.Ordinal))
        {
            return false;
        }
        return TryParseNetwork(line);
    }

    private bool TryParseCosmetic(string domainsPart, string selector)
    {
        selector = selector.Trim();
        if (selector.Length == 0 || selector.Contains(":has(", StringComparison.Ordinal)
            || selector.Contains(":has-text(", StringComparison.Ordinal)
            || selector.Contains(":upward(", StringComparison.Ordinal)
            || selector.Contains(":matches-css(", StringComparison.Ordinal)
            || selector.Contains(":remove(", StringComparison.Ordinal)
            || selector.Contains(":style(", StringComparison.Ordinal))
        {
            return false;
        }
        if (domainsPart.Length == 0)
        {
            _cosmeticRules.Add(new CosmeticRule(null, selector));
            return true;
        }
        foreach (var domain in domainsPart.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            var clean = domain.Trim();
            if (clean.StartsWith('~'))
            {
                continue;
            }
            _cosmeticRules.Add(new CosmeticRule(clean, selector));
        }
        return true;
    }

    private bool TryParseNetwork(string line)
    {
        var isException = false;
        if (line.StartsWith("@@", StringComparison.Ordinal))
        {
            isException = true;
            line = line[2..];
        }
        var pattern = line;
        string? options = null;
        var dollar = line.LastIndexOf('$');
        if (dollar > 0)
        {
            var candidate = line[(dollar + 1)..];
            if (candidate.Length > 0 && candidate.All(c => char.IsLetterOrDigit(c) || c is '-' or '_' or '=' or ',' or '~' or '|' or '.'))
            {
                pattern = line[..dollar];
                options = candidate;
            }
        }
        var parsedOptions = NetworkOptions.Parse(options);
        if (parsedOptions.IsRemoveParam)
        {
            _removeParamRules.Add(new RemoveParamRule(parsedOptions.RemoveParamName, parsedOptions.Domains, parsedOptions.ResourceTypes, parsedOptions.ThirdParty));
            return true;
        }
        if (pattern.StartsWith("||", StringComparison.Ordinal))
        {
            var rest = pattern[2..];
            var separator = rest.IndexOfAny(new[] { '^', '/' });
            var hostPart = separator >= 0 ? rest[..separator] : rest;
            var remainder = separator >= 0 ? rest[separator..] : string.Empty;
            if (remainder.Length == 0 && !hostPart.Contains('*') && parsedOptions.Domains.Count == 0 && parsedOptions.ExcludedDomains.Count == 0 && parsedOptions.ResourceTypes.Count == 0 && parsedOptions.ThirdParty is null)
            {
                if (isException)
                {
                    _allowedHosts.Add(hostPart);
                }
                else
                {
                    _blockedHosts.Add(hostPart);
                }
                return true;
            }
        }
        _networkRules.Add(new NetworkRule(pattern, isException, parsedOptions));
        return true;
    }

    private sealed class NetworkOptions
    {
        public List<string> Domains { get; } = new();

        public List<string> ExcludedDomains { get; } = new();

        public HashSet<string> ResourceTypes { get; } = new(StringComparer.OrdinalIgnoreCase);

        public bool? ThirdParty { get; set; }

        public bool IsRemoveParam { get; set; }

        public string? RemoveParamName { get; set; }

        public static NetworkOptions Parse(string? options)
        {
            var result = new NetworkOptions();
            if (string.IsNullOrEmpty(options))
            {
                return result;
            }
            foreach (var raw in options.Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                var option = raw.Trim();
                if (option.StartsWith("domain=", StringComparison.OrdinalIgnoreCase))
                {
                    foreach (var domain in option[7..].Split('|', StringSplitOptions.RemoveEmptyEntries))
                    {
                        if (domain.StartsWith('~'))
                        {
                            result.ExcludedDomains.Add(domain[1..]);
                        }
                        else
                        {
                            result.Domains.Add(domain);
                        }
                    }
                }
                else if (option.Equals("third-party", StringComparison.OrdinalIgnoreCase))
                {
                    result.ThirdParty = true;
                }
                else if (option.Equals("~third-party", StringComparison.OrdinalIgnoreCase) || option.Equals("first-party", StringComparison.OrdinalIgnoreCase))
                {
                    result.ThirdParty = false;
                }
                else if (option.Equals("removeparam", StringComparison.OrdinalIgnoreCase))
                {
                    result.IsRemoveParam = true;
                }
                else if (option.StartsWith("removeparam=", StringComparison.OrdinalIgnoreCase))
                {
                    result.IsRemoveParam = true;
                    result.RemoveParamName = option["removeparam=".Length..];
                }
                else if (option is "script" or "image" or "stylesheet" or "xmlhttprequest" or "font" or "media" or "websocket" or "document" or "subdocument" or "fetch" or "other")
                {
                    result.ResourceTypes.Add(option);
                }
            }
            return result;
        }
    }

    private sealed class NetworkRule
    {
        private readonly string _pattern;
        private readonly NetworkOptions _options;

        public NetworkRule(string pattern, bool isException, NetworkOptions options)
        {
            _pattern = pattern;
            IsException = isException;
            _options = options;
        }

        public bool IsException { get; }

        public bool MatchesResource(string resourceType, bool isThirdParty)
        {
            if (_options.ResourceTypes.Count > 0 && !_options.ResourceTypes.Contains(resourceType) && !_options.ResourceTypes.Contains("other"))
            {
                return false;
            }
            if (_options.ThirdParty is not null && _options.ThirdParty.Value != isThirdParty)
            {
                return false;
            }
            return true;
        }

        public bool MatchesUrl(string url, string host, Func<string, Regex?> getRegex)
        {
            if (_options.Domains.Count > 0 && !_options.Domains.Any(domain => HostMatchesDomain(host, domain)))
            {
                return false;
            }
            if (_options.ExcludedDomains.Any(domain => HostMatchesDomain(host, domain)))
            {
                return false;
            }
            if (_pattern.StartsWith("||", StringComparison.Ordinal))
            {
                var rest = _pattern[2..];
                var separator = rest.IndexOfAny(new[] { '^', '/' });
                var hostPart = separator >= 0 ? rest[..separator] : rest;
                var remainder = separator >= 0 ? rest[separator..] : string.Empty;
                if (hostPart.Contains('*'))
                {
                    var wildcardRegex = getRegex(_pattern);
                    return wildcardRegex is not null && wildcardRegex.IsMatch(url);
                }
                if (!host.Equals(hostPart, StringComparison.OrdinalIgnoreCase)
                    && !host.EndsWith("." + hostPart, StringComparison.OrdinalIgnoreCase))
                {
                    return false;
                }
                if (remainder.Length == 0 || remainder == "^")
                {
                    return true;
                }
                var restRegex = getRegex(_pattern);
                return restRegex is not null && restRegex.IsMatch(url);
            }
            if (_pattern.StartsWith('|'))
            {
                var regex = getRegex("^" + _pattern.TrimStart('|'));
                return regex is not null && regex.IsMatch(url);
            }
            if (_pattern.Contains('*') || _pattern.Contains('^'))
            {
                var regex = getRegex(_pattern);
                return regex is not null && regex.IsMatch(url);
            }
            return url.Contains(_pattern, StringComparison.OrdinalIgnoreCase);
        }
    }

    private sealed record CosmeticRule(string? Domain, string Selector);

    private sealed record RemoveParamRule(string? ParamName, List<string> Domains, HashSet<string> ResourceTypes, bool? ThirdParty)
    {
        public bool MatchesResource(string resourceType, bool isThirdParty)
        {
            if (ResourceTypes.Count > 0 && !ResourceTypes.Contains(resourceType) && !ResourceTypes.Contains("other"))
            {
                return false;
            }
            if (ThirdParty is not null && ThirdParty.Value != isThirdParty)
            {
                return false;
            }
            return true;
        }
    }
}
