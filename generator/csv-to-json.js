#!/usr/bin/env node
/**
 * Maidan Play — Wide-row to Card JSON transformer
 *   node csv-to-json.js <input> --out <dir>
 *
 * Input: JSON file containing array of wide rows (from Apps Script doGet)
 *        or a CSV file exported from Google Sheets.
 *
 * Output: One .json file per student in the output directory,
 *         ready for generate-card.js / generate-all.js.
 *
 * All display copy (pillar names, drill labels, "what" descriptions,
 * page 2 blocks) is embedded here — coaches enter only raw numbers.
 */

const fs = require('fs');
const path = require('path');

// ── CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const inputPath = args[0];
if (!inputPath) { console.error('Usage: node csv-to-json.js <rows.json|rows.csv> [--out dir]'); process.exit(1); }
const outDir = (() => { const i = args.indexOf('--out'); return i >= 0 ? args[i+1] : 'out/json'; })();
fs.mkdirSync(outDir, { recursive: true });

// ── Parse input ───────────────────────────────────────────────────
let rows;
const raw = fs.readFileSync(inputPath, 'utf8');
if (inputPath.endsWith('.json')) {
  const parsed = JSON.parse(raw);
  rows = Array.isArray(parsed) ? parsed : (parsed.rows || []);
} else {
  // CSV parse (simple — handles quoted fields)
  const lines = raw.split('\n').filter(l => l.trim());
  const headers = parseCSVLine(lines[0]);
  rows = lines.slice(1).map(line => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function parseCSVLine(line) {
  const result = []; let current = ''; let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"' && line[i+1] === '"') { current += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { current += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { result.push(current); current = ''; }
      else { current += c; }
    }
  }
  result.push(current);
  return result;
}

