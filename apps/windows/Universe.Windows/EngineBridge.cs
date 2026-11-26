using System.Runtime.InteropServices;
using System.Threading.Tasks;

namespace Universe.Windows;

[ClassInterface(ClassInterfaceType.AutoDual)]
[ComVisible(true)]
public sealed class EngineBridge
{
    private readonly TabHost tabs;

    public EngineBridge(TabHost tabs)
    {
        this.tabs = tabs;
    }

    public Task<string> EngineCall(string domain, string name, string profile, string argsJson)
    {
        return Task.FromResult(tabs.HandleEngineCall(domain, name, profile, argsJson));
    }

    public Task<string> CreateTab(string tabId, string profile)
    {
        return Task.FromResult(tabs.CreateTab(tabId, profile));
    }

    public Task DestroyTab(string tabId)
    {
        tabs.DestroyTab(tabId);
        return Task.CompletedTask;
    }

    public Task Navigate(string tabId, string url)
    {
        tabs.Navigate(tabId, url);
        return Task.CompletedTask;
    }

    public Task GoBack(string tabId)
    {
        tabs.GoBack(tabId);
        return Task.CompletedTask;
    }

    public Task GoForward(string tabId)
    {
        tabs.GoForward(tabId);
        return Task.CompletedTask;
    }

    public Task Reload(string tabId)
    {
        tabs.Reload(tabId);
        return Task.CompletedTask;
    }

    public Task Stop(string tabId)
    {
        tabs.Stop(tabId);
        return Task.CompletedTask;
    }

    public Task SetTabVisible(string tabId, bool visible)
    {
        tabs.SetTabVisible(tabId, visible);
        return Task.CompletedTask;
    }

    public Task SetMuted(string tabId, bool muted)
    {
        tabs.SetMuted(tabId, muted);
        return Task.CompletedTask;
    }

    public Task ZoomStep(string tabId, int direction)
    {
        tabs.ZoomStep(tabId, direction);
        return Task.CompletedTask;
    }

    public Task<string> Evaluate(string tabId, string code)
    {
        return tabs.Evaluate(tabId, code);
    }

    public Task<string> NavigationEntries(string tabId)
    {
        return Task.FromResult(tabs.NavigationEntries(tabId));
    }

    public Task<string> GetSecurityInfo(string tabId)
    {
        return Task.FromResult(tabs.GetSecurityInfo(tabId));
    }
}
