import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useBrowser } from "../../state/browser/store";
import { updateSettings } from "../../state/settings/actions";
import { Text, radius, space, useTheme, withAlpha } from "../ui";

type EntityKind = "rock" | "buoy" | "rival" | "coin" | "star" | "heart";
type Entity = { id: number; kind: EntityKind; x: number; y: number; r: number; vx: number };
type Phase = "menu" | "playing" | "paused" | "over";

const EMOJI: Record<EntityKind, string> = { rock: "🪨", buoy: "🛟", rival: "🏄", coin: "🪙", star: "⭐", heart: "❤️" };
const SURFER = "🏄";
const PLAYER_R = 24;
const BASE_SPEED = 180;
const MAX_SPEED = 520;
const SPEED_RAMP = 6;
const STEER_STEP = 56;
const COIN_POINTS = 25;
const SHIELD_MS = 5000;
const HIT_SHIELD_MS = 1500;

const SURF_KEYS = [{ key: "ArrowLeft" }, { key: "ArrowRight" }, { key: "ArrowUp" }, { key: "ArrowDown" }, { key: " " }, { key: "Enter" }];

const OCEAN = ["#0b1030", "#131a4d", "#1b2371"];
const WAVE_A = "rgba(124, 140, 255, 0.16)";
const WAVE_B = "rgba(167, 139, 250, 0.14)";

function isObstacle(kind: EntityKind) {
  return kind === "rock" || kind === "buoy" || kind === "rival";
}

