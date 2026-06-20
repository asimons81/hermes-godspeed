import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KokoroTTS } from 'kokoro-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outputPath = resolve(root, 'assets/cutscene/intro-narration.mp3');
const workDir = resolve(root, 'assets/cutscene/.intro-narration-work');
const modelId = 'onnx-community/Kokoro-82M-v1.0-ONNX';
const voice = process.env.HERMES_INTRO_VOICE ?? 'bm_fable';
const speed = Number(process.env.HERMES_INTRO_SPEED ?? '0.92');

const script = [
  { text: 'Olympus is losing its signal.', pauseAfterSeconds: 0.65 },
  { text: 'Open Claws jam the road to dawn.', pauseAfterSeconds: 0.75 },
  { text: 'Every stolen spark slows Olympus.', pauseAfterSeconds: 0.45 },
  { text: 'Hermes runs the relay.', pauseAfterSeconds: 0.75 },
  { text: 'Jump the faults.', pauseAfterSeconds: 0.3 },
  { text: 'Slide the sparks.', pauseAfterSeconds: 0.3 },
  { text: 'Chain the chomp.', pauseAfterSeconds: 0.45 },
  { text: 'Chase the laurel.', pauseAfterSeconds: 0.8 },
  { text: 'Hermes: Godspeed.', pauseAfterSeconds: 0.55 },
  { text: 'One more run.', pauseAfterSeconds: 0.35 }
];

await mkdir(dirname(outputPath), { recursive: true });
await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });

console.log(`Generating intro narration with ${modelId}, voice ${voice}, speed ${speed}.`);
const tts = await KokoroTTS.from_pretrained(modelId, {
  dtype: 'q8',
  device: 'cpu'
});

const concatEntries = [];
for (const [index, line] of script.entries()) {
  const segmentPath = resolve(workDir, `segment-${String(index).padStart(2, '0')}.wav`);
  const silencePath = resolve(workDir, `silence-${String(index).padStart(2, '0')}.wav`);
  const audio = await tts.generate(line.text, { voice, speed });
  audio.save(segmentPath);
  concatEntries.push(segmentPath);

  await run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'anullsrc=r=24000:cl=mono',
    '-t',
    String(line.pauseAfterSeconds),
    silencePath
  ]);
  concatEntries.push(silencePath);
}

const concatPath = resolve(workDir, 'concat.txt');
await writeFile(
  concatPath,
  concatEntries.map((path) => `file '${path.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'),
  'utf8'
);

await run('ffmpeg', [
  '-y',
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'concat',
  '-safe',
  '0',
  '-i',
  concatPath,
  '-af',
  'loudnorm=I=-18:LRA=9:TP=-1.5',
  '-codec:a',
  'libmp3lame',
  '-b:a',
  '128k',
  outputPath
]);

await rm(workDir, { recursive: true, force: true });
console.log(`Wrote ${outputPath}`);

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', rejectRun);
    child.on('exit', (code) => {
      if (code === 0) {
        resolveRun();
        return;
      }

      rejectRun(new Error(`${command} exited with code ${code}`));
    });
  });
}
