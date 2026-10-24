import {useEffect, useMemo, useState} from 'react';
import {AbsoluteFill, Easing, Img, cancelRender, continueRender, delayRender, interpolate, staticFile, useCurrentFrame} from 'remotion';
import displaySemibold from '@fontsource/funnel-display/files/funnel-display-latin-600-normal.woff2';

// pHARe in use, for the card of the project on sammagbo.com: 1600 x 1000, 30 fps, no sound, in a loop (the last frame
// is the first). Tuesday 13/10/2026 in a fictitious school: the login, a new case with three students, the history and
// its search, the team, then the interviews of the pHARe meeting, one of them planned on screen, and the planning.
// Only the real captures of video/capture/capture.mjs, in public/phare/ (outside git: run the capture before
// rendering). The engine is the one of the MeetingManager video (MeetingManagerDemo.tsx, 05d4963): the band with the
// caption and the chip, the camera and the readability rules.
//
// The rule is readability on the site, where the video shows at 45 % of its size. In each reading view, the text the
// caption speaks of comes out at 30 px or more in the frame (size on screen x zoom), the labels that explain it at 24 px
// or more, and the view stays still 2.5 s or more, at most with a pan of 60 CSS px per second. The edges stay clean: no
// text cut by the top or by the band, nor closer than 8 px to them, and no word cut at the sides; shapes may be cut.
// dayPlan() checks all of it view by view, with the lines of text the capture measured (text.json), and stops the
// render if a view breaks a rule. It also stops it if a caption or a chip quotes a name of the demo data.

const FPS = 30;
const BLACK = '#000000';
const WHITE = '#F2F0EB';
const RED = '#FF3D2E';
const LINE = '#34322F'; // the outline of the chip, the same as the chips of the site

// The screen of the app fills the width of the frame: each pixel of width is zoom on the text. The views have the
// proportions of the captures (16:10), and the band of the caption hides their foot.
const SCREEN = {width: 1600, height: 1000};
const RATIO = SCREEN.height / SCREEN.width;

// The band at the bottom (BAND) holds the caption, on the left, and the chip, on the right: the screen of the app ends
// above it, and nothing of the app passes behind the letters. What is read stays 10 px or more from the edges of the
// screen (EDGE): above READ_HEIGHT, 10 px from the band. No text of the screen comes closer than GAP px to the top or to
// the band.
const BAND = 140;
const CAPTION = {size: 58, left: 56, dot: 20, gap: 18};
const CHIP = {size: 42, padY: 12, padX: 26, border: 3, right: 56};
const EDGE = 10;
const GAP = 8;
const READ_HEIGHT = SCREEN.height - BAND - EDGE;

// The rules of the lote, checked by dayPlan().
const RULES = {mainPx: 30, labelPx: 24, minRead: 2.5 * FPS, maxPan: 60, enter: [15, 24], chars: 42, seconds: [40, 60]};
const SWAP = 15; // the swap of one capture for another in the same framing

// The guard of the captions and the chips: no name of the demo data, neither the full name nor the first name, as a
// whole word, without accents or capitals.
const plain = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const quotedName = (text: string, people: string[]) =>
  people.find((name) =>
    [name, name.split(' ')[0]].some((word) =>
      new RegExp(`(^|[^\\p{L}\\p{N}])${escape(plain(word))}([^\\p{L}\\p{N}]|$)`, 'u').test(plain(text)),
    ),
  );

type Box = {x: number; y: number; width: number; height: number};
type Size = {width: number; height: number};
type Manifest = {viewport: Size; people: string[]; shots: Record<string, Record<string, Partial<Box> | null>>};
/** A line of text on screen in a capture, measured by capture.mjs. */
type Line = Box & {text: string; kind: 'text' | 'field' | 'icon'; px: number};
type Texts = Record<string, Line[]>;
// A framing of the capture, in its CSS pixels: the centre and the width (the height follows the frame's ratio).
type View = {cx: number; cy: number; w: number};
type Boxes = (shot: string, name: string) => Box;

