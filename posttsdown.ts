import pkg from './package.json';

async function copy(...files: string[]) {
    return files.map((file) => Bun.write('dist/' + file.replace('src/', ''), Bun.file(file), { createPath: true }));
}

copy('LICENSE', 'CHANGELOG.md', 'README.md');

const exports: Record<string, string | { import?: string; require?: string; types: string }> = {
    './package.json': './package.json',
};

const pkgOut = pkg as Record<string, any>;

pkg.private = false;
pkgOut.exports = exports;
delete pkgOut.devDependencies;
delete pkgOut.overrides;
delete pkgOut.scripts;
delete pkgOut.engines;
delete pkgOut.exports;
delete pkgOut.commitlint;

Bun.write('dist/package.json', JSON.stringify(pkg, undefined, 2));
