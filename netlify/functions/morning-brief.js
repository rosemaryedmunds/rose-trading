---
import Layout from '../layouts/Layout.astro';
---

<Layout title="Morning Brief">
  <style>
    .brief-page {
      max-width: 760px;
      margin: 0 auto;
      padding: 2rem 1.5rem 4rem;
    }

    .brief-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2rem;
      flex-wrap: wrap;
      gap: 1rem;
    }

    .brief-header-left h1 {
      font-size: 1.6rem;
      font-weight: 700;
      color: #998BFF;
      margin: 0 0 0.25rem;
    }

    .brief-header-left .brief-date {
      font-size: 0.85rem;
      color: #888;
    }

    .brief-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      background: rgba(153, 139, 255, 0.12);
      border: 1px solid rgba(153, 139, 255, 0.3);
      color: #998BFF;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.3rem 0.75rem;
      border-radius: 20px;
      letter-spacing: 0.04em;
    }

    .brief-actions {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .refresh-btn {
      background: rgba(153, 139, 255, 0.15);
      border: 1px solid rgba(153, 139, 255, 0.4);
      color: #998BFF;
      font-size: 0.8rem;
      font-weight: 600;
      padding: 0.4rem 1rem;
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.2s;
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .refresh-btn:hover {
      background: rgba(153, 139, 255, 0.25);
    }

    .refresh-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .loading-status {
      background: #1C1E2D;
      border: 1px solid rgba(153, 139, 255, 0.15);
      border-radius: 10px;
      padding: 1.5rem 1.75rem;
      margin-bottom: 1.5rem;
    }

    .loading-steps {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .loading-step {
      display: flex;
      align-items: center;
      gap: 0.65rem;
      font-size: 0.85rem;
      color: #888;
      transition: color 0.3s;
    }

    .loading-step.active {
      color: #998BFF;
    }

    .loading-step.done {
      color: #5DCAA5;
    }

    .step-icon {
      width: 14px;
      font-size: 12px;
      flex-shrink: 0;
    }

    .spinning {
      display: inline-block;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .brief-content {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .brief-section {
      background: #1C1E2D;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      overflow: hidden;
    }

    .section-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.85rem 1.25rem;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      background: rgba(0,0,0,0.15);
    }

    .section-icon {
      font-size: 16px;
    }

    .section-title {
      font-size: 0.8rem;
      font-weight: 700;
      letter-spacing: 0.07em;
      text-transform: uppercase;
      color: #998BFF;
    }

    .section-body {
      padding: 1rem 1.25rem;
    }

    .calendar-item {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      padding: 0.5rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .calendar-item:last-child {
      border-bottom: none;
    }

    .cal-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
      margin-top: 4px;
    }

    .cal-dot.high { background: #E24B4A; }
    .cal-dot.medium { background: #EF9F27; }
    .cal-dot.low { background: #5F5E5A; }

    .cal-name {
      font-size: 0.875rem;
      color: #E0E0E0;
      font-weight: 500;
    }

    .cal-time {
      font-size: 0.75rem;
      color: #888;
      margin-top: 1px;
    }

    .cal-note {
      font-size: 0.8rem;
      color: #aaa;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-style: italic;
      line-height: 1.5;
    }

    .gapper-item {
      padding: 0.6rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .gapper-item:last-of-type {
      border-bottom: none;
    }

    .gapper-ticker {
      font-weight: 700;
      color: #E0E0E0;
      font-size: 0.875rem;
    }

    .gapper-move {
      font-size: 0.8rem;
      font-weight: 600;
      margin-left: 0.35rem;
    }

    .gapper-move.up { color: #5DCAA5; }
    .gapper-move.down { color: #E24B4A; }

    .gapper-desc {
      font-size: 0.8rem;
      color: #aaa;
      margin-top: 2px;
      line-height: 1.5;
    }

    .gapper-note {
      font-size: 0.8rem;
      color: #aaa;
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid rgba(255,255,255,0.06);
      font-style: italic;
      line-height: 1.5;
    }

    .rating-item {
      display: flex;
      align-items: flex-start;
      gap: 0.5rem;
      padding: 0.45rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.85rem;
    }

    .rating-item:last-child { border-bottom: none; }

    .rating-arrow {
      font-weight: 700;
      font-size: 0.9rem;
      flex-shrink: 0;
      width: 14px;
    }

    .rating-arrow.up { color: #5DCAA5; }
    .rating-arrow.down { color: #E24B4A; }
    .rating-arrow.neutral { color: #888; }

    .rating-ticker {
      font-weight: 700;
      color: #E0E0E0;
    }

    .rating-detail {
      color: #aaa;
    }

    .catalyst-item {
      padding: 0.65rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .catalyst-item:last-child { border-bottom: none; }

    .catalyst-tag {
      display: inline-block;
      font-size: 0.7rem;
      font-weight: 700;
      color: #998BFF;
      background: rgba(153,139,255,0.12);
      border: 1px solid rgba(153,139,255,0.25);
      border-radius: 4px;
      padding: 1px 6px;
      margin-bottom: 4px;
      letter-spacing: 0.04em;
    }

    .catalyst-text {
      font-size: 0.85rem;
      color: #ccc;
      line-height: 1.55;
    }

    .trump-section {
      background: #1C1E2D;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 10px;
      overflow: hidden;
    }

    .trump-item {
      display: flex;
      gap: 0.75rem;
      padding: 0.55rem 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      font-size: 0.85rem;
    }

    .trump-item:last-child { border-bottom: none; }

    .trump-time {
      color: #998BFF;
      font-weight: 600;
      font-size: 0.78rem;
      min-width: 70px;
      flex-shrink: 0;
      padding-top: 1px;
    }

    .trump-event {
      color: #ccc;
      line-height: 1.5;
    }

    .bias-box {
      background: rgba(95, 92, 255, 0.07);
      border: 1px solid rgba(95, 92, 255, 0.2);
      border-radius: 10px;
      padding: 1.25rem 1.5rem;
    }

    .bias-label {
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #5F5CFF;
      margin-bottom: 0.5rem;
    }

    .bias-direction {
      font-size: 1.05rem;
      font-weight: 700;
      color: #E0E0E0;
      margin-bottom: 0.5rem;
    }

    .bias-direction .bull { color: #5DCAA5; }
    .bias-direction .bear { color: #E24B4A; }
    .bias-direction .neutral-bias { color: #EF9F27; }

    .bias-text {
      font-size: 0.875rem;
      color: #bbb;
      line-height: 1.6;
    }

    .brief-footer {
      margin-top: 2.5rem;
      padding-top: 1.25rem;
      border-top: 1px solid rgba(255,255,255,0.07);
      font-size: 0.75rem;
      color: #555;
      text-align: center;
    }

    .error-box {
      background: rgba(226, 75, 74, 0.08);
      border: 1px solid rgba(226, 75, 74, 0.25);
      border-radius: 8px;
      padding: 1rem 1.25rem;
      color: #E24B4A;
      font-size: 0.85rem;
    }

    @media (max-width: 600px) {
      .brief-page { padding: 1.25rem 1rem 3rem; }
      .brief-header { flex-direction: column; align-items: flex-start; }
    }
  </style>

  <div class="brief-page">
    <div class="brief-header">
      <div class="brief-header-left">
        <h1>Morning Brief</h1>
        <div class="brief-date" id="brief-date"></div>
      </div>
      <div class="brief-actions">
        <span class="brief-badge">
          <span>✦</span> AI-powered
        </span>
        <button class="refresh-btn" id="refresh-btn" onclick="generateBrief()">
          <span id="refresh-icon">↺</span> Refresh
        </button>
      </div>
    </div>

    <div id="loading-panel" class="loading-status" style="display:none;">
      <ul class="loading-steps" id="loading-steps">
        <li class="loading-step" id="step-econ">
          <span class="step-icon">▷</span> Fetching economic calendar &amp; earnings
        </li>
        <li class="loading-step" id="step-trump">
          <span class="step-icon">▷</span> Pulling Trump schedule
        </li>
        <li class="loading-step" id="step-ratings">
          <span class="step-icon">▷</span> Compiling analyst ratings &amp; upgrades
        </li>
        <li class="loading-step" id="step-catalyst">
          <span class="step-icon">▷</span> Fetching catalyst &amp; macro news
        </li>
        <li class="loading-step" id="step-bias">
          <span class="step-icon">▷</span> Generating morning bias
        </li>
      </ul>
    </div>

    <div id="error-panel" class="error-box" style="display:none;"></div>

    <div id="brief-output" class="brief-content" style="display:none;"></div>

    <div class="brief-footer">
      rose.trading &nbsp;·&nbsp; SPX/ES 0DTE &nbsp;·&nbsp; Houston CT
      &nbsp;·&nbsp; Sources: Anthropic Claude · Financial news · Roll Call Factbase
    </div>
  </div>

  <script>
    const CT_OFFSET = -5;

    function formatDate() {
      const now = new Date();
      const ct = new Date(now.getTime() + (now.getTimezoneOffset() + CT_OFFSET * -60) * 60000);
      return ct.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    document.getElementById('brief-date').textContent = formatDate();

    function setStep(id, state) {
      const el = document.getElementById(id);
      if (!el) return;
      el.className = 'loading-step ' + state;
      const icon = el.querySelector('.step-icon');
      if (state === 'active') {
        icon.innerHTML = '<span class="spinning">◌</span>';
      } else if (state === 'done') {
        icon.textContent = '✓';
      } else {
        icon.textContent = '▷';
      }
    }

    function renderBrief(data) {
      const container = document.getElementById('brief-output');
      const d = data;

      let html = '';

      // Section A — Economic Calendar
      if (d.economic_calendar) {
        const ec = d.economic_calendar;
        html += `<div class="brief-section">
          <div class="section-header">
            <span class="section-icon">📅</span>
            <span class="section-title">Section A — Economic Calendar (US)</span>
          </div>
          <div class="section-body">`;

        (ec.events || []).forEach(ev => {
          const dotClass = ev.importance === 'high' ? 'high' : ev.importance === 'medium' ? 'medium' : 'low';
          html += `<div class="calendar-item">
            <div class="cal-dot ${dotClass}"></div>
            <div>
              <div class="cal-name">${ev.name}</div>
              <div class="cal-time">${ev.time}</div>
            </div>
          </div>`;
        });

        if (ec.note) {
          html += `<div class="cal-note">${ec.note}</div>`;
        }

        html += `</div></div>`;
      }

      // Section B — Pre-Market Earnings Gappers
      if (d.earnings_gappers) {
        const eg = d.earnings_gappers;
        html += `<div class="brief-section">
          <div class="section-header">
            <span class="section-icon">⚡</span>
            <span class="section-title">Section B — Pre-Market Earnings Gappers</span>
          </div>
          <div class="section-body">`;

        (eg.gappers || []).forEach(g => {
          const moveClass = g.move >= 0 ? 'up' : 'down';
          const moveStr = (g.move >= 0 ? '+' : '') + g.move + '%';
          html += `<div class="gapper-item">
            <div>
              <span class="gapper-ticker">$${g.ticker}</span>
              <span class="gapper-move ${moveClass}">${moveStr} — ${g.result}</span>
            </div>
            <div class="gapper-desc">${g.description}</div>
          </div>`;
        });

        if (eg.note) {
          html += `<div class="gapper-note">${eg.note}</div>`;
        }

        html += `</div></div>`;
      }

      // Section C — Upgrades & Downgrades
      if (d.ratings) {
        const rt = d.ratings;
        html += `<div class="brief-section">
          <div class="section-header">
            <span class="section-icon">📊</span>
            <span class="section-title">Section C — Upgrades &amp; Downgrades</span>
          </div>
          <div class="section-body">`;

        (rt.items || []).forEach(r => {
          const arrowClass = r.direction === 'up' ? 'up' : r.direction === 'down' ? 'down' : 'neutral';
          const arrowChar = r.direction === 'up' ? '↑' : r.direction === 'down' ? '↓' : '→';
          html += `<div class="rating-item">
            <span class="rating-arrow ${arrowClass}">${arrowChar}</span>
            <span><span class="rating-ticker">$${r.ticker}</span> <span class="rating-detail">— ${r.detail}</span></span>
          </div>`;
        });

        html += `</div></div>`;
      }

      // Section D — Catalyst News
      if (d.catalyst_news) {
        const cn = d.catalyst_news;
        html += `<div class="brief-section">
          <div class="section-header">
            <span class="section-icon">🔥</span>
            <span class="section-title">Section D — Catalyst News (Overnight &amp; Pre-Market)</span>
          </div>
          <div class="section-body">`;

        (cn.items || []).forEach(item => {
          html += `<div class="catalyst-item">
            <div class="catalyst-tag">${item.tag}</div>
            <div class="catalyst-text">${item.text}</div>
          </div>`;
        });

        html += `</div></div>`;
      }

      // Trump Schedule
      if (d.trump_schedule) {
        const ts = d.trump_schedule;
        html += `<div class="trump-section">
          <div class="section-header">
            <span class="section-icon">🇺🇸</span>
            <span class="section-title">Trump Schedule</span>
          </div>
          <div class="section-body">`;

        if (ts.items && ts.items.length > 0) {
          ts.items.forEach(item => {
            html += `<div class="trump-item">
              <span class="trump-time">${item.time}</span>
              <span class="trump-event">${item.event}</span>
            </div>`;
          });
        } else {
          html += `<div class="catalyst-text" style="color:#888;">No scheduled public events found for today.</div>`;
        }

        if (ts.note) {
          html += `<div class="cal-note">${ts.note}</div>`;
        }

        html += `</div></div>`;
      }

      // Morning Bias
      if (d.morning_bias) {
        const mb = d.morning_bias;
        const dirClass = mb.direction && mb.direction.toLowerCase().includes('bull') ? 'bull'
          : mb.direction && mb.direction.toLowerCase().includes('bear') ? 'bear' : 'neutral-bias';

        html += `<div class="bias-box">
          <div class="bias-label">⏱ Morning Bias</div>
          <div class="bias-direction">
            <span class="${dirClass}">${mb.direction || 'Neutral'}</span>
          </div>
          <div class="bias-text">${mb.text}</div>
        </div>`;
      }

      container.innerHTML = html;
      container.style.display = 'flex';
    }

    async function generateBrief() {
      const btn = document.getElementById('refresh-btn');
      const icon = document.getElementById('refresh-icon');
      const loading = document.getElementById('loading-panel');
      const output = document.getElementById('brief-output');
      const errorPanel = document.getElementById('error-panel');

      btn.disabled = true;
      icon.innerHTML = '<span class="spinning">◌</span>';
      loading.style.display = 'block';
      output.style.display = 'none';
      errorPanel.style.display = 'none';

      ['step-econ', 'step-trump', 'step-ratings', 'step-catalyst', 'step-bias'].forEach(id => setStep(id, ''));

      const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

      const prompt = `Today is ${today}. You are a professional stock market morning brief writer for a 0DTE SPX/ES options trader.

Generate a structured morning brief in valid JSON. Return ONLY the JSON object, no other text, no markdown code fences.

The JSON must have exactly these keys:
{
  "economic_calendar": {
    "events": [
      { "name": "Event Name", "time": "8:30 AM ET", "importance": "high|medium|low" }
    ],
    "note": "1-2 sentence commentary on how today's calendar could affect $QQQ/$SPY"
  },
  "earnings_gappers": {
    "gappers": [
      { "ticker": "AAPL", "move": 3.5, "result": "Beat", "description": "Brief reason for gap" }
    ],
    "note": "1-2 sentences on setup potential for gap-and-go or fade plays"
  },
  "ratings": {
    "items": [
      { "ticker": "NVDA", "direction": "up", "detail": "Firm upgrades to Buy, PT $200, reason" }
    ]
  },
  "catalyst_news": {
    "items": [
      { "tag": "Macro", "text": "Brief catalyst description and market impact" },
      { "tag": "Sector Name", "text": "Brief catalyst description" },
      { "tag": "Market Structure", "text": "Brief item" }
    ]
  },
  "trump_schedule": {
    "items": [
      { "time": "10:00 AM ET", "event": "Event description" }
    ],
    "note": "Optional note on market-relevant items (tariffs, Fed, policy)"
  },
  "morning_bias": {
    "direction": "Bullish Lean | Bearish Lean | Neutral | Cautiously Bullish | Cautiously Bearish",
    "text": "2-3 sentences explaining the bias. Name specific catalysts, key levels to watch, and what could flip the bias. Mention Initial Claims 220k consensus or relevant data."
  }
}

Requirements:
- Use real, accurate data for today's date. If you're not certain of exact pre-market moves, provide realistic estimates based on recent earnings cycles.
- Economic calendar: include all major US releases for today (Initial Jobless Claims, retail sales, PMI, Fed speakers, etc.)
- Earnings gappers: include any companies reporting pre-market today with estimated move direction
- Ratings: include 4-6 real recent analyst actions (upgrades, downgrades, initiations, PT changes)
- Catalyst news: 3-4 items covering macro, sector, geopolitical, or market structure items relevant to SPX/ES trading
- Trump schedule: include any public events, speeches, tariff announcements, or policy events
- Morning bias: be specific about $SPX levels, setup types (ORB, Vomy), and what catalysts matter
- importance levels: "high" for market-moving releases (NFP, CPI, FOMC), "medium" for secondary data, "low" for minor releases`;

      setStep('step-econ', 'active');

      try {
        const resp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1000,
            tools: [{ type: 'web_search_20250305', name: 'web_search' }],
            messages: [{ role: 'user', content: prompt }]
          })
        });

        setStep('step-econ', 'done');
        setStep('step-trump', 'active');

        if (!resp.ok) {
          throw new Error(`API error ${resp.status}`);
        }

        const data = await resp.json();

        setStep('step-trump', 'done');
        setStep('step-ratings', 'active');

        // Extract text from response (handles tool use + text blocks)
        let rawText = '';
        if (data.content) {
          for (const block of data.content) {
            if (block.type === 'text') {
              rawText += block.text;
            }
          }
        }

        setStep('step-ratings', 'done');
        setStep('step-catalyst', 'active');

        // Strip any markdown fences and parse JSON
        const cleaned = rawText.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
        const jsonStart = cleaned.indexOf('{');
        const jsonEnd = cleaned.lastIndexOf('}');
        if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON found in response');
        const jsonStr = cleaned.slice(jsonStart, jsonEnd + 1);
        const parsed = JSON.parse(jsonStr);

        setStep('step-catalyst', 'done');
        setStep('step-bias', 'active');

        await new Promise(r => setTimeout(r, 300));
        setStep('step-bias', 'done');

        await new Promise(r => setTimeout(r, 200));
        loading.style.display = 'none';
        renderBrief(parsed);

      } catch (err) {
        loading.style.display = 'none';
        errorPanel.textContent = 'Error generating brief: ' + err.message + '. Please try refreshing.';
        errorPanel.style.display = 'block';
      } finally {
        btn.disabled = false;
        icon.textContent = '↺';
      }
    }

    generateBrief();
  </script>
</Layout>
