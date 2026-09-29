import { useState, useEffect } from 'react'
import { MdPower, MdPowerOff } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import SystemLayout from './SystemLayout'
import api from '../../../services/api'

const ENDPOINTS = [
    { key: 'auth/register', label: 'Registration' },
    { key: 'auth/login', label: 'Login' },
    { key: 'auth/forgot-password', label: 'Forgot Password' },
    { key: 'users/farmers', label: 'Farmers Management' },
    { key: 'users/extension-workers', label: 'Extension Workers Management' },
    { key: 'positions', label: 'Positions Management' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'tickets', label: 'Tickets' },
]

const Endpoints = () => {
    const [disabledEndpoints, setDisabledEndpoints] = useState([])
    const [loading, setLoading] = useState(null)

    useEffect(() => {
        api.get('/system/endpoints/').then(res => setDisabledEndpoints(res.data.disabledEndpoints || []))
    }, [])

    const handleToggle = async (key) => {
        const isDisabled = disabledEndpoints.includes(key)
        setLoading(key)
        try {
            await api.patch('/system/endpoints/', {
                endpoint: key,
                action: isDisabled ? 'enable' : 'disable'
            })
            setDisabledEndpoints(prev =>
                isDisabled ? prev.filter(e => e !== key) : [...prev, key]
            )
        } finally {
            setLoading(null)
        }
    }

    return (
        <SystemLayout title='Endpoints'>
            <div className='flex flex-col gap-3'>
                {ENDPOINTS.map(({ key, label }) => {
                    const isDisabled = disabledEndpoints.includes(key)
                    return (
                        <div key={key} className='flex items-center justify-between p-4 rounded-xl'
                            style={{ backgroundColor: '#16213e' }}>
                            <div>
                                <p className='text-sm font-medium' style={{ color: '#fff' }}>{label}</p>
                                <p className='text-xs opacity-50' style={{ color: isDisabled ? '#e94560' : '#22c55e' }}>
                                    {isDisabled ? 'Disabled' : 'Enabled'}
                                </p>
                            </div>
                            <button onClick={() => handleToggle(key)} disabled={loading === key}
                                className='p-2 rounded-lg cursor-pointer'
                                style={{ backgroundColor: isDisabled ? '#22c55e20' : '#e9456020' }}>
                                {loading === key
                                    ? <AiOutlineLoading3Quarters size={20} className='animate-spin' color='#fff' />
                                    : isDisabled
                                        ? <MdPower size={20} color='#22c55e' />
                                        : <MdPowerOff size={20} color='#e94560' />
                                }
                            </button>
                        </div>
                    )
                })}
            </div>
        </SystemLayout>
    )
}

export default Endpoints
