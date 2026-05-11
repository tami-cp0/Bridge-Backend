/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Walks the Mono Partners API sandbox flow to obtain a MONO_TEST_ACCOUNT_ID.
 *
 * ⚠️  Requires the "Partners API" add-on enabled in your Mono dashboard.
 *     If you see a 401 "You must be subscribed to Partners API addon" error,
 *     use the widget approach instead:
 *       1. Open scripts/mono-connect-test.html in a browser
 *       2. Complete the Mono Connect flow (pick any bank, use sandbox credentials)
 *       3. Copy the code shown on the page into .env as MONO_TEST_CODE
 *       4. Run the Mono integration tests — the first test will print MONO_TEST_ACCOUNT_ID
 *
 * Run: npm run script:mono-test-account
 */
import 'dotenv/config';
import axios from 'axios';

const BASE = process.env.MONO_BASE_URL ?? 'https://api.withmono.com';
const SECRET = process.env.MONO_SECRET_KEY;

if (!SECRET) {
  console.error('MONO_SECRET_KEY not set in .env');
  process.exit(1);
}

const client = axios.create({
  baseURL: BASE,
  headers: { 'mono-sec-key': SECRET, 'Content-Type': 'application/json' },
  validateStatus: () => true,
});

function unwrap(res: any, label: string): any {
  if (res.status < 200 || res.status >= 300) {
    console.error(`${label} failed (${res.status}):`, JSON.stringify(res.data, null, 2));
    process.exit(1);
  }
  return res.data?.data ?? res.data;
}

async function main() {
  // ── 1. Get available institutions ──────────────────────────────────────────
  console.log('1. Fetching institutions…');
  const instData = unwrap(
    await client.get('/v3/institutions', { params: { scope: 'financial_data' } }),
    'GET /v3/institutions',
  );
  const institutions: any[] = Array.isArray(instData)
    ? instData
    : instData?.institutions ?? [];

  if (!institutions.length) {
    console.error('No institutions returned. Check your secret key and Mono dashboard scope.');
    process.exit(1);
  }

  const inst = institutions[0];
  const authMethod = inst.auth_methods?.[0] ?? inst.authMethod ?? 'internet_banking';
  console.log(`   Using: ${inst.name} (${inst._id}), auth: ${authMethod}\n`);

  // ── 2. Create connect session ───────────────────────────────────────────────
  console.log('2. Creating connect session…');
  const sessionData = unwrap(
    await client.post('/v2/connect/session', {
      institution: inst._id,
      auth_method: authMethod,
      scope: 'financial_data',
      customer: { name: 'Bridge Test', email: 'test@bridge.com' },
    }),
    'POST /v2/connect/session',
  );
  const sessionId: string = sessionData?.id ?? sessionData?.session_id ?? sessionData?._id;
  if (!sessionId) {
    console.error('Could not extract session ID from:', sessionData);
    process.exit(1);
  }
  console.log(`   session_id: ${sessionId}\n`);

  const sessionHeaders = { 'x-session-id': sessionId };

  // ── 3. Fetch sandbox test credentials ──────────────────────────────────────
  console.log('3. Fetching sandbox credentials…');
  const creds = unwrap(
    await client.get('/v2/connect/sandbox', { headers: sessionHeaders }),
    'GET /v2/connect/sandbox',
  );
  console.log('   credentials:', JSON.stringify(creds, null, 4), '\n');

  // ── 4. Login ────────────────────────────────────────────────────────────────
  console.log('4. Logging in…');
  const loginRes = await client.post('/v2/connect/login', creds, {
    headers: sessionHeaders,
  });
  const loginData = loginRes.data?.data ?? loginRes.data;
  console.log('   login response:', JSON.stringify(loginRes.data, null, 4), '\n');

  let code: string | undefined =
    loginData?.code ?? loginData?.auth_code ?? loginData?.token;

  // ── 5. Commit (if login needs OTP / account selection) ─────────────────────
  if (!code) {
    console.log('5. No immediate code — trying commit…');
    const commitRes = await client.post('/v2/connect/commit', {}, {
      headers: sessionHeaders,
    });
    const commitData = commitRes.data?.data ?? commitRes.data;
    console.log('   commit response:', JSON.stringify(commitRes.data, null, 4), '\n');
    code = commitData?.code ?? commitData?.auth_code ?? commitData?.token;
  }

  if (!code) {
    console.error('Could not extract connect code from login/commit responses above.');
    process.exit(1);
  }
  console.log(`   connect code: ${code}\n`);

  // ── 6. Exchange code → account ID ──────────────────────────────────────────
  console.log('6. Exchanging code for account ID…');
  const authRes = await client.post('/v2/accounts/auth', { code });
  const authData = authRes.data?.data ?? authRes.data;
  console.log('   auth response:', JSON.stringify(authRes.data, null, 4), '\n');

  const accountId: string = authData?.id ?? authData?.account_id;
  if (!accountId) {
    console.error('Could not extract account ID from response above.');
    process.exit(1);
  }

  console.log('══════════════════════════════════════════');
  console.log('✅  Add this to your .env:');
  console.log(`    MONO_TEST_ACCOUNT_ID=${accountId}`);
  console.log('══════════════════════════════════════════');
}

main().catch((err) => {
  const detail = axios.isAxiosError(err) ? err.response?.data : err.message;
  console.error('Unexpected error:', detail ?? err);
  process.exit(1);
});
