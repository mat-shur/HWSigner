export type SpeculosGuideLink = {
  title: string;
  href: string;
  description: string;
};

export type SpeculosGuideStep = {
  title: string;
  body: string;
  command?: string;
};

export const speculosGuideLinks: SpeculosGuideLink[] = [
  {
    title: 'Speculos GitHub',
    href: 'https://github.com/LedgerHQ/speculos',
    description: 'Official emulator repository, releases, and issues.',
  },
  {
    title: 'Speculos Usage Docs',
    href: 'https://speculos.ledger.com/user/usage.html',
    description: 'CLI flags, display modes, REST API, and button control.',
  },
  {
    title: 'Ledger Transport Docs',
    href: 'https://developers.ledger.com/docs/device-interaction/integration/how_to/transports',
    description: 'Official DMK transport overview, including Speculos and React Native transports.',
  },
  {
    title: 'Ledger Solana App',
    href: 'https://github.com/LedgerHQ/app-solana',
    description: 'Official Solana app source used to build the .elf for Speculos.',
  },
];

export const speculosGuideSteps: SpeculosGuideStep[] = [
  {
    title: '1. Build the Solana app and locate app.elf',
    body: 'Clone the official Ledger Solana app, pull the dev-tools image, then build inside the container. After the build, locate the generated app.elf under the device-specific build folder.',
    command: [
      'git clone https://github.com/LedgerHQ/app-solana.git',
      'cd app-solana',
      'docker pull ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools:latest',
      'docker run --rm -ti --privileged -v "$(Get-Location):/app" ghcr.io/ledgerhq/ledger-app-builder/ledger-app-dev-tools:latest',
      'BOLOS_SDK=$NANOS_SDK make',
      'find /app -name "*.elf"',
    ].join('\n'),
  },
  {
    title: '2. Run Speculos from the host shell, not from the build container',
    body: 'The chat log showed the most common mistake: running docker commands from inside the ledger-app-dev-tools container prompt. Exit that prompt first, then start Speculos from host PowerShell or WSL.',
    command: [
      'cd C:\\Users\\matsh\\Desktop\\ledger_emul\\app-solana\\build\\nanos2\\bin',
      'docker run --rm -it `',
      '  -p 5000:5000 `',
      '  -p 9999:9999 `',
      '  -v "${PWD}:/speculos/apps" `',
      '  ghcr.io/ledgerhq/speculos `',
      '  --model nanosp `',
      '  --display headless `',
      '  --api-port 5000 `',
      '  /speculos/apps/app.elf',
    ].join('\n'),
  },
  {
    title: '3. Verify the local API',
    body: 'Speculos should expose a REST API on 127.0.0.1:5000. Once that answers, the local bridge in HWSigner can connect to it.',
    command: [
      'curl.exe http://127.0.0.1:5000',
      'curl.exe -d "{\\"action\\":\\"press-and-release\\"}" http://127.0.0.1:5000/button/left',
      'curl.exe -o screenshot.png http://127.0.0.1:5000/screenshot',
    ].join('\n'),
  },
  {
    title: '4. If text mode crashes, stay on headless',
    body: 'Your notes already hit the TextScreen crash on Windows. For that setup, keep --display headless. It is enough for the local bridge, smoke tests, and API-driven button presses.',
  },
  {
    title: '5. Optional WSL/bash variant',
    body: 'If you prefer WSL instead of host PowerShell, the command is the same but uses bash path expansion and backslashes for line continuation.',
    command: [
      'cd /mnt/c/Users/matsh/Desktop/ledger_emul/app-solana/build/nanos2/bin',
      'docker run --rm -it \\',
      '  -p 5000:5000 \\',
      '  -p 9999:9999 \\',
      '  -v "$(pwd):/speculos/apps" \\',
      '  ghcr.io/ledgerhq/speculos \\',
      '  --model nanosp \\',
      '  --display headless \\',
      '  --api-port 5000 \\',
      '  /speculos/apps/app.elf',
    ].join('\n'),
  },
];

export const speculosGuideNotes = [
  'Do not run docker commands from inside the ledger-app-dev-tools container prompt like `(venv) root@...:/app#`.',
  'Use `serialized-transaction` first. Switch payload modes only when you are testing Speculos compatibility.',
  'Speculos is useful for adapter logic, derivation, signing, and error handling. It is not a substitute for real USB or BLE testing.',
  'React Native transports are separate from Speculos. The current demo only ships WebHID and the local Speculos bridge.',
];
