import { display, type Bar, type Bench, type Figure, type Row } from "./bench";

export type Outcome = "win" | "loss" | "tie";

export type Verdict = {
  figure: Figure | null;
  word: string | null;
  line: string;
  note: string | null;
  photoFinish: boolean;
};

export type Lane = { name: string; isUniverse: boolean; bar: Bar | null };

export type Case = {
  id: string;
  label: string;
  fullLabel: string;
  outcome: Outcome;
  winner: string;
  lanes: Lane[];
};

export type Card = {
  id: string;
  title: string;
  wide: boolean;
  solo: boolean;
  outcome: Outcome;
  stamp: string;
  context: string | null;
  verdict: Verdict;
  cases: Case[];
  unit: string;
  meta: string;
  caption: string;
  record: { won: number; of: number };
  footnotes: string[];
};


export type Scorecard = {
  cards: Card[];
  total: number;
  roster: string[];
};

const PHOTO_FINISH_PCT = 5;

const figureText = (f: Figure) => `${display(f)}${f.suffix}`;
const plainCase = (sub: string) => sub.replace(/\s*\(.*$/, "");
const valueText = (bar: Bar) => `${display(bar.value)}${bar.unit === "%" ? "%" : ` ${bar.unit}`}`;

function outcomeOf(row: Row): Outcome {
  const universe = row.bars.find((b) => b.isUniverse);
  if (!universe?.isBest) return "loss";
  return row.bars.some((b) => !b.isUniverse && b.isBest) ? "tie" : "win";
}

function winnerOf(row: Row): string {
  const outcome = outcomeOf(row);
  if (outcome === "win") return row.bars.find((b) => b.isUniverse)!.name;
  return row.bars.find((b) => !b.isUniverse && b.isBest)!.name;
}

const isPhotoFinish = (f: Figure | null) => !!f && f.suffix === "%" && f.value < PHOTO_FINISH_PCT;

function verdictOf(row: Row): Verdict {
  const { call } = row;
  const note = call.second ? `${figureText(call.second.figure)} ${call.second.line}` : null;
  return { figure: call.figure, word: call.word ?? null, line: call.line, note, photoFinish: isPhotoFinish(call.figure) };
}

function lanesOf(row: Row, roster: string[]): Lane[] {
  return roster.map((name) => {
    const bar = row.bars.find((b) => b.name === name) ?? null;
    return { name, isUniverse: bar?.isUniverse ?? roster[0] === name, bar };
  });
}

function stampOf(outcome: Outcome, winner: string): string {
  if (outcome === "tie") return "Dead heat";
  if (outcome === "loss") return `${winner} wins this one`;
  return "UniVerse Project Browser";
}

function cardOf(group: Bench["groups"][number], roster: string[]): Card {
  const cases: Case[] = group.rows.map((row) => ({
    id: row.id,
    label: plainCase(row.sub ?? row.label),
    fullLabel: row.label,
    outcome: outcomeOf(row),
    winner: winnerOf(row),
    lanes: lanesOf(row, roster),
  }));
  const headIndex = Math.max(0, cases.findIndex((c) => c.outcome === "win"));
  const head = group.rows[headIndex];
  const wide = group.rows.length > 1;
  const won = cases.filter((c) => c.outcome === "win").length;
  const outcome = wide ? (won > 0 ? "win" : cases[0].outcome) : cases[0].outcome;
  const footnotes = wide
    ? cases.flatMap((c, i) => {
        if (c.outcome === "win") return [];
        const row = group.rows[i];
        const universe = row.bars.find((b) => b.isUniverse)!;
        const best = row.bars.find((b) => b.name === c.winner)!;
        const verb = c.outcome === "tie" ? "ties" : "takes";
        return [`${c.winner} ${verb} ${c.label.toLowerCase()}: ${valueText(best)} to UniVerse Project Browser’s ${valueText(universe)}.`];
      })
    : [];
  return {
    id: group.id,
    title: group.label,
    wide,
    solo: false,
    outcome,
    stamp: wide ? `UniVerse Project Browser ${won} of ${cases.length}` : stampOf(cases[0].outcome, cases[0].winner),
    context: wide ? cases[headIndex].label : null,
    verdict: verdictOf(head),
    cases,
    unit: head.bars[0].unit,
    meta: head.meta,
    caption: wide ? `${group.label}, in ${head.bars[0].unit}. ${head.meta}.` : head.caption,
    record: { won, of: cases.length },
    footnotes,
  };
}

export function scorecardOf(bench: Bench): Scorecard {
  const rows = bench.groups.flatMap((g) => g.rows);
  const universeName = rows[0].bars.find((b) => b.isUniverse)!.name;
  const roster = [universeName, ...bench.rivals];
  const cards = bench.groups.map((g) => cardOf(g, roster));
  const singles = cards.filter((c) => !c.wide);
  if (singles.length % 2 === 1) singles[singles.length - 1].solo = true;
  return {
    cards,
    total: rows.length,
    roster,
  };
}
