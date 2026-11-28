import { DIA_SPECTRUM, Meadow, meadowTextStyle, PowerUp, Text, reduceMotion, withAlpha, type MeadowTone } from "../ui";
import {
  playIntroMusic,
  setIntroMusicMuted,
  stopIntroMusic,
  type IntroMusicCues,
  introMusicMuted,
  saveIntroMusicMuted,
} from "../../state/onboarding/onboarding";
import { isWebDemo } from "../../state/onboarding/demoSteps";
import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";
import { useTheme } from "../ui/theme";
import { CircleButton, SecondaryButton } from "./Buttons";
import { useOnboardingColors } from "./Parts";
import { curve, springs } from "../ui/motion";
import { ink as inkColors, space } from "../ui/tokens";
import { onboardingMotion, onboardingType } from "./tokens";

const WORDMARK = "UniVerse Project Browser";
const ICON = require("../../../assets/app-icon.png");

const LETTER = 0.52;
const TAGLINE = 0.6;
const EXIT = 0.65;
const CUES: IntroMusicCues = (() => {
  const icon = 0.25;
  const letters = 1.15;
  const letterStep = 0.055;
  const letterCount = WORDMARK.length;
  const tagline = letters + (letterCount - 1) * letterStep + LETTER + 0.15;
  const exit = tagline + TAGLINE + 1.1;
  return { icon, letters, letterStep, letterCount, tagline, exit, end: exit + EXIT };
})();

const ms = (s: number) => Math.round(s * 1000);
const OPENING_TONE: Record<"day" | "night", MeadowTone> = { day: { tone: "light", halo: 0 }, night: { tone: "dark", halo: 0 } };

const DISK = 148;
const RING = 180;
const ORBIT = 26000;
const ORBIT_BACK = 42000;
const HALO = 1600;
const ACCENT = DIA_SPECTRUM[0]!;
const HOTSPOT = DIA_SPECTRUM[3]!;
const HOTSPOT_SIZE = 6;

type Star = { left: `${number}%`; top: `${number}%`; size: number; drift: number; phase: number };

const STARFIELD: Star[] = [
  { left: "6%", top: "10%", size: 3, drift: 9000, phase: 0 },
  { left: "18%", top: "24%", size: 2, drift: 11000, phase: 0.3 },
  { left: "88%", top: "8%", size: 3, drift: 8000, phase: 0.6 },
  { left: "78%", top: "18%", size: 2, drift: 12000, phase: 0.15 },
  { left: "12%", top: "78%", size: 3, drift: 10000, phase: 0.45 },
  { left: "24%", top: "88%", size: 2, drift: 7000, phase: 0.75 },
  { left: "85%", top: "82%", size: 3, drift: 11000, phase: 0.2 },
  { left: "70%", top: "90%", size: 2, drift: 9000, phase: 0.5 },
  { left: "92%", top: "55%", size: 2, drift: 13000, phase: 0.8 },
  { left: "4%", top: "48%", size: 3, drift: 8000, phase: 0.1 },
  { left: "30%", top: "6%", size: 2, drift: 10000, phase: 0.65 },
  { left: "62%", top: "4%", size: 3, drift: 12000, phase: 0.35 },
  { left: "45%", top: "92%", size: 2, drift: 9000, phase: 0.9 },
  { left: "55%", top: "8%", size: 2, drift: 11000, phase: 0.25 },
];

