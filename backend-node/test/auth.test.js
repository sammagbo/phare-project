// The auth service under the token contract: it does not start without the shared secret, it signs tokens for the
// pHARe API, requireAuth answers 401 with the RFC 6750 challenge, there is no sign-up route, and the CORS only answers
// the frontend's origins. The session lives in the phare_refresh cookie: rotated at each refresh, kept as a hash,
// revoked on reuse and on logout, and only reachable with a JSON body. Each run uses a throwaway SQLite file and an
// @example.com account.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SECRET = 'test-only-secret-for-the-phare-auth-tests-0123456789';
const ROOT = path.join(__dirname, '..');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'phare-auth-test-'));

process.env.JWT_SECRET = SECRET;
process.env.PHARE_DB_PATH = path.join(dir, 'auth.sqlite');
delete process.env.PHARE_ALLOWED_ORIGINS;

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../server');
const db = require('../src/db/database');
const UserModel = require('../src/models/userModel');

const EMAIL = 'membre@example.com';
const PASSWORD = 'Membre-2026!';
let server;
let base;
let userId;

before(async () => {
    userId = await UserModel.create(EMAIL, await bcrypt.hash(PASSWORD, 10));
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
    server.close();
    db.close();
    fs.rmSync(dir, { recursive: true, force: true });
});

/** `node <script>` in the service's folder, with only the environment given. */
const run = (args, env) => spawnSync(process.execPath, args, {
    cwd: ROOT,
    env: { PATH: process.env.PATH, ...env },
    encoding: 'utf8',
    timeout: 15000,
});

const login = () => fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

const COOKIE = 'phare_refresh';

/** The Set-Cookie line of the session cookie in a response, or undefined. */
const sessionCookieLine = (res) => res.headers.getSetCookie().find((line) => line.startsWith(`${COOKIE}=`));

/** The value of the session cookie a response sets. */
const sessionCookie = (res) => sessionCookieLine(res)?.split(';')[0].slice(COOKIE.length + 1);

/** POST /api/auth/<route> as the browser would, with the session cookie and a JSON body by default. */
const post = (route, { cookie, type = 'application/json', body = '{}' } = {}) => fetch(`${base}/api/auth/${route}`, {
    method: 'POST',
    headers: { 'Content-Type': type, ...(cookie ? { Cookie: `${COOKIE}=${cookie}` } : {}) },
    body,
});

const sql = (query, params = []) => new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => (err ? reject(err) : resolve(rows)));
});

const sha256 = (value) => crypto.createHash('sha256').update(value, 'utf8').digest('hex');

test('refuses to start without JWT_SECRET', () => {
    const result = run(['server.js'], { PORT: '0', PHARE_DB_PATH: path.join(dir, 'unused.sqlite') });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JWT_SECRET is missing or shorter than 32 bytes/);
});

test('refuses to start with a secret shorter than 32 bytes', () => {
    const result = run(['server.js'], { PORT: '0', PHARE_DB_PATH: path.join(dir, 'unused.sqlite'), JWT_SECRET: 'x'.repeat(31) });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /JWT_SECRET is missing or shorter than 32 bytes/);
});

test('the login token carries the claims of the contract', async () => {
    const res = await login();
    assert.equal(res.status, 200);
    const { token } = await res.json();
    assert.equal(jwt.decode(token, { complete: true }).header.alg, 'HS256');
    const claims = jwt.verify(token, SECRET, { algorithms: ['HS256'], issuer: 'phare-auth', audience: 'phare-api' });
    assert.equal(claims.iss, 'phare-auth');
    assert.equal(claims.aud, 'phare-api');
    assert.equal(claims.sub, String(userId));
    assert.equal(claims.email, EMAIL);
    assert.equal(claims.exp - claims.iat, 15 * 60);
});

