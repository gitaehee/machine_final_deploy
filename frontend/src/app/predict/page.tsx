'use client'

import { useState } from 'react'

export default function PredictPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ label: string; confidence: number }[] | null>(null)
  const [loading, setLoading] = useState(false)

  const handleUpload = async () => {
    if (!file) return

    // ✅ 여기에 넣어줘!
    if (file && !file.type.startsWith("image/")) {
        alert("❗️이미지 파일만 업로드할 수 있어요.")
        return
    }

    if (file && file.size > 5 * 1024 * 1024) {
        alert("❗️5MB 이하 이미지만 업로드할 수 있어요.")
        return
    }

    const formData = new FormData()
    formData.append('image', file)

    setLoading(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 40000)

    try {
      const res = await fetch('https://style-predict-backend.onrender.com/predict', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // ✅ 응답 상태코드 확인
      if (!res.ok) {
        console.error('❌ 서버 응답 실패:', res.status)
        alert(`❌ 서버에서 오류가 발생했어요. (${res.status})`)
        return
      }

      // ✅ JSON 응답 안전하게 처리
      const data = await res.json()
      console.log('✅ 예측 결과:', data)
      setResult(data.top3)

      
    } catch (err: any) {
        if (err.name === 'AbortError') {
          alert("⏱️ 서버 응답이 너무 느려요.\n다시 시도하거나 잠시 기다려 주세요.")
        } else {
          console.error('❌ 예측 실패:', err)
          alert("❌ 예측에 실패했어요.\n서버가 꺼져 있거나 이미지가 너무 클 수 있어요.")
        }
        setResult(null)
    } finally {
      setLoading(false) // ✅ 예측이 끝나거나 실패해도 무조건 false 처리
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">🎨 화풍(사조) 예측기</h1>

      <input
        type="file"
        accept="image/*"
        onChange={e => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <button
        onClick={handleUpload}
        className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-4 rounded"
        disabled={!file || loading}
      >
        {loading ? (
            <span className="flex items-center">
                <svg className="animate-spin h-4 w-4 mr-2 text-white" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8z" />
                </svg>
                예측 중...
            </span>
        ) : '예측하기'}
      </button>

      {result && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold mb-2">🔮 예측 결과 (Top 3)</h2>
          <ul className="list-disc pl-6">
            {result.map((item, idx) => (
              <li key={idx}>
                {idx + 1}위: <strong>{item.label}</strong> ({(item.confidence * 100).toFixed(2)}%)
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
