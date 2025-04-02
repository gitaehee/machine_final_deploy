'use client'

import { useState, useEffect } from 'react'
import { FaFolderOpen, FaTrash } from 'react-icons/fa' // 📁 아이콘용 react-icons
// import Image from 'next/image' // ❗next/image 쓰고 싶을 때 활성화

export default function PredictPage() {
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<{ label: string; confidence: number }[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  // const [isDragging, setIsDragging] = useState(false) // ❌ 사용 안하므로 제거하거나 주석 처리

  // ✅ 미리보기 URL 생성
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setPreview(null)
  }, [file])

  // ✅ 서버 깨우기
  const wakeServer = async () => {
    try {
      await fetch('https://machinefinaldeploy-production.up.railway.app/')
    } catch {
      console.warn("서버 깨우기 실패 (무시해도 됨)")
    }
  }

  const handleUpload = async () => {
    if (!file) return

    await wakeServer()

    if (!file.type.startsWith("image/")) {
      alert("❗️이미지 파일만 업로드할 수 있어요.")
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("❗️5MB 이하 이미지만 업로드할 수 있어요.")
      return
    }

    const formData = new FormData()
    formData.append('image', file)

    const maxTimeout = 40000
    const updateInterval = 1000
    const steps = maxTimeout / updateInterval

    setProgress(0)
    setLoading(true)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), maxTimeout)

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

      if (!res.ok) {
        alert(`❌ 서버에서 오류가 발생했어요. (${res.status})`)
        throw new Error("응답 오류")
      }

      const data: { top3: { label: string; confidence: number }[] } = await res.json()
      setResult(data.top3)
      setProgress(100)
      setTimeout(() => {
        setLoading(false)
        setProgress(0)
      }, 200)
    } catch (err) {
      clearInterval(intervalId)
      if (err instanceof Error && err.name === 'AbortError') {
        alert("⏱️ 서버 응답이 너무 느려요.")
      } else {
        console.error('❌ 예측 실패:', err)
        alert("❌ 예측에 실패했어요.")
      }
      setResult(null)
      setProgress(0)
      setLoading(false)
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
        onDragOver={(_e) => _e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const droppedFile = e.dataTransfer.files?.[0]
          if (droppedFile?.type.startsWith("image/")) {
            setResult(null) // 예측 결과 초기화
            setFile(droppedFile)
          } else {
            alert("❗ 이미지 파일만 드롭할 수 있어요.")
          }
        }}
        className="border-4 border-dashed border-indigo-400 hover:border-indigo-600 transition-colors duration-300 rounded-xl p-8 text-center bg-indigo-50 dark:bg-zinc-800 mb-6"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
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
        <label className="flex items-center gap-2 cursor-pointer bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium py-2 px-4 rounded">
          <FaFolderOpen className="text-gray-600" />
          파일 선택
          <input
            type="file"
            accept="image/*"
            onChange={e => {
              const selectedFile = e.target.files?.[0] || null
              setResult(null) // 예측 결과 초기화. 얘가 setFile 보다 먼저 있어야함
              setFile(selectedFile)
            }}
            className="hidden"
          />
        </label>

        <button
          onClick={handleUpload}
          disabled={!file || loading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 px-5 rounded disabled:opacity-50"
        >
          예측하기
        </button>
      </div>

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
        // ✨ 조건에 따른 렌더링 로직 변경
        (() => {
          const first = result[0]
          const second = result[1]
          const third = result[2]

          const firstAbove = first && first.confidence >= 0.3
          const secondAbove = second && second.confidence >= 0.3
          const thirdAbove = third && third.confidence >= 0.3

          if (firstAbove) {
            return (
              <div className="mt-4">
                {/* ✨ 1위만 강조 */}
                <p className="text-yellow-600 font-bold text-lg">
                  🎉 당신의 작품 사조는 <strong>{first.label}</strong>입니다! (확률: {first.confidence})
                </p>

                {/* ✨ 2, 3위 추가 안내 */}
                {(secondAbove || thirdAbove) && (
                  <div className="mt-4 text-sm text-white-700">
                    <p>🔎 추가로 이런 사조도 비슷해 보입니다:</p>
                    <ul className="list-disc pl-6 mt-2">
                      {secondAbove && (
                        <li>
                          2위: <strong>{second.label}</strong> (확률: {second.confidence})
                        </li>
                      )}
                      {thirdAbove && (
                        <li>
                          3위: <strong>{third.label}</strong> (확률: {third.confidence})
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )
          } else {
            return (
              <p className="text-orange-500 mt-4">😥 해당되는 사조가 없습니다 (모든 예측 확률이 0.3 미만)</p>
            )
          }
        })()
      )}

    </div>
  )
}
