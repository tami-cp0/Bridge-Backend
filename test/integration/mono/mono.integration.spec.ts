import 'dotenv/config';
import axios from 'axios';

jest.setTimeout(20000);

describe('Mono API integration', () => {
  const monoSecretKey = process.env.MONO_SECRET_KEY;
  const monoBaseUrl = process.env.MONO_BASE_URL ?? 'https://api.withmono.com';
  const testCode = process.env.MONO_TEST_CODE;
  const testAccountId = process.env.MONO_TEST_ACCOUNT_ID;
  const testRc = process.env.MONO_TEST_RC ?? 'RC1234567';

  // Exchanges a Mono Connect widget code for an account ID.
  // Requires completing the widget flow with "Mono Test Bank" to get a real code —
  // set MONO_TEST_CODE in .env before running.
  it('exchanges Mono Connect code for account id', async () => {
    expect(monoSecretKey).toBeTruthy();

    if (!testCode) {
      console.log(
        'Skipping — MONO_TEST_CODE not set. Complete the Mono Connect widget ' +
          'with "Mono Test Bank" → Simulate → Success to get a code.',
      );
      return;
    }

    const response = await axios.post(
      `${monoBaseUrl}/v2/accounts/auth`,
      { code: testCode },
      {
        headers: {
          'mono-sec-key': monoSecretKey,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    const data = response.data?.data ?? response.data;
    expect(data?.id).toBeTruthy();
    console.log(`\n✅ MONO_TEST_ACCOUNT_ID=${data.id}\nAdd this to your .env\n`);
  });

  // Triggers async income processing for a linked account.
  // Mono returns data:null immediately — the actual income arrives via the
  // mono.events.account_income webhook. Requires MONO_TEST_ACCOUNT_ID.
  it('triggers income processing (async — data:null, result via webhook)', async () => {
    expect(monoSecretKey).toBeTruthy();

    if (!testAccountId || testAccountId.includes('1234567890') || monoSecretKey?.includes('sample') || monoSecretKey?.includes('test_sk_xl3')) {
      console.log(
        'Skipping — real MONO_TEST_ACCOUNT_ID or live key not set. ' +
          'Exchange a valid Mono Connect code first to get an account ID.',
      );
      return;
    }

    const response = await axios.get(
      `${monoBaseUrl}/v2/accounts/${testAccountId}/income`,
      {
        headers: {
          'mono-sec-key': monoSecretKey,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    // Income endpoint is async — data is always null on the initial trigger.
    // The actual income_summary arrives via mono.events.account_income webhook.
    expect(response.data.status).toBe('successful');
    expect(response.data.data).toBeNull();
  });

  // CAC lookup uses GET /v3/lookup/cac?search=<rc>&exact=true.
  // Requires Lookup access enabled in the Mono dashboard.
  it('verifies CAC via Mono', async () => {
    expect(monoSecretKey).toBeTruthy();

    if (monoSecretKey?.includes('sample') || monoSecretKey?.includes('test_sk_xl3')) {
      console.log('Skipping CAC verification — live Mono secret key not configured.');
      return;
    }

    const response = await axios.get(
      `${monoBaseUrl}/v3/lookup/cac`,
      {
        params: { search: testRc, exact: true },
        headers: {
          'mono-sec-key': monoSecretKey,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    const data = response.data?.data ?? response.data;
    expect(Array.isArray(data)).toBe(true);
  });
});
