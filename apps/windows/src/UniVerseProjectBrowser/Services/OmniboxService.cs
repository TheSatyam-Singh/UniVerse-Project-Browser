using System.Text.RegularExpressions;

namespace UniVerseProjectBrowser.Services;

public static partial class OmniboxService
{
    private static readonly HashSet<string> KnownSchemes = new(StringComparer.OrdinalIgnoreCase)
    {
        "http", "https", "file", "about", "data", "blob", "mailto", "tel", "sms",
        "facetime", "ftp", "view-source", "universe", "chrome", "chrome-extension",
        "devtools", "slack", "zoommtg", "vscode", "cursor", "notion", "figma",
        "spotify", "linear", "obsidian", "raycast"
    };

    private static readonly HashSet<string> LocalTlds = new(StringComparer.OrdinalIgnoreCase)
    {
        "localhost", "local", "test", "internal", "lan"
    };

    private static readonly HashSet<string> GlobalParams = new(StringComparer.OrdinalIgnoreCase)
    {
        "gclid", "gclsrc", "dclid", "gbraid", "wbraid", "gad_source", "gad_campaignid", "_ga", "_gl", "srsltid",
        "fbclid", "igshid", "msclkid", "twclid", "ttclid", "li_fat_id", "yclid", "ysclid", "rdt_cid", "epik",
        "mc_cid", "mc_eid", "_hsenc", "_hsmi", "__hssc", "__hstc", "__hsfp", "hsctatracking", "mkt_tok", "elqtrackid",
        "elqtrack", "vero_id", "vero_conv", "_kx", "__s",
        "oly_anon_id", "oly_enc_id", "_openstat", "wickedid", "rb_clickid", "s_cid", "irclickid", "cjevent", "sscid",
        "zanpid", "ranmid", "raneaid", "ransiteid", "trk_contact", "trk_msg", "trk_module", "trk_sid"
    };

    private static readonly string[] GlobalPrefixes = { "utm_", "pk_", "mtm_", "piwik_", "matomo_", "hsa_", "stm_" };

    private static readonly (string[] Hosts, string[] Params, string[] Prefixes)[] SiteParams =
    {
        (new[] { "youtube.com", "youtu.be", "music.youtube.com" }, new[] { "si", "pp", "feature" }, Array.Empty<string>()),
        (new[] { "open.spotify.com" }, new[] { "si", "nd", "context" }, Array.Empty<string>()),
        (new[] { "instagram.com" }, new[] { "igsh", "img_index" }, Array.Empty<string>()),
        (new[] { "x.com", "twitter.com" }, new[] { "s", "t", "ref_src", "ref_url" }, Array.Empty<string>()),
        (new[] { "threads.net", "threads.com" }, new[] { "xmt", "slof" }, Array.Empty<string>()),
        (new[] { "tiktok.com" }, new[] { "is_from_webapp", "sender_device", "sender_web_id", "_r", "_t" }, Array.Empty<string>()),
        (new[] { "linkedin.com" }, new[] { "trk", "trackingid", "lipi", "midtoken", "midsig", "trkemail", "eid" }, Array.Empty<string>()),
        (new[] { "reddit.com" }, new[] { "share_id", "ref_source", "ref_campaign" }, Array.Empty<string>()),
        (new[] { "medium.com" }, new[] { "source" }, Array.Empty<string>()),
        (new[] { "facebook.com" }, new[] { "mibextid", "sfnsn", "rdid", "share_url" }, Array.Empty<string>()),
        (new[] { "amazon.com", "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it", "amazon.es", "amazon.ca", "amazon.co.jp", "amazon.in", "amazon.com.au" },
            new[] { "_encoding", "psc", "ref", "ref_", "tag", "linkcode", "linkid", "camp", "creative", "creativeasin", "content-id", "crid", "sprefix", "qid", "sr", "dib", "dib_tag" },
            new[] { "pd_rd_", "pf_rd_" })
    };

    public static string Resolve(string input)
    {
        var text = input.Trim();
        if (text.Length == 0)
        {
            return string.Empty;
        }
        if (text.StartsWith("universe:", StringComparison.OrdinalIgnoreCase))
        {
            return text;
        }
        if (Uri.TryCreate(text, UriKind.Absolute, out var absolute) && KnownSchemes.Contains(absolute.Scheme))
        {
            return CleanUrl(text);
        }
        if (LooksLikeHost(text))
        {
            var candidate = text.Contains("://", StringComparison.Ordinal) ? text : "https://" + text;
            return CleanUrl(candidate);
        }
        return "https://duckduckgo.com/?q=" + Uri.EscapeDataString(text);
    }

    public static bool LooksLikeHost(string text)
    {
        if (text.Contains(' ') || text.Contains("://", StringComparison.Ordinal))
        {
            return false;
        }
        var hostPort = text.Split('/')[0];
        var host = hostPort.Split(':')[0];
        if (host.Length == 0 || !HostChars().IsMatch(host))
        {
            return false;
        }
        if (host.Equals("localhost", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }
        if (System.Net.IPAddress.TryParse(host, out _))
        {
            return true;
        }
        var lastDot = host.LastIndexOf('.');
        if (lastDot <= 0 || lastDot == host.Length - 1)
        {
            return false;
        }
        var tld = host[(lastDot + 1)..];
        if (LocalTlds.Contains(tld))
        {
            return true;
        }
        return tld.Length >= 2 && tld.All(char.IsLetter);
    }

    public static string CleanUrl(string url)
    {
        if (string.IsNullOrEmpty(url))
        {
            return url;
        }
        if (!Uri.TryCreate(url, UriKind.Absolute, out var parsed))
        {
            return url;
        }
        if (parsed.Scheme != "http" && parsed.Scheme != "https")
        {
            return url;
        }
        var query = parsed.Query;
        if (string.IsNullOrEmpty(query))
        {
            return url;
        }
        var host = parsed.Host;
        var kept = new List<string>();
        foreach (var pair in query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var equals = pair.IndexOf('=');
            var name = equals >= 0 ? pair[..equals] : pair;
            string decoded;
            try
            {
                decoded = Uri.UnescapeDataString(name.Replace('+', ' ')).ToLowerInvariant();
            }
            catch
            {
                decoded = name.ToLowerInvariant();
            }
            if (!IsTrackingParam(decoded, host))
            {
                kept.Add(pair);
            }
        }
        var builder = new UriBuilder(parsed) { Query = kept.Count > 0 ? string.Join("&", kept) : string.Empty };
        return builder.Uri.ToString();
    }

    public static bool IsTrackingParam(string name, string hostname = "")
    {
        var key = name.ToLowerInvariant();
        if (GlobalParams.Contains(key))
        {
            return true;
        }
        if (GlobalPrefixes.Any(prefix => key.StartsWith(prefix, StringComparison.Ordinal)))
        {
            return true;
        }
        var host = hostname.ToLowerInvariant();
        if (host.StartsWith("www.", StringComparison.Ordinal))
        {
            host = host[4..];
        }
        foreach (var (hosts, parameters, prefixes) in SiteParams)
        {
            if (!hosts.Any(h => host == h || host.EndsWith("." + h, StringComparison.Ordinal)))
            {
                continue;
            }
            if (parameters.Contains(key))
            {
                return true;
            }
            if (prefixes.Any(prefix => key.StartsWith(prefix, StringComparison.Ordinal)))
            {
                return true;
            }
        }
        return false;
    }

    [GeneratedRegex("^[a-z0-9\\u00a1-\\uffff.-]+$", RegexOptions.IgnoreCase)]
    private static partial Regex HostChars();
}