/** A reading view: the framing, what is read in it and the size, on screen, of that text. */
type Look = {
  view: View;
  to?: View; // the end of a slow pan, at the same width
  read: Box; // the text read, which has to fit above the band of the caption
  readTo?: Box; // the text read at the end of the pan
  px: number; // the size of the text the caption speaks of
  labelPx?: number; // the size of the labels that explain it
};

type Step = {
  shot: string;
  enter: number; // the frames of the transition that brings this view
  move?: boolean; // the camera travels from the previous view, on the same screen; without it, the two screens blend
  hold: number; // the frames in which the view stays still (or in a slow pan)
  chip: string;
  swap?: {shot: string; at: number}; // another capture in the same framing, `at` frames after the view starts
  look: (b: Boxes) => Look;
};
type Scene = {caption?: string; dot?: boolean; steps: Step[]};

const ease = Easing.bezier(0.65, 0, 0.35, 1);
const fade = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});

const topOf = (view: View) => view.cy - (view.w * RATIO) / 2;
const zoomOf = (view: View) => SCREEN.width / view.w;

/** The view of width `w` with its left edge at `left` and its top at `top`. */
const at = (left: number, top: number, w: number): View => ({cx: left + w / 2, cy: top + (w * RATIO) / 2, w});
const pan = (view: View, dx: number, dy = 0): View => ({...view, cx: view.cx + dx, cy: view.cy + dy});

// The views, from the boxes capture.mjs measured in each capture. The fixed offsets come from the lines of text.json,
// from those boxes; the gaps between the lines decide where the top of the frame and the band fall.

// The login: from « pHARe » to the button, with demo@example.com and the masked password. The footer stays under the
// band.
const login = (b: Boxes): Look => {
  const form = b('login', 'form');
  const read = {x: form.x, y: form.y - 134, width: form.width, height: 396};
  return {view: at(form.x - 219, form.y - 141, 762), read, px: 16, labelPx: 12.8};
};

// The case: the date and the time, then the first student, the victim. The badges « Requis » and « Optionnel » between
// them lose their text in the app (white on white, see the report). The band falls in the gap between the first card
// and the second, « Requis : » keeps a margin on the left, and the cross of the first card stays outside on the right.
const caseTop = (b: Boxes): Look => {
  const fields = b('caso', 'fields');
  const read = {x: fields.x + 24, y: fields.y + 29, width: 705, height: 277};
  return {view: at(fields.x - 8, fields.y - 41, 800), read, px: 16, labelPx: 12.8};
};
// Then the witness and the aggressor, both « Lié à » the victim, with their member.
const caseStudents = (b: Boxes): Look => {
  const first = b('caso', 'first');
  const read = {x: first.x + 24, y: first.y + 170, width: 640, height: 297};
  return {view: at(first.x, first.y + 145, 840), read, px: 16, labelPx: 12.8};
};

// The history, in its left column: the heading and the search, then, in a slow pan down, the case of the screen on top
// with its three students. The right column starts where the view ends.
const history = (b: Boxes): Look => {
  const search = b('historico', 'search');
  const first = b('historico', 'first');
  const view = at(search.x - 8, search.y - 111, 490);
  return {
    view,
    to: pan(view, 0, 190),
    read: {x: search.x, y: search.y - 58, width: 278, height: 117},
    readTo: {x: first.x + 25, y: first.y + 28, width: 352, height: 156},
    px: 16,
    labelPx: 12,
  };
};

// The search: « Hugo Démo » and the first result, then the count « 2 résultats » and the second one.
const searchLeft = (b: Boxes): Look => {
  const search = b('busca', 'search');
  const read = {x: search.x + 25, y: search.y + 39, width: 338, height: 240};
  return {view: at(search.x + 10, search.y + 33, 470), read, px: 16, labelPx: 12};
};
const searchRight = (b: Boxes): Look => {
  const search = b('busca', 'search');
  const read = {x: search.x + 487, y: search.y + 41, width: 376, height: 238};
  return {view: at(search.x + 430, search.y + 33, 470), read, px: 16, labelPx: 12};
};

