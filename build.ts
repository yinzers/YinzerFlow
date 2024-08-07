import dts from 'bun-plugin-dts';

await Bun.build({
  sourcemap: 'external',
  minify: false,
  entrypoints: ['./app/index.ts'],
  outdir: './lib',
  target: 'node',
  plugins: [
    dts({
      output: { noBanner: true, exportReferencedTypes: true },
    }),
  ],
});

const file = Bun.file(`${import.meta.dir}/lib/index.d.ts`);
const writer = file.writer();
let content = await file.text();

content = content.replace(/declare class/g, 'export declare class');

writer.write(content);
