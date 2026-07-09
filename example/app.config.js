const RELEASE = process.env.RELEASE === 'TRUE';
const legendListVersion = require("../package.json").version;
const expoVersion = require("./package.json").dependencies?.expo ?? "unknown";

export default ({ config }) => {
    const bundleIdentifier = 'com.legendapp.listtest';
    return {
        ...config,
        newArchEnabled: true,
        ios: {
            supportsTablet: true,
            bundleIdentifier,
        },
        android: {
            adaptiveIcon: {
                foregroundImage: './assets/images/adaptive-icon.png',
                backgroundColor: '#ffffff',
            },
            package: bundleIdentifier,
        },
        name: `list-test${RELEASE ? '-r' : ''}`,
        extra: {
            ...(config.extra ?? {}),
            legendListVersion,
            expoVersion,
        },
    };
};
