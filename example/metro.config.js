const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const listRoot = path.resolve(projectRoot, '../src');
const flashList = path.resolve(projectRoot, '../packages/flashlist-autolayout');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [listRoot,flashList];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

config.resolver.extraNodeModules = {
    "flashlist-autolayout": path.resolve(flashList),
}
module.exports = config;