// The team window: its title, the field to add a member and the first members. The page behind is blurred; its texts
// count for the edges all the same, so the view takes « Projet pHARe » whole at the top.
const teamTop = (b: Boxes): Look => {
  const modal = b('equipe', 'modal');
  const read = {x: modal.x + 33, y: modal.y + 45, width: 360, height: 292};
  return {view: at(modal.x - 229, modal.y - 21, 720), read, px: 16, labelPx: 12.8};
};
// Then the list, whose four rows scroll inside the window: the swap shows it scrolled to the fifth member.
const teamList = (b: Boxes): Look => {
  const list = b('equipe', 'list');
  const read = {x: list.x + 17, y: list.y + 20, width: 143, height: 252};
  return {view: at(list.x - 262, list.y - 1, 720), read, px: 16};
};

// The meeting: the case of the screen, with « 3 en attente » and its three students, each with « Intervenant... », the
// date and the time. The counters, at the other end of the heading, do not fit with the students at this zoom.
const pending = (shot: string) => (b: Boxes): Look => {
  const card = b(shot, shot === 'pendentes' ? 'first' : 'card'); // the same first case card in both captures
  const read = {x: card.x + 54, y: card.y + 42, width: 785, height: 257};
  return {view: at(card.x + 46, card.y + 20, 800), read, px: 16, labelPx: 12};
};

// The planning: the group of the case of the screen, with the victim, her member and the date of the interview. The
// heading stays above the frame, and the cross of each row outside on the right.
const planning = (b: Boxes): Look => {
  const group = b('planejamento', 'group');
  const read = {x: group.x + 49, y: group.y + 43, width: 681, height: 104};
  return {view: at(group.x + 40, group.y - 25, 770), read, px: 16, labelPx: 12};
};

// The script. The chip is the time of the demo clock in the log of the capture (~/phare-captura.log); in the history,
// the period of the cases it shows.
const SCENES: Scene[] = [
  {caption: 'Connexion réservée à l’équipe pHARe.', steps: [{shot: 'login', enter: 0, hold: 96, chip: '10:05', look: login}]},
  {
    caption: 'Un cas : la date, l’heure, les élèves.',
    steps: [
      {shot: 'caso', enter: 18, hold: 84, chip: '10:08', look: caseTop},
      {shot: 'caso', enter: 21, move: true, hold: 84, chip: '10:08', look: caseStudents},
    ],
  },
  {caption: 'Chaque cas rejoint l’historique.', steps: [{shot: 'historico', enter: 18, hold: 102, chip: 'Sept. – oct.', look: history}]},
  {
    caption: 'Retrouver un élève en un instant.',
    steps: [
      {shot: 'busca', enter: 18, hold: 84, chip: '10:11', look: searchLeft},
      {shot: 'busca', enter: 21, move: true, hold: 84, chip: '10:11', look: searchRight},
    ],
  },
  {
    caption: 'L’équipe pHARe se gère dans l’app.',
    steps: [
      {shot: 'equipe', enter: 18, hold: 84, chip: '10:13', look: teamTop},
      {shot: 'equipe', enter: 21, move: true, hold: 132, chip: '10:13', swap: {shot: 'equipe-fim', at: 36}, look: teamList},
    ],
  },
  {
    caption: 'Un intervenant et une date par élève.',
    steps: [
      {shot: 'pendentes', enter: 18, hold: 84, chip: '10:18', look: pending('pendentes')},
      {shot: 'agendar', enter: 18, move: true, hold: 90, chip: '10:20', look: pending('agendar')},
    ],
  },
  {caption: 'Le planning de la réunion pHARe.', steps: [{shot: 'planejamento', enter: 18, hold: 96, chip: '10:21', look: planning}]},
  // The end of the loop, without a caption: back to the login, in the framing and with the chip of the first frame.
  {steps: [{shot: 'login', enter: 18, hold: 48, chip: '10:05', look: login}]},
];

type Timed = Step & {scene: number; start: number; hold0: number; end: number};

// The timeline, in frames: each view enters (a transition of `enter` frames) and stays `hold` frames.
const TIMELINE: Timed[] = [];
SCENES.forEach((scene, index) =>
  scene.steps.forEach((step) => {
    const start = TIMELINE.length ? TIMELINE[TIMELINE.length - 1].end : 0;
    TIMELINE.push({...step, scene: index, start, hold0: start + step.enter, end: start + step.enter + step.hold});
  }),
);

