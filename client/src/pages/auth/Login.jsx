import { useState } from 'react'
import { useNavigate, useSearchParams, useLocation, Navigate, Link } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { sha256 } from '../../utils/crypto'
import { setCredentials } from '../../store/slices/authSlice'
import { setCookie, REMEMBER_ME_DAYS, setSessionCookie } from '../../utils/cookies'
import api from '../../services/api'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import heroMinecraft from '../../assets/hero-minecraft.jpg'
import heroBackground from '../../assets/hero-background.jpg'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { setAppLoading } from '../../store/slices/appSlice'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'

const Login = () => {
    const [searchParams] = useSearchParams()
    const location = useLocation()
    const isAdminLogin = location.pathname === '/admin-login'


    const role = isAdminLogin ? 'admin' : searchParams.get('role')
    const navigate = useNavigate()
    const theme = useSelector((state) => state.theme)
    const isAuthenticated = useSelector((state) => state.auth.isAuthenticated)
    const dispatch = useDispatch()
    const [loadingMessage, setLoadingMessage] = useState(null)
    const [form, setForm] = useState({ identifier: '', password: '', rememberMe: false })
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState(null)
    const useSupabaseAuth = theme?.useSupabaseAuth ?? false

    if (isAuthenticated) return <Navigate to='/dashboard' replace />
    if (searchParams.get('role') === 'admin') return <Navigate to='/admin-login' replace />


    const handleChange = (e) => {
        const { name, value, type, checked } = e.target
        setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoadingMessage('Logging in...')
        setError(null)
        try {
            let accessToken, userData

            if (useSupabaseAuth && !isAdminLogin) {
                // Supabase primary auth
                try {
                    const res = await api.post('/auth/supabase/login/', {
                        email: form.identifier,
                        password: form.password,
                        rememberMe: form.rememberMe,
                    })
                    accessToken = res.data.access
                    userData = res.data.user
                } catch {
                    // Fallback to custom auth
                    const hashedPassword = await sha256(form.password)
                    const res = await api.post('/auth/login/', { identifier: form.identifier, password: hashedPassword, rememberMe: form.rememberMe })
                    accessToken = res.data.access
                    userData = res.data.user
                }
            } else {
                // Custom auth
                const hashedPassword = await sha256(form.password)
                const res = await api.post('/auth/login/', { identifier: form.identifier, password: hashedPassword, rememberMe: form.rememberMe })
                accessToken = res.data.access
                userData = res.data.user
            }

            const userRole = userData.role
            if (role === 'farmer' && userRole !== 'farmer') { setError('Please login as a Farmer.'); return }
            if (role === 'extension' && userRole !== 'extension_worker') { setError('Please login as an Extension Worker.'); return }
            if (role === 'admin' && userRole !== 'admin') { setError('Please login as an Admin.'); return }

            setCookie('token', accessToken, form.rememberMe ? REMEMBER_ME_DAYS : 1)
            dispatch(setCredentials({ user: userData, token: accessToken }))
            dispatch(setAppLoading(true))
            navigate('/dashboard')
        } catch (err) {
            setLoadingMessage(null)
            const data = err.response?.data
            if (data?.isPending) {
                if (role === 'farmer') setError('Please login as an Extension Worker.')
                else navigate('/pending-approval')
            } else if (data?.isIncomplete) {
                setSessionCookie('pendingMobile', data.mobileNumber)
                navigate(`/register?role=${role}`)
            } else {
                setError(data?.error || 'Invalid credentials. Please try again.')
            }
        } finally {
            setLoadingMessage(null)
        }
    }


    const roleLabel = role === 'farmer' ? 'Farmer' : role === 'extension' ? 'Extension Worker' : 'Admin'

    return (
        <div className='min-h-screen flex items-center justify-center relative'
            style={{ backgroundImage: `url(${theme.minecraftHero ? heroMinecraft : heroBackground})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className='absolute inset-0' style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />

            <div className='relative z-10 w-full max-w-md mx-4'>
                {/* Logo */}
                <div className='flex flex-col items-center gap-2 mb-6 mt-8'>
                    <span className='text-5xl md:text-8xl font-bold text-white tracking-wide'>
                        Agri<span style={{ color: theme.secondaryColor }}>Care</span>
                    </span>
                </div>

                {/* Card */}
                <div className='rounded-xl p-8 shadow-2xl' style={{ backgroundColor: theme.backgroundColor }}>
                    <span className='text-5xl font-semibold mb-4 block text-center' style={{ color: theme.textColor }}>{roleLabel} Login</span>
                    {error && (
                        <div className='mb-4 p-3 rounded text-sm text-red-600' style={{ backgroundColor: '#fee2e2' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                        <div className='flex flex-col gap-1'>
                            <label className='text-sm font-medium' style={{ color: theme.textColor }}>
                                {role === 'admin' ? 'Username' : useSupabaseAuth ? 'Email' : 'Username, Mobile Number, or Email'}
                            </label>
                            <input
                                name='identifier'
                                value={form.identifier}
                                onChange={handleChange}
                                placeholder={role === 'admin' ? 'Enter username' : useSupabaseAuth ? 'Enter email' : 'Enter username, mobile number, or email'}
                                required
                                className='w-full px-4 py-2.5 text-sm outline-none border'
                                style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }}
                            />
                        </div>

                        <div className='flex flex-col gap-1'>
                            <label className='text-sm font-medium' style={{ color: theme.textColor }}>Password</label>
                            <div className='relative'>
                                <input
                                    name='password'
                                    type={showPassword ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={handleChange}
                                    placeholder='Enter password'
                                    required
                                    className='w-full px-4 py-2.5 text-sm outline-none border pr-10'
                                    style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }}
                                />
                                <button type='button' onClick={() => setShowPassword(!showPassword)}
                                    className='absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer'>
                                    {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className='flex items-center justify-between'>
                            <label className='flex items-center gap-2 text-sm cursor-pointer' style={{ color: theme.textColor }}>
                                <input type='checkbox' name='rememberMe' checked={form.rememberMe} onChange={handleChange} />
                                Remember Me (7 days)
                            </label>
                            <Link to={`/forgot-password?role=${role || 'farmer'}`} className='text-sm' style={{ color: theme.primaryColor }}>Forgot Password?</Link>
                        </div>

                        <Button type='submit' disabled={!!loadingMessage} className='w-full mt-2'>Login</Button>

                        {role !== 'admin' && (
                            <p className='text-center text-sm' style={{ color: theme.textColor }}>
                                Don't have an account?{' '}
                                <Link to={`/register?role=${role}`} style={{ color: theme.primaryColor }} className='font-medium'>Register</Link>
                            </p>
                        )}
                    </form>
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

export default Login
