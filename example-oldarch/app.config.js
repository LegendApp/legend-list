const RELEASE = process.env.RELEASE === 'TRUE';

export default ({ config }) => {
    const architectureSuffix = '.o';
    const bundleIdentifier = `com.legendapp.listtest${architectureSuffix}${RELEASE ? '.r' : ''}`;
    return {
        ...config,
        newArchEnabled: false,
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
        name: `list-test-o${RELEASE ? '-r' : ''}`,
    };
};
