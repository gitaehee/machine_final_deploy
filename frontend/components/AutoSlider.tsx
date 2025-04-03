'use client'

import { useEffect, useRef } from 'react'

type Props = {
  label: string
}

export default function AutoSlider({ label }: Props) {
  const images = [`${label}1.jpg`, `${label}2.jpg`, `${label}3.jpg`]
  const fullImages = [...images, ...images] // 복제해서 무한루프처럼 보이게

  const sliderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const slider = sliderRef.current
    if (!slider) return

    let animationFrame: number
    let x = 0

    const animate = () => {
      x -= 2 // 속도
      if (slider) {
        slider.style.transform = `translateX(${x}px)`

        // 이미지 폭 절반만큼 밀리면 리셋 (무한 루프처럼 보이게)
        if (Math.abs(x) >= slider.scrollWidth / 2) {
          x = 0
        }
      }

      animationFrame = requestAnimationFrame(animate)
    }

    animationFrame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animationFrame)
  }, [])

  return (
    <div className="w-full h-72 overflow-hidden relative rounded shadow-lg mt-4">
      <div
        ref={sliderRef}
        className="flex h-full"
        style={{
          width: 'max-content',
          whiteSpace: 'nowrap',
        }}
      >
        {fullImages.map((img, i) => (
          <img
            key={i}
            src={`/sample/${img}`}
            alt={`${label} 예시 ${(i % 3) + 1}`}
            className="h-full w-auto object-contain mx-4"
          />
        ))}
      </div>
    </div>
  )
}
