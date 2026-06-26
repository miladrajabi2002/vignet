'use client'

import { useEffect, useRef } from 'react'

interface Node {
  x: number
  y: number
  vx: number
  vy: number
}

export function ParticleGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const isMobile = window.matchMedia('(max-width: 768px)').matches
    const COUNT = isMobile ? 25 : 50
    const LINK_DIST = 120
    const REPEL_DIST = 80

    let width = 0
    let height = 0
    let nodes: Node[] = []
    const mouse = { x: -9999, y: -9999 }
    let raf = 0

    function resize() {
      const parent = canvas!.parentElement
      width = parent?.clientWidth ?? window.innerWidth
      height = parent?.clientHeight ?? window.innerHeight
      canvas!.width = width * dpr
      canvas!.height = height * dpr
      canvas!.style.width = `${width}px`
      canvas!.style.height = `${height}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    function seed() {
      nodes = Array.from({ length: COUNT }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
      }))
    }

    function step() {
      if (document.hidden) {
        raf = requestAnimationFrame(step)
        return
      }
      ctx!.clearRect(0, 0, width, height)

      for (const n of nodes) {
        n.x += n.vx
        n.y += n.vy
        if (n.x < 0 || n.x > width) n.vx *= -1
        if (n.y < 0 || n.y > height) n.vy *= -1

        // Mouse repel
        const dx = n.x - mouse.x
        const dy = n.y - mouse.y
        const dist = Math.hypot(dx, dy)
        if (dist < REPEL_DIST && dist > 0) {
          const force = (REPEL_DIST - dist) / REPEL_DIST
          n.x += (dx / dist) * force * 2
          n.y += (dy / dist) * force * 2
        }
      }

      // Links
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.hypot(dx, dy)
          if (dist < LINK_DIST) {
            const opacity = (1 - dist / LINK_DIST) * 0.12
            ctx!.strokeStyle = `rgba(255,255,255,${opacity})`
            ctx!.lineWidth = 1
            ctx!.beginPath()
            ctx!.moveTo(nodes[i].x, nodes[i].y)
            ctx!.lineTo(nodes[j].x, nodes[j].y)
            ctx!.stroke()
          }
        }
      }

      // Dots
      ctx!.fillStyle = 'rgba(255,255,255,0.5)'
      for (const n of nodes) {
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, 1, 0, Math.PI * 2)
        ctx!.fill()
      }

      raf = requestAnimationFrame(step)
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
    }
    function onMouseLeave() {
      mouse.x = -9999
      mouse.y = -9999
    }

    resize()
    seed()
    step()

    const ro = new ResizeObserver(() => {
      resize()
      seed()
    })
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0"
    />
  )
}
