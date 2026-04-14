import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';

/**
 * アクセスログ取得 API
 * GET /api/get-access-logs?limit=200
 */
export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const logPath = getDataPath('access-log.json');
    if (!fs.existsSync(logPath)) {
      return res.status(200).json({ logs: [] });
    }
    const all = JSON.parse(fs.readFileSync(logPath, 'utf-8') || '[]');
    const limit = Math.min(parseInt(req.query.limit || '200', 10), 1000);
    return res.status(200).json({ logs: all.slice(0, limit) });
  } catch (err) {
    console.error('get-access-logs error:', err);
    return res.status(500).json({ error: err.message });
  }
}
