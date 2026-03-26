const esbuild = require('esbuild');
const path = require('path');

async function build() {
  const entries = [
    { entry: 'src/background/index.ts', outfile: 'dist/background/index.js' },
    { entry: 'src/content/index.ts', outfile: 'dist/content/index.js' },
    { entry: 'src/offscreen/index.ts', outfile: 'dist/offscreen/index.js' },
    { entry: 'src/popup/index.ts', outfile: 'dist/popup/index.js' },
    { entry: 'src/inject.ts', outfile: 'dist/inject.js' },
  ];

  for (const { entry, outfile } of entries) {
    await esbuild.build({
      entryPoints: [path.join(__dirname, entry)],
      bundle: true,
      outfile: path.join(__dirname, outfile),
      format: 'iife',
      platform: 'browser',
      target: 'es2022',
      sourcemap: true,
    });
    console.log(`Built: ${outfile}`);
  }

  console.log('All files built successfully!');
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});