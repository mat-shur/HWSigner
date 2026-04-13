import {
  createPlaygroundTransaction,
  createPlaygroundVersionedTransaction,
  serializeTransactionForLedger,
  summarizeTransaction,
} from '../../dist/core.js';

const fromAddress =
  process.env.HWSIGNER_EXAMPLE_FROM ?? 'EDUded8fGxKkRTWWjE9YFzCmrW54aXXabVKLn3NyvHqV';

const legacy = createPlaygroundTransaction({ fromAddress });
const versioned = createPlaygroundVersionedTransaction({ fromAddress });
const legacyPayload = serializeTransactionForLedger(legacy);
const versionedPayload = serializeTransactionForLedger(versioned);

console.log('Legacy transaction summary');
console.log(JSON.stringify(summarizeTransaction(legacy), null, 2));
console.log(`Ledger payload: ${legacyPayload.version}, ${legacyPayload.bytes.length} bytes`);

console.log('\nVersioned transaction summary');
console.log(JSON.stringify(summarizeTransaction(versioned), null, 2));
console.log(`Ledger payload: ${versionedPayload.version}, ${versionedPayload.bytes.length} bytes`);
