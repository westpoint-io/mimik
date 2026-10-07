export const SAMPLES = [
  'jane.doe@example.com',
  'Contact JANE_DOE+news@Mail.Example.co.uk today',
  'a@b.c',
  'a@b.co',
  'first.last%tag@sub-domain.example.org.',
  'no-at-sign.example.com',
  'name@localhost',
  'x@y.z1',
  'user@@example.com',
  '@example.com',
  'mail me at bob@ex-ample.io, or alice@example.com.',
  'émile@example.fr',
  'trailing@example.c0m',
  'under_score@exa_mple.com',
  '123-45-6789',
  '123456789',
  'SSN: 123-456789 and 12345-6789',
  '1234-56-789',
  '0123-45-6789',
  '123-45-67890',
  'id 987-65-4321.',
  '4111111111111111',
  '4111 1111 1111 1111',
  '4111-1111-1111-1111',
  '4111 - 1111 - 1111 - 1111',
  '378282246310005',
  '4222222222222',
  '1234567890123456789',
  '12345678901234567890',
  'card:4111111111111111x',
  '4111 1111 1111 111 ',
  '555-123-4567',
  '(555) 123-4567',
  '(555)123-4567',
  '555.123.4567',
  '+1 555 123 4567',
  '+44 20 7946 0958',
  '+351912345678',
  '020 7946 0958',
  '07911 123456',
  '5551234567',
  '15551234567',
  'call 555 123 4567 now',
  'order 12345, qty 3, 2024-01-31',
  'ref 1234567',
  '+1-555-123-4567',
  '+1.555.123.4567',
  '00351 912 345 678',
  '192.168.0.1',
  '10.0.0.255',
  '256.1.1.1',
  '1.2.3',
  '1.2.3.4.5',
  '001.002.003.004',
  '127.0.0.1:8080',
  'v1.2.3.4-beta',
  '255.255.255.255',
  '99.199.249.255',
  '0.0.0.0',
  '01:23:45:67:89:ab',
  '01-23-45-67-89-AB',
  'AA:BB:CC:DD:EE',
  'AA:BB:CC:DD:EE:FF:00',
  'aa:bb-cc:dd-ee:ff',
  'mac=0a:1b:2c:3d:4e:5f;',
  'Mixed: jane@example.com, 555-123-4567, 192.168.1.10 and 4111 1111 1111 1111.',
  'Line one 123-45-6789\nline two 10.0.0.1\nthree aa:bb:cc:dd:ee:ff',
  '',
  '   ',
  'nothing sensitive here',
];

const ALPHABET = '0123456789012345678901234567890123456789 -.:()+@_%abcdefxyzABCF\n';

function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export function fuzzSamples(count: number, seed: number): string[] {
  const next = seeded(seed);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const length = 4 + Math.floor(next() * 36);
    let text = '';
    for (let j = 0; j < length; j++) text += ALPHABET[Math.floor(next() * ALPHABET.length)];
    out.push(text);
  }
  return out;
}

export function shapedSamples(count: number, seed: number): string[] {
  const next = seeded(seed);
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const digits = (n: number) => Array.from({ length: n }, () => pick('0123456789'.split(''))).join('');
  const hex = (n: number) => Array.from({ length: n }, () => pick('0123456789abcdefABCDEFgG'.split(''))).join('');
  const word = (n: number) => Array.from({ length: n }, () => pick('abcxyzABC_.%+-0123'.split(''))).join('');
  const parts = [
    () => digits(1 + Math.floor(next() * 5)),
    () => digits(9 + Math.floor(next() * 12)),
    () => hex(2),
    () => word(1 + Math.floor(next() * 8)),
    () => '@',
    () => pick(['.', '-', ' ', ':', '(', ')', '+', '  ', ' - ', '.', '-']),
    () => pick(['com', 'io', 'co.uk', 'c', 'x1', 'ORG']),
    () => `${digits(1 + Math.floor(next() * 3))}.${digits(1 + Math.floor(next() * 3))}`,
    () =>
      Array.from({ length: 3 + Math.floor(next() * 3) }, () =>
        pick([digits(1), digits(2), digits(3), `2${pick(['4', '5', '6'])}${digits(1)}`, `0${digits(2)}`]),
      ).join(pick(['.', '.', '.', ':'])),
    () => {
      const groups = 4 + Math.floor(next() * 4);
      const pair = () => (next() < 0.92 ? pick('0123456789abcdefABCDEF'.split('')) : pick('gGxz'.split('')));
      const group = () => Array.from({ length: next() < 0.9 ? 2 : pick([1, 3]) }, pair).join('');
      const separator = () => (next() < 0.85 ? pick([':', '-']) : pick(['.', '', ' ']));
      return Array.from({ length: groups }, (_, index) => (index === 0 ? '' : separator()) + group()).join('');
    },
    () =>
      `${word(1 + Math.floor(next() * 6))}@${word(1 + Math.floor(next() * 6))}.${pick(['com', 'io', 'c', 'co.uk', 'x1', '1a'])}`,
  ];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const pieces = 2 + Math.floor(next() * 9);
    let text = '';
    for (let j = 0; j < pieces; j++) text += pick(parts)();
    out.push(text);
  }
  return out;
}

export const PAGES = [
  '<p>Email jane@example.com and call 555-123-4567.</p>',
  '<div><span>192.168.0.1</span> <b>4111 1111 1111 1111</b></div>',
  '<p>a <em>jane@</em>example.com split across nodes</p>',
  '<script>var x = "jane@example.com"</script><p>visible bob@example.com</p>',
  '<style>.a{content:"x@y.com"}</style><noscript>n@o.com</noscript>',
  '<textarea>t@example.com</textarea><input value="i@example.com"><input value="plain">',
  '<select><option>o@example.com</option></select>',
  '<p title="attr@example.com">no text match</p>',
  '<svg><text>svg@example.com</text></svg>',
  '<ul><li>123-45-6789</li><li>   </li><li></li><li>aa:bb:cc:dd:ee:ff</li></ul>',
  '<p>one jane@example.com two bob@example.com three 10.0.0.1</p>',
  '<input value="call 555-123-4567"><input type="hidden" value="h@example.com">',
];
