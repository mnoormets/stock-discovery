import { describe, expect, it } from 'vitest';

// Guard on PUHAS funktsioon ja seda testitakse ilma ühtki andmebaasi puudutamata
// — sh ilma päris golden source'iga (Neon) ühendumata. Sellepärast on
// `isScratchDatabase` ja `assertDatabaseAllowed` runnerist eksporditud.
const { isScratchDatabase, assertDatabaseAllowed } = await import('../../scripts/migrate.cjs');

// Cutover 2026-08-19: golden source liikus koduarvuti lokaalsest Docker
// Postgresist Neoni ja sai seal nime `neondb`. Vana guard võrdles sihtbaasi nime
// TÄPSELT stringiga 'discovery', seega ta ei saanud põhimõtteliselt käivituda
// päris baasi vastu — kaitstud jäi ainult külmutatud lokaalne koopia. Kaitse oli
// tagurpidi. Need testid lukustavad ümberpööratud polaarsuse: kaitstud on KÕIK,
// mis ei ole tõestatavalt äraviskamiseks mõeldud ajutine baas.
const GOLDEN_SOURCE_NOW = 'neondb';   // Neon, praegune päris golden source
const FROZEN_LOCAL = 'discovery';     // külmutatud cutover-eelne snapshot

describe('migrate guard: fail-closed sihtbaasi kaitse', () => {
  it('kaitseb päris golden source\'i (Neon/neondb) ilma eksplitsiitse kinnituseta', () => {
    expect(isScratchDatabase(GOLDEN_SOURCE_NOW)).toBe(false);
    expect(() => assertDatabaseAllowed(GOLDEN_SOURCE_NOW, false))
      .toThrow(/KEELATUD: sihtbaas on "neondb"/);
    // Veateade peab nimetama ÕIGE lipu, muidu ei tea kasutaja, kuidas edasi.
    expect(() => assertDatabaseAllowed(GOLDEN_SOURCE_NOW, false))
      .toThrow(/--allow-golden-source/);
  });

  it('lubab päris golden source\'i AINULT eksplitsiitse kinnitusega', () => {
    expect(() => assertDatabaseAllowed(GOLDEN_SOURCE_NOW, true)).not.toThrow();
  });

  it('hoiab külmutatud lokaalse "discovery" baasi endiselt kaitstuna', () => {
    // Teadlik otsus: see on ainus cutover-eelse ajaloo koopia ja taastepunkt,
    // seega kaotus oleks pöördumatu. Kaitse hind on üks lipp.
    expect(isScratchDatabase(FROZEN_LOCAL)).toBe(false);
    expect(() => assertDatabaseAllowed(FROZEN_LOCAL, false)).toThrow(/KEELATUD/);
    expect(() => assertDatabaseAllowed(FROZEN_LOCAL, true)).not.toThrow();
  });

  it('lubab testharnessi baasi ilma lipuga — muidu katkeks kogu testikomplekt', () => {
    // tests/setup/global-setup.ts kutsub runMigrations() SIHILIKULT ilma
    // kinnituslipuga, et runneri enda kaitse jääks viimaseks kaitseliiniks.
    // Kui see test kukub, on testibaasi ehitamine katki.
    expect(isScratchDatabase('discovery_test')).toBe(true);
    expect(() => assertDatabaseAllowed('discovery_test', false)).not.toThrow();
  });

  it('lubab dokumenteeritud ajutised baasid ilma lipuga', () => {
    // `schema_conformance_diff_tmp` on runneri enda conformance-referents
    // (TMP_SUFFIX); `*_migration_tmp` on runbookis soovitatud käsitsi-nimi.
    expect(() => assertDatabaseAllowed('schema_conformance_diff_tmp', false)).not.toThrow();
    expect(() => assertDatabaseAllowed('minu_migration_tmp', false)).not.toThrow();
  });

  // Just SEE omadus puudus vanal nimekirja-põhisel guardil: iga baas, mida
  // nimekirjas ei olnud, oli vaikimisi migreeritav. Ükski tulevane Neoni
  // branch, projekt ega host ei tohi kaitset vaikselt maha võtta.
  it.each([
    'neondb',
    'discovery',
    'postgres',
    'stock_discovery',
    'neondb_prod',
    'golden_source',
  ])('on ümbernimetamiskindel: mitte-ajutine nimi %s on kaitstud', (dbName) => {
    expect(isScratchDatabase(dbName)).toBe(false);
    expect(() => assertDatabaseAllowed(dbName, false)).toThrow(/KEELATUD/);
  });

  it.each([
    'test_golden_source',
    'tmp_discovery',
    'discovery_testing',
    'neondb_temp',
  ])('nõuab, et _test/_tmp oleks SUFIKS: %s ei lähe ajutiseks arvesse', (dbName) => {
    // Muidu annaks nimi nagu `test_golden_source` end ekslikult ajutiseks välja
    // ja kaotaks kaitse.
    expect(isScratchDatabase(dbName)).toBe(false);
    expect(() => assertDatabaseAllowed(dbName, false)).toThrow(/KEELATUD/);
  });

  it('ei sõltu enam nimest "discovery" — vana guardi täpne rikkeviis', () => {
    // Vana loogika oli `dbName === 'discovery'`. Tõestame mõlemad pooled:
    // vana guard oleks päris golden source'i läbi lasknud, uus keeldub.
    const oldGuardWouldBlock = (dbName: string) => dbName === 'discovery';
    expect(oldGuardWouldBlock(GOLDEN_SOURCE_NOW)).toBe(false);
    expect(() => assertDatabaseAllowed(GOLDEN_SOURCE_NOW, false)).toThrow(/KEELATUD/);
  });
});
