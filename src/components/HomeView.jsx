import { useEffect, useState } from 'react';
import { useT } from '../i18n.jsx';

function getLastSevenDays() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

function toPoints(values, max, width, height, padding, stepX) {
  return values.map((v, i) => {
    const x = padding + i * stepX;
    const y = height - padding - (v / max) * (height - padding * 2);
    return { x, y };
  });
}

function toPath(points) {
  return points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
}

export default function HomeView({ active, vaultVersion }) {
  const t = useT();
  const [sessionPercent, setSessionPercent] = useState(null);
  const [weeklyPercent, setWeeklyPercent] = useState(null);
  const [promptStats, setPromptStats] = useState({});
  const [gitStats, setGitStats] = useState({});
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (!active) return;

    (async () => {
      const config = await window.claudeAPI.getConfig();
      setUserName(config.userName || '');
    })();

    (async () => {
      const raw = await window.claudeAPI.getUsage();
      const percentMatches = raw.match(/(\d{1,3})\s*%/g);
      setSessionPercent(percentMatches?.[0] ? parseInt(percentMatches[0]) : null);
      setWeeklyPercent(percentMatches?.[1] ? parseInt(percentMatches[1]) : null);
    })();

    (async () => {
      setPromptStats(await window.claudeAPI.getPromptStats());
      setGitStats(await window.claudeAPI.getGitStats());
    })();
  }, [active, vaultVersion]);

  const days = getLastSevenDays();
  const promptValues = days.map((d) => promptStats[d] || 0);
  const gitValues = days.map((d) => gitStats[d] || 0);
  const max = Math.max(...promptValues, ...gitValues, 1);

  const width = 600;
  const height = 220;
  const padding = 20;
  const stepX = (width - padding * 2) / (days.length - 1);

  const promptPoints = toPoints(promptValues, max, width, height, padding, stepX);
  const promptLine = toPath(promptPoints);
  const promptArea = `${promptLine} L ${promptPoints[promptPoints.length - 1].x} ${height - padding} L ${promptPoints[0].x} ${height - padding} Z`;

  const gitPoints = toPoints(gitValues, max, width, height, padding, stepX);
  const gitLine = toPath(gitPoints);

  return (
    <div id="home-view" className="view" style={{ display: active ? 'flex' : 'none' }}>
      <div id="topbar">
        <div>
          <div id="greeting">{userName ? t('home.greeting', { name: userName }) : t('home.greetingGeneric')}</div>
          <div id="greeting-sub">{t('home.greetingSub')}</div>
        </div>
      </div>

      <div id="home-stats">
        <div className="stat-card">
          <div className="stat-label">{t('home.sessionUsage')}</div>
          <div className="stat-value">{sessionPercent !== null ? `${sessionPercent}%` : '–'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('home.weeklyLimit')}</div>
          <div className="stat-value">{weeklyPercent !== null ? `${weeklyPercent}%` : '–'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t('home.status')}</div>
          <div className="stat-value"><span className="status-dot" style={{ marginRight: 8 }}></span>{t('home.ready')}</div>
        </div>
      </div>

      <div id="graph-card">
        <div className="usage-card-label" style={{ marginBottom: 14 }}>{t('home.chartTitle')}</div>
        <div className="graph-legend">
          <span><span className="dot-purple"></span> {t('home.legendPrompts')}</span>
          <span><span className="dot-green"></span> {t('home.legendGit')}</span>
        </div>
        <svg id="glowChart" viewBox="0 0 600 220" preserveAspectRatio="none">
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop className="area-stop-start" offset="0%" stopOpacity="0.35" />
              <stop className="area-stop-end" offset="100%" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path id="areaPath" fill="url(#areaFill)" stroke="none" d={promptArea}></path>
          <path id="linePath" fill="none" strokeWidth="2" d={promptLine}></path>

          <g id="dots">
            {promptPoints.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r="4" />
            ))}
          </g>

          <path id="gitLinePath" fill="none" strokeWidth="2" strokeDasharray="5,4" d={gitLine}></path>
        </svg>
        <div id="graph-labels">
          {days.map((d) => (
            <span key={d}>{d.slice(5)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