// ── Band configuration ────────────────────────────────────────────
const BANDS = {
  'Toddler': {
    tier_name: 'Play Report', band_range: '5–7', pillars_label: 'What we measured',
    drills: {
      frog_jumps:      { roman:'i',  name:'Jumping',   alias:'Frog jumps',     drill:'Two-foot standing jump · best of 2', what:'How far {first} can launch from a two-foot take-off — the very beginning of explosive movement.', unit:'centimetres' },
      flamingo_stand:  { roman:'ii', name:'Balance',    alias:'Flamingo stand', drill:'Single-leg stand · timed', what:'How long {first} can hold steady on one leg — a playful window into balance and body awareness.', unit:'seconds' },
      tiger_run:       { roman:'iii',name:'Running',    alias:'Tiger run',      drill:'10 m sprint · best of 2', what:'How quickly {first} covers a short dash — early running confidence in action.', unit:'seconds' },
      snake_dribble:   { roman:'iv', name:'Ball play',  alias:'Snake dribble',  drill:'5-cone dribble · timed', what:'How {first} weaves a ball through cones — first steps in coordination and control.', unit:'seconds' },
    },
    observed: {
      participation:  { roman:'v',   name:'Participation', what:'Was {first} actively involved during the session — joining in, trying activities, staying engaged with the group?' },
      perseverance:   { roman:'vi',  name:'Perseverance',  what:'Did {first} keep going when things got tricky — sticking with a challenge rather than stepping away?' },
      teamwork:       { roman:'vii', name:'Teamwork',      what:'Did {first} work alongside others — sharing, taking turns, and being part of the group?' },
    },
    page2: {
      lead: "This is a snapshot of {first}'s play session — jumping, running, balance, and ball play. <strong>The numbers describe what happened on the day, not what {first} \"should\" be doing.</strong> At this age, every child develops at their own pace.",
      habits: "Between 5 and 7, children are building the physical habits that underpin all future sport. Running, jumping, balancing, and playing with a ball are the foundations — and the fact that {first} is doing them in a structured, coached environment is the important thing.",
      blocks: [
        { title:'What we measured', body:'Four playful activities — each a real measurement of one movement skill. We show the numbers honestly, with no score and no rating.' },
        { title:'What we observed', body:'Three dimensions of how {first} engaged with the session. "Yes" means the coaches saw it consistently; "Building" means it\'s developing — both are completely normal at this age.' },
        { title:'How often', body:'Twice in a 3-month cycle — end of Month 1 and end of Month 3. Both follow the same protocol, so a change between them is meaningful.' },
        { title:'A note on the numbers', body:'We deliberately do not compare {first} against other children, age-band averages, or any benchmark. The numbers describe what happened on the day. We collected only height, weight, and four activity measurements plus three observations; the data is held by Maidan Play and not shared outside the academy.', full:true },
      ]
    }
  },
  'Sub Junior': {
    tier_name: 'Fitness Snapshot', band_range: '8–11', pillars_label: 'Six measurements',
    drills: {
      standing_long_jump: { roman:'i',   name:'Lower-body power', drill:'Standing long jump · best of 2', what:'How far {first} can jump from a standing start — the explosive force young legs produce.', unit:'centimetres' },
      sprint_20m:         { roman:'ii',  name:'Speed',             drill:'20 m sprint · best of 2', what:'How quickly {first} accelerates and carries speed over a short distance.', unit:'seconds' },
      agility_shuttle:    { roman:'iii', name:'Agility',           drill:'4×10 m shuttle · timed', what:'How sharply {first} changes direction under control — every turn and stop on the pitch.', unit:'seconds' },
      single_leg_stand:   { roman:'iv',  name:'Balance',           drill:'Single-leg stand · timed', what:'How long {first} can hold steady on one foot — a key part of coordination and body control.', unit:'seconds' },
      cone_dribble:       { roman:'v',   name:'Ball coordination', drill:'5-cone dribble · timed', what:'How {first} moves a ball through a set course — close control and footwork combined.', unit:'seconds' },
      endurance_run:      { roman:'vi',  name:'Endurance',         drill:'Timed run', what:'How {first} sustains effort over a continuous run — one of several stamina markers.', unit:'seconds' },
    },
    page2: {
      lead: "This is a snapshot of {first}'s physical state on the day we measured — power, speed, agility, balance, ball coordination, and endurance. <strong>The numbers are facts, not judgements.</strong>",
      blocks: [
        { title:'What we measured', body:'Six movement tests run on Combine Day, each a real measurement of one capacity. We show the numbers honestly, with no score and no rating.' },
        { title:'How often', body:'Twice in a 3-month cycle — end of Month 1 and end of Month 3. Both follow the same protocol, so a change between them is meaningful.' },
        { title:'A note on the numbers', body:'We deliberately do not compare {first} against other athletes, age-band averages, or any benchmark, and we use no traffic-light scoring. The numbers describe what happened on the day.', full:true },
      ]
    }
  },
  'Junior': {
    tier_name: 'Fitness Snapshot', band_range: '12–15', pillars_label: 'Seven measurements',
    drills: {
      triple_hop:       { roman:'i',   name:'Lower-body power',           drill:'Triple hop · best of 2', what:'Explosive force the legs produce across repeated efforts — the power football demands.', unit:'centimetres' },
      out_and_back_40m: { roman:'ii',  name:'Speed & acceleration',       drill:'40 m out-and-back · best of 2', what:'How quickly {first} accelerates, decelerates and turns over distance.', unit:'seconds' },
      t_test:           { roman:'iii', name:'Agility & change of direction', drill:'T-test · single attempt', what:'How sharply {first} changes direction, shuffles, and recovers.', unit:'seconds' },
      slalom:           { roman:'iv',  name:'Ball coordination',          drill:'Slalom dribble · timed', what:'How {first} controls the ball through a set course at speed.', unit:'seconds' },
      run_800m:         { roman:'v',   name:'Endurance',                  drill:'800 m timed', what:'How {first} sustains effort over a continuous run — directionally useful as a stamina marker.', unit:'min : sec' },
      sit_and_reach:    { roman:'vi',  name:'Mobility & flexibility',     drill:'Sit-and-reach · best of 2', what:'How freely {first} moves through a full range of motion.', unit:'centimetres' },
      pushups_60s:      { roman:'vii', name:'Strength',                   drill:'Push-ups 60 s · plank hold', what:'How muscles sustain effort — strength-endurance, distinct from maximal strength.', unit:'push-ups' },
    },
    page2: {
      lead: "This is a snapshot of {first}'s physical state on the day we measured — power, speed, agility, ball coordination, endurance, mobility, and strength. <strong>The numbers are facts, not judgements.</strong>",
      blocks: [
        { title:'What we measured', body:'Seven movement tests run on Combine Day, each a real measurement of one capacity. We show the numbers honestly, with no score and no rating.' },
        { title:'How often', body:'Twice in a 3-month cycle — end of Month 1 and end of Month 3. Both follow the same protocol, so a change between them is meaningful.' },
        { title:'A note on the numbers', body:'We deliberately do not compare {first} against other athletes, age-band averages, or any benchmark, and we use no traffic-light scoring. The numbers describe what happened on the day. The data is held by Maidan Play and not shared outside the academy.', full:true },
      ]
    }
  },
  'Senior': {
    tier_name: 'Fitness Snapshot', band_range: '16–18', pillars_label: 'Seven measurements',
    drills: {
      triple_hop:    { roman:'i',   name:'Lower-body power',           drill:'Triple hop · best of 2', what:'Explosive force the legs produce across repeated efforts — the power football demands in repeated sprints and jumps.', unit:'centimetres' },
      sprint_30m:    { roman:'ii',  name:'Speed & acceleration',       drill:'30 m sprint · best of 2', what:'How quickly {first} accelerates from a standing start and carries that speed over distance.', unit:'seconds' },
      t_test:        { roman:'iii', name:'Agility & change of direction', drill:'T-test · single attempt', what:'How sharply {first} changes direction, shuffles, and recovers — every turn and reaction on the pitch.', unit:'seconds' },
      long_pass:     { roman:'iv',  name:'Ball coordination',          drill:'Long-pass accuracy · 5 attempts', what:'How accurately {first} strikes a lofted long pass to a target — consistency across five attempts.', unit:'hits · from 25 m' },
      run_800m:      { roman:'v',   name:'Endurance',                  drill:'800 m timed', what:'How {first} sustains effort over a continuous run — one of several stamina markers, directionally useful.', unit:'min : sec' },
      sit_and_reach: { roman:'vi',  name:'Mobility & flexibility',     drill:'Sit-and-reach · best of 2', what:'How freely {first} moves through a full range — supporting comfortable movement and athletic demand.', unit:'centimetres' },
      pushups_60s:   { roman:'vii', name:'Strength',                   drill:'Push-ups 60 s · plank hold', what:'How muscles sustain effort — strength-endurance, distinct from maximal strength, which we don\'t measure.', unit:'push-ups' },
    },
    page2: {
      lead: "This is a snapshot of {first}'s physical state on the day we measured — power, speed, agility, ball coordination, endurance, mobility, and strength. <strong>The numbers are facts, not judgements.</strong> This card is not a medical or diagnostic tool, and not a comparison against any benchmark, age norm, or peer.",
      blocks: [
        { title:'What we measured', body:'Seven movement tests run on Combine Day, each a real measurement of one capacity. We show the numbers honestly, with no score and no rating.' },
        { title:'How often', body:'Twice in a 3-month cycle — end of Month 1 and end of Month 3. Both follow the same protocol, so a change between them is meaningful.' },
        { title:'A note on how some tests are recorded', body:'Some carry a little context so the picture stays honest — the plank is held only to a 3:00 limit, and the long-pass distance is set per session and shown beside the result.' },
        { title:'A note on the numbers', body:'We deliberately do not compare {first} against other athletes, age-band averages, or any benchmark, and we use no traffic-light scoring. The numbers describe what happened on the day. The data is held by Maidan Play and not shared outside the academy. If you\'d like to discuss anything here, the coaching and curriculum team is available.', full:true },
      ]
    }
  },
};

