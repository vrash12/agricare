import { useState, useEffect } from 'react'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { MdPower, MdPowerOff, MdPalette, MdSecurity } from 'react-icons/md'
import SystemLayout from './SystemLayout'
import api from '../../../services/api'

const SystemControl = () => {
    const [config, setConfig] = useState(null)
    const [theme, setTheme] = useState(null)
    const [loading, setLoading] = useState(null)

    useEffect(() => {
        api.get('/system/config/').then(res => setConfig(res.data))
        api.get('/theme/').then(res => setTheme(res.data))
    }, [])

    const handleToggleSystem = async () => {
        setLoading('system')
        try {
            await api.patch('/system/config/', { isSystemEnabled: !config.isSystemEnabled })
            setConfig(prev => ({ ...prev, isSystemEnabled: !prev.isSystemEnabled }))
        } finally {
            setLoading(null)
        }
    }

    const handleToggleSupabaseAuth = async () => {
        setLoading('supabase')
        try {
            await api.patch('/system/config/', { useSupabaseAuth: !config.useSupabaseAuth })
            setConfig(prev => ({ ...prev, useSupabaseAuth: !prev.useSupabaseAuth }))
        } finally {
            setLoading(null)
        }
    }

    const handleThemeChange = async (key, value) => {
        const updated = { ...theme, [key]: value }
        setTheme(updated)
        await api.patch('/theme/', { [key]: value })
    }

    return (
        <SystemLayout title='System Control'>
            <div className='flex flex-col gap-4'>

                {/* Supabase Auth Toggle */}
                <div className='p-5 rounded-xl' style={{ backgroundColor: '#16213e' }}>
                    <div className='flex items-center gap-2 mb-3'>
                        <MdSecurity size={18} color='#e94560' />
                        <p className='text-sm font-semibold' style={{ color: '#fff' }}>Auth Provider</p>
                    </div>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-xs font-medium' style={{ color: config?.useSupabaseAuth ? '#22c55e' : '#f59e0b' }}>
                                {config?.useSupabaseAuth ? '● Supabase Auth (Primary)' : '● Custom Auth (Fallback)'}
                            </p>
                            <p className='text-xs opacity-40 mt-1' style={{ color: '#fff' }}>
                                {config?.useSupabaseAuth ? 'Using Supabase for authentication' : 'Using custom JWT + Gmail OTP'}
                            </p>
                        </div>
                        <button onClick={handleToggleSupabaseAuth} disabled={loading === 'supabase'}
                            className='w-10 h-5 rounded-full transition-all cursor-pointer'
                            style={{ backgroundColor: config?.useSupabaseAuth ? '#22c55e' : '#ffffff30' }}>
                            {loading === 'supabase'
                                ? <AiOutlineLoading3Quarters size={14} className='animate-spin mx-auto' color='#fff' />
                                : <div className='w-4 h-4 rounded-full bg-white transition-all mx-auto'
                                    style={{ transform: config?.useSupabaseAuth ? 'translateX(10px)' : 'translateX(-10px)' }} />
                            }
                        </button>
                    </div>
                </div>

                {/* System Toggle */}
                <div className='p-5 rounded-xl' style={{ backgroundColor: '#16213e' }}>
                    <p className='text-sm font-semibold mb-3' style={{ color: '#fff' }}>System Status</p>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-xs opacity-50' style={{ color: config?.isSystemEnabled ? '#22c55e' : '#e94560' }}>
                                {config?.isSystemEnabled ? '● System is Online' : '● System is Offline'}
                            </p>
                            <p className='text-xs opacity-40 mt-1' style={{ color: '#fff' }}>
                                {config?.isSystemEnabled ? 'Click to disable the system' : 'Click to enable the system'}
                            </p>
                        </div>
                        <button onClick={handleToggleSystem} disabled={loading === 'system'}
                            className='p-3 rounded-lg cursor-pointer'
                            style={{ backgroundColor: config?.isSystemEnabled ? '#e9456020' : '#22c55e20' }}>
                            {loading === 'system'
                                ? <AiOutlineLoading3Quarters size={22} className='animate-spin' color='#fff' />
                                : config?.isSystemEnabled
                                    ? <MdPowerOff size={22} color='#e94560' />
                                    : <MdPower size={22} color='#22c55e' />
                            }
                        </button>
                    </div>
                </div>

                {/* Theme Configurator */}
                {theme && (
                    <div className='p-5 rounded-xl' style={{ backgroundColor: '#16213e' }}>
                        <div className='flex items-center gap-2 mb-4'>
                            <MdPalette size={18} color='#e94560' />
                            <p className='text-sm font-semibold' style={{ color: '#fff' }}>Theme</p>
                        </div>

                        {/* Colors */}
                        {[
                            { key: 'primaryColor', label: 'Primary Color' },
                            { key: 'secondaryColor', label: 'Secondary Color' },
                            { key: 'dangerColor', label: 'Danger Color' },
                            { key: 'backgroundColor', label: 'Background Color' },
                            { key: 'textColor', label: 'Text Color' },
                        ].map(({ key, label }) => (
                            <div key={key} className='flex items-center justify-between mb-3'>
                                <p className='text-xs opacity-70' style={{ color: '#fff' }}>{label}</p>
                                <input type='color' value={theme[key]} onChange={e => handleThemeChange(key, e.target.value)}
                                    className='w-10 h-8 rounded cursor-pointer border-0 bg-transparent' />
                            </div>
                        ))}

                        {/* Border Radius */}
                        <div className='flex items-center justify-between mb-3'>
                            <p className='text-xs opacity-70' style={{ color: '#fff' }}>Border Radius</p>
                            <input type='text' value={theme.borderRadius} onChange={e => handleThemeChange('borderRadius', e.target.value)}
                                className='w-20 px-2 py-1 text-xs rounded outline-none text-center'
                                style={{ backgroundColor: '#0f3460', color: '#fff', border: '1px solid #e9456040' }} />
                        </div>

                        {/* Toggles */}
                        {[
                            { key: 'minecraftMode', label: 'Minecraft Font' },
                            { key: 'minecraftLogo', label: 'Minecraft Logo' },
                            { key: 'minecraftHero', label: 'Minecraft Hero' },
                            { key: 'minecraftSteve', label: 'Running Steve' },
                            { key: 'minecraftMusic', label: 'Minecraft Music' },
                        ].map(({ key, label }) => (
                            <div key={key} className='flex items-center justify-between mb-3'>
                                <p className='text-xs opacity-70' style={{ color: '#fff' }}>{label}</p>
                                <button onClick={() => handleThemeChange(key, !theme[key])}
                                    className='w-10 h-5 rounded-full transition-all cursor-pointer'
                                    style={{ backgroundColor: theme[key] ? '#22c55e' : '#ffffff30' }}>
                                    <div className='w-4 h-4 rounded-full bg-white transition-all mx-auto'
                                        style={{ transform: theme[key] ? 'translateX(10px)' : 'translateX(-10px)' }} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </SystemLayout>
    )
}

export default SystemControl
