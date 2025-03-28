'use client'

import { useState, useEffect } from 'react'
import { FaFolderOpen, FaTrash } from 'react-icons/fa' // 📁 아이콘용 react-icons

export default function PredictPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ label: string; confidence: number }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // ✅ 미리보기 URL 생성
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreview(null)
  }, [file])


  // ✅ 여기에 wakeServer 함수 선언
  const wakeServer = async () => {
    try {
      await fetch('https://machinefinaldeploy-production.up.railway.app/')
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
      const res = await fetch('https://machinefinaldeploy-production.up.railway.app/predict', {
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

  const handleRemove = () => {
    setFile(null)
    setPreview(null)
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">🎨 화풍(사조) 예측기</h1>

    {/* 🔽 드래그 앤 드롭 박스 */}
    <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const droppedFile = e.dataTransfer.files?.[0]
          if (droppedFile && droppedFile.type.startsWith("image/")) {
            setFile(droppedFile)
          } else {
            alert("❗ 이미지 파일만 드롭할 수 있어요.")
          }
        }}
        className="border-4 border-dashed border-indigo-400 hover:border-indigo-600 transition-colors duration-300 rounded-xl p-8 text-center bg-indigo-50 dark:bg-zinc-800 mb-6"
      >
        {preview ? (
          <img
            src={preview}
            alt="미리보기"
            className="mx-auto max-h-64 rounded shadow-md"
          />
        ) : (
          <p className="text-gray-500">👉 여기에 이미지를 드래그하거나 아래에서 파일을 선택해 주세요.</p>
        )}
      </div>


    {/* ✅ 파일 선택 + 예측 버튼 */}
    <div className="flex items-center justify-between mb-2">
        {/* 파일 선택 버튼 */}
        <label className="flex items-center gap-2 cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium py-2 px-4 rounded">
          <FaFolderOpen className="text-gray-600" />
          파일 선택
          <input
            type="file"
            accept="image/*"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>

        {/* 예측하기 버튼 */}
        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-5 rounded disabled:opacity-50"
        >
          예측하기
        </button>
    </div>


    {/* 선택된 파일명 표시 */}
    {file ? (
        <div className="flex items-center justify-between text-sm text-gray-400 mb-6">
          <span>선택된 파일: {file.name}</span>
          <button onClick={handleRemove} className="text-red-400 hover:text-red-600">
            <FaTrash className="inline-block mr-1" /> 삭제
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 mb-6">선택된 파일 없음</p>
      )}

      {loading && (
        <div className="w-full max-w-xs bg-gray-200 rounded-full h-2 mt-4 overflow-hidden">
          <div
            className="bg-indigo-600 h-2 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {result && result.length > 0 && (
        result[0].label === "해당되는 사조가 없습니다" ? (
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
