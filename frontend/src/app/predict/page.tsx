'use client'

import { useState } from 'react'

export default function PredictPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ label: string; confidence: number }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)

  // ✅ 여기에 wakeServer 함수 선언
  const wakeServer = async () => {
    try {
      await fetch('https://style-predict-backend.onrender.com')
    } catch (e) {
      console.warn("서버 깨우기 실패 (무시해도 됨)")
    }
  }

  const handleUpload = async () => {
    if (!file) return

    // ✅ 2. 예측 시작 전에 서버 깨우기
    await wakeServer()

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

    const maxTimeout = 40000 // 40초
    const updateInterval = 1000 // 1초마다 progress 업데이트
    const steps = maxTimeout / updateInterval

    setProgress(0)
    setLoading(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), maxTimeout)

    // 🌈 진행 바용 인터벌 타이머
    const intervalId = setInterval(() => {
      setProgress(prev => {
        const next = prev + 100 / steps
        return next >= 100 ? 100 : next
      })
    }, updateInterval)

    try {
      const res = await fetch('https://style-predict-backend.onrender.com/predict', {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)
      clearInterval(intervalId)

      // ✅ 응답 상태코드 확인
      if (!res.ok) {
        alert(`❌ 서버에서 오류가 발생했어요. (${res.status})`)
        throw new Error("응답 오류")  // 🔥 여기서 throw로 catch로 보냄
      }

      // ✅ JSON 응답 안전하게 처리
      const data = await res.json()
      setResult(data.top3)

      // ✅ 바를 즉시 100%로 채움
      setProgress(100)

      // ✅ 잠깐 보여주고 로딩 종료
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 200) // 0.2초 후 숨김

      
    } catch (err: any) {
      clearInterval(intervalId)
      if (err.name === 'AbortError') {
        alert("⏱️ 서버 응답이 너무 느려요.")
      } else {
        console.error('❌ 예측 실패:', err)
        alert("❌ 예측에 실패했어요.")
      }
      setResult(null)
      setProgress(0)
      setLoading(false)  // 실패한 경우만 여기서 처리
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
        예측하기
      </button>

      {loading && (
        <div className="w-full max-w-sm bg-gray-200 rounded-full h-2 mt-4 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {result && (
        result.length === 1 && result[0].label === "해당되는 사조가 없습니다" ? (
          <p className="text-orange-500 mt-4">😥 {result[0].label} (확률: {result[0].confidence})</p>
        ) : (
            <ul className="list-disc pl-6 mt-4">
              {result.map((item, idx) => (
              <li key={idx}>
                  {idx + 1}위: <strong>{item.label}</strong> (확률: {item.confidence})
              </li>
              ))}
          </ul>
        )
      )}
    </div>
  )
}