// ── Transform each row ────────────────────────────────────────────
console.log(`\nMaidan Play — CSV/JSON to Card JSON transformer`);
console.log(`  Input : ${inputPath}  (${rows.length} rows)`);
console.log(`  Output: ${outDir}\n`);

let count = 0;
rows.forEach(row => {
  if (!row.student_id || !row.session_id) return;

  const bandKey = Object.keys(BANDS).find(b => (row.band_label || '').includes(b));
  if (!bandKey) { console.warn(`  Skipping ${row.student_id}: unknown band "${row.band_label}"`); return; }
  const band = BANDS[bandKey];

  // Parse student name
  const fullName = row.student_name || '';
  const nameParts = fullName.split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join(' ') || '';

  // Build pillars from p1–p9 columns
  const pillars = [];
  const drillIds = Object.keys(band.drills);
  for (let i = 1; i <= 9; i++) {
    const drillId = row[`p${i}_drill_id`];
    if (!drillId) continue;
    const cfg = band.drills[drillId];
    if (!cfg) continue;

    let value = row[`p${i}_value`] || '';
    // Special formatting: long_pass → "3<small>/5</small>"
    if (drillId === 'long_pass' && value && !value.includes('<small>')) {
      value = `${value}<small>/5</small>`;
    }

    pillars.push({
      roman: cfg.roman,
      name: cfg.name,
      drill: cfg.drill,
      what: cfg.what.replace(/\{first\}/g, firstName),
      value: String(value),
      unit: cfg.unit,
      ...(row[`p${i}_flag`] ? { flag: row[`p${i}_flag`] } : {}),
      ...(cfg.alias ? { alias: cfg.alias } : {}),
    });
  }

  // Build observed pillars for Toddler
  let measured_pillars, observed_pillars;
  if (bandKey === 'Toddler' && band.observed) {
    measured_pillars = pillars;
    observed_pillars = Object.entries(band.observed).map(([key, cfg]) => ({
      roman: cfg.roman,
      name: cfg.name,
      what: cfg.what.replace(/\{first\}/g, firstName),
      yn: ['yes','true','1'].includes(String(row[`eng_${key}_yn`] || '').toLowerCase()),
      time_bucket: row[`eng_${key}_bucket`] || '',
    }));
  }

  // Parse session_id for cycle info
  const sessionParts = (row.session_id || '').split('-');
  const mPoint = row.measurement_point || sessionParts[1] || 'M1';

  // Substitute {first} in page2 content
  const sub = s => (s || '').replace(/\{first\}/g, firstName);
  const page2 = {
    lead: sub(band.page2.lead),
    ...(band.page2.habits ? { habits: sub(band.page2.habits) } : {}),
    blocks: band.page2.blocks.map(b => ({
      title: sub(b.title),
      body: sub(b.body),
      ...(b.full ? { full: true } : {}),
    })),
  };

  const card = {
    card_id: `card_${row.student_id}_${row.session_id}`,
    version: 1,
    tier_name: band.tier_name,
    band_label: bandKey,
    band_range: band.band_range,
    pillars_label: band.pillars_label,
    student: {
      student_id: row.student_id,
      first_name: firstName,
      last_name: lastName,
      age: row.age || '',
    },
    cycle: {
      cycle_id: row.session_id || '',
      point: mPoint,
      month_label: mPoint === 'M1' ? 'Month 1 of 3' : mPoint === 'M2' ? 'Month 2 of 3' : 'Month 3 of 3',
      issued_on: new Date().toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }),
      combine_day: row.combine_date || '',
    },
    venue: { name: 'Guru Nanak', field: '7v7' },
    growth: {
      height_cm: row.height_cm ? Number(row.height_cm) : '',
      weight_kg: row.weight_kg ? Number(row.weight_kg) : '',
    },
    ...(bandKey === 'Toddler' ? { measured_pillars, observed_pillars } : { pillars }),
    narrative: {
      text: row.narrative_text || '',
      attribution: row.narrative_attribution || 'Observed by the coaching team · Tekkers Football Academy',
    },
    next_line: `${firstName}'s next ${band.tier_name} will be ready at the end of Month 3, when this cycle of training completes.`,
    qr_target_url: 'https://maidanplay.com/how-we-measure',
    page2,
    contact: { email: 'academy@maidanplay.com', phone: '+91 XX XXX XXXX' },
  };

  const safe = s => String(s || '').replace(/[^A-Za-z0-9]+/g, '_');
  const filename = ['Maidan', safe(firstName), safe(lastName), safe(bandKey), safe(row.session_id), safe(mPoint)].filter(Boolean).join('_') + '.json';
  fs.writeFileSync(path.join(outDir, filename), JSON.stringify(card, null, 2));
  count++;
  process.stdout.write(`  [${count}] ${filename}\n`);
});

console.log(`\n  ✓ ${count} card JSON file(s) written to ${outDir}\n`);