test('requireAuth accepts the login token and refuses a token for another audience', async () => {
    const { token } = await (await login()).json();
    const me = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(me.status, 200);
    assert.equal((await me.json()).user.email, EMAIL);

    const other = jwt.sign({ email: EMAIL }, SECRET, {
        algorithm: 'HS256', issuer: 'phare-auth', audience: 'another-api', subject: String(userId), expiresIn: '15m',
    });
    const refused = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${other}` } });
    assert.equal(refused.status, 401);
    assert.equal(refused.headers.get('www-authenticate'), 'Bearer error="invalid_token"');
});

test('requireAuth: 401 with the Bearer challenge without a token, and invalid_token for a bad or expired one', async () => {
    const missing = await fetch(`${base}/api/auth/me`);
    assert.equal(missing.status, 401);
    assert.equal(missing.headers.get('www-authenticate'), 'Bearer');

    const garbage = await fetch(`${base}/api/auth/me`, { headers: { Authorization: 'Bearer not-a-token' } });
    assert.equal(garbage.status, 401);
    assert.equal(garbage.headers.get('www-authenticate'), 'Bearer error="invalid_token"');

    const now = Math.floor(Date.now() / 1000);
    const expired = jwt.sign({ email: EMAIL, iat: now - 25 * 60, exp: now - 10 * 60 }, SECRET, {
        algorithm: 'HS256', issuer: 'phare-auth', audience: 'phare-api', subject: String(userId),
    });
    const late = await fetch(`${base}/api/auth/me`, { headers: { Authorization: `Bearer ${expired}` } });
    assert.equal(late.status, 401);
    assert.equal(late.headers.get('www-authenticate'), 'Bearer error="invalid_token"');
});

test('there is no sign-up route', async () => {
    const res = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nouveau@example.com', password: 'Nouveau-2026!' }),
    });
    assert.equal(res.status, 404);
});

test('an origin outside the list gets no Access-Control-Allow-Origin', async () => {
    const evil = await fetch(`${base}/health`, { headers: { Origin: 'http://evil.example' } });
    assert.equal(evil.headers.get('access-control-allow-origin'), null);
    const frontend = await fetch(`${base}/health`, { headers: { Origin: 'http://localhost:8000' } });
    assert.equal(frontend.headers.get('access-control-allow-origin'), 'http://localhost:8000');
    assert.equal(frontend.headers.get('access-control-allow-credentials'), 'true');
});

test('the account script creates an account on a brand-new database, and refuses a taken email or a weak password', () => {
    const fresh = path.join(dir, 'fresh.sqlite');
    const created = run(['scripts/create-user.js', 'Nouveau@Example.com'], { PHARE_DB_PATH: fresh, PHARE_PASSWORD: 'Nouveau-2026!' });
    assert.equal(created.status, 0, created.stderr);
    assert.match(created.stdout, /Account created for nouveau@example.com/);

    const taken = run(['scripts/create-user.js', 'nouveau@example.com'], { PHARE_DB_PATH: fresh, PHARE_PASSWORD: 'Nouveau-2026!' });
    assert.equal(taken.status, 1);
    assert.match(taken.stderr, /already exists/);

    const weak = run(['scripts/create-user.js', 'autre@example.com'], { PHARE_DB_PATH: fresh, PHARE_PASSWORD: 'faible' });
    assert.equal(weak.status, 1);
    assert.match(weak.stderr, /at least 8 characters/);
    assert.doesNotMatch(weak.stdout + weak.stderr, /faible/);

    const usage = run(['scripts/create-user.js', 'autre@example.com'], { PHARE_DB_PATH: fresh });
    assert.equal(usage.status, 2);
});

test('login: the refresh token goes in an HttpOnly, SameSite=Strict cookie on /api/auth, never in the body', async () => {
    const res = await login();
    assert.equal(res.status, 200);
    const line = sessionCookieLine(res);
    assert.ok(line, 'a phare_refresh cookie');
    assert.ok(sessionCookie(res).length >= 40);
    assert.match(line, /; HttpOnly/);
    assert.match(line, /; SameSite=Strict/);
    assert.match(line, /; Path=\/api\/auth/);
    assert.match(line, /; Max-Age=604800/);
    assert.doesNotMatch(line, /; Secure/, 'no Secure over plain http');
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['token', 'user']);
    assert.equal(body.user.email, EMAIL);
});

test('refresh: the cookie gets an access token and a new cookie; the replaced one works once in 30 s, without a cookie', async () => {
    const first = sessionCookie(await login());

    const rotated = await post('refresh', { cookie: first });
    assert.equal(rotated.status, 200);
    const claims = jwt.verify((await rotated.json()).token, SECRET, { algorithms: ['HS256'], issuer: 'phare-auth', audience: 'phare-api' });
    assert.equal(claims.sub, String(userId));
    const second = sessionCookie(rotated);
    assert.ok(second);
    assert.notEqual(second, first);

    // a second tab that sent the replaced cookie at the same time
    const grace = await post('refresh', { cookie: first });
    assert.equal(grace.status, 200);
    assert.ok((await grace.json()).token);
    assert.deepEqual(grace.headers.getSetCookie(), []);

    const third = sessionCookie(await post('refresh', { cookie: second }));
    assert.ok(third);

    // once only: the same replaced cookie again is a reuse, and the session ends
    assert.equal((await post('refresh', { cookie: first })).status, 401);
    assert.equal((await post('refresh', { cookie: third })).status, 401);
});

test('refresh: a replaced cookie after 30 s is a reuse, and it revokes the whole session', async () => {
    const first = sessionCookie(await login());
    const second = sessionCookie(await post('refresh', { cookie: first }));
    assert.ok(second);
    await sql('UPDATE refresh_tokens SET replaced_at = ? WHERE token_hash = ?', [new Date(Date.now() - 31 * 1000).toISOString(), sha256(first)]);

    const reuse = await post('refresh', { cookie: first });
    assert.equal(reuse.status, 401);
    assert.equal((await post('refresh', { cookie: second })).status, 401, 'the newest cookie dies with its session');
});

test('refresh: 401 without a cookie; refresh and logout answer 415 to another Content-Type', async () => {
    assert.equal((await post('refresh')).status, 401);

    const cookie = sessionCookie(await login());
    assert.equal((await post('refresh', { cookie, type: 'application/x-www-form-urlencoded', body: 'a=1' })).status, 415);
    assert.equal((await post('logout', { cookie, type: 'text/plain' })).status, 415);
    assert.equal((await post('refresh', { cookie })).status, 200, 'the 415s left the session alone');
});

test('logout: no access token needed; 204, the cookie deleted, and the session gone', async () => {
    const cookie = sessionCookie(await login());
    const res = await post('logout', { cookie });
    assert.equal(res.status, 204);
    const line = sessionCookieLine(res);
    assert.match(line, /^phare_refresh=;/);
    assert.match(line, /; Max-Age=0/);
    assert.match(line, /; Path=\/api\/auth/);
    assert.equal((await post('refresh', { cookie })).status, 401);

    assert.equal((await post('logout')).status, 204, 'without a cookie too');
});

test('the database keeps only the SHA-256 of each refresh token', async () => {
    const cookie = sessionCookie(await login());
    const rows = await sql('SELECT * FROM refresh_tokens');
    assert.ok(rows.length > 0);
    assert.ok(!JSON.stringify(rows).includes(cookie));
    assert.ok(rows.some((row) => row.token_hash === sha256(cookie)));
});

test('on start, the old table with the tokens in clear is dropped and replaced', () => {
    const old = path.join(dir, 'old.sqlite');
    const prepare = run(['-e', `
        const sqlite3 = require('sqlite3');
        const db = new sqlite3.Database(${JSON.stringify(old)});
        db.serialize(() => {
            db.run('CREATE TABLE refresh_tokens (id INTEGER PRIMARY KEY AUTOINCREMENT, token TEXT UNIQUE NOT NULL, user_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, expires_at DATETIME NOT NULL)');
            db.run("INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ('an-old-token-in-clear', 1, '2099-01-01')");
        });
        db.close();
    `], {});
    assert.equal(prepare.status, 0, prepare.stderr);

    const started = run(['-e', `
        const db = require('./src/db/database');
        db.ready.then(() => db.all('PRAGMA table_info(refresh_tokens)', (err, columns) => {
            db.all('SELECT * FROM refresh_tokens', (err2, rows) => {
                console.log(JSON.stringify({ columns: columns.map((c) => c.name), rows }));
                db.close();
            });
        }));
    `], { PHARE_DB_PATH: old });
    assert.equal(started.status, 0, started.stderr);
    const { columns, rows } = JSON.parse(started.stdout);
    assert.ok(!columns.includes('token'));
    assert.ok(columns.includes('token_hash'));
    assert.deepEqual(rows, []);
});
