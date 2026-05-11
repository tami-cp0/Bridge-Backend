import 'dotenv/config';
import axios from 'axios';

jest.setTimeout(20000);

describe('Squad API integration', () => {
  const squadBaseUrl =
    process.env.SQUAD_BASE_URL ?? 'https://sandbox-api-d.squadco.com';
  const squadSecretKey = process.env.SQUAD_SECRET_KEY;
  const beneficiaryAccount =
    process.env.SQUAD_BENEFICIARY_ACCOUNT ?? '0000000000';

  it('registers an investor via Squad customer virtual account', async () => {
    expect(squadSecretKey).toBeTruthy();
    expect(squadBaseUrl).toContain('sandbox');
    expect(beneficiaryAccount).toMatch(/^\d{10}$/);

    const response = await axios.post(
      `${squadBaseUrl}/virtual-account`,
      {
        customer_identifier: `itest-${Date.now()}`,
        first_name: 'Bridge',
        last_name: 'Sandbox',
        middle_name: 'N/A',
        mobile_num: '08012345678',
        dob: '01/01/1990',
        email: 'bridge-sandbox@example.com',
        bvn: '22123456789',
        gender: '1',
        address: 'Lagos, Nigeria',
        beneficiary_account: beneficiaryAccount,
      },
      {
        headers: {
          Authorization: `Bearer ${squadSecretKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    const data = response.data?.data ?? response.data;
    expect(data?.virtual_account_number).toBeTruthy();
  });

  it('registers a business via Squad business virtual account', async () => {
    expect(squadSecretKey).toBeTruthy();
    expect(squadBaseUrl).toContain('sandbox');
    expect(beneficiaryAccount).toMatch(/^\d{10}$/);

    const response = await axios.post(
      `${squadBaseUrl}/virtual-account/business`,
      {
        customer_identifier: `biz-itest-${Date.now()}`,
        business_name: 'Bridge Sandbox Business',
        mobile_num: '08012345678',
        bvn: '22123456789',
        beneficiary_account: beneficiaryAccount,
      },
      {
        headers: {
          Authorization: `Bearer ${squadSecretKey}`,
          'Content-Type': 'application/json',
        },
        validateStatus: () => true,
      },
    );

    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(300);
    const data = response.data?.data ?? response.data;
    expect(data?.virtual_account_number).toBeTruthy();
  });
});
