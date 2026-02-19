const OLD_ARCH = process.env.OLD_ARCH === 'TRUE';
const RELEASE = process.env.RELEASE === 'TRUE';

export default ({ config }) => {
    const bundleIdentifier = `com.legendapp.listtest${OLD_ARCH ? '.o' : ''}${OLD_ARCH ? '.r' : ''}`;
    return {
        ...config,
        newArchEnabled: !OLD_ARCH,
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
        name: `list-test${OLD_ARCH ? '-o' : ''}${RELEASE ? '-r' : ''}`,
    };
};
