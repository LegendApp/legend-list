import { isFixturesMode } from "~/lib/appMode";
import AiChatExampleScreen from "~/screens/examples/ai-chat";
import AiChatFixtureScreen from "~/screens/fixtures/ai-chat";

export default function AiChatRoute() {
    return isFixturesMode() ? <AiChatFixtureScreen /> : <AiChatExampleScreen />;
}
