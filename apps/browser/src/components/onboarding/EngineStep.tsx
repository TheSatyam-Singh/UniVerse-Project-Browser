import { View } from "react-native";
import { space } from "../ui/tokens";
import { ENGINE_NAMES, type PageEngine } from "../../state/engines/engines";
import { setOnboardingDraft, useOnboarding } from "../../state/onboarding/onboarding";
import { keysOf, useQuestions } from "../../state/onboarding/questions";
import { useMockFocus } from "./ChoiceList";
import { Page } from "./LayoutSteps";
import { OptionCard } from "./OptionCard";
import { MockPanel, useScreen } from "./Screen";

const KEYS = keysOf("engine");

const ENGINE_CHOICES: { value: PageEngine; title: string; subtitle: string }[] = [
  { value: "chromium", title: "Chromium", subtitle: "Fast and full-featured. Extensions, DevTools, and most sites work best here." },
  { value: "webkit", title: "WebKit", subtitle: "Safari's engine. Best when a site needs FairPlay video or Safari-only features." },
];

export function EngineStep() {
  const sub = useOnboarding((s) => s.sub);
  const id = useQuestions("engine")[sub]?.id;
  const focus = useMockFocus(id);
  const { values, mock } = useScreen(KEYS);
  const engine = values.pageEngine;
  return (
    <Page
      id="browserEngine"
      title="Which engine renders your pages?"
      subtitle="Chromium is the default. WebKit steps in for sites that need it, like FairPlay video. Change it any time in Settings › Engines."
      patch={{ pageEngine: engine }}
      picked={[`Default engine: ${ENGINE_NAMES[engine]}`]}
      preview={<MockPanel settings={mock} focus={focus.focus} />}
    >
      <View style={{ gap: space.ml }}>
        {ENGINE_CHOICES.map((c) => (
          <OptionCard key={c.value} control="radio" title={c.title} subtitle={c.subtitle} selected={engine === c.value} onPress={() => setOnboardingDraft({ pageEngine: c.value })} />
        ))}
      </View>
    </Page>
  );
}