export const PHARE_DEMO = {width: SCREEN.width, height: SCREEN.height, fps: FPS, durationInFrames: TIMELINE[TIMELINE.length - 1].end};

/** A line of the plan: the view, the zoom and the size in the frame of the text read. */
export type PlanRow = {
  step: number;
  scene: number;
  shot: string;
  from: number; // the first frame of the transition that brings the view
  still: number; // the first frame with the view still
  swap?: number; // the frame in which the swap of capture starts
  to: number; // the last frame of the view
  width: number;
  zoom: number;
  mainPx: number;
  labelPx?: number;
  chip: string;
  caption?: string;
};

/** The width of a text in Funnel Display 600, at the given size; in the browser, to check the band at the bottom. */
type Measure = (text: string, size: number) => number;

/** The texts of the capture that the view cuts at a side, or that are cut or closer than GAP px to the top or the band. */
const edgeProblems = (name: string, view: View, lines: Line[]): string[] => {
  const zoom = zoomOf(view);
  const left = view.cx - view.w / 2;
  const right = left + view.w;
  const top = topOf(view);
  const band = top + (SCREEN.height - BAND) / zoom;
  const m = GAP / zoom;
  const problems: string[] = [];
  for (const line of lines) {
    if (line.kind === 'icon') continue;
    const r = line.x + line.width;
    const bottom = line.y + line.height;
    if (r <= left || line.x >= right || bottom <= top || line.y >= band) continue; // outside the frame or under the band
    if (line.x < left || r > right) problems.push(`${name}: «${line.text}» is cut at the side`);
    else if (line.y < top + m) problems.push(`${name}: «${line.text}» is cut by or too close to the top`);
    else if (bottom > band - m) problems.push(`${name}: «${line.text}» is cut by or too close to the band`);
  }
  return problems;
};

/**
 * The views of every scene, from the manifest and the lines of text, checked against the rules of the lote. Stops the
 * render (with the list of the problems) if a view breaks one.
 */
