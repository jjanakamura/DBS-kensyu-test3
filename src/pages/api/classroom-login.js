import { getOperator, findClassroom } from '../../lib/db';
import { writeAccessLog } from '../../lib/accessLog';
import { generateClassroomToken } from '../../lib/auth';
import { checkRateLimit } from '../../lib/rateLimit';

/**
 * 教室ダッシュボード ログイン API
 * POST /api/classroom-login
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!checkRateLimit(req, res, { key: 'classroom-login', limit: 10, windowMs: 60_000 })) return;

  const { operatorCode, classroomCode, password } = req.body;
  if (!operatorCode || !classroomCode || !password) {
    return res.status(400).json({ success: false, message: '事業者コード・教室コード・パスワードをすべて入力してください。' });
  }

  try {
    const opCode = String(operatorCode).trim().toUpperCase();
    const clsCode = String(classroomCode).trim().toUpperCase();

    const operator = await getOperator(opCode);
    if (!operator) {
      await writeAccessLog({ type: 'classroom', target: `${opCode}/${clsCode}`, result: 'fail', reason: '事業者コード不存在', req });
      return res.status(200).json({ success: false, message: '事業者コードが見つかりません。' });
    }
    if (operator.status === 'inactive') {
      await writeAccessLog({ type: 'classroom', target: `${opCode}/${clsCode}`, result: 'fail', reason: '事業者アカウント停止中', req });
      return res.status(200).json({ success: false, message: 'このアカウントは停止されています。事務局にお問い合わせください。' });
    }

    const classroom = await findClassroom(opCode, clsCode, { activeOnly: true });
    if (!classroom) {
      await writeAccessLog({ type: 'classroom', target: `${opCode}/${clsCode}`, result: 'fail', reason: '教室コード不存在', req });
      return res.status(200).json({ success: false, message: '教室コードが見つかりません。' });
    }

    // 本部教室はclassroomログイン不可
    if (classroom.isHQ) {
      await writeAccessLog({ type: 'classroom', target: `${opCode}/${clsCode}`, result: 'fail', reason: '本部教室は教室ログイン不可', req });
      return res.status(200).json({
        success: false,
        message: 'この教室コードは事業者本部用です。事業者本部の方は「事業者ログイン」からアクセスしてください。',
      });
    }

    const storedPw = classroom.classroomPassword || classroom.classroomCode;
    if (storedPw !== String(password)) {
      await writeAccessLog({ type: 'classroom', target: `${opCode}/${clsCode}`, result: 'fail', reason: 'パスワード不正', req });
      return res.status(200).json({ success: false, message: 'パスワードが正しくありません。' });
    }

    await writeAccessLog({ type: 'classroom', target: `${opCode}/${clsCode}`, result: 'success', req });
    return res.status(200).json({
      success: true,
      operatorCode: operator.operatorCode,
      classroomCode: classroom.classroomCode,
      companyName: operator.companyName,
      classroomName: classroom.classroomName,
      classroomToken: generateClassroomToken(storedPw),
    });
  } catch (err) {
    console.error('classroom-login エラー:', err);
    return res.status(500).json({ success: false, message: '内部エラーが発生しました。' });
  }
}
