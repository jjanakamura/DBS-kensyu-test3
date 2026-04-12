import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Layout from '../components/Layout';

/**
 * 確認テスト画面
 * - 40問バンクからランダムに20問を選択
 * - 設問順シャッフル・選択肢順シャッフル（Fisher-Yates）
 * - 合格基準：16問以上正解（80%）
 * - 不合格回数を sessionStorage に記録
 *   1〜2回目不合格：テストのみ再受講可
 *   3回目以降不合格：動画視聴から再受講
 */

const QUESTION_COUNT = 20;  // 出題数
const PASS_COUNT = 16;       // 合格に必要な正答数（80%）

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 40問バンクからランダムに20問選択し、設問・選択肢をシャッフル
function prepareQuestions(allQuestions) {
  const selected = shuffle(allQuestions).slice(0, QUESTION_COUNT);
  return selected.map((q) => {
    const correctText = q.choices[q.answer];
    const shuffledChoices = shuffle(q.choices);
    return {
      ...q,
      shuffledChoices,
      shuffledCorrectIndex: shuffledChoices.indexOf(correctText),
    };
  });
}

export default function TestPage({ questions }) {
  const router = useRouter();
  const [trainee, setTrainee] = useState(null);
  const [prepared, setPrepared] = useState([]);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('trainee');
    if (!stored) { router.replace('/register'); return; }
    setTrainee(JSON.parse(stored));
    setPrepared(prepareQuestions(questions));
  }, []);

  const handleSubmit = async () => {
    const unanswered = prepared.filter((q) => answers[q.id] === undefined);
    if (unanswered.length > 0) {
      alert(`まだ回答していない問題が ${unanswered.length} 問あります。全問回答してから送信してください。`);
      return;
    }
    setSubmitting(true);

    let correctCount = 0;
    const answerDetails = prepared.map((q) => {
      const selected = answers[q.id];
      const isCorrect = selected === q.shuffledCorrectIndex;
      if (isCorrect) correctCount++;
      return {
        questionId: q.id,
        questionText: q.question,
        selectedText: q.shuffledChoices[selected],
        correctText: q.shuffledChoices[q.shuffledCorrectIndex],
        isCorrect,
      };
    });

    const totalQuestions = prepared.length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = correctCount >= PASS_COUNT;

    // 不合格回数を管理
    const prevFailCount = parseInt(sessionStorage.getItem('failCount') || '0');
    const newFailCount = passed ? 0 : prevFailCount + 1;
    if (!passed) {
      sessionStorage.setItem('failCount', String(newFailCount));
    } else {
      sessionStorage.removeItem('failCount'); // 合格時はリセット
    }

    const today = new Date();
    const completionDate = today.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
    const certNumber = `JJA-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const traineeData = JSON.parse(sessionStorage.getItem('trainee'));

    try {
      await fetch('/api/submit-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...traineeData,
          score, correctCount, totalQuestions, passed,
          failCount: newFailCount,
          completionDate: passed ? completionDate : null,
          certNumber: passed ? certNumber : null,
          answers: answerDetails,
          submittedAt: new Date().toISOString(),
        }),
      });
    } catch (e) {
      console.error('記録の保存に失敗しました:', e);
    }

    sessionStorage.setItem('result', JSON.stringify({
      score, correctCount, totalQuestions, passed,
      failCount: newFailCount,
      completionDate: passed ? completionDate : null,
      certNumber: passed ? certNumber : null,
      answerDetails,
    }));

    router.push('/result');
  };

  if (!trainee || prepared.length === 0) return null;

  const answeredCount = Object.keys(answers).length;
  const totalCount = prepared.length;

  return (
    <Layout title="確認テスト">
      <div className="max-w-2xl mx-auto">
        {/* ステッパー */}
        <div className="flex flex-wrap items-center gap-1 text-xs text-gray-400 mb-5">
          <span className="text-green-700 font-medium">① 基本情報 ✓</span>
          <span className="mx-1">›</span>
          <span className="text-green-700 font-medium">② 動画視聴 ✓</span>
          <span className="mx-1">›</span>
          <span className="font-bold text-green-800">③ 確認テスト</span>
          <span className="mx-1">›</span>
          <span>④ 修了証</span>
        </div>

        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl font-bold text-gray-900">確認テスト</h1>
          <span className="text-sm text-gray-500">回答済み：{answeredCount} / {totalCount} 問</span>
        </div>
        <p className="text-sm text-gray-500 mb-5">
          全問回答後「採点する」を押してください。合格基準：<strong>16問以上正解（80%以上）</strong>
        </p>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 text-xs text-green-800">
          ※ 40問の問題バンクから20問がランダムに出題されます。問題・選択肢の順番も毎回変わります。
        </div>

        {/* 問題一覧 */}
        <div className="space-y-5 mb-8">
          {prepared.map((q, idx) => (
            <div key={q.id} className="bg-white rounded-xl shadow-sm border border-green-200 p-5">
              <div className="flex gap-3 mb-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-green-800 text-white text-xs font-bold flex items-center justify-center">
                  {idx + 1}
                </span>
                <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.question}</p>
              </div>
              <div className="space-y-2">
                {q.shuffledChoices.map((choice, optIdx) => {
                  const isSelected = answers[q.id] === optIdx;
                  return (
                    <label key={optIdx}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        isSelected
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-gray-50 hover:bg-green-50 hover:border-green-300'
                      }`}>
                      <input type="radio" name={`q-${q.id}`} value={optIdx} checked={isSelected}
                        onChange={() => setAnswers({ ...answers, [q.id]: optIdx })}
                        className="mt-0.5 flex-shrink-0 accent-green-700" />
                      <span className="text-sm text-gray-800 leading-relaxed">{choice}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* 進捗バー */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>回答進捗</span>
            <span>{answeredCount} / {totalCount} 問</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-green-700 h-2 rounded-full transition-all"
              style={{ width: `${(answeredCount / totalCount) * 100}%` }} />
          </div>
        </div>

        {/* 採点ボタン */}
        <button
          onClick={handleSubmit}
          disabled={submitting || answeredCount < totalCount}
          className="w-full bg-green-800 hover:bg-green-700 active:bg-green-900 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {submitting ? '採点中...'
            : answeredCount < totalCount ? `残り ${totalCount - answeredCount} 問を回答してください`
            : '採点する →'}
        </button>
      </div>
    </Layout>
  );
}

export async function getServerSideProps() {
  const path = require('path');
  const fs = require('fs');
  const filePath = path.join(process.cwd(), 'data', 'questions.json');
  const questions = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  return { props: { questions } };
}
