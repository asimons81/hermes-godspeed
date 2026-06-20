import "./index.css";
import { Composition } from "remotion";
import { HermesGodspeedTrailer } from "./Composition";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="HermesGodspeedTrailer"
        component={HermesGodspeedTrailer}
        durationInFrames={2700}
        fps={60}
        width={1920}
        height={1080}
      />
    </>
  );
};