export function SurfPage({ tabId }: { tabId: string }) {
  const theme = useTheme();
  const best = useBrowser((s) => s.settings.surfBestScore);
  const [phase, setPhase] = useState<Phase>("menu");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [tick, setTick] = useState(0);
  const inputRef = useRef<TextInput>(null);
  const frameRef = useRef(0);
  const worldRef = useRef({
    playerX: 0.5,
    targetX: 0.5,
    tilt: 0,
    entities: [] as Entity[],
    nextId: 1,
    speed: BASE_SPEED,
    distance: 0,
    score: 0,
    coins: 0,
    lives: 3,
    shieldUntil: 0,
    lastSpawn: 0,
    elapsed: 0,
    lastTs: 0,
    newBest: false,
  });
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const world = worldRef.current;
  const playerY = size.height * 0.78;
  const playerPx = world.playerX * size.width;

  useEffect(() => {
    inputRef.current?.focus();
  }, [phase]);

  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    const step = (ts: number) => {
      const w = worldRef.current;
      const s = sizeRef.current;
      if (w.lastTs === 0) w.lastTs = ts;
      const dt = Math.min((ts - w.lastTs) / 1000, 0.05);
      w.lastTs = ts;
      w.elapsed += dt;
      w.speed = Math.min(BASE_SPEED + w.elapsed * SPEED_RAMP, MAX_SPEED);
      const dx = w.targetX - w.playerX;
      w.playerX += dx * Math.min(1, dt * 10);
      w.tilt = Math.max(-0.4, Math.min(0.4, dx * 2));
      w.distance += w.speed * dt;
      w.score = Math.floor(w.distance / 12) + w.coins * COIN_POINTS;
      if (ts - w.lastSpawn > Math.max(420, 760 - w.elapsed * 8)) {
        w.lastSpawn = ts;
        spawn(w, s.width);
      }
      const now = ts;
      const shielded = now < w.shieldUntil;
      const px = w.playerX * s.width;
      const py = s.height * 0.78;
      for (const e of w.entities) {
        e.y += w.speed * dt;
        e.x += e.vx * dt;
        if (e.x < 20) e.x = 20;
        if (e.x > s.width - 20) e.x = s.width - 20;
      }
      w.entities = w.entities.filter((e) => e.y < s.height + 60);
      for (const e of w.entities) {
        const ddx = e.x - px;
        const ddy = e.y - py;
        const rr = (e.r + PLAYER_R) * 0.7;
        if (ddx * ddx + ddy * ddy > rr * rr) continue;
        if (e.kind === "coin") {
          w.coins += 1;
          e.y = s.height + 100;
        } else if (e.kind === "star") {
          w.shieldUntil = now + SHIELD_MS;
          e.y = s.height + 100;
        } else if (e.kind === "heart") {
          w.lives = Math.min(3, w.lives + 1);
          e.y = s.height + 100;
        } else if (isObstacle(e.kind)) {
          if (shielded) {
            w.score += 10;
            e.y = s.height + 100;
          } else {
            w.lives -= 1;
            w.shieldUntil = now + HIT_SHIELD_MS;
            e.y = s.height + 100;
            if (w.lives <= 0) {
              finish(w);
              break;
            }
          }
        }
      }
      frameRef.current += 1;
      if (frameRef.current % 2 === 0) setTick((t) => t + 1);
      if (phaseRef.current === "playing") raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  function finish(w: typeof world) {
    const finalScore = Math.floor(w.distance / 12) + w.coins * COIN_POINTS;
    w.score = finalScore;
    if (finalScore > best) {
      w.newBest = true;
      void updateSettings({ surfBestScore: finalScore });
    }
    setPhase("over");
  }

  function spawn(w: typeof world, width: number) {
    if (width <= 0) return;
    const roll = Math.random();
    const id = w.nextId++;
    if (roll < 0.55) {
      const kind: EntityKind = Math.random() < 0.45 ? "rock" : Math.random() < 0.6 ? "buoy" : "rival";
      w.entities.push({
        id,
        kind,
        x: 40 + Math.random() * Math.max(1, width - 80),
        y: -40,
        r: kind === "rock" ? 24 : 20,
        vx: kind === "rival" ? (Math.random() < 0.5 ? -30 : 30) : 0,
      });
      if (Math.random() < 0.35) {
        w.entities.push({
          id: w.nextId++,
          kind: "buoy",
          x: 40 + Math.random() * Math.max(1, width - 80),
          y: -110,
          r: 20,
          vx: 0,
        });
      }
    } else if (roll < 0.82) {
      const cx = 40 + Math.random() * Math.max(1, width - 80);
      for (let i = 0; i < 3; i++) {
        w.entities.push({ id: w.nextId++, kind: "coin", x: cx, y: -40 - i * 52, r: 16, vx: 0 });
      }
    } else if (roll < 0.92) {
      w.entities.push({ id, kind: "star", x: 40 + Math.random() * Math.max(1, width - 80), y: -40, r: 18, vx: 0 });
    } else {
      w.entities.push({ id, kind: "heart", x: 40 + Math.random() * Math.max(1, width - 80), y: -40, r: 18, vx: 0 });
    }
  }

  function reset() {
    const w = worldRef.current;
    w.playerX = 0.5;
    w.targetX = 0.5;
    w.tilt = 0;
    w.entities = [];
    w.speed = BASE_SPEED;
    w.distance = 0;
    w.score = 0;
    w.coins = 0;
    w.lives = 3;
    w.shieldUntil = 0;
    w.lastSpawn = 0;
    w.elapsed = 0;
    w.lastTs = 0;
    w.newBest = false;
    setTick((t) => t + 1);
  }

  function start() {
    reset();
    setPhase("playing");
  }

  function nudge(dir: number) {
    const w = worldRef.current;
    w.targetX = Math.max(0.04, Math.min(0.96, w.targetX + (dir * STEER_STEP) / Math.max(1, sizeRef.current.width)));
  }

  function onKeyDown(e: { nativeEvent: { key: string } }) {
    const key = e.nativeEvent.key;
    if (key === "ArrowLeft") nudge(-1);
    else if (key === "ArrowRight") nudge(1);
    else if (key === "ArrowUp") worldRef.current.speed = Math.min(MAX_SPEED, worldRef.current.speed + 30);
    else if (key === "ArrowDown") worldRef.current.speed = Math.max(120, worldRef.current.speed - 30);
    else if (key === " " || key === "Enter") {
      if (phaseRef.current === "menu" || phaseRef.current === "over") start();
      else if (phaseRef.current === "playing") setPhase("paused");
      else if (phaseRef.current === "paused") setPhase("playing");
    }
  }

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => inputRef.current?.focus(),
        onPanResponderMove: (_, g) => {
          const s = sizeRef.current;
          if (s.width <= 0) return;
          const w = worldRef.current;
          w.targetX = Math.max(0.04, Math.min(0.96, (g.moveX - 0) / s.width));
        },
      }),
    []
  );

  const waveOff = Math.floor(world.distance % 90);
  const shielded = phase === "playing" && Date.now() < world.shieldUntil;
  const lives = world.lives;
  void tick;
  void tabId;

  return (
    <View style={styles.root} onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
      <View style={[styles.ocean, { backgroundColor: OCEAN[0] }]} />
      <View style={[styles.wave, styles.waveA, { backgroundColor: WAVE_A, transform: [{ translateY: waveOff - 90 }] }]} />
      <View style={[styles.wave, styles.waveB, { backgroundColor: WAVE_B, transform: [{ translateY: waveOff / 2 - 45 }] }]} />
      <View style={[styles.wave, styles.waveA, { backgroundColor: WAVE_A, transform: [{ translateY: waveOff - 200 }] }]} />
      <View style={styles.hud}>
        <Text size="body" weight="medium" style={{ color: "#fff" }}>
          {world.score}
        </Text>
        <Text size="small" style={{ color: withAlpha("#fff", 0.75) }}>
          Best {Math.max(best, world.score)}
        </Text>
        <Text size="body" style={{ color: "#fff" }}>
          {"🪙 "}{world.coins}
        </Text>
        <Text size="body" style={{ color: "#fff" }}>
          {"❤️".repeat(Math.max(0, lives))}{"🖤".repeat(Math.max(0, 3 - lives))}
        </Text>
        {phase === "playing" ? (
          <Pressable onPress={() => setPhase("paused")} style={styles.pauseBtn}>
            <Text size="body" style={{ color: "#fff" }}>II</Text>
          </Pressable>
        ) : null}
      </View>
      {size.width > 0 && phase !== "menu" ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {world.entities.map((e) => (
            <Text key={e.id} style={[styles.entity, { left: e.x - e.r, top: e.y - e.r, fontSize: e.r * 2 }]}>
              {EMOJI[e.kind]}
            </Text>
          ))}
          <Text
            style={[
              styles.entity,
              { left: playerPx - PLAYER_R, top: playerY - PLAYER_R, fontSize: PLAYER_R * 2, opacity: shielded ? 0.55 : 1, transform: [{ rotate: `${world.tilt}rad` }] },
            ]}
          >
            {SURFER}
          </Text>
        </View>
      ) : null}
      <View style={styles.board} {...pan.panHandlers}>
        <TextInput
          ref={inputRef}
          value=""
          onChangeText={() => {}}
          autoFocus
          caretHidden
          style={styles.keyCatcher}
          keyDownEvents={SURF_KEYS}
          onKeyDown={onKeyDown}
        />
      </View>
      {phase === "playing" ? (
        <View style={styles.steerRow} pointerEvents="box-none">
          <Pressable onPress={() => nudge(-1)} style={styles.steerBtn}>
            <Text size="body" style={{ color: "#fff" }}>◀</Text>
          </Pressable>
          <Pressable onPress={() => nudge(1)} style={styles.steerBtn}>
            <Text size="body" style={{ color: "#fff" }}>▶</Text>
          </Pressable>
        </View>
      ) : null}
      {phase === "menu" ? (
        <View style={styles.overlay}>
          <Text size="body" weight="medium" style={[styles.title, { color: "#fff" }]}>UniVerse Surf</Text>
          <Text size="small" style={[styles.sub, { color: withAlpha("#fff", 0.8) }]}>
            Ride the wave. Dodge the rocks, buoys and other surfers. Grab coins, stars and hearts.
          </Text>
          <Text size="small" style={[styles.sub, { color: withAlpha("#fff", 0.8) }]}>
            Steer with ← →, drag, or the buttons. Space pauses. Best {best}.
          </Text>
          <Pressable onPress={start} style={[styles.cta, { backgroundColor: theme.accent }]}>
            <Text size="body" weight="medium" style={{ color: theme.onAccent }}>
              Start surfing
            </Text>
          </Pressable>
        </View>
      ) : null}
      {phase === "paused" ? (
        <View style={styles.overlay}>
          <Text size="body" weight="medium" style={[styles.title, { color: "#fff" }]}>Paused</Text>
          <Text size="small" style={[styles.sub, { color: withAlpha("#fff", 0.8) }]}>Score {world.score}</Text>
          <Pressable onPress={() => setPhase("playing")} style={[styles.cta, { backgroundColor: theme.accent }]}>
            <Text size="body" weight="medium" style={{ color: theme.onAccent }}>
              Resume
            </Text>
          </Pressable>
        </View>
      ) : null}
      {phase === "over" ? (
        <View style={styles.overlay}>
          <Text size="body" weight="medium" style={[styles.title, { color: "#fff" }]}>Wiped out</Text>
          <Text size="small" style={[styles.sub, { color: withAlpha("#fff", 0.8) }]}>
            Score {world.score} · Coins {world.coins}{world.newBest ? " · New best!" : ` · Best ${best}`}
          </Text>
          <Pressable onPress={start} style={[styles.cta, { backgroundColor: theme.accent }]}>
            <Text size="body" weight="medium" style={{ color: theme.onAccent }}>
              Surf again
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: OCEAN[0], overflow: "hidden" },
  ocean: { ...StyleSheet.absoluteFillObject },
  wave: { position: "absolute", left: -60, right: -60, height: 90, borderRadius: 45, opacity: 0.7 },
  waveA: { top: 120 },
  waveB: { top: 300 },
  hud: { position: "absolute", top: space.m, left: space.m, right: space.m, flexDirection: "row", alignItems: "center", gap: space.m },
  pauseBtn: { marginLeft: "auto", paddingHorizontal: space.s, paddingVertical: space.xs, borderRadius: radius.control, backgroundColor: withAlpha("#000", 0.35) },
  entity: { position: "absolute", textAlign: "center" },
  board: { ...StyleSheet.absoluteFillObject },
  keyCatcher: { ...StyleSheet.absoluteFillObject, opacity: 0 },
  steerRow: { position: "absolute", left: space.m, right: space.m, bottom: space.l, flexDirection: "row", justifyContent: "space-between" },
  steerBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: withAlpha("#000", 0.4), alignItems: "center", justifyContent: "center" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: space.m, backgroundColor: withAlpha("#0b1030", 0.72), padding: space.l },
  title: { fontSize: 34, fontWeight: "700" },
  sub: { textAlign: "center", maxWidth: 420 },
  cta: { paddingHorizontal: space.l, paddingVertical: space.m, borderRadius: radius.control },
});