export const dayPlan = (manifest: Manifest, texts: Texts, measure?: Measure): {looks: Look[]; rows: PlanRow[]} => {
  const box: Boxes = (shot, name) => {
    const found = manifest.shots[shot]?.[name];
    if (name === 'page') return {x: 0, y: 0, ...sizeOf(manifest, shot)};
    if (!found || [found.x, found.y, found.width, found.height].some((n) => typeof n !== 'number')) {
      throw new Error(`manifest.json has no ${name} in ${shot}: run video/capture/capture.mjs again`);
    }
    return found as Box;
  };
  const looks = TIMELINE.map((step) => step.look(box));
  const problems: string[] = [];
  const people = manifest.people ?? [];
  if (!people.length) problems.push('manifest.json has no people: run video/capture/capture.mjs again');
  const seconds = PHARE_DEMO.durationInFrames / FPS;
  if (seconds < RULES.seconds[0] || seconds > RULES.seconds[1]) problems.push(`the video lasts ${seconds.toFixed(1)} s`);

  const rows = TIMELINE.map((step, k): PlanRow => {
    const look = looks[k];
    const name = `${k + 1} ${step.shot}`;
    const views = look.to ? [look.view, look.to] : [look.view];
    for (const view of views) {
      const left = view.cx - view.w / 2;
      const top = topOf(view);
      const bounds = {x: 0, y: 0, ...sizeOf(manifest, step.shot)};
      if (left < bounds.x - 0.5 || top < bounds.y - 0.5 || left + view.w > bounds.x + bounds.width + 0.5 || top + view.w * RATIO > bounds.y + bounds.height + 0.5) {
        problems.push(`${name}: the view leaves the capture`);
      }
      // clean edges, in the captures the view shows still
      for (const shot of step.swap ? [step.shot, step.swap.shot] : [step.shot]) {
        if (!texts[shot]) problems.push(`${name}: text.json has no lines for ${shot}: run video/capture/capture.mjs again`);
        else problems.push(...edgeProblems(name, view, texts[shot]));
      }
    }
    if (k > 0 && (step.enter < RULES.enter[0] || step.enter > RULES.enter[1])) problems.push(`${name}: a transition of ${step.enter} frames`);
    const scene = SCENES[step.scene];
    const zoom = zoomOf(look.view);
    const quoted = quotedName(`${scene.caption ?? ''} ${step.chip}`, people);
    if (quoted) problems.push(`${name}: the caption or the chip quotes «${quoted}», a name of the demo data`);
    if (scene.caption) {
      // a reading view
      if (scene.caption.length > RULES.chars) problems.push(`${name}: the caption has ${scene.caption.length} characters`);
      if (measure) {
        const caption = measure(scene.caption, CAPTION.size) + (scene.dot ? CAPTION.dot + CAPTION.gap : 0);
        const chip = measure(step.chip, CHIP.size) + 2 * (CHIP.padX + CHIP.border);
        if (CAPTION.left + caption + 48 + chip + CHIP.right > SCREEN.width) problems.push(`${name}: the caption runs into the chip`);
      }
      if (look.px * zoom < RULES.mainPx) problems.push(`${name}: the text is ${(look.px * zoom).toFixed(1)} px`);
      if (look.labelPx && look.labelPx * zoom < RULES.labelPx) problems.push(`${name}: the labels are ${(look.labelPx * zoom).toFixed(1)} px`);
      // the reading time counts from the end of the swap of capture and, in the first frame, from the entry of the caption
      const reading = step.hold - Math.max(step.swap ? step.swap.at + SWAP : 0, k === 0 ? 16 : 0);
      if (reading < RULES.minRead) problems.push(`${name}: the view is read for ${(reading / FPS).toFixed(2)} s`);
      if (look.to) {
        const speed = Math.hypot(look.to.cx - look.view.cx, look.to.cy - look.view.cy) / (step.hold / FPS);
        if (look.to.w !== look.view.w) problems.push(`${name}: the pan zooms`);
        if (speed > RULES.maxPan) problems.push(`${name}: the pan runs at ${speed.toFixed(0)} px/s`);
      }
      const pairs: [View, Box][] = look.to ? [[look.view, look.read], [look.to, look.readTo ?? look.read]] : [[look.view, look.read]];
      for (const [view, read] of pairs) {
        const left = view.cx - view.w / 2;
        const top = topOf(view);
        const m = EDGE / zoom;
        if (read.x < left + m || read.x + read.width > left + view.w - m || read.y < top + m || read.y + read.height > top + READ_HEIGHT / zoom) {
          problems.push(`${name}: the text read does not fit above the band`);
        }
      }
    }
    return {
      step: k + 1,
      scene: step.scene + 1,
      shot: step.swap ? `${step.shot} → ${step.swap.shot}` : step.shot,
      from: step.start,
      still: step.hold0,
      swap: step.swap ? step.hold0 + step.swap.at : undefined,
      to: step.end - 1,
      width: look.view.w,
      zoom,
      mainPx: look.px * zoom,
      labelPx: look.labelPx ? look.labelPx * zoom : undefined,
      chip: step.chip,
      caption: scene.caption,
    };
  });

  // The loop: the last frame shows the same capture, in the same framing and with the same chip as the first, without a
  // caption.
  const first = TIMELINE[0];
  const last = TIMELINE[TIMELINE.length - 1];
  const lastShot = last.swap?.shot ?? last.shot;
  const sameView = JSON.stringify(looks[0].view) === JSON.stringify(looks[looks.length - 1].view) && !looks[looks.length - 1].to;
  if (lastShot !== first.shot || !sameView || last.chip !== first.chip || SCENES[last.scene].caption || last.hold < (last.swap ? last.swap.at + SWAP + 1 : 1)) {
    problems.push('the last frame is not the first one');
  }
  if (problems.length) throw new Error(`PhareDemo breaks the rules: ${problems.join('; ')}`);
  return {looks, rows};
};

const sizeOf = (manifest: Manifest, shot: string): Size => {
  const page = manifest.shots[shot]?.page;
  return page && typeof page.width === 'number' && typeof page.height === 'number' ? {width: page.width, height: page.height} : manifest.viewport;
};

