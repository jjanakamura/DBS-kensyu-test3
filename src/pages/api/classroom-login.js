import fs from 'fs';
import { getDataPath } from '../../lib/dataPath';
import { writeAccessLog } from '../../lib/accessLog';
import { generateClassroomToken } from '../../lib/auth';

/**
 * 教室ダッシュボード ログイン API
 * POST /api/classroom-login
 *
 * リクエスト: { operatorCode, classroomCode, password }
 * レスポンス:
 *   { success: true, operatorCode, classroomCode, companyName, classroomName }
 *   { success: false, message: string }
 */
export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { operatorCode, classroomCode, password } = req.body;

  if (!operatorCode || !classroomCode || !password) {
    return res.status(400).json({ success: false, message: '事業者コード・教室コード・パスワードをすべて入力してください。' });
  }

  try {
    const opFilePath  = getDataPath('operators.json');
    const clsFilePath = getDataPath('classrooms.json');

    const operators  = JSON.parse(fs.readFileSync(opFilePath, 'utf-8') || '[]');
    const classrooms = JSON.parse(fs.readFileSync(clsFilePath, 'utf-8') || '[]');

    const normalizedOp  = String(operatorCode).trim().toUpperCase();
    const normalizedCls = String(classroomCode).trim().toUpperCase();

    const operator = operators.find(
      (o) => o.operatorCode.trim().toUpperCase() === normalizedOp
    );
    if (!operator) {
      writeAccessLog({ type: 'classroom', target: `${normalizedOp}/${normalizedCls}`, result: 'fail', reason: '事業者コード不存在', req });
      return res.status(200).json({ success: false, message: '事業者コードが見つかりません。' });
    }
    if (operator.status === 'inactive') {
      writeAccessLog({ type: 'classroom', target: `${normalizedOp}/${normalizedCls}`, result: 'fail', reason: '事業者アカウント停止中', req });
      return res.status(200).json({ success: false, message: 'このアカウントは停止されています。事務局にお問い合わせください。' });
    }

    const classroom = classrooms.find(
      (c) =>
        c.classroomCode.trim().toUpperCase() === normalizedCls &&
        c.operatorCode.trim().toUpperCase() === normalizedOp &&
        c.status === 'active'
    );
    if (!classroom) {
      writeAccessLog({ type: 'classroom', target: `${normalizedOp}/${normalizedCls}`, result: 'fail', reason: '教室コード不存在', req });
      return res.status(200).json({ success: false, message: '教室コードが見つかりません。' });
    }

    // パスワード確認（未設定の場合は classroomCode をデフォルトとする）
    const storedPw = classroom.classroomPassword || classroom.classroomCode;
    if (storedPw !== String(password)) {
      writeAccessLog({ type: 'classroom', target: `${normalizedOp}/${normalizedCls}`, result: 'fail', reason: 'パスワード不正', req });
      return res.status(200).json({ success: false, message: 'パスワードが正しくありません。' });
    }

    writeAccessLog({ type: 'classroom', target: `${normalizedOp}/${normalizedCls}`, result: 'success', req });
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
