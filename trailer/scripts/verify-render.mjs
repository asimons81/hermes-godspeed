import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const trailerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const output = path.join(trailerRoot, "out", "hermes-godspeed-launch-trailer.mp4");

const probe = () =>
  new Promise((resolve, reject) => {
    const child = spawn(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate", "-of", "json", output],
      { cwd: trailerRoot, shell: false },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(JSON.parse(stdout));
      else reject(new Error(`ffprobe failed with ${code}: ${stderr}`));
    });
  });

const result = await probe();
const duration = Number(result.format?.duration);
const video = result.streams?.find((stream) => stream.codec_type === "video");
const audio = result.streams?.find((stream) => stream.codec_type === "audio");

// AAC priming/padding can extend the MP4 container by a few hundredths of a second.
if (Math.abs(duration - 45) > 0.1) throw new Error(`Expected a 45-second trailer, received ${duration}`);
if (video?.codec_name !== "h264" || video.width !== 1920 || video.height !== 1080 || video.r_frame_rate !== "60/1") {
  throw new Error(`Unexpected video stream: ${JSON.stringify(video)}`);
}
if (audio?.codec_name !== "aac") throw new Error(`Unexpected audio stream: ${JSON.stringify(audio)}`);

console.log(JSON.stringify({ output, duration, video, audio, size: Number(result.format?.size) }, null, 2));
