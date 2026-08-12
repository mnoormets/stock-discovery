// Ainus koht, kus test-andmebaasi URL defineeritakse, ja turvakaitse kiht K3.
//
// Vaikeväärtus osutab docker-compose `db` teenusele, sest testid jooksevad
// konteineris (hostil ei ole Node'i paigaldatud). GitHub Actionsis piisab
// TEST_DATABASE_URL keskkonnamuutuja seadmisest — koodimuudatust ei ole vaja.

const DEFAULT_TEST_DATABASE_URL = 'postgres://discovery:discovery@db:5432/discovery_test';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || DEFAULT_TEST_DATABASE_URL;

// Ei kasuta URL API-t: `postgres://` ei ole WHATWG "special scheme" ja parsimine
// erineb keskkondade vahel. Lihtne lõikamine on siin ennustatavam.
export function databaseName(url: string): string {
  const base = url.split('?')[0];
  const afterScheme = base.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  const slash = afterScheme.indexOf('/');
  return slash === -1 ? '' : afterScheme.slice(slash + 1);
}

export function withDatabase(url: string, name: string): string {
  const [base, query] = url.split('?');
  const afterScheme = base.replace(/^[a-zA-Z0-9+.-]+:\/\//, '');
  const slash = afterScheme.indexOf('/');
  if (slash === -1) throw new Error('TEST_DATABASE_URL ei sisalda andmebaasi teed.');
  const prefix = base.slice(0, base.length - afterScheme.length + slash + 1);
  return prefix + name + (query ? `?${query}` : '');
}

export const TEST_DB_NAME = databaseName(TEST_DATABASE_URL);

// Hooldusühendus (CREATE / DROP DATABASE) läheb `postgres` baasi, MITTE
// `discovery` vastu. Nii ei ava test-harness kunagi ühtki ühendust
// tootmisandmebaasi — ka mitte hetkeks.
export const MAINTENANCE_DATABASE_URL = withDatabase(TEST_DATABASE_URL, 'postgres');

export function redact(url: string): string {
  return url.replace(/\/\/[^@]*@/, '//***@');
}

// K3: keeldu enne kui midagi luuakse või kirjutatakse.
export function assertTestDatabaseName(name: string = TEST_DB_NAME): void {
  if (!name) {
    throw new Error(`TEST_DATABASE_URL ei sisalda andmebaasi nime: ${redact(TEST_DATABASE_URL)}`);
  }
  if (name === 'discovery') {
    throw new Error('KEELATUD: testid ei tohi kunagi kasutada tootmisandmebaasi "discovery".');
  }
  if (!name.endsWith('_test')) {
    throw new Error(`KEELATUD: test-andmebaasi nimi peab lõppema "_test"-iga, sai "${name}".`);
  }
  if (!/^[a-z0-9_]+$/.test(name)) {
    throw new Error(`KEELATUD: test-andmebaasi nimi sisaldab lubamatuid märke: "${name}".`);
  }
}
