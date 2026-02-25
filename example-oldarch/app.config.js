const OLD_ARCH = process.env.OLD_ARCH === 'TRUE';
const RELEASE = process.env.RELEASE === 'TRUE';

export default ({ config }) => {
    const architectureSuffix = OLD_ARCH ? '.o' : '.n';
    const bundleIdentifier = `com.legendapp.listtest${architectureSuffix}${RELEASE ? '.r' : ''}`;
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
        name: `list-test${OLD_ARCH ? '-o' : '-n'}${RELEASE ? '-r' : ''}`,
    };
};
