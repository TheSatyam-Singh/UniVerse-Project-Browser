using System.Runtime.InteropServices;

namespace UniVerseProjectBrowser.Services;

public sealed class UpdateService
{
    private bool _initialized;

    public bool IsAvailable { get; private set; }

    public void Initialize()
    {
        if (_initialized)
        {
            return;
        }
        _initialized = true;
        try
        {
            var settings = SettingsService.Shared;
            NativeMethods.win_sparkle_set_appcast_url(settings.UpdateAppcastUrl);
            NativeMethods.win_sparkle_set_app_details("UniVerse", "UniVerse Project Browser", "0.2.47");
            if (!string.IsNullOrEmpty(settings.UpdateEdDSAPublicKey))
            {
                NativeMethods.win_sparkle_set_eddsa_public_key(settings.UpdateEdDSAPublicKey);
            }
            NativeMethods.win_sparkle_init();
            IsAvailable = true;
        }
        catch (DllNotFoundException)
        {
            IsAvailable = false;
        }
        catch (EntryPointNotFoundException)
        {
            IsAvailable = false;
        }
    }

    public void CheckForUpdatesInBackground()
    {
        if (!IsAvailable)
        {
            return;
        }
        try
        {
            NativeMethods.win_sparkle_check_update_without_ui();
        }
        catch (DllNotFoundException)
        {
            IsAvailable = false;
        }
    }

    public void CheckForUpdatesWithUi()
    {
        if (!IsAvailable)
        {
            return;
        }
        try
        {
            NativeMethods.win_sparkle_check_update_with_ui();
        }
        catch (DllNotFoundException)
        {
            IsAvailable = false;
        }
    }

    public void Shutdown()
    {
        if (!IsAvailable)
        {
            return;
        }
        try
        {
            NativeMethods.win_sparkle_cleanup();
        }
        catch (DllNotFoundException)
        {
            IsAvailable = false;
        }
    }

    private static class NativeMethods
    {
        [DllImport("WinSparkle.dll", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl)]
        public static extern void win_sparkle_init();

        [DllImport("WinSparkle.dll", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl)]
        public static extern void win_sparkle_cleanup();

        [DllImport("WinSparkle.dll", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl)]
        public static extern void win_sparkle_set_appcast_url(string url);

        [DllImport("WinSparkle.dll", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl)]
        public static extern void win_sparkle_set_app_details(string companyName, string appName, string appVersion);

        [DllImport("WinSparkle.dll", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl)]
        public static extern void win_sparkle_set_eddsa_public_key(string publicKey);

        [DllImport("WinSparkle.dll", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl)]
        public static extern void win_sparkle_check_update_with_ui();

        [DllImport("WinSparkle.dll", CharSet = CharSet.Ansi, CallingConvention = CallingConvention.Cdecl)]
        public static extern void win_sparkle_check_update_without_ui();
    }
}
