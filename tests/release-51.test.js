/* Release 5.1 (the Risk Application 1.3 and the Investment Application 1.2; the Fact Find 5.1 carries the new names in its Other forms menu).
   Paul's list of 18 November 2026: (1) the Short Risk Application is called Risk Application, and the Investment Capture Sheet Investment Application; (2) where the policy owner pays, the account holder, contact number and
   e-mail in Banking start as the client's; (3) the pages are called Home COC & doctor, Dependents & Beneficiaries, Declarations & Replacements; (4) the replaced policy's Company is a drop-down of life insurers;
   (5) Bank name is a drop-down of the banks (Go Tyme Bank and the others added) that really works; (6) Branch name is a drop-down with Universal, or typed; (7) Region is a drop-down of the nine provinces.
   No id changed. The browser side is tests/browser/t-release51.js. */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const schema = require('../app/js/schema.js');
const SR = require('../app/js/sr-schema.js');
const store = require('../app/js/sr-store.js');
const CS = require('../app/js/cs-schema.js');

const app = f => fs.readFileSync(path.join(__dirname, '..', 'app', f), 'utf8');
const set = (s, id, v) => store.setField(s, id, v);
const holder = s => [s.f.acc_holder, s.f.bank_contact, s.f.bank_email].map(b => b.v + '/' + b.st);

test('versions: Fact Find 5.1, Risk Application 1.3, Investment Application 1.2; every page carries the same build', () => {
  assert.ok(parseFloat(schema.version) >= 5.1, schema.version);
  assert.strictEqual(SR.version, '1.3'); assert.strictEqual(CS.version, '1.2');
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => assert.ok(app(f).includes('<meta name="wr-build" content="' + schema.version + '">'), f));
});

