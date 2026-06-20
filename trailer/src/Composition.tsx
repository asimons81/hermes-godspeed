import type { CSSProperties, ReactNode } from "react";
import { Audio, Video } from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  ink: "#050814",
  navy: "#071332",
  gold: "#ffd86d",
  cyan: "#65f4ff",
  orange: "#ff6241",
  violet: "#b990ff",
  white: "#fff8e6",
};

const clamp = {
  extrapolateLeft: "clamp",
  extrapolateRight: "clamp",
} as const;

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);
const asset = (path: string) => staticFile(`generated/assets/${path}`);
const media = (path: string) => staticFile(`generated/media/${path}`);
const audio = (path: string) => staticFile(`generated/audio/${path}`);

const fill: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const Title = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      color: COLORS.white,
      fontFamily: '"Arial Black", Impact, sans-serif',
      fontWeight: 900,
      letterSpacing: "-0.04em",
      lineHeight: 0.92,
      textTransform: "uppercase",
      textShadow: "0 10px 40px rgba(0,0,0,0.82)",
      ...style,
    }}
  >
    {children}
  </div>
);

const FilmFrame = ({ children }: { children: ReactNode }) => (
  <AbsoluteFill style={{ backgroundColor: COLORS.ink, overflow: "hidden" }}>
    {children}
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background:
          "radial-gradient(circle at center, transparent 44%, rgba(5,8,20,0.24) 72%, rgba(5,8,20,0.86) 100%)",
      }}
    />
    <AbsoluteFill style={{ pointerEvents: "none", justifyContent: "space-between" }}>
      <div style={{ height: 72, background: COLORS.ink }} />
      <div style={{ height: 72, background: COLORS.ink }} />
    </AbsoluteFill>
  </AbsoluteFill>
);

const SpeedLines = ({ strength = 1 }: { strength?: number }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: 18 }).map((_, index) => (
        <div
          key={index}
          style={{
            position: "absolute",
            top: 110 + ((index * 59 + frame * (7 + index / 3)) % 850),
            left: ((frame * (15 + index) + index * 211) % 2320) - 380,
            width: 160 + index * 14,
            height: 3,
            opacity: (0.08 + (index % 4) * 0.045) * strength,
            transform: "skewX(-18deg)",
            background: `linear-gradient(90deg, transparent, ${index % 3 === 0 ? COLORS.gold : COLORS.cyan})`,
            boxShadow: `0 0 14px ${COLORS.cyan}`,
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

const Flash = ({ color = COLORS.gold }: { color?: string }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 5, 22], [0.7, 0.18, 0], clamp);
  return <AbsoluteFill style={{ background: color, mixBlendMode: "screen", opacity }} />;
};

const Footage = ({
  source,
  trimSeconds,
  rate = 1,
  zoom = 1.035,
}: {
  source: string;
  trimSeconds: number;
  rate?: number;
  zoom?: number;
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const drift = Math.sin(frame / 44) * 0.004;
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.ink, overflow: "hidden" }}>
      <Video
        src={media(source)}
        trimBefore={Math.round(trimSeconds * fps)}
        playbackRate={rate}
        muted
        objectFit="cover"
        style={{
          width: "100%",
          height: "100%",
          transform: `scale(${zoom + drift})`,
          filter: "contrast(1.09) saturate(1.12) brightness(0.98)",
        }}
      />
      <AbsoluteFill
        style={{
          background: "linear-gradient(180deg, rgba(5,8,20,0.2), transparent 30%, transparent 70%, rgba(5,8,20,0.5))",
        }}
      />
    </AbsoluteFill>
  );
};

const KineticCopy = ({
  kicker,
  headline,
  accent = COLORS.cyan,
  align = "left",
}: {
  kicker: string;
  headline: string;
  accent?: string;
  align?: "left" | "right";
}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 24], [0, 1], { ...clamp, easing: easeOut });
  const exit = interpolate(frame, [120, 150], [1, 0], clamp);
  const visible = Math.min(enter, exit);
  return (
    <div
      style={{
        position: "absolute",
        left: align === "left" ? 120 : undefined,
        right: align === "right" ? 120 : undefined,
        bottom: 122,
        width: 780,
        opacity: visible,
        textAlign: align,
        transform: `translateX(${(align === "left" ? -70 : 70) * (1 - enter)}px)`,
      }}
    >
      <div
        style={{
          color: accent,
          fontFamily: "Arial, sans-serif",
          fontSize: 22,
          fontWeight: 900,
          letterSpacing: "0.18em",
          marginBottom: 14,
          textTransform: "uppercase",
        }}
      >
        {kicker}
      </div>
      <Title style={{ fontSize: 70 }}>{headline}</Title>
    </div>
  );
};

