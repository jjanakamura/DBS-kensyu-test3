import { getOperator, findClassroom } from '../../lib/db';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * 事業者コード・教室コード照合 API
 * POST /api/lookup-operator
 *
 * リクエスト: { operatorCode: string, classroomCode?: string, track?: 'general' | 'manager' }
 * レスポンス:
 *   { found: true, companyName, classroomName?, isHQ? }
 *   { found: false, inactive: true }
 *   { found: false }
 *   { found: false, managerNotAllowed: true }
 *
 * 情報管理責任者研修（track=manager）の制限：
 *   - 必ず classroomCode が指定されていること
 *   - 該当教室が本部教室（isHQ: true）であること
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { key: 'lookup-operator', limit: 20, windowMs: 60_000 })) return;

  const { operatorCode, classroomCode, track } = req.body;
  const isManagerTrack = track === 'manager';
  if (!operatorCode || typeof operatorCode !== 'string') {
    return res.status(400).json({ error: 'operatorCode は必須です。' });
  }

  try {
    const operator = await getOperator(operatorCode);
    if (!operator) return res.status(200).json({ found: false });
    if (operator.status === 'inactive') return res.status(200).json({ found: false, inactive: true });

    let classroomName = null;
    let isHQ = false;
    if (classroomCode) {
      const classroom = await findClassroom(operatorCode, classroomCode, { activeOnly: true });
      if (classroom) {
        classroomName = classroom.classroomName;
        isHQ = !!classroom.isHQ;
      }
    }

    if (isManagerTrack) {
      if (!classroomCode || !isHQ) {
        return res.status(200).json({
          found: false,
          managerNotAllowed: true,
          message: '情報管理責任者向け研修は、事業者本部からの専用URLでのみ受講可能です。',
        });
      }
    }

    return res.status(200).json({
      found: true,
      companyName: operator.companyName,
      classroomName,
      isHQ,
    });
  } catch (err) {
    console.error('lookup-operator エラー:', err);
    return res.status(500).json({ error: '内部エラーが発生しました。' });
  }
}