test('the names (1): Risk Application and Investment Application on the screen, in the title bar, the menus and the PDF headings; the old names are gone from what is shown', () => {
  assert.strictEqual(SR.title, 'Risk Application'); assert.strictEqual(CS.title, 'Investment Application');
  assert.match(app('short-risk.html'), /<title>Risk Application<\/title>/); assert.match(app('short-risk.html'), /<h1>Risk Application<\/h1>/);
  assert.match(app('capture-sheet.html'), /<title>Investment Application<\/title>/); assert.match(app('capture-sheet.html'), /<h1>Investment Application<\/h1>/);
  ['index.html', 'short-risk.html', 'capture-sheet.html'].forEach(f => { const h = app(f); assert.ok(!/Short Risk Application|Investment Capture Sheet/.test(h), f + ' still shows an old name'); });
  assert.match(app('index.html'), /id="linkSR"[^>]*>Risk Application &#8599;</); assert.match(app('index.html'), /id="linkCS"[^>]*>Investment Application &#8599;</);
  assert.match(app('js/sr-pdf.js'), /'Risk Application - '/); assert.match(app('js/cs-pdf.js'), /'Investment Application - '/);
  assert.match(app('js/sr-pdf.js'), /doc\.text\('RISK APPLICATION'/); assert.match(app('js/cs-pdf.js'), /doc\.text\('INVESTMENT APPLICATION'/);
  assert.match(app('js/sr-pdf.js'), /'WR Risk Application v'/); assert.match(app('js/cs-pdf.js'), /'WR Investment Application v'/);
  assert.strictEqual(SR.sectionsById.bank.title, 'Banking details of the person paying the premium', 'a section keeps its own title');
});

test('the names (3): the three pages are renamed, their ids are not (an id never changes with its label)', () => {
  assert.deepStrictEqual(SR.pages.map(p => p.id), ['client', 'home', 'bank', 'family', 'decl']);
  assert.deepStrictEqual(SR.pages.map(p => p.title), ['Cover & client', 'Home COC & doctor', 'Banking', 'Dependents & Beneficiaries', 'Declarations & Replacements']);
});

test('the lists (5, 4, 7): banks (the old ten kept, Go Tyme Bank added), life insurers and the nine provinces, each alphabetical and without a repeat', () => {
  const sorted = a => a.slice().sort((x, y) => x.toLowerCase().localeCompare(y.toLowerCase()));
  ['ABSA', 'African Bank', 'Bidvest Bank', 'Capitec', 'Discovery Bank', 'FNB', 'Investec', 'Nedbank', 'Standard Bank', 'TymeBank'].forEach(b => assert.ok(SR.banks.indexOf(b) >= 0, 'the old bank ' + b + ' is still in the list'));
  ['Go Tyme Bank', 'Bank Zero', 'Postbank', 'Ubank', 'Grindrod Bank', 'Sasfin Bank', 'Mercantile Bank'].forEach(b => assert.ok(SR.banks.indexOf(b) >= 0, b));
  assert.deepStrictEqual(SR.banks, sorted(SR.banks)); assert.strictEqual(new Set(SR.banks.map(x => x.toLowerCase())).size, SR.banks.length);
  SR.insurers.forEach(i => assert.ok(SR.lifeInsurers.some(x => x.toLowerCase() === i.toLowerCase()), 'the insurer ' + i + ' the form offers is in the life insurers too'));
  ['Old Mutual', 'Sanlam', 'Discovery', 'Momentum', 'Liberty', 'BrightRock', 'Hollard Life', 'Assupol', 'Clientele', 'Metropolitan', '1Life', 'Absa Life', 'FNB Life', 'PPS', 'AVBOB', 'Bidvest Life'].forEach(i => assert.ok(SR.lifeInsurers.indexOf(i) >= 0, i));
  assert.deepStrictEqual(SR.lifeInsurers, sorted(SR.lifeInsurers)); assert.strictEqual(new Set(SR.lifeInsurers).size, SR.lifeInsurers.length);
  assert.deepStrictEqual(SR.provinces, ['Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal', 'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape']);
});

test('the boxes: Bank name, Branch name, the replaced policy’s Company and Account type pick from a list or type their own; Region picks from the provinces; no id changed', () => {
  const f = id => SR.fieldsById[id];
  assert.deepStrictEqual([f('bank').t, f('bank').free, f('bank').o === SR.banks], ['sel', 1, true]);
  assert.deepStrictEqual([f('branch').t, f('branch').free, f('branch').o], ['sel', 1, ['Universal']]);
  assert.deepStrictEqual([f('old_company').t, f('old_company').free, f('old_company').o === SR.lifeInsurers], ['sel', 1, true]);
  assert.deepStrictEqual([f('region').t, !!f('region').free, f('region').o === SR.provinces, f('region').opt], ['sel', false, true, 1], 'Region is a plain drop-down, still optional');
  assert.deepStrictEqual(SR.lists.benef.cols.filter(c => c.k === 'relation').map(c => !!c.free), [true]);
  ['acc_holder', 'bank', 'branch', 'branch_code', 'acc_type', 'debit_date', 'acc_no', 'bank_contact', 'bank_email', 'region', 'old_company', 'ownerpays', 'owner'].forEach(id => assert.ok(f(id), id + ' is still there'));
});

test('the banking details (2): where the owner pays, the account holder, contact number and e-mail start as the client’s, and follow the client’s boxes', () => {
  const s = store.blank();
  set(s, 'fname', 'Anna'); set(s, 'sname', 'Kuiper'); set(s, 'cell', '082 555 0101'); set(s, 'email', 'anna@example.com');
  assert.deepStrictEqual(holder(s), ['/empty', '/empty', '/empty'], 'nothing is filled before the owner is said to be paying');
  set(s, 'ownerpays', 'Yes');
  assert.deepStrictEqual(holder(s), ['Anna Kuiper/preset', '082 555 0101/preset', 'anna@example.com/preset'], 'name and surname, cell and e-mail, as a starting default');
  set(s, 'cell', '083 555 0202'); set(s, 'sname', 'Kuiper-Botha');
  assert.deepStrictEqual(holder(s), ['Anna Kuiper-Botha/preset', '083 555 0202/preset', 'anna@example.com/preset'], 'they follow the client’s boxes');
  set(s, 'ownerpays', 'No');
  assert.deepStrictEqual(holder(s), ['/empty', '/empty', '/empty'], 'and go again when the owner is not the one paying');
});

test('the banking details (2): what the adviser typed (or still has to verify) is never overwritten; a cleared box is filled again only when a box it comes from changes', () => {
  const s = store.blank();
  set(s, 'fname', 'Anna'); set(s, 'sname', 'Kuiper'); set(s, 'cell', '082 555 0101'); set(s, 'email', 'anna@example.com'); set(s, 'ownerpays', 'Yes');
  set(s, 'bank_email', 'accounts@example.com'); set(s, 'email', 'other@example.com');
  assert.strictEqual(s.f.bank_email.v, 'accounts@example.com'); assert.strictEqual(s.f.bank_email.st, 'confirmed');
  assert.strictEqual(s.f.acc_holder.v, 'Anna Kuiper', 'the others still follow');
  set(s, 'acc_holder', 'A Kuiper (joint account)'); set(s, 'fname', 'Annabel');
  assert.strictEqual(s.f.acc_holder.v, 'A Kuiper (joint account)');
  set(s, 'ownerpays', 'No'); assert.strictEqual(s.f.bank_email.v, 'accounts@example.com', 'typed boxes stay when the owner is not paying'); assert.strictEqual(s.f.bank_contact.v, '');
  const v = store.blank(); set(v, 'fname', 'Anna'); set(v, 'ownerpays', 'Yes'); v.f.bank_contact = { v: '082 555 0101', st: 'verify' }; set(v, 'cell', '083 555 0202');
  assert.deepStrictEqual([v.f.bank_contact.v, v.f.bank_contact.st], ['082 555 0101', 'verify'], 'a box loaded and still to verify is not touched');
});

test('the banking details (2): when the owner is someone else, the owner’s own boxes are used (there is no owner e-mail); the client’s e-mail is not used', () => {
  const s = store.blank();
  set(s, 'fname', 'Anna'); set(s, 'sname', 'Kuiper'); set(s, 'cell', '082 555 0101'); set(s, 'email', 'anna@example.com'); set(s, 'ownerpays', 'Yes');
  set(s, 'owner', 'Another person'); set(s, 'ow_fn', 'Piet'); set(s, 'ow_sn', 'Botha'); set(s, 'ow_cell', '084 555 0303');
  assert.deepStrictEqual(holder(s), ['Piet Botha/preset', '084 555 0303/preset', '/empty']);
  set(s, 'owner', SR.owners[0]);
  assert.deepStrictEqual(holder(s), ['Anna Kuiper/preset', '082 555 0101/preset', 'anna@example.com/preset'], 'back to the client');
});

test('the banking details (2): Load from Fact Find fills them too, and a file that is opened keeps what it holds', () => {
  const ff = JSON.stringify({ app: 'wr-fact-find', f: { fname: { v: 'Anna' }, sname: { v: 'Kuiper' }, cell: { v: '082 555 0101' }, pemail: { v: 'anna@example.com' } }, l: {} });
  const s = store.blank(); set(s, 'ownerpays', 'Yes'); store.loadFromFactFind(s, ff, 'x.json');
  assert.deepStrictEqual(holder(s), ['Anna Kuiper/preset', '082 555 0101/preset', 'anna@example.com/preset']);
  const t = store.blank(); set(t, 'fname', 'Anna'); set(t, 'sname', 'Kuiper'); set(t, 'cell', '082 555 0101');
  t.f.ownerpays = { v: 'Yes', st: 'confirmed' };                                                       // as an older file would hold it: the boxes are empty
  const back = store.fromJSON(store.toJSON(t));
  assert.deepStrictEqual(holder(back), ['/empty', '/empty', '/empty'], 'opening does not change a file');
  const again = store.fromJSON(store.toJSON(s));
  assert.deepStrictEqual(holder(again), holder(s), 'and a saved file reopens with the presets as saved');
});

test('older files open as they were: a bank, a branch, a region or a company that is not in the lists stays in its box', () => {
  const s = store.blank();
  set(s, 'bank', 'Some Credit Union'); set(s, 'branch', 'Rosebank 2'); set(s, 'region', 'gauteng'); set(s, 'replace', 'Yes'); set(s, 'old_company', 'Samplecompany'); set(s, 'acc_type', 'Business');
  const back = store.fromJSON(store.toJSON(s));
  ['bank', 'branch', 'region', 'old_company', 'acc_type'].forEach(id => assert.strictEqual(back.f[id].v, s.f[id].v, id));
  const old = JSON.parse(store.toJSON(s)); old.schema = '1.2'; old.f.bank.v = 'TymeBank';
  assert.strictEqual(store.fromJSON(JSON.stringify(old)).f.bank.v, 'TymeBank', 'a 1.2 file opens, with its bank in the list');
  assert.ok(SR.banks.indexOf('TymeBank') >= 0);
});

test('the page draws a real drop-down for these boxes, with Other (type it in), and keeps the text box for what is typed', () => {
  const ui = app('js/sr-ui.js');
  assert.ok(/function comboHTML\(/.test(ui) && /function syncCombo\(/.test(ui) && /function comboPicked\(/.test(ui));
  assert.ok(/Other \(type it in\)/.test(ui));
  assert.ok(/c\.t === 'sel' && c\.free && c\.o\) return comboHTML/.test(ui), 'a list that may also be typed is a combo');
  assert.ok(/\{ t: c\.o \? 'sel' : '', o: c\.o, free: c\.free \}/.test(ui), 'also in a list row (the beneficiary’s relation)');
  assert.ok(/\.combo\.typing/.test(app('css/short-risk.css')));
});

test('the Investment Application loads from a Risk Application file and says so in the new words', () => {
  const cs = require('../app/js/cs-store.js');
  assert.throws(() => cs.loadFromShortRisk(cs.blank(), '{"app":"wr-fact-find"}', 'x'), /not a Wealth Revolution Risk Application/);
  assert.match(app('capture-sheet.html'), /Load from Risk Application file&hellip;/);
});