const TitleStrike = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 32, 180], [1.18, 1, 1.035], { ...clamp, easing: easeOut });
  const titleY = interpolate(frame, [0, 30], [80, 0], { ...clamp, easing: easeOut });
  const reveal = interpolate(frame, [4, 42], [0, 1], clamp);
  return (
    <FilmFrame>
      <Img src={asset("cutscene/intro-title-backdrop.jpg")} style={{ ...fill, transform: `scale(${scale})` }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,8,20,0.9), rgba(5,8,20,0.2), rgba(5,8,20,0.86))" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", transform: `translateY(${titleY}px)` }}>
        <Img
          src={asset("favicon.svg")}
          style={{
            width: 128,
            height: 128,
            marginBottom: 24,
            opacity: reveal,
            filter: `drop-shadow(0 0 28px ${COLORS.cyan})`,
          }}
        />
        <Title style={{ color: COLORS.gold, fontSize: 116 }}>Hermes: Godspeed</Title>
        <div
          style={{
            color: COLORS.cyan,
            fontFamily: "Arial, sans-serif",
            fontSize: 27,
            fontWeight: 900,
            letterSpacing: "0.22em",
            marginTop: 24,
            opacity: interpolate(frame, [40, 68], [0, 1], clamp),
            textTransform: "uppercase",
          }}
        >
          Run the relay
        </div>
      </AbsoluteFill>
      <SpeedLines strength={0.7} />
      <Sequence durationInFrames={28} premountFor={30}>
        <Flash />
      </Sequence>
    </FilmFrame>
  );
};

const setupFrames = [
  ["cutscene/intro-olympus-signal.jpg", "Olympus lost the signal", COLORS.cyan],
  ["cutscene/intro-openclaw-surge.jpg", "OpenClaw took the road", COLORS.orange],
  ["cutscene/intro-hermes-launch.jpg", "Hermes took the keys", COLORS.gold],
  ["cutscene/intro-godspeed-run.jpg", "And floored it", COLORS.violet],
] as const;

const SetupBeat = ({ image, copy, accent }: { image: string; copy: string; accent: string }) => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 82], [1.04, 1.13], clamp);
  return (
    <AbsoluteFill>
      <Img src={asset(image)} style={{ ...fill, transform: `scale(${scale})`, filter: "contrast(1.08) saturate(1.1)" }} />
      <AbsoluteFill style={{ background: "linear-gradient(90deg, rgba(5,8,20,0.82), transparent 58%)" }} />
      <div style={{ position: "absolute", left: 120, bottom: 132 }}>
        <div style={{ width: 72, height: 5, background: accent, boxShadow: `0 0 18px ${accent}`, marginBottom: 18 }} />
        <Title style={{ fontSize: 58 }}>{copy}</Title>
      </div>
    </AbsoluteFill>
  );
};

const MythTechSetup = () => (
  <FilmFrame>
    {setupFrames.map(([image, copy, accent], index) => (
      <Sequence key={image} from={index * 75} durationInFrames={82} premountFor={30}>
        <SetupBeat image={image} copy={copy} accent={accent} />
      </Sequence>
    ))}
  </FilmFrame>
);

const GameplayShowcase = () => (
  <FilmFrame>
    <Footage source="showcase.mp4" trimSeconds={1.5} />
    <SpeedLines strength={0.45} />
    {[
      [20, "Three lanes", "Pick a line", COLORS.cyan, "left"],
      [315, "No brakes", "Jump the faults", COLORS.gold, "right"],
      [610, "Stay low", "Slide the sparks", COLORS.orange, "left"],
      [905, "Feed the combo", "Chain the chomp", COLORS.violet, "right"],
    ].map(([from, kicker, headline, accent, align]) => (
      <Sequence key={String(headline)} from={Number(from)} durationInFrames={160} premountFor={30}>
        <KineticCopy
          kicker={String(kicker)}
          headline={String(headline)}
          accent={String(accent)}
          align={align as "left" | "right"}
        />
      </Sequence>
    ))}
  </FilmFrame>
);

