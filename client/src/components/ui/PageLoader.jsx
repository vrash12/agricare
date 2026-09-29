import { useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { GiWheat } from 'react-icons/gi'
import logoMinecraft from '../../assets/logo-minecraft.png'

const PageLoader = ({ onDone }) => {
    const theme = useSelector((state) => state.theme)
    const canvasRef = useRef(null)
    const [fading, setFading] = useState(false)

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        const timer = setTimeout(() => {
            setFading(true)
            setTimeout(() => {
                document.body.style.overflow = ''
                onDone?.()
            }, 500)
        }, 2500)
        return () => {
            clearTimeout(timer)
            document.body.style.overflow = ''
        }
    }, [onDone])

    useEffect(() => {

        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        canvas.width = window.innerWidth
        canvas.height = window.innerHeight

        const particles = Array.from({ length: 40 }, () => ({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 6 + 2,
            speedX: (Math.random() - 0.5) * 1.5,
            speedY: -Math.random() * 1.5 - 0.5,
            opacity: Math.random() * 0.6 + 0.2,
        }))

        let animFrame
        const animate = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            particles.forEach((p) => {
                ctx.beginPath()
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
                ctx.fillStyle = `rgba(71, 131, 71, ${p.opacity})`
                ctx.fill()
                p.x += p.speedX
                p.y += p.speedY
                if (p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width }
                if (p.x < -10) p.x = canvas.width + 10
                if (p.x > canvas.width + 10) p.x = -10
            })
            animFrame = requestAnimationFrame(animate)
        }
        animate()

        const handleResize = () => {
            canvas.width = window.innerWidth
            canvas.height = window.innerHeight
        }
        window.addEventListener('resize', handleResize)

        return () => {
            cancelAnimationFrame(animFrame)
            window.removeEventListener('resize', handleResize)
        }
    }, [])

    return (
        <div className='fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden'
            style={{ opacity: 0, animation: fading ? 'fadeOut 0.5s ease forwards' : 'fadeIn 0.5s ease forwards' }}>
            {/* Animated gradient background */}
            <div className='absolute inset-0' style={{
                background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.backgroundColor}, ${theme.secondaryColor})`,
                backgroundSize: '400% 400%',
                animation: 'gradientShift 6s ease infinite',
            }} />

            {/* Particles canvas */}
            <canvas ref={canvasRef} className='absolute inset-0' style={{ opacity: 0.5 }} />

            <div className='absolute bottom-0 left-0 w-full overflow-hidden' style={{ height: '120px' }}>
                <svg viewBox='0 0 1200 120' preserveAspectRatio='none' className='w-full h-full'>
                    <path d='M0,60 C300,120 900,0 1200,60 L1200,120 L0,120 Z' fill={theme.primaryColor} opacity='0.3' />
                    <path d='M0,80 C400,20 800,100 1200,40 L1200,120 L0,120 Z' fill={theme.primaryColor} opacity='0.2' />
                </svg>
            </div>

            {/* Content */}
            <div className='relative z-10 flex flex-col items-center gap-4'>
                {theme.minecraftLogo
                    ? <img src={logoMinecraft} alt='logo' className='h-20 w-20 object-contain' />
                    : <GiWheat size={56} color={theme.primaryColor} />
                }
                <span className='text-3xl font-bold tracking-wide' style={{ color: theme.textColor }}>
                    Agri<span style={{ color: theme.primaryColor }}>Care</span>
                </span>
                <AiOutlineLoading3Quarters size={28} className='animate-spin' color={theme.primaryColor} />
                <span className='text-xs opacity-60' style={{ color: theme.textColor }}>Loading, please wait...</span>
            </div>
        </div>
    )
}

export default PageLoader
