import { lookupBooking } from '../src/lib/lookup';
import { formatBooking } from '../src/lib/format';

async function main() {
  const [code, lastName, firstName] = process.argv.slice(2);
  if (!code || !lastName || !firstName) {
    console.error('Usage: tsx scripts/cli.ts <code> <lastName> <firstName>');
    process.exit(1);
  }

  const result = await lookupBooking(code, lastName, firstName);
  if (!result.status) {
    console.error('Lookup failed:', result.message);
    process.exit(1);
  }

  console.log('=== style: en ===');
  console.log(formatBooking(result.reservation, 'en'));
  console.log('\n=== style: vi-short ===');
  console.log(formatBooking(result.reservation, 'vi-short'));
  console.log('\n=== style: en-long ===');
  console.log(formatBooking(result.reservation, 'en-long'));
}

main().catch((err) => {
  console.error('ERROR:', err);
  process.exit(1);
});