const useAssets = (): {manifest: Manifest; texts: Texts} | null => {
  const [handle] = useState(() => delayRender('phare captures and fonts'));
  const [assets, setAssets] = useState<{manifest: Manifest; texts: Texts} | null>(null);
  useEffect(() => {
    Promise.all([
      fetch(staticFile('phare/manifest.json')).then((res) => res.json() as Promise<Manifest>),
      fetch(staticFile('phare/text.json')).then((res) => res.json() as Promise<Texts>),
      new FontFace('Funnel Display', `url(${displaySemibold}) format('woff2')`, {weight: '600'}).load().then((face) => {
        document.fonts.add(face);
      }),
    ])
      .then(([manifest, texts]) => {
        setAssets({manifest, texts});
        continueRender(handle);
      })
      .catch((error) => cancelRender(error));
  }, [handle]);
  return assets;
};

/** The width of a text in Funnel Display 600, measured on the browser's canvas (without the negative letter-spacing: slack). */
const measureText: Measure = (text, size) => {
  const context = document.createElement('canvas').getContext('2d');
  if (!context) return 0;
  context.font = `600 ${size}px "Funnel Display"`;
  return context.measureText(text).width;
};

/** The framing between two views: the centre in a straight line, the zoom on a logarithmic scale. */
const mix = (a: View, b: View, t: number): View => ({
  cx: a.cx + (b.cx - a.cx) * t,
  cy: a.cy + (b.cy - a.cy) * t,
  w: Math.exp(Math.log(a.w) + (Math.log(b.w) - Math.log(a.w)) * t),
});

type Layer = {shot: string; view: View; opacity: number};

const Screen: React.FC<Layer & {size: Size}> = ({shot, view, opacity, size}) => {
  const scale = SCREEN.width / view.w;
  const left = view.cx - view.w / 2;
  const top = topOf(view);
  return (
    <AbsoluteFill style={{opacity}}>
      <Img
        src={staticFile(`phare/${shot}.png`)}
        style={{position: 'absolute', left: -left * scale, top: -top * scale, width: size.width * scale, height: size.height * scale}}
      />
    </AbsoluteFill>
  );
};

const lettering = (size: number): React.CSSProperties => ({
  position: 'absolute',
  color: WHITE,
  fontFamily: 'Funnel Display',
  fontWeight: 600,
  fontSize: size,
  lineHeight: 1.1,
  whiteSpace: 'nowrap',
});

// The caption, in the band, on the left and in the middle of its height: the text straight on the black, no pill.
const Caption: React.FC<{text: string; opacity: number; dot?: boolean}> = ({text, opacity, dot}) => (
  <div
    style={{
      ...lettering(CAPTION.size),
      left: CAPTION.left,
      top: SCREEN.height - BAND,
      height: BAND,
      display: 'flex',
      alignItems: 'center',
      gap: CAPTION.gap,
      letterSpacing: '-0.01em',
      opacity,
      transform: `translateY(${(1 - opacity) * 14}px)`,
    }}
  >
    {dot ? <span style={{width: CAPTION.dot, height: CAPTION.dot, borderRadius: '50%', background: RED, flex: 'none'}} /> : null}
    {text}
  </div>
);

// The chip, in the band, on the right and in the middle of its height: only the outline, like the chips of the site.
const Chip: React.FC<{text: string; opacity: number}> = ({text, opacity}) => (
  <div
    style={{
      ...lettering(CHIP.size),
      right: CHIP.right,
      top: SCREEN.height - BAND / 2,
      transform: 'translateY(-50%)',
      boxSizing: 'border-box',
      padding: `${CHIP.padY}px ${CHIP.padX}px`,
      border: `${CHIP.border}px solid ${LINE}`,
      borderRadius: 999,
      fontVariantNumeric: 'tabular-nums',
      opacity,
    }}
  >
    {text}
  </div>
);

