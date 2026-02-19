const RELEASE = process.env.RELEASE === 'TRUE';

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
    };
};
