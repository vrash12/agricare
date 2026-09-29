import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { sha256 } from '../../utils/crypto'
import api from '../../services/api'
import supabase from '../../services/supabase'
import { FaEye, FaEyeSlash, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import heroMinecraft from '../../assets/hero-minecraft.jpg'
import heroBackground from '../../assets/hero-background.jpg'
import { setSessionCookie, getCookie, deleteCookie } from '../../utils/cookies'

const Register = () => {
    const [searchParams] = useSearchParams()
    const role = searchParams.get('role')
    const navigate = useNavigate()
    const theme = useSelector((state) => state.theme)

    const [step, setStep] = useState(1)
    const [form, setForm] = useState({ mobileNumber: '', email: '', password: '', confirmPassword: '' })
    const [personalForm, setPersonalForm] = useState({ firstName: '', lastName: '', barangay: '', username: '', positionId: '' })
    const [positions, setPositions] = useState([])
    const [otp, setOtp] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [showConfirm, setShowConfirm] = useState(false)
    const [loading, setLoading] = useState(false)
    const [countdown, setCountdown] = useState(3)
    const [error, setError] = useState(null)
    const [mobileStatus, setMobileStatus] = useState(null)
    const [usernameStatus, setUsernameStatus] = useState(null)
    const [emailStatus, setEmailStatus] = useState(null)
    const [dialog, setDialog] = useState({ open: false, type: null, messages: [] })
    const [loadingMessage, setLoadingMessage] = useState(null)

    const passwordReqs = {
        minLength: form.password.length >= 8,
        hasUpper: /[A-Z]/.test(form.password),
        hasNumber: /[0-9]/.test(form.password),
        hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(form.password),
    }
    const allReqsMet = Object.values(passwordReqs).every(Boolean)
    const roleLabel = role === 'farmer' ? 'Farmer' : 'Extension Worker'

    // Check pending registration on mount
    useEffect(() => {
        const pendingMobile = getCookie('pendingMobile')
        if (pendingMobile) {
            api.get(`/auth/check-pending/?mobile=${pendingMobile}`).then(res => {
                if (res.data.status === 'verified') {
                    setForm(prev => ({ ...prev, mobileNumber: pendingMobile }))
                    setStep(3)
                } else if (res.data.status === 'none') {
                    deleteCookie('pendingMobile')
                }
            }).catch(() => deleteCookie('pendingMobile'))
        }
    }, [])

    // Fetch positions for extension worker
    useEffect(() => {
        if (role === 'extension') {
            api.get('/positions/').then(res => setPositions(res.data.filter(p => p.isActive)))
        }
    }, [role])

    // Mobile debounce check
    useEffect(() => {
        if (!form.mobileNumber) return setMobileStatus(null)
        setMobileStatus('checking')
        const timer = setTimeout(async () => {
            const res = await api.get(`/auth/check-mobile/?mobile=${form.mobileNumber}`)
            setMobileStatus(res.data.available ? 'available' : 'taken')
        }, 500)
        return () => clearTimeout(timer)
    }, [form.mobileNumber])

    // Username debounce check
    useEffect(() => {
        if (!personalForm.username) return setUsernameStatus(null)
        setUsernameStatus('checking')
        const timer = setTimeout(async () => {
            const res = await api.get(`/auth/check-username/?username=${personalForm.username}`)
            setUsernameStatus(res.data.available ? 'available' : 'taken')
        }, 500)
        return () => clearTimeout(timer)
    }, [personalForm.username])

    // Email debounce check
    useEffect(() => {
        if (!form.email) return setEmailStatus(null)
        setEmailStatus('checking')
        const timer = setTimeout(async () => {
            const res = await api.get(`/auth/check-email/?email=${form.email}`)
            setEmailStatus(res.data.available ? 'available' : 'taken')
        }, 500)
        return () => clearTimeout(timer)
    }, [form.email])

    const handleChange = (e) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const handlePersonalChange = (e) => {
        const { name, value } = e.target
        setPersonalForm(prev => ({ ...prev, [name]: value }))
    }

    const useSupabaseAuth = theme?.useSupabaseAuth ?? false

    const handleStep1 = async (e) => {
        e.preventDefault()
        const missing = []
        if (!form.mobileNumber) missing.push('Mobile Number')
        if (!form.email) missing.push('Email')
        if (!form.password) missing.push('Password')
        if (!form.confirmPassword) missing.push('Confirm Password')
        if (mobileStatus === 'taken') missing.push('Mobile number is already registered')
        if (emailStatus === 'taken') missing.push('Email is already registered')
        if (!allReqsMet) missing.push('Password does not meet all requirements')
        if (form.password !== form.confirmPassword) missing.push('Passwords do not match')
        if (missing.length > 0) return setDialog({ open: true, type: 'error', messages: missing })

        setLoadingMessage('Sending OTP...')
        setLoading(true)
        setError(null)
        try {
            const hashedPassword = await sha256(form.password)
            if (useSupabaseAuth) {
                try {
                    await api.post('/auth/supabase/register/', {
                        mobileNumber: form.mobileNumber,
                        email: form.email,
                        password: form.password,
                        role: role === 'farmer' ? 'farmer' : 'extension_worker',
                    })
                } catch {
                    // Fallback to custom
                    await api.post('/auth/register/', {
                        mobileNumber: form.mobileNumber,
                        email: form.email,
                        password: hashedPassword,
                        role: role === 'farmer' ? 'farmer' : 'extension_worker',
                    })
                }
            } else {
                await api.post('/auth/register/', {
                    mobileNumber: form.mobileNumber,
                    email: form.email,
                    password: hashedPassword,
                    role: role === 'farmer' ? 'farmer' : 'extension_worker',
                })
            }
            setLoadingMessage(null)
            setSessionCookie('pendingMobile', form.mobileNumber)
            setCountdown(3)
            setDialog({ open: true, type: 'success', messages: [] })
            const interval = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        clearInterval(interval)
                        setDialog({ open: false, type: null, messages: [] })
                        setStep(2)
                        return 3
                    }
                    return prev - 1
                })
            }, 1000)
        } catch (err) {
            setLoadingMessage(null)
            setDialog({ open: true, type: 'error', messages: [err.response?.data?.error || 'Registration failed. Please try again.'] })
        } finally {
            setLoading(false)
        }
    }

    const handleStep2 = async (e) => {
        e.preventDefault()
        setLoadingMessage('Verifying OTP...')
        setLoading(true)
        setError(null)
        try {
            if (useSupabaseAuth) {
                try {
                    await api.post('/auth/supabase/verify-otp/', { email: form.email, otp, mobileNumber: form.mobileNumber, isRegistration: true })
                } catch {
                    await api.post('/auth/verify-otp/', { mobileNumber: form.mobileNumber, otp, isRegistration: true })
                }
            } else {
                await api.post('/auth/verify-otp/', { mobileNumber: form.mobileNumber, otp, isRegistration: true })
            }
            setLoadingMessage(null)
            setStep(3)
        } catch (err) {
            setLoadingMessage(null)
            setError(err.response?.data?.error || 'Invalid OTP. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleStep3 = async (e) => {
        e.preventDefault()
        const missing = []
        if (!personalForm.firstName) missing.push('First Name')
        if (!personalForm.lastName) missing.push('Last Name')
        if (!personalForm.username) missing.push('Username')
        if (role === 'farmer' && !personalForm.barangay) missing.push('Barangay')
        if (role === 'extension' && !personalForm.positionId) missing.push('Position')
        if (usernameStatus === 'taken') missing.push('Username is already taken')
        if (missing.length > 0) return setDialog({ open: true, type: 'error', messages: missing })

        setLoadingMessage('Creating your account...')
        setLoading(true)
        setError(null)
        try {
            await api.post('/auth/complete-registration/', {
                mobileNumber: form.mobileNumber,
                firstName: personalForm.firstName,
                lastName: personalForm.lastName,
                barangay: personalForm.barangay,
                username: personalForm.username,
                positionId: personalForm.positionId,
            })
            setLoadingMessage(null)
            deleteCookie('pendingMobile')
            setStep(4)
        } catch (err) {
            setLoadingMessage(null)
            setDialog({ open: true, type: 'error', messages: [err.response?.data?.error || 'Failed to complete registration.'] })
        } finally {
            setLoading(false)
        }
    }

    const stepTitles = ['Account Setup', 'OTP Verification', 'Personal Info', 'Done']

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
                <div className='rounded-xl shadow-2xl' style={{ backgroundColor: theme.backgroundColor }}>
                    <div className='p-8'>
                        <span className='text-4xl font-semibold mb-2 block text-center' style={{ color: theme.textColor }}>{roleLabel} Register</span>

                        {/* Step Indicator */}
                        <div className='flex items-center justify-center gap-2 mb-6'>
                            {[1, 2, 3, 4].map(s => (
                                <div key={s} className='flex items-center gap-2'>
                                    <div className='w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold'
                                        style={{ backgroundColor: step >= s ? theme.primaryColor : theme.secondaryColor + '40', color: step >= s ? '#fff' : theme.textColor }}>
                                        {s}
                                    </div>
                                    {s < 4 && <div className='w-6 h-0.5' style={{ backgroundColor: step > s ? theme.primaryColor : theme.secondaryColor + '40' }} />}
                                </div>
                            ))}
                        </div>

                        <p className='text-center text-sm font-medium mb-4 opacity-70' style={{ color: theme.textColor }}>{stepTitles[step - 1]}</p>

                        {error && (
                            <div className='mb-4 p-3 rounded text-sm text-red-600' style={{ backgroundColor: '#fee2e2' }}>
                                {error}
                            </div>
                        )}

                        {/* Step 1 - Account Setup */}
                        {step === 1 && (
                            <form onSubmit={handleStep1} className='flex flex-col gap-4'>
                                <div className='flex flex-col gap-1'>
                                    <label className='text-sm font-medium' style={{ color: theme.textColor }}>Mobile Number</label>
                                    <div className='relative'>
                                        <input name='mobileNumber' type='tel' value={form.mobileNumber}
                                            onChange={(e) => setForm(prev => ({ ...prev, mobileNumber: e.target.value.replace(/\D/g, '') }))}
                                            placeholder='Enter mobile number'
                                            className='w-full px-4 py-2.5 text-sm outline-none border pr-8'
                                            style={{ borderRadius: theme.borderRadius, borderColor: mobileStatus === 'taken' ? theme.dangerColor : mobileStatus === 'available' ? '#22c55e' : theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                        {mobileStatus === 'checking' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-50'>...</span>}
                                        {mobileStatus === 'available' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm'>✓</span>}
                                        {mobileStatus === 'taken' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-sm'>✗</span>}
                                    </div>
                                    {mobileStatus === 'taken' && <span className='text-xs' style={{ color: theme.dangerColor }}>Mobile number is already registered</span>}
                                </div>

                                <div className='flex flex-col gap-1'>
                                    <label className='text-sm font-medium' style={{ color: theme.textColor }}>Email</label>
                                    <div className='relative'>
                                        <input name='email' type='email' value={form.email} onChange={handleChange} placeholder='Enter email address'
                                            className='w-full px-4 py-2.5 text-sm outline-none border pr-8'
                                            style={{ borderRadius: theme.borderRadius, borderColor: emailStatus === 'taken' ? theme.dangerColor : emailStatus === 'available' ? '#22c55e' : theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                        {emailStatus === 'checking' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-50'>...</span>}
                                        {emailStatus === 'available' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm'>✓</span>}
                                        {emailStatus === 'taken' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-sm'>✗</span>}
                                    </div>
                                    {emailStatus === 'taken' && <span className='text-xs' style={{ color: theme.dangerColor }}>Email is already registered</span>}
                                </div>

                                <div className='flex flex-col gap-1'>
                                    <label className='text-sm font-medium' style={{ color: theme.textColor }}>Password</label>
                                    <div className='relative'>
                                        <input name='password' type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder='Enter password'
                                            className='w-full px-4 py-2.5 text-sm outline-none border pr-10'
                                            style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                        <button type='button' onClick={() => setShowPassword(!showPassword)} className='absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer'>
                                            {showPassword ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Requirements */}
                                <div className='flex flex-col gap-2 p-4 rounded-lg' style={{ backgroundColor: theme.primaryColor + '10' }}>
                                    <p className='text-xs font-semibold' style={{ color: theme.textColor }}>Password Requirements</p>
                                    {[
                                        { label: 'At least 8 characters', met: passwordReqs.minLength },
                                        { label: '1 uppercase letter', met: passwordReqs.hasUpper },
                                        { label: '1 number', met: passwordReqs.hasNumber },
                                        { label: '1 special character', met: passwordReqs.hasSpecial },
                                    ].map(({ label, met }) => (
                                        <div key={label} className='flex items-center gap-2'>
                                            <span className={`text-sm ${met ? 'text-green-500' : 'text-red-400'}`}>{met ? '✓' : '✗'}</span>
                                            <span className='text-xs' style={{ color: theme.textColor, opacity: met ? 1 : 0.6 }}>{label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className='flex flex-col gap-1'>
                                    <label className='text-sm font-medium' style={{ color: theme.textColor }}>Confirm Password</label>
                                    <div className='relative'>
                                        <input name='confirmPassword' type={showConfirm ? 'text' : 'password'} value={form.confirmPassword} onChange={handleChange} placeholder='Confirm password'
                                            className='w-full px-4 py-2.5 text-sm outline-none border pr-10'
                                            style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                        <button type='button' onClick={() => setShowConfirm(!showConfirm)} className='absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer'>
                                            {showConfirm ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
                                        </button>
                                    </div>
                                </div>

                                <Button type='submit' disabled={!!loadingMessage}>Next</Button>
                                <p className='text-center text-sm' style={{ color: theme.textColor }}>
                                    Already have an account?{' '}
                                    <Link to={`/login?role=${role}`} style={{ color: theme.primaryColor }} className='font-medium'>Login</Link>
                                </p>
                            </form>
                        )}

                        {/* Step 2 - OTP */}
                        {step === 2 && (
                            <form onSubmit={handleStep2} className='flex flex-col gap-4'>
                                <p className='text-sm text-center' style={{ color: theme.textColor, opacity: 0.7 }}>
                                    We sent an OTP to <strong>{form.email || form.mobileNumber}</strong>
                                </p>
                                <div className='flex flex-col gap-1'>
                                    <label className='text-sm font-medium' style={{ color: theme.textColor }}>Enter OTP</label>
                                    <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder='Enter OTP' maxLength={8}
                                        className='w-full px-4 py-2.5 text-sm outline-none border text-center tracking-widest'
                                        style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                </div>
                                <Button type='submit' disabled={!!loadingMessage}>Verify OTP</Button>
                                <p className='text-center text-sm cursor-pointer' style={{ color: theme.primaryColor }} onClick={() => setStep(1)}>← Back</p>
                            </form>
                        )}

                        {/* Step 3 - Personal Info */}
                        {step === 3 && (
                            <form onSubmit={handleStep3} className='flex flex-col gap-4'>
                                <div className='flex gap-3'>
                                    <div className='flex flex-col gap-1 flex-1'>
                                        <label className='text-sm font-medium' style={{ color: theme.textColor }}>First Name</label>
                                        <input name='firstName' value={personalForm.firstName} onChange={handlePersonalChange} placeholder='First name'
                                            className='w-full px-4 py-2.5 text-sm outline-none border'
                                            style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                    </div>
                                    <div className='flex flex-col gap-1 flex-1'>
                                        <label className='text-sm font-medium' style={{ color: theme.textColor }}>Last Name</label>
                                        <input name='lastName' value={personalForm.lastName} onChange={handlePersonalChange} placeholder='Last name'
                                            className='w-full px-4 py-2.5 text-sm outline-none border'
                                            style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                    </div>
                                </div>

                                <div className='flex flex-col gap-1'>
                                    <label className='text-sm font-medium' style={{ color: theme.textColor }}>Username</label>
                                    <div className='relative'>
                                        <input name='username' value={personalForm.username} onChange={handlePersonalChange} placeholder='Enter username'
                                            className='w-full px-4 py-2.5 text-sm outline-none border pr-8'
                                            style={{ borderRadius: theme.borderRadius, borderColor: usernameStatus === 'taken' ? theme.dangerColor : usernameStatus === 'available' ? '#22c55e' : theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                        {usernameStatus === 'checking' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs opacity-50'>...</span>}
                                        {usernameStatus === 'available' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm'>✓</span>}
                                        {usernameStatus === 'taken' && <span className='absolute right-3 top-1/2 -translate-y-1/2 text-red-500 text-sm'>✗</span>}
                                    </div>
                                    {usernameStatus === 'taken' && <span className='text-xs' style={{ color: theme.dangerColor }}>Username is already taken</span>}
                                </div>

                                {role === 'farmer' && (
                                    <div className='flex flex-col gap-1'>
                                        <label className='text-sm font-medium' style={{ color: theme.textColor }}>Barangay</label>
                                        <input name='barangay' value={personalForm.barangay} onChange={handlePersonalChange} placeholder='Enter barangay'
                                            className='w-full px-4 py-2.5 text-sm outline-none border'
                                            style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                    </div>
                                )}

                                {role === 'extension' && (
                                    <div className='flex flex-col gap-1'>
                                        <label className='text-sm font-medium' style={{ color: theme.textColor }}>Position</label>
                                        <select name='positionId' value={personalForm.positionId} onChange={handlePersonalChange}
                                            className='w-full px-4 py-2.5 text-sm outline-none border'
                                            style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }}>
                                            <option value=''>Select position...</option>
                                            {positions.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <Button type='submit' disabled={!!loadingMessage}>Complete Registration</Button>
                            </form>
                        )}

                        {/* Step 4 - Success */}
                        {step === 4 && (
                            <div className='flex flex-col items-center gap-4 text-center'>
                                {role === 'farmer' ? (
                                    <>
                                        <p className='text-sm' style={{ color: theme.textColor }}>Your account has been created successfully!</p>
                                        <Button onClick={() => navigate(`/login?role=farmer`)}>Go to Login</Button>
                                    </>
                                ) : (
                                    <>
                                        <p className='text-sm' style={{ color: theme.textColor }}>Your account is pending approval from the admin.</p>
                                        <Button onClick={() => navigate('/pending-approval')}>View Status</Button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Loading Dialog */}
                    <Dialog isOpen={!!loadingMessage} title={loadingMessage}>
                        <div className='flex justify-center py-2'>
                            <AiOutlineLoading3Quarters size={28} className='animate-spin' color={theme.primaryColor} />
                        </div>
                    </Dialog>

                    {/* Validation/Success Dialog */}
                    <Dialog
                        isOpen={dialog.open}
                        onClose={() => setDialog({ open: false, type: null, messages: [] })}
                        title={dialog.type === 'success' ? 'OTP Sent!' : 'Please fix the following'}
                        icon={dialog.type === 'success' ? FaCheckCircle : FaExclamationCircle}
                    >
                        {dialog.type === 'success' ? (
                            <div className='text-center'>
                                <p className='text-sm' style={{ color: theme.textColor }}>
                                    OTP has been sent to <strong>{form.email || form.mobileNumber}</strong>
                                </p>
                                <p className='text-xs opacity-60 mt-2' style={{ color: theme.textColor }}>
                                    Redirecting in {countdown} {countdown === 1 ? 'second' : 'seconds'}...
                                </p>
                            </div>
                        ) : (
                            <ul className='flex flex-col gap-2'>
                                {dialog.messages.map((msg, i) => (
                                    <li key={i} className='flex items-center gap-2 text-sm' style={{ color: theme.textColor }}>
                                        <span className='text-red-500'>•</span> {msg}
                                    </li>
                                ))}
                            </ul>
                        )}
                        {dialog.type === 'error' && (
                            <div className='flex justify-end mt-4'>
                                <Button onClick={() => setDialog({ open: false, type: null, messages: [] })}>OK</Button>
                            </div>
                        )}
                    </Dialog>
                </div>

                <p className='text-center text-sm text-white opacity-60 mt-4 mb-8 cursor-pointer' onClick={() => navigate('/')}>
                    ← Back to Home
                </p>
            </div>
        </div>
    )
}

export default Register
