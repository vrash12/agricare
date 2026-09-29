import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import heroMinecraft from '../../assets/hero-minecraft.jpg'
import heroBackground from '../../assets/hero-background.jpg'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import supabase from '../../services/supabase'
import api from '../../services/api'

const ResetPassword = () => {
    const navigate = useNavigate()
    const theme = useSelector((state) => state.theme)
    const [accessToken, setAccessToken] = useState('')
    const [form, setForm] = useState({ password: '', confirmPassword: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loadingMessage, setLoadingMessage] = useState(null)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(false)

    useEffect(() => {
        let active = true
        const loadSession = async () => {
            try {
                const code = new URLSearchParams(window.location.search).get('code')
                const result = code ? await supabase.auth.exchangeCodeForSession(code) : await supabase.auth.getSession()
                if (!active) return
                if (result.error || !result.data?.session) setError('Invalid or expired reset link. Please request a new one.')
                else setAccessToken(result.data.session.access_token)
            } catch {
                if (active) setError('Invalid or expired reset link. Please request a new one.')
            }
        }
        loadSession()
        return () => { active = false }
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
        if (form.password.length < 8) return setError('Password must be at least 8 characters.')
        setLoadingMessage('Resetting password...')
        setError(null)
        try {
            await api.post('/auth/supabase/reset-password/', { accessToken, newPassword: form.password })
            try { await supabase.auth.signOut({ scope: 'local' }) } catch { /* Password was already updated. */ }
            setSuccess(true)
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Failed to reset password. Please try again.')
        } finally {
            setLoadingMessage(null)
        }
    }

    return (
        <div className='min-h-screen flex items-center justify-center relative'
            style={{ backgroundImage: `url(${theme.minecraftHero ? heroMinecraft : heroBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className='absolute inset-0' style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />

            <div className='relative z-10 w-full max-w-md mx-4'>
                <div className='flex flex-col items-center gap-2 mb-6 mt-8'>
                    <span className='text-5xl md:text-8xl font-bold text-white tracking-wide'>
                        Agri<span style={{ color: theme.secondaryColor }}>Care</span>
                    </span>
                </div>

                <div className='rounded-xl p-8 shadow-2xl' style={{ backgroundColor: theme.backgroundColor }}>
                    <span className='text-4xl font-semibold mb-4 block text-center' style={{ color: theme.textColor }}>Reset Password</span>

                    {error && (
                        <div className='mb-4 p-3 rounded text-sm text-red-600' style={{ backgroundColor: '#fee2e2' }}>
                            {error}
                        </div>
                    )}

                    {success ? (
                        <div className='flex flex-col items-center gap-4 text-center'>
                            <div className='w-16 h-16 rounded-full flex items-center justify-center text-3xl'
                                style={{ backgroundColor: '#dcfce7', border: '2px solid #16a34a' }}>
                                ✅
                            </div>
                            <p className='text-sm' style={{ color: theme.textColor }}>Password reset successfully!</p>
                            <Button onClick={() => navigate('/login')}>Back to Login</Button>
                        </div>
                    ) : accessToken ? (
                        <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                            <div className='flex flex-col gap-1'>
                                <label className='text-sm font-medium' style={{ color: theme.textColor }}>New Password</label>
                                <div className='relative'>
                                    <input type={showPassword ? 'text' : 'password'} value={form.password}
                                        onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                                        placeholder='Enter new password' required
                                        className='w-full px-4 py-2.5 text-sm outline-none border pr-10'
                                        style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                    <button type='button' onClick={() => setShowPassword(!showPassword)} className='absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer'>
                                        {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <div className='flex flex-col gap-1'>
                                <label className='text-sm font-medium' style={{ color: theme.textColor }}>Confirm Password</label>
                                <div className='relative'>
                                    <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                                        onChange={(e) => setForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                                        placeholder='Confirm new password' required
                                        className='w-full px-4 py-2.5 text-sm outline-none border pr-10'
                                        style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                    <button type='button' onClick={() => setShowConfirm(!showConfirm)} className='absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer'>
                                        {showConfirm ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                    </button>
                                </div>
                            </div>
                            <Button type='submit' disabled={!!loadingMessage}>Reset Password</Button>
                        </form>
                    ) : !error ? (
                        <div className='flex justify-center py-4'>
                            <AiOutlineLoading3Quarters className='animate-spin' size={28} color={theme.primaryColor} />
                        </div>
                    ) : null}
                </div>

                <Dialog isOpen={!!loadingMessage} title={loadingMessage}>
                    <div className='flex justify-center py-2'>
                        <AiOutlineLoading3Quarters size={28} className='animate-spin' color={theme.primaryColor} />
                    </div>
                </Dialog>

                <p className='text-center text-sm text-white opacity-60 mt-4 mb-8 cursor-pointer' onClick={() => navigate('/')}>
                    ← Back to Home
                </p>
            </div>
        </div>
    )
}

export default ResetPassword
