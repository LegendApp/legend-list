const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const listRoot = path.resolve(projectRoot, '../src');
const sharedExamplesRoot = path.resolve(projectRoot, '../examples-shared');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [listRoot, sharedExamplesRoot];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules'), path.resolve(listRoot, 'node_modules')];
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName.startsWith('@examples/')) {
        const relativePath = moduleName.slice('@examples/'.length);
        const targetPath = path.join(sharedExamplesRoot, relativePath);
        return context.resolveRequest(context, targetPath, platform);
    }

    return defaultResolveRequest
        ? defaultResolveRequest(context, moduleName, platform)
        : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
