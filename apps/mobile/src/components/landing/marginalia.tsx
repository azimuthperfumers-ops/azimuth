import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Text as SvgText,
  TextPath,
} from "react-native-svg";

/**
 * Engraved apothecary + postal marks, drawn natively so they scale crisply and
 * carry no image weight. Shared by the mood cards (Postmark) and the quote band
 * (CompassRose) — the mobile echo of the web landing's visual language.
 */

export function Postmark({ size = 84, color = "#FAF6EE", opacity = 0.6 }: { size?: number; color?: string; opacity?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" opacity={opacity}>
      <Defs>
        {/* clockwise ring the label rides on */}
        <Path id="postmark-ring" d="M50,50 m-35,0 a35,35 0 1,1 70,0 a35,35 0 1,1 -70,0" fill="none" />
      </Defs>
      <Circle cx="50" cy="50" r="47" stroke={color} strokeWidth="1.2" fill="none" />
      <Circle cx="50" cy="50" r="29" stroke={color} strokeWidth="0.8" fill="none" />
      <SvgText fill={color} fontSize="7.4" fontWeight="700" letterSpacing="1.4">
        <TextPath href="#postmark-ring" startOffset="2">
          AZIMUTH · PERFUMERS · POST ·
        </TextPath>
      </SvgText>
      {/* cancellation waves through the middle */}
      <G stroke={color} strokeWidth="1" fill="none" strokeLinecap="round">
        <Path d="M22 45 q7 -5 14 0 t14 0 t14 0" />
        <Path d="M22 50 q7 -5 14 0 t14 0 t14 0" />
        <Path d="M22 55 q7 -5 14 0 t14 0 t14 0" />
      </G>
    </Svg>
  );
}

export function CompassRose({ size = 300, color = "#FAF6EE", opacity = 0.1 }: { size?: number; color?: string; opacity?: number }) {
  const ticks = Array.from({ length: 72 });
  return (
    <Svg width={size} height={size} viewBox="0 0 400 400" opacity={opacity}>
      <G stroke={color} fill="none">
        <Circle cx="200" cy="200" r="188" strokeWidth="1" />
        <Circle cx="200" cy="200" r="164" strokeWidth="0.75" />
        <Circle cx="200" cy="200" r="70" strokeWidth="0.75" />
        {ticks.map((_, i) => (
          <Line
            key={i}
            x1="200"
            y1="12"
            x2="200"
            y2={i % 6 === 0 ? "26" : "19"}
            strokeWidth={i % 6 === 0 ? 1.2 : 0.6}
            transform={`rotate(${i * 5} 200 200)`}
          />
        ))}
        {[0, 90, 180, 270].map((deg) => (
          <Path key={deg} d="M200 34 L212 200 L200 214 L188 200 Z" strokeWidth="1.2" transform={`rotate(${deg} 200 200)`} />
        ))}
        {[45, 135, 225, 315].map((deg) => (
          <Path key={deg} d="M200 96 L208 200 L200 208 L192 200 Z" strokeWidth="0.8" transform={`rotate(${deg} 200 200)`} />
        ))}
        <Circle cx="200" cy="200" r="5" strokeWidth="1.2" />
      </G>
    </Svg>
  );
}

export function VerifiedTick({ size = 13, color = "#9A5B2B" }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx="12" cy="12" r="11" fill="none" stroke={color} strokeWidth="1.6" />
      <Path d="M7 12.5 L10.5 16 L17 8.5" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}
