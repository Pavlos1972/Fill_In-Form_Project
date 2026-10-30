const { chromium } = require((process.argv[2]) + '/playwright');
const dir = process.argv[3], wav = process.argv[4];
const mk = body => `
export const env = {};
export async function pipeline(task, id, opts) {
  const dt = JSON.stringify(opts.dtype);
  ${body}
  opts.progress_callback({ status: 'progress', file: id + dt, loaded: 10, total: 10 });
  return async (audio, o) => ({ text: ' ' + id.split('/')[1] + ' ' + opts.device + ' ' + dt + ' heard ' + audio.length + ' tokens ' + o.max_new_tokens });
}`;
const scenarios = {
  'q8 file missing -> q4 works': mk("if (id.includes('moonshine') && opts.dtype && opts.dtype.decoder_model_merged === 'q8') throw new Error('Could not locate file: decoder_model_merged_quantized.onnx (404)');"),
  'moonshine cannot start at all -> Whisper Tiny': mk("if (id.includes('moonshine')) throw new Error('Unsupported model type: moonshine');"),
  'no internet': mk("throw new Error('Failed to fetch');"),
  'everything works first time': mk('')
};
(async () => {
  for (const name of Object.keys(scenarios)) {
    const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--use-file-for-fake-audio-capture=' + wav] });
    const p = await (await b.newContext({ viewport: { width: 1300, height: 700 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto('file://' + dir + '/index.html');
    await p.evaluate(src => { const o = FF.listen.create; FF.listen.create = x => o(Object.assign({}, x, { lib: 'data:text/javascript,' + encodeURIComponent(src) })); }, scenarios[name]);
    await p.click('#btnListen'); await p.waitForTimeout(5500);
    console.log('## ' + name + '\n  ', JSON.stringify(await p.evaluate(() => ({ btn: document.querySelector('#lnLabel').textContent, status: document.querySelector('#heardStatus').textContent, heard: document.querySelector('#heardText').textContent }))), errs.length ? errs : '');
    await b.close();
  }
})();
