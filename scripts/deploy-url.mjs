import { pathToFileURL } from 'node:url';

export function healthUrl(appUrl, healthPath = '/api/health/ready') {
  if (!appUrl) throw new Error('APP_URL é obrigatória antes de publicar.');
  const base = new URL(appUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw new Error('APP_URL deve ser uma URL HTTPS sem credenciais, query ou fragmento.');
  }
  if (!healthPath.startsWith('/') || healthPath.startsWith('//') || /[\\?#\s]/.test(healthPath)) {
    throw new Error('HEALTH_PATH deve ser um caminho absoluto, como /api/health.');
  }
  return `${base.href.replace(/\/$/, '')}${healthPath}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const healthPath = process.env.HEALTH_PATH || '/api/health/ready';
    const health = healthUrl(process.env.APP_URL, healthPath);
    if (process.argv.includes('--all')) {
      const app = new URL(process.env.APP_URL);
      console.log(app.href);
      console.log(health);
      console.log(healthUrl(`https://api.${app.host}`, healthPath));
    } else {
      console.log(health);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
