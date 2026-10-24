// Prepares the demo instance for the captures, with the fictitious data of
// backend/src/test/resources/demo/phare-demo.json:
// - checks the data first: every name has a fictitious surname (Exemple, Démo, Fictif or Fictive), nobody is both a
//   student and a member of the team, the classes go from 6ème to 3ème, the cases fall on school days between 07/09
//   and 12/10/2026 with two to four students and at least one victim, and one student is in exactly two cases;
// - logs in as the demo account (its password in PHARE_DEMO_DIR/demo-password, never printed) through the auth
//   service, and refuses to write if the API already has a case or a member: the demo starts empty;
// - writes the team, then the cases from the oldest to the newest (the history shows the last created first).
//
//   node seed.mjs          (on a new instance: demo-instance.sh up)
//
// It only talks to 127.0.0.2: the auth service on 3000 and the API on 8080 of the demo instance.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const HOST = '127.0.0.2';
const AUTH = `http://${HOST}:3000/api/auth`;
const API = `http://${HOST}:8080/api`;
const DEMO_DIR = process.env.PHARE_DEMO_DIR ?? '/tmp/phare-demo';
const data = JSON.parse(readFileSync(new URL('../../backend/src/test/resources/demo/phare-demo.json', import.meta.url), 'utf8'));

// ── The data ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const FICTITIOUS = /^\p{Lu}\p{Ll}+ (Exemple|Démo|Fictif|Fictive)$/u;
const all = [...data.cases, data.screenCase];
const students = new Set(all.flatMap((c) => c.eleves.map((e) => e.nom)));
const team = new Set(data.team);
const fail = (why) => { throw new Error(`phare-demo.json: ${why}`); };
for (const name of [...students, ...team]) if (!FICTITIOUS.test(name)) fail(`"${name}" has no fictitious surname`);
for (const name of team) if (students.has(name)) fail(`"${name}" is both a student and a member of the team`);
if (team.size !== 5) fail(`the team has ${team.size} members, not 5`);
for (const c of all) {
      const day = new Date(`${c.date}T12:00:00Z`).getUTCDay();
      if (day === 0 || day === 6) fail(`${c.date} is not a school day`);
      if (c.eleves.length < 2 || c.eleves.length > 4) fail(`the case of ${c.date} has ${c.eleves.length} students`);
      if (!c.eleves.some((e) => e.type === 'VICTIME')) fail(`the case of ${c.date} has no victim`);
      for (const e of c.eleves) {
            if (!/^[6543]ème [A-D]$/.test(e.classe)) fail(`${e.nom}: class "${e.classe}"`);
            if (e.membre && !team.has(e.membre)) fail(`${e.nom}: "${e.membre}" is not in the team`);
            if (e.lie_a && !c.eleves.some((v) => v.nom === e.lie_a && v.type === 'VICTIME')) fail(`${e.nom}: "${e.lie_a}" is not a victim of the case`);
      }
}
const dates = data.cases.map((c) => c.date);
if (dates.some((d) => d < '2026-09-07' || d > '2026-10-12')) fail('a case of the seed is outside 07/09-12/10/2026');
if (new Set(dates).size !== dates.length) fail('two cases of the seed share a date');
if (data.cases.length < 6 || data.cases.length > 7) fail(`${data.cases.length} cases in the seed, not 6 or 7`);
const inCases = (nom) => data.cases.filter((c) => c.eleves.some((e) => e.nom === nom)).length;
if (inCases(data.search) !== 2) fail(`the search "${data.search}" is in ${inCases(data.search)} cases, not 2`);
if ([...students].filter((nom) => inCases(nom) > 1).length !== 1) fail('more than one student is in two cases');
const types = data.screenCase.eleves.map((e) => e.type).sort().join(',');
if (data.screenCase.date !== data.clock.date || types !== 'INTIMIDATEUR,TEMOIN,VICTIME') fail('the case of the screen');

// ── The demo instance ────────────────────────────────────────────────────────────────────────────────────────────────
const password = readFileSync(join(DEMO_DIR, 'demo-password'), 'utf8').trim();
const login = await fetch(`${AUTH}/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.account, password }),
});
if (!login.ok) throw new Error(`login as ${data.account}: ${login.status}`);
const { token } = await login.json();
const call = async (method, path, body) => {
      const res = await fetch(`${API}${path}`, {
            method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${await res.text()}`);
      const text = await res.text();
      return text ? JSON.parse(text) : null;
};

const [cases, members] = [await call('GET', '/cas'), await call('GET', '/membres')];
if (cases.length || members.length) {
      throw new Error(`the API already has ${cases.length} cases and ${members.length} members: the seed runs once, on a new instance (demo-instance.sh up)`);
}

for (const nom of data.team) await call('POST', '/membres', { nom });
for (const c of [...data.cases].sort((a, b) => a.date.localeCompare(b.date))) {
      await call('POST', '/cas', { date: c.date, heure: c.heure, eleves: c.eleves });
}

const saved = await call('GET', '/cas');
const team2 = await call('GET', '/membres');
console.log(`seed: account ${data.account}, ${team2.length} members, ${saved.length} cases `
      + `(${saved.at(-1).date} to ${saved[0].date}), ${saved.reduce((n, c) => n + c.eleves.length, 0)} students`);