export function Intro({ onDone }: { onDone: () => void }) {
  const colors = useOnboardingColors();
  const theme = useTheme();
  const dark = theme.dark;
  const accent = theme.powerUpColor ?? ACCENT;
  const icon = useRef(new Animated.Value(0)).current;
  const letters = useRef([...WORDMARK].map(() => new Animated.Value(0))).current;
  const tagline = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const orbitBack = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const starDrift = useRef(STARFIELD.map((star) => new Animated.Value(star.phase))).current;
  const done = useRef(false);
  const [muted, setMuted] = useState(introMusicMuted);
  const [tone, setTone] = useState(() => OPENING_TONE[dark ? "night" : "day"]);
  const ink = isWebDemo ? null : meadowTextStyle(tone);
  const starColor = dark ? inkColors.white : accent;

  const finish = () => {
    if (done.current) return;
    done.current = true;
    onDone();
  };

  useEffect(() => {
    const ease = curve.enter;
    const at = (s: number) => ({ delay: ms(s), useNativeDriver: true });
    const sequence = Animated.parallel([
      Animated.spring(icon, { toValue: 1, ...springs.smooth, ...at(CUES.icon) }),
      ...letters.map((l, i) =>
        Animated.timing(l, { toValue: 1, duration: ms(LETTER), easing: ease, ...at(CUES.letters + i * CUES.letterStep) }),
      ),
      Animated.timing(tagline, { toValue: 1, duration: ms(TAGLINE), easing: ease, ...at(CUES.tagline) }),
      Animated.timing(exit, { toValue: 1, duration: ms(EXIT), easing: curve.move, ...at(CUES.exit) }),
    ]);
    playIntroMusic(CUES, introMusicMuted());
    sequence.start(({ finished }) => finished && finish());
    return () => sequence.stop();
  }, []);

  useEffect(() => {
    if (reduceMotion()) return;
    const loops = [
      Animated.loop(Animated.timing(orbit, { toValue: 1, duration: ORBIT, easing: curve.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(orbitBack, { toValue: 1, duration: ORBIT_BACK, easing: curve.linear, useNativeDriver: true })),
      Animated.loop(
        Animated.sequence([
          Animated.timing(halo, { toValue: 1, duration: HALO, easing: curve.pulse, useNativeDriver: true }),
          Animated.timing(halo, { toValue: 0, duration: HALO, easing: curve.pulse, useNativeDriver: true }),
        ]),
      ),
      ...starDrift.map((value, i) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(value, { toValue: 1, duration: STARFIELD[i]!.drift / 2, easing: curve.pulse, useNativeDriver: true }),
            Animated.timing(value, { toValue: 0, duration: STARFIELD[i]!.drift / 2, easing: curve.pulse, useNativeDriver: true }),
          ]),
        ),
      ),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, []);

  const skip = () => {
    stopIntroMusic(0.35);
    Animated.timing(exit, { toValue: 1, duration: onboardingMotion.introSkip, easing: curve.enter, useNativeDriver: true }).start(finish);
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setIntroMusicMuted(next);
    saveIntroMusicMuted(next);
  };

  const muteLabel = muted ? "Unmute intro music" : "Mute intro music";
  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.background,
          alignItems: "center",
          justifyContent: "center",
          opacity: exit.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
        },
      ]}
    >
      {isWebDemo ? (
        <PowerUp palette={DIA_SPECTRUM} speed={0.8} origin={0.5} style={[StyleSheet.absoluteFill, { opacity: dark ? 0.9 : 0.6 }]} />
      ) : (
        <Meadow night={dark} onTone={setTone} style={StyleSheet.absoluteFill} />
      )}
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: dark ? 0.5 : 0.35 }]}>
        {STARFIELD.map((star, i) => (
          <Animated.View
            key={i}
            style={{
              position: "absolute",
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              borderRadius: star.size / 2,
              backgroundColor: starColor,
              opacity: starDrift[i]!.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.15, 0.85, 0.15] }),
              transform: [{ translateY: starDrift[i]!.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }],
            }}
          />
        ))}
      </View>
      <Animated.View
        style={{
          alignItems: "center",
          gap: space.xl,
          transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        }}
      >
        <Animated.View
          style={{
            opacity: icon.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
            transform: [{ scale: icon.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
          }}
        >
          <View style={{ width: RING, height: RING, alignItems: "center", justifyContent: "center" }}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: DISK,
                height: DISK,
                borderRadius: DISK / 2,
                borderWidth: 1,
                borderColor: withAlpha(accent, 0.5),
                opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }],
              }}
            />
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: DISK,
                height: DISK,
                transform: [{ rotate: orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
              }}
            >
              <View
                style={{
                  width: DISK,
                  height: DISK,
                  borderRadius: DISK / 2,
                  borderWidth: 2,
                  borderColor: inkColors.clear,
                  borderTopColor: accent,
                  borderRightColor: withAlpha(accent, 0.4),
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: DISK / 2 - HOTSPOT_SIZE / 2,
                  top: -HOTSPOT_SIZE / 2,
                  width: HOTSPOT_SIZE,
                  height: HOTSPOT_SIZE,
                  borderRadius: HOTSPOT_SIZE / 2,
                  backgroundColor: HOTSPOT,
                }}
              />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                width: RING,
                height: RING,
                borderRadius: RING / 2,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: withAlpha(accent, 0.35),
                transform: [{ rotate: orbitBack.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] }) }],
              }}
            />
            <Image source={ICON} style={{ width: 96, height: 96 }} />
          </View>
        </Animated.View>
        <View style={{ flexDirection: "row" }} accessibilityLabel={WORDMARK}>
          {[...WORDMARK].map((ch, i) => (
            <Animated.Text
              key={i}
              style={{
                ...onboardingType.wordmark,
                color: colors.title,
                ...ink,
                opacity: letters[i],
                transform: [{ translateY: letters[i]!.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              }}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>
        <Animated.View style={{ opacity: tagline, transform: [{ translateY: tagline.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
          <Text color={colors.subtitle} style={[onboardingType.tagline, ink]}>
            Your new home on the internet
          </Text>
        </Animated.View>
      </Animated.View>
      <View style={{ position: "absolute", left: 28, bottom: 28 }}>
        <CircleButton
          title={muteLabel}
          tooltip={muteLabel}
          icon={muted ? "speaker.slash.fill" : "speaker.wave.3.fill"}
          size={13}
          symbolWeight="medium"
          box={20}
          onPress={toggleMute}
        />
      </View>
      <View style={{ position: "absolute", right: 28, bottom: 28 }} accessibilityHint="Button that skips the onboarding intro animation">
        <SecondaryButton title="Skip" onPress={skip} />
      </View>
    </Animated.View>
  );
}
