import { useState, useEffect } from 'react'
import SystemLayout from './SystemLayout'
import api from '../../../services/api'

const Overview = () => {
    const [config, setConfig] = useState(null)

    useEffect(() => {
        api.get('/system/config/').then(res => setConfig(res.data))
    }, [])

    return (
        <SystemLayout title='Overview'>
            <div className='flex flex-col gap-4'>
                <div className='p-5 rounded-xl' style={{ backgroundColor: '#16213e' }}>
                    <p className='text-xs opacity-50 mb-2' style={{ color: '#fff' }}>System Status</p>
                    <p className='text-2xl font-bold' style={{ color: config?.isSystemEnabled ? '#22c55e' : '#e94560' }}>
                        {config?.isSystemEnabled ? '● Online' : '● Offline'}
                    </p>
                </div>
                <div className='p-5 rounded-xl' style={{ backgroundColor: '#16213e' }}>
                    <p className='text-xs opacity-50 mb-2' style={{ color: '#fff' }}>Disabled Endpoints</p>
                    <p className='text-2xl font-bold' style={{ color: '#fff' }}>
                        {config?.disabledEndpoints?.length ?? 0}
                    </p>
                </div>
            </div>
        </SystemLayout>
    )
}

export default Overview
