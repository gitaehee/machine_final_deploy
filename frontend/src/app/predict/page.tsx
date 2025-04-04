'use client'

import { useState, useEffect } from 'react'
import { FaFolderOpen, FaTrash } from 'react-icons/fa' // 📁 아이콘용 react-icons
// import Image from 'next/image' // ❗next/image 쓰고 싶을 때 활성화
import AutoSlider from '../../../components/AutoSlider'

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
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8 font-sans">
      <h1 className="text-center text-[42px] leading-tight font-serif text-[#caa27a] mb-8 drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)]">
        🎨 <span className="italic tracking-wide">Know Your Style</span>
      </h1>

      {/* 업로드 카드 */}
      <div className="rounded-xl border border-[#e8dac9] bg-[#fffaf3] p-6 shadow-inner">
        <h2 className="text-lg font-semibold text-[#6e584f] mb-4">
          📤 이미지 업로드
        </h2>

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const droppedFile = e.dataTransfer.files?.[0]
            if (droppedFile?.type.startsWith("image/")) {
              setResult(null)
              setFile(droppedFile)
            } else {
              alert("❗ 이미지 파일만 드롭할 수 있어요.")
            }
          }}
          className="border-2 border-dashed border-[#d3b49f] hover:border-[#c9a27e] rounded-xl p-6 text-center bg-[#fdf6ec] transition"
        >
          {preview ? (
            <img
              src={preview}
              alt="미리보기"
              className="mx-auto max-h-64 rounded-xl shadow-sm"
            />
          ) : (
            <p className="text-[#a49386]">
              👉 이미지를 드래그하거나 아래에서 파일을 선택해 주세요.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-4">
          <label className="flex items-center gap-2 cursor-pointer bg-[#efe2d1] hover:bg-[#e4d4bf] text-[#4b3f36] text-sm font-medium py-2 px-4 rounded-lg transition">
            <FaFolderOpen className="text-[#6e584f]" />
            파일 선택
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const selectedFile = e.target.files?.[0] || null
                setResult(null)
                setFile(selectedFile)
              }}
              className="hidden"
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || loading}
            className="bg-[#c9a27e] hover:bg-[#b89174] text-white font-semibold py-2 px-5 rounded-lg shadow-sm disabled:opacity-50 transition"
          >
            예측하기
          </button>
        </div>

        <div className="text-sm text-[#998675] mt-2 flex justify-between">
          {file ? (
            <>
              <span>선택된 파일: {file.name}</span>
              <button onClick={handleRemove} className="text-[#b27363] hover:text-[#a15f4d]">
                <FaTrash className="inline-block mr-1" /> 삭제
              </button>
            </>
          ) : (
            <span>선택된 파일 없음</span>
          )}
        </div>

        {loading && (
          <div className="w-full bg-[#e8dac9] rounded-full h-2 mt-6 overflow-hidden">
            <div
              className="bg-[#c9a27e] h-2 transition-all duration-1000"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      {/* 결과 카드 */}
      {result && result.length > 0 && (() => {
        const first = result[0]
        const second = result[1]
        const third = result[2]

        const firstAbove = first && first.confidence >= 0.3
        const secondAbove = second && second.confidence >= 0.3
        const thirdAbove = third && third.confidence >= 0.3

        if (firstAbove) {
          const labelMap: Record<string, string> = {
            '사실주의': 'Realism',
            '낭만주의': 'Romanticism',
            '인상주의': 'Impressionism',
            '표현주의': 'Expressionism',
            '바로크 양식': 'Baroque',
            '아르누보': 'ArtNouveau(Modern)',
            '북부 르네상스': 'NorthernRenaissance',
            '초현실주의': 'Surrealism',
            '로코코 양식': 'Rococo'
          }

          const label = labelMap[first.label] || first.label.replace(/\s/g, '')

          return (
            <div className="rounded-xl border border-[#e8dac9] bg-[#fffaf3] p-6 shadow-inner">
              <h2 className="text-lg font-semibold text-[#6e584f] mb-4">
                🔍 예측 결과
              </h2>

              <p className="text-[#a17c6b] font-semibold text-xl mb-2">
                🎉 당신의 작품 사조는 <span className="font-bold text-[#5f5048]">{first.label}</span>입니다!
                <span className="ml-1 text-sm">({(first.confidence * 100).toFixed(1)}%)</span>
              </p>

              {(secondAbove || thirdAbove) && (
                <div className="mt-3 text-sm text-[#6e584f]">
                  <p>📌 추가로 이런 사조도 비슷해 보입니다:</p>
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    {secondAbove && (
                      <li>
                        2위: <strong>{second.label}</strong> ({(second.confidence * 100).toFixed(1)}%)
                      </li>
                    )}
                    {thirdAbove && (
                      <li>
                        3위: <strong>{third.label}</strong> ({(third.confidence * 100).toFixed(1)}%)
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="mt-6">
                <p className="font-medium text-[#5c4b3c] mb-2">🖼️ {first.label} 대표 작품 예시:</p>
                <AutoSlider label={label} />
              </div>
            </div>
          )
        } else {
          return (
            <div className="rounded-xl border border-[#e6cfc0] bg-[#f9ece0] text-[#b35c4b] p-6 text-center shadow-sm">
              😥 해당되는 사조가 없습니다 (모든 예측 확률이 0.3 미만)
            </div>
          )
        }
      })()}
    </div>


  )
}
