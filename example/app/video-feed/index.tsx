import { isFixturesMode } from "~/lib/appMode";
import VideoFeedExampleScreen from "~/screens/examples/video-feed";
import VideoFeedFixtureScreen from "~/screens/fixtures/video-feed";

export default function VideoFeedRoute() {
    return isFixturesMode() ? <VideoFeedFixtureScreen /> : <VideoFeedExampleScreen />;
}
