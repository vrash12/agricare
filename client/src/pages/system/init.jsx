import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { setCredentials } from '../../store/slices/authSlice'
import { setCookie } from '../../utils/cookies'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import api from '../../services/api'

const Init = () => {
    const navigate = useNavigate()
    const theme = useSelector((state) => state.theme)
    const dispatch = useDispatch()

    const [form, setForm] = useState({ username: '', password: '' })
    const [showPassword, setShowPassword] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const handleChange = (e) => {
        const { name, value } = e.target
        setForm(prev => ({ ...prev, [name]: value }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setLoading(true)
        setError(null)
        try {
            const res = await api.post('/system/login/', { username: form.username, password: form.password })
            setCookie('token', res.data.access, 1)
            dispatch(setCredentials({ user: res.data.user, token: res.data.access }))
            navigate('/system/panel/overview')
        } catch (err) {
            setError(err.response?.data?.error || 'Invalid credentials.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='min-h-screen flex items-center justify-center' style={{ backgroundColor: '#1a1a2e' }}>
            <div className='w-full max-w-sm mx-4'>
                <div className='rounded-xl p-8 shadow-2xl' style={{ backgroundColor: '#16213e' }}>
                    <h1 className='text-2xl font-bold text-center mb-2' style={{ color: '#e94560' }}>System Access</h1>
                    <p className='text-center text-xs mb-6 opacity-50' style={{ color: '#fff' }}>Restricted Area</p>

                    {error && (
                        <div className='mb-4 p-3 rounded text-sm text-red-400' style={{ backgroundColor: '#e9456020' }}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
                        <div className='flex flex-col gap-1'>
                            <label className='text-xs font-medium opacity-70' style={{ color: '#fff' }}>Username</label>
                            <input name='username' value={form.username} onChange={handleChange} placeholder='Enter username' required
                                className='w-full px-4 py-2.5 text-sm outline-none rounded-lg'
                                style={{ backgroundColor: '#0f3460', color: '#fff', border: '1px solid #e9456040' }} />
                        </div>

                        <div className='flex flex-col gap-1'>
                            <label className='text-xs font-medium opacity-70' style={{ color: '#fff' }}>Password</label>
                            <div className='relative'>
                                <input name='password' type={showPassword ? 'text' : 'password'} value={form.password} onChange={handleChange} placeholder='Enter password' required
                                    className='w-full px-4 py-2.5 text-sm outline-none rounded-lg pr-10'
                                    style={{ backgroundColor: '#0f3460', color: '#fff', border: '1px solid #e9456040' }} />
                                <button type='button' onClick={() => setShowPassword(!showPassword)} className='absolute right-3 top-1/2 -translate-y-1/2 opacity-50 cursor-pointer'>
                                    {showPassword ? <FaEyeSlash size={16} color='#fff' /> : <FaEye size={16} color='#fff' />}
                                </button>
                            </div>
                        </div>

                        <button type='submit' disabled={loading}
                            className='w-full py-2.5 rounded-lg font-medium text-sm mt-2 cursor-pointer'
                            style={{ backgroundColor: '#e94560', color: '#fff', opacity: loading ? 0.7 : 1 }}>
                            {loading ? <AiOutlineLoading3Quarters className='animate-spin inline' size={16} /> : 'Access System'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}

export default Init
