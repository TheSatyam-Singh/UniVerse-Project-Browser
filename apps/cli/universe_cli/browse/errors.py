POLICY_REFUSAL = "isn't allowed for the universe command"


class BrowseError(Exception):
    exit_code = 1

    def __init__(self, message: str, data: dict | None = None, code: str | None = None):
        super().__init__(message)
        self.message = message
        self.data = data
        self.code = code


class Unreachable(BrowseError):
    exit_code = 2


class ConnectionLost(BrowseError):
    exit_code = 2

    def __init__(self, message: str = "UniVerse Project Browser closed the connection (Stop was pressed, control was turned off, or UniVerse Project Browser quit)"):
        super().__init__(message, code="connection_lost")


class OutcomeUnknown(BrowseError):
    exit_code = 1

    def __init__(self, action: str, why: str):
        super().__init__(f"{why}; the outcome of {action} is unknown, so it wasn't retried", code="outcome_unknown")


class StaleRef(BrowseError):
    def __init__(self, ref: str, why: str):
        fix = "use that ref" if "is now @" in why else "Run `universe browse snapshot -i` again and use the new refs"
        super().__init__(f"Stale ref @{ref}: {why}. {fix[0].upper() + fix[1:]}", code="stale_ref")


NOT_A_WEB_TAB = "the tab is gone, isn't a web page (an UniVerse Project Browser or extension page), or is in a window UniVerse Project Browser keeps for itself"
REFUSAL_HINTS = {
    "to that target": NOT_A_WEB_TAB,
    "on that target": NOT_A_WEB_TAB,
    "to that URL": "only http, https, data and about:blank pages can be opened",
    "on a tab the universe command didn't open": "the viewport can be set only on a tab this command opened: `universe browse open <url>`, then set it there",
    "with that option": "only a width, a height, a scale and mobile can be set",
    "on a tab that isn't off-screen": "UniVerse Project Browser sets a viewport only on a tab it has taken off-screen, which `universe browse set viewport <w> <h>` does for a tab this session opened and never showed",
}


def refusal_reason(text: str, method: str) -> str:
    said = text.split(POLICY_REFUSAL, 1)[0]
    if method not in said:
        return ""
    return said.rsplit(method, 1)[1].strip()


class Gated(BrowseError):
    def __init__(self, method: str, command: str | None = None, detail: str | None = None, reason: str | None = None):
        self.method = method
        self.reason = reason or ""
        self.refusal = " ".join(part for part in (method, self.reason, POLICY_REFUSAL) if part)
        what = f"`{command}` needs {method}" if command else f"{method} is needed"
        if self.reason:
            hint = REFUSAL_HINTS.get(self.reason)
            message = f"{what}, which UniVerse Project Browser allows for the universe command, but not {self.reason} ({self.refusal})" + (f": {hint}" if hint else "")
        else:
            message = (
                f"{what}, which UniVerse Project Browser's universe-command policy refuses ({self.refusal}). "
                "It works once the engine's token policy allows it; until then only a plain DevTools test "
                "server (--port) accepts it"
            )
        super().__init__(message + (f" ({detail})" if detail else ""), data={"method": method, "reason": self.reason}, code="policy_refused")

    def during(self, command: str | None, detail: str | None = None) -> "Gated":
        return Gated(self.method, command, detail, self.reason)


class CdpError(BrowseError):
    def __init__(self, method: str, message: str):
        super().__init__(f"{method}: {message}")
        self.method = method
        self.cdp_message = message


class CdpTimeout(BrowseError):
    def __init__(self, method: str, seconds: float):
        super().__init__(f"{method} got no answer in {seconds:g}s")
        self.method = method


class Usage(BrowseError):
    pass
