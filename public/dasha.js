(function () {
  const KB = window.KB, E = window.Engine;
  const ORDER = [['Ketu', 7], ['Venus', 20], ['Sun', 6], ['Moon', 10], ['Mars', 7], ['Rahu', 18], ['Jupiter', 16], ['Saturn', 19], ['Mercury', 17]];
  const YEAR = 365.25 * 86400000;
  const PL = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const ord = n => n + (n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th');
  const dFull = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const dMon = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  const g = KB.glossary.find(x => x.id === 'dasha');
  if (g) g.text = "A dasha is a planetary period. In the most widely used system, Vimshottari, life is divided into a 120-year cycle of periods ruled by each planet in turn: Ketu 7 years, Venus 20, Sun 6, Moon 10, Mars 7, Rahu 18, Jupiter 16, Saturn 19, and Mercury 17. Your Moon's nakshatra decides which planet's period you start in and how much of it was left at birth. The main periods are called mahadashas, and each is split into nine sub-periods called antardashas. Astrologers use dashas for timing: which planet's themes are in the foreground right now. They describe emphasis, not fixed events.";

  function compute(chart) {
    if (chart._dasha) return chart._dasha;
    const [y, m, d] = chart.input.date.split('-').map(Number);
    const [hh, mm] = chart.input.time.split(':').map(Number);
    const birth = Date.UTC(y, m - 1, d, hh, mm) - Number(chart.input.utcOffset) * 3600000;
    const span = 360 / 27, lon = chart.planets.Moon.longitude;
    const first = Math.floor(lon / span) % 9;
    const elapsed = (lon % span) / span;
    let t = birth - ORDER[first][1] * elapsed * YEAR;
    const mahas = [];
    for (let i = 0; i < 9; i++) {
      const mi = (first + i) % 9, lord = ORDER[mi][0], yrs = ORDER[mi][1];
      const start = t, end = t + yrs * YEAR;
      let s = start;
      const subs = [];
      for (let j = 0; j < 9; j++) {
        const sl = ORDER[(mi + j) % 9];
        const len = yrs * sl[1] / 120 * YEAR;
        subs.push({ lord: sl[0], start: s, end: s + len });
        s += len;
      }
      mahas.push({ lord, years: yrs, start, end, subs });
      t = end;
    }
    chart._dasha = { birth, mahas, balance: +(ORDER[first][1] * (1 - elapsed)).toFixed(2), firstLord: ORDER[first][0] };
    return chart._dasha;
  }

  function current(chart) {
    const now = Date.now(), D = compute(chart);
    const maha = D.mahas.find(m => now >= m.start && now < m.end);
    const sub = maha && maha.subs.find(s => now >= s.start && now < s.end);
    return { D, maha, sub };
  }

  function theme(chart, lord) {
    const p = chart.planets[lord], r = KB.rashis[p.signIndex], h = KB.houses[p.house - 1];
    return 'During ' + lord + ' periods, the themes of ' + KB.planets[lord].kw + ' take the foreground. In your chart ' + lord + ' sits in ' + r.name + ' in your ' + ord(p.house) + ' house (' + h.name.toLowerCase() + '), so those themes tend to show up through ' + r.name + "'s style and in the area of " + h.name.toLowerCase() + '.';
  }

  const CAVEAT = '\n\nA note on accuracy: dasha dates depend on your exact birth time, and each minute of error can move boundaries by a few days. Treat the dates as a guide if your birth time is approximate. Dashas describe which themes are emphasized, not what will happen.';

  function dashaNow(chart) {
    const { D, maha, sub } = current(chart);
    if (!maha) return { text: 'Your current period falls outside the 120-year cycle I calculated.', chips: [] };
    let t = '**You are in the ' + maha.lord + ' mahadasha** (' + dFull(Math.max(maha.start, D.birth)) + ' to ' + dFull(maha.end) + '), and within it the **' + sub.lord + ' antardasha** (' + dFull(sub.start) + ' to ' + dFull(sub.end) + ').\n\n';
    t += 'The mahadasha is the main chapter, and the antardasha is the sub-chapter that colors it.\n\n';
    t += '**The main chapter:** ' + theme(chart, maha.lord) + '\n\n';
    t += '**The sub-chapter:** ' + theme(chart, sub.lord) + (sub.lord === maha.lord ? ' Because it is the same planet, those themes are concentrated.' : '') + '\n\n';
    const upcoming = maha.subs.filter(s => s.start > sub.start).slice(0, 3);
    if (upcoming.length) t += '**Coming up in this chapter:**\n' + upcoming.map(s => '• ' + maha.lord + '–' + s.lord + ': ' + dMon(s.start) + ' to ' + dMon(s.end)).join('\n') + '\n\n';
    const next = D.mahas[D.mahas.indexOf(maha) + 1];
    if (next) t += '**Next mahadasha:** ' + next.lord + ', starting ' + dFull(next.start) + '.';
    t += CAVEAT;
    return { text: t, chips: ['Show my dasha timeline', 'Tell me about my ' + maha.lord + ' dasha', next ? 'Tell me about my ' + next.lord + ' dasha' : 'What is a nakshatra?', 'What is a dasha?'] };
  }

  function timeline(chart) {
    const { D, maha } = current(chart);
    let t = '**Your Vimshottari mahadashas**\n\n';
    t += D.mahas.map(m => '• ' + m.lord + ' (' + m.years + ' yrs): ' + dMon(Math.max(m.start, D.birth)) + ' to ' + dMon(m.end) + (m === maha ? '  ← now' : '')).join('\n');
    t += '\n\nYou were born in ' + D.firstLord + "'s period, with about " + D.balance + ' years of it remaining.';
    t += CAVEAT;
    return { text: t, chips: ['What dasha am I in?', 'What is a dasha?', 'Tell me about my ' + (maha ? maha.lord : 'Moon') + ' dasha'] };
  }

  function planetDasha(chart, planet) {
    const { D, maha, sub } = current(chart);
    const m = D.mahas.find(x => x.lord === planet), now = Date.now();
    const status = now < m.start ? 'coming up' : now >= m.end ? 'already complete' : 'running right now';
    let t = '**Your ' + planet + ' mahadasha** runs from ' + dFull(Math.max(m.start, D.birth)) + ' to ' + dFull(m.end) + ' (' + m.years + ' years in the cycle), and it is **' + status + '**.\n\n';
    if (m === D.mahas[0]) t += 'It was already underway when you were born, with about ' + D.balance + ' years remaining.\n\n';
    t += theme(chart, planet) + '\n\n';
    if (maha === m && sub) t += 'Right now you are in its **' + sub.lord + ' antardasha** until ' + dFull(sub.end) + '.\n\n';
    t += '**Sub-periods:**\n' + m.subs.filter(s => s.end > D.birth).map(s => '• ' + planet + '–' + s.lord + ': ' + dMon(Math.max(s.start, D.birth)) + ' to ' + dMon(s.end)).join('\n');
    t += CAVEAT;
    return { text: t, chips: ['What dasha am I in?', 'Show my dasha timeline', 'Tell me about my ' + planet] };
  }

  function dashaAnswer(chart, t) {
    if (/\b(timeline|full|all|every|list|schedule)\b/.test(t)) return timeline(chart);
    const planet = PL.find(p => new RegExp('\\b' + p.toLowerCase() + '\\b').test(t));
    if (planet) return planetDasha(chart, planet);
    if (/\b(my|me|now|current|currently|am i|next|when|upcoming|future|running)\b/.test(t)) return dashaNow(chart);
    const cur = current(chart);
    return { text: '**Dasha**\n\n' + g.text + (cur.maha ? '\n\nFor you right now: the **' + cur.maha.lord + '** mahadasha with the **' + cur.sub.lord + '** antardasha.' : ''), chips: ['What dasha am I in?', 'Show my dasha timeline', 'What is a nakshatra?'] };
  }

  const baseAnswer = E.answer, baseOverview = E.overview;
  E.answer = function (chart, q) {
    const t = q.toLowerCase();
    if (/\b(dasha|dashas|mahadasha|antardasha|bhukti|vimshottari)\b/.test(t)) return dashaAnswer(chart, t);
    return baseAnswer(chart, q);
  };
  E.overview = function (chart) {
    const r = baseOverview(chart), c = current(chart);
    if (c.maha) {
      const line = '**Current dasha:** ' + c.maha.lord + ' mahadasha, ' + c.sub.lord + ' antardasha (until ' + dMon(c.sub.end) + '), the chapter your life is emphasizing now.\n\n';
      const anchor = 'In Vedic astrology the Lagna';
      r.text = r.text.includes(anchor) ? r.text.replace(anchor, line + anchor) : r.text + '\n\n' + line;
    }
    r.chips = ['What dasha am I in?'].concat(r.chips.filter(x => x !== 'What dasha am I in?').slice(0, 4));
    return r;
  };

  window.renderDasha = function (chart) {
    const { D, maha, sub } = current(chart);
    document.getElementById('dsum').textContent = maha ? 'Your dashas. Now: ' + maha.lord + '–' + sub.lord + ' until ' + dMon(sub.end) : 'Your dashas';
    const box = document.getElementById('dlist');
    box.innerHTML = '';
    D.mahas.forEach(m => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'drow' + (m === maha ? ' now' : '');
      b.innerHTML = '<b>' + m.lord + '</b><span>' + dMon(Math.max(m.start, D.birth)) + ' to ' + dMon(m.end) + (m === maha ? ' · now' : '') + '</span>';
      b.onclick = () => window.ask('Tell me about my ' + m.lord + ' dasha');
      box.appendChild(b);
    });
  };
})();
