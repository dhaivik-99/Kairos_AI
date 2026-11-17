require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sweph = require('sweph');

const C = sweph.constants;
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const RASHIS = ['Aries','Taurus','Gemini','Cancer','Leo','Virgo','Libra','Scorpio','Sagittarius','Capricorn','Aquarius','Pisces'];
const NAKSHATRAS = ['Ashwini','Bharani','Krittika','Rohini','Mrigashira','Ardra','Punarvasu','Pushya','Ashlesha','Magha','Purva Phalguni','Uttara Phalguni','Hasta','Chitra','Swati','Vishakha','Anuradha','Jyeshtha','Mula','Purva Ashadha','Uttara Ashadha','Shravana','Dhanishta','Shatabhisha','Purva Bhadrapada','Uttara Bhadrapada','Revati'];

function tzOffset(tz, date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(guess));
  const g = t => Number(parts.find(p => p.type === t).value);
  const asUTC = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  return (asUTC - guess) / 3600000;
}

function describe(lon) {
  const n = ((lon % 360) + 360) % 360;
  const span = 360 / 27;
  return {
    longitude: +n.toFixed(4),
    rashi: RASHIS[Math.floor(n / 30)],
    degreeInSign: +(n % 30).toFixed(2),
    nakshatra: NAKSHATRAS[Math.floor(n / span)],
    pada: Math.floor((n % span) / (span / 4)) + 1
  };
}

app.get('/chart', (req, res) => {
  try {
    const { date, time, lat, lon, tz } = req.query;
    if (!date || !time || lat === undefined || lon === undefined) {
      return res.status(400).json({ error: 'Need date, time, lat, lon (and tz or utcOffset)' });
    }
    const utcOffset = tz ? tzOffset(tz, date, time) : Number(req.query.utcOffset || 0);

    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const utcHour = hh + mm / 60 - utcOffset;
    const jd = sweph.julday(y, m, d, utcHour, C.SE_GREG_CAL);

    sweph.set_sid_mode(C.SE_SIDM_LAHIRI, 0, 0);
    const flags = C.SEFLG_MOSEPH | C.SEFLG_SIDEREAL | C.SEFLG_SPEED;

    const bodies = {
      Sun: C.SE_SUN, Moon: C.SE_MOON, Mars: C.SE_MARS, Mercury: C.SE_MERCURY,
      Jupiter: C.SE_JUPITER, Venus: C.SE_VENUS, Saturn: C.SE_SATURN, Rahu: C.SE_TRUE_NODE
    };

    const planets = {};
    for (const [name, id] of Object.entries(bodies)) {
      const r = sweph.calc_ut(jd, id, flags);
      if (r.error) throw new Error(name + ': ' + r.error);
      planets[name] = { ...describe(r.data[0]), retrograde: r.data[3] < 0 };
    }
    planets.Ketu = describe(planets.Rahu.longitude + 180);

    const h = sweph.houses_ex(jd, C.SEFLG_SIDEREAL, Number(lat), Number(lon), 'W');
    const ascendant = describe(h.data.points[0]);

    res.json({ input: { date, time, lat, lon, utcOffset }, ayanamsa: 'Lahiri', ascendant, planets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
