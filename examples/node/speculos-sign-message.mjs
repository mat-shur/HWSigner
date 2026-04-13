const apiBaseUrl =
  process.env.HWSIGNER_SPECULOS_API_BASE_URL ?? 'http://localhost:3000/api/ledger/speculos';
const message = process.argv.slice(2).join(' ') || 'hello from HWSigner node example';

async function post(path, body) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const reason = payload?.error?.message ?? response.statusText;
    throw new Error(`${path} failed: ${reason}`);
  }

  return payload;
}

const { sessionToken, connection } = await post('/connect', {});

try {
  const { accounts } = await post('/accounts', {
    sessionToken,
    startIndex: 0,
    count: 1,
  });

  const { result } = await post('/sign-message', {
    sessionToken,
    accountIndex: 0,
    messageText: message,
    messageBase64: Buffer.from(message).toString('base64'),
    raw: false,
  });

  console.log(`Connected to ${connection.walletName}`);
  console.log(`Account: ${accounts[0]?.address ?? result.address}`);
  console.log(`Signature: ${result.signature}`);
} finally {
  await post('/disconnect', { sessionToken }).catch(() => {});
}
