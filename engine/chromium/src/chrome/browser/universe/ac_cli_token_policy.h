// Copyright 2026 UniVerse. Apache-2.0.

#ifndef CHROME_BROWSER_UNIVERSE_AC_CLI_TOKEN_POLICY_H_
#define CHROME_BROWSER_UNIVERSE_AC_CLI_TOKEN_POLICY_H_

#include <memory>

#include "universe/core/ac_content_hooks.h"

namespace content {
class DevToolsAgentHost;
class DevToolsAgentHostClient;
class RenderFrameHost;
}

namespace universe {

std::unique_ptr<UniVerseDevToolsTokenClient> CreateTokenClient(
    content::DevToolsAgentHostClient* client,
    content::DevToolsAgentHost* host);

bool TokenClientMayAttach(content::DevToolsAgentHostClient* root_client,
                          content::DevToolsAgentHost* host);

bool TokenClientMayInput(content::DevToolsAgentHostClient* root_client,
                         content::RenderFrameHost* frame);

bool IsTokenClient(content::DevToolsAgentHostClient* root_client);

}

#endif
