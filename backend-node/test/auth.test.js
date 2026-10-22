// The auth service under the token contract: it does not start without the shared secret, it signs tokens for the
// pHARe API, requireAuth checks the issuer and the audience, there is no sign-up route, and the CORS only answers the
// frontend's origins. Each run uses a throwaway SQLite file and an @example.com account.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { spawnSync } = require('node:child_process');
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
    assert.equal(refused.status, 403);
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