export const PhareDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const assets = useAssets();
  const plan = useMemo(() => (assets ? dayPlan(assets.manifest, assets.texts, measureText) : null), [assets]);
  if (!assets || !plan) return <AbsoluteFill style={{background: BLACK}} />;
  const {manifest} = assets;
  const {looks} = plan;

  const i = Math.max(0, TIMELINE.findIndex((step) => frame < step.end));
  const step = TIMELINE[i];

  // The framing of a view while it is on screen: still, or in a pan at constant speed.
  const camera = (k: number, f: number): View => {
    const look = looks[k];
    if (!look.to) return look.view;
    return mix(look.view, look.to, Math.min(Math.max((f - TIMELINE[k].hold0) / TIMELINE[k].hold, 0), 1));
  };
  // The captures of a view: its own and, during and after the swap, the next one on top (the one below leaves when the
  // one on top is opaque).
  const held = (k: number, f: number, view: View): Layer[] => {
    const s = TIMELINE[k];
    const base: Layer = {shot: s.shot, view, opacity: 1};
    if (!s.swap) return [base];
    const swapped = fade(f, s.hold0 + s.swap.at, s.hold0 + s.swap.at + SWAP);
    if (swapped >= 1) return [{...base, shot: s.swap.shot}];
    return swapped > 0 ? [base, {...base, shot: s.swap.shot, opacity: swapped}] : [base];
  };

  let layers: Layer[];
  let progress = 1; // the progress of the transition that brought the current view
  if (frame >= step.hold0 || i === 0) {
    layers = held(i, frame, camera(i, frame));
  } else {
    const prev = TIMELINE[i - 1];
    progress = ease((frame - step.start) / step.enter);
    const leaving = held(i - 1, prev.end - 1, camera(i - 1, prev.end - 1));
    const target = looks[i].view;
    if (step.move) {
      // the same screen: the camera travels, and the new capture (the updated screen) comes on top
      const view = mix(camera(i - 1, prev.end - 1), target, progress);
      layers = [...leaving.map((layer) => ({...layer, view})), {shot: step.shot, view, opacity: progress}];
    } else {
      // another screen: the new one blends over the previous one, opening a little before it stops
      layers = [...leaving, {shot: step.shot, view: {...target, w: target.w * (1 + 0.04 * (1 - progress))}, opacity: progress}];
    }
  }

  // The caption and the chip: they change in the middle of the transition from one scene to the next; the first caption
  // comes after the first frame, so the loop has no seam.
  const scene = SCENES[step.scene];
  const prevStep = i > 0 && frame < step.hold0 ? TIMELINE[i - 1] : null;
  const prevScene = prevStep ? SCENES[prevStep.scene] : null;
  const out = 1 - interpolate(progress, [0, 0.4], [0, 1], {extrapolateRight: 'clamp'});
  const into = interpolate(progress, [0.5, 1], [0, 1], {extrapolateLeft: 'clamp'});
  const captions: {text: string; dot?: boolean; opacity: number}[] = [];
  if (prevScene && prevScene !== scene) {
    if (prevScene.caption) captions.push({text: prevScene.caption, dot: prevScene.dot, opacity: out});
    if (scene.caption) captions.push({text: scene.caption, dot: scene.dot, opacity: into});
  } else if (scene.caption) {
    captions.push({text: scene.caption, dot: scene.dot, opacity: i === 0 ? fade(frame, 4, 16) : 1});
  }
  const chips =
    prevStep && prevStep.chip !== step.chip
      ? [
          {text: prevStep.chip, opacity: out},
          {text: step.chip, opacity: into},
        ]
      : [{text: step.chip, opacity: 1}];

  return (
    <AbsoluteFill style={{background: BLACK}}>
      <div style={{position: 'absolute', left: 0, top: 0, width: SCREEN.width, height: SCREEN.height - BAND, overflow: 'hidden'}}>
        {layers
          .filter((layer) => layer.opacity > 0)
          .map((layer, k) => (
            <Screen key={`${k}-${layer.shot}`} {...layer} size={sizeOf(manifest, layer.shot)} />
          ))}
      </div>
      {captions
        .filter((caption) => caption.opacity > 0)
        .map((caption) => (
          <Caption key={caption.text} {...caption} />
        ))}
      {chips
        .filter((chip) => chip.opacity > 0)
        .map((chip) => (
          <Chip key={chip.text} {...chip} />
        ))}
    </AbsoluteFill>
  );
};