const PowerupGrid = () => {
  const frame = useCurrentFrame();
  const powers = [
    ["powerups/chomp-relic.png", "Chomp"],
    ["powerups/sandals-relic.png", "Sandals"],
    ["powerups/goblet-relic.png", "Triple score"],
    ["powerups/bolt-relic.png", "Zeus bolt"],
    ["powerups/magnet-relic.png", "Magnet"],
  ];
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", background: "rgba(5,8,20,0.84)" }}>
      <div style={{ color: COLORS.cyan, fontFamily: "Arial, sans-serif", fontSize: 22, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase" }}>
        Five divine powerups
      </div>
      <Title style={{ fontSize: 72, marginTop: 16 }}>Break the rules</Title>
      <div style={{ display: "flex", gap: 28, marginTop: 54 }}>
        {powers.map(([path, label], index) => {
          const pop = interpolate(frame, [index * 9, index * 9 + 24], [0.72, 1], { ...clamp, easing: easeOut });
          return (
            <div key={path} style={{ width: 220, textAlign: "center", transform: `scale(${pop})` }}>
              <div style={{ alignItems: "center", background: "rgba(16,35,106,0.82)", border: `2px solid ${COLORS.gold}`, borderRadius: 28, display: "flex", height: 210, justifyContent: "center", boxShadow: `0 0 32px rgba(101,244,255,0.22)` }}>
                <Img src={asset(path)} style={{ maxWidth: 170, maxHeight: 170 }} />
              </div>
              <div style={{ color: COLORS.white, fontFamily: "Arial, sans-serif", fontSize: 20, fontWeight: 900, marginTop: 15, textTransform: "uppercase" }}>{label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

const FeatureRun = () => (
  <FilmFrame>
    <Sequence durationInFrames={240} premountFor={30}>
      <Footage source="features.mp4" trimSeconds={0.2} zoom={1.1} />
      <KineticCopy kicker="Every run matters" headline="Missions. Unlocks. Stats." accent={COLORS.gold} />
    </Sequence>
    <Sequence from={240} durationInFrames={240} premountFor={30}>
      <Img src={asset("environment/myth-tech-roadway-game.jpg")} style={fill} />
      <PowerupGrid />
    </Sequence>
    <Sequence from={480} durationInFrames={120} premountFor={30}>
      <Footage source="showcase.mp4" trimSeconds={18.2} rate={1.08} zoom={1.055} />
      <KineticCopy kicker="Route shift" headline="Choose the risk" accent={COLORS.violet} align="right" />
    </Sequence>
  </FilmFrame>
);

const Climax = () => (
  <FilmFrame>
    <Footage source="showcase.mp4" trimSeconds={22.2} rate={1.18} zoom={1.07} />
    <AbsoluteFill style={{ background: "rgba(255,98,65,0.08)", mixBlendMode: "screen" }} />
    <SpeedLines strength={1.3} />
    <KineticCopy kicker="Godspeed" headline="One hit. Keep moving." accent={COLORS.orange} align="right" />
    <Sequence from={170} durationInFrames={42} premountFor={30}>
      <Flash color={COLORS.orange} />
    </Sequence>
  </FilmFrame>
);

const FinalHit = () => {
  const frame = useCurrentFrame();
  const scale = interpolate(frame, [0, 36, 180], [1.12, 1, 1.025], { ...clamp, easing: easeOut });
  const opacity = interpolate(frame, [0, 18, 156, 180], [0, 1, 1, 0], clamp);
  return (
    <FilmFrame>
      <Img src={asset("cutscene/intro-title-backdrop.jpg")} style={{ ...fill, transform: `scale(${scale})` }} />
      <AbsoluteFill style={{ background: "rgba(5,8,20,0.58)" }} />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity }}>
        <Title style={{ color: COLORS.gold, fontSize: 112 }}>Hermes: Godspeed</Title>
        <div style={{ color: COLORS.cyan, fontFamily: '"Arial Black", Impact, sans-serif', fontSize: 34, letterSpacing: "0.22em", marginTop: 30, textTransform: "uppercase" }}>
          One more run.
        </div>
      </AbsoluteFill>
      <SpeedLines strength={0.5} />
    </FilmFrame>
  );
};

export const HermesGodspeedTrailer = () => (
  <AbsoluteFill style={{ background: COLORS.ink }}>
    <Sequence durationInFrames={180} premountFor={60}>
      <TitleStrike />
    </Sequence>
    <Sequence from={180} durationInFrames={300} premountFor={60}>
      <MythTechSetup />
    </Sequence>
    <Sequence from={480} durationInFrames={1200} premountFor={60}>
      <GameplayShowcase />
    </Sequence>
    <Sequence from={1680} durationInFrames={600} premountFor={60}>
      <FeatureRun />
    </Sequence>
    <Sequence from={2280} durationInFrames={240} premountFor={60}>
      <Climax />
    </Sequence>
    <Sequence from={2520} durationInFrames={180} premountFor={60}>
      <FinalHit />
    </Sequence>
    <Audio src={audio("hermes-godspeed-score.wav")} volume={0.9} />
  </AbsoluteFill>
);
