import 'dotenv/config';
import axios from 'axios';

async function main() {
  const baseUrl =
    process.env.SQUAD_BASE_URL ?? 'https://sandbox-api-d.squadco.com';
  const secretKey = process.env.SQUAD_SECRET_KEY;

  if (!secretKey) {
    console.error('SQUAD_SECRET_KEY is required in .env');
    process.exit(1);
  }

  const response = await axios.post(
    `${baseUrl}/virtual-account/business`,
    {
      business_name: 'Bridge Platform',
      mobile_num: '08000000001',
      bvn: '22000000001',
      customer_identifier: 'bridge-platform-escrow',
      beneficiary_account: '0000000001',
    },
    {
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      validateStatus: () => true,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    console.error('Squad API error:', JSON.stringify(response.data, null, 2));
    process.exit(1);
  }

  const data = response.data?.data ?? response.data;
  const accountNumber: string = data?.virtual_account_number;

  if (!accountNumber) {
    console.error('No virtual_account_number in response:', JSON.stringify(response.data, null, 2));
    process.exit(1);
  }

  console.log('\n=== Bridge Escrow Account Created ===');
  console.log(`Virtual Account Number: ${accountNumber}`);
  console.log('\nAdd this to your .env file:');
  console.log(`SQUAD_ESCROW_ACCOUNT=${accountNumber}`);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('Script failed:', message);
  process.exit(1);
});
