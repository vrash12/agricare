import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { MdDashboard, MdPower, MdSettings, MdLogout, MdViewQuilt } from 'react-icons/md'
import { clearCredentials } from '../../../store/slices/authSlice'
import { deleteCookie } from '../../../utils/cookies'

const SystemLayout = ({ children, title }) => {
    const navigate = useNavigate()
    const location = useLocation()
    const dispatch = useDispatch()
    const { user } = useSelector((state) => state.auth)

    const handleLogout = () => {
        dispatch(clearCredentials())
        deleteCookie('token')
        navigate('/system/init')
    }

    const navItems = [
        { label: 'Overview', path: '/system/panel/overview', icon: MdDashboard },
        { label: 'Endpoints', path: '/system/panel/endpoints', icon: MdPower },
        { label: 'Control', path: '/system/panel/control', icon: MdSettings },
        { label: 'Templates', path: '/system/panel/templates', icon: MdViewQuilt },
    ]

    return (
        <div className='min-h-screen flex flex-col' style={{ backgroundColor: '#1a1a2e' }}>
            {/* Header */}
            <div className='px-4 py-4 flex items-center justify-between' style={{ backgroundColor: '#16213e' }}>
                <h1 className='text-base font-bold' style={{ color: '#e94560' }}>⚙ System Panel</h1>
                <div className='flex items-center gap-3'>
                    <span className='text-xs opacity-50' style={{ color: '#fff' }}>{user?.username}</span>
                    <button onClick={handleLogout} className='cursor-pointer opacity-70' style={{ color: '#e94560' }}>
                        <MdLogout size={18} />
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className='flex-1 p-4 pb-20'>
                <h2 className='text-lg font-bold mb-4' style={{ color: '#fff' }}>{title}</h2>
                {children}
            </div>

            {/* Bottom Navigation */}
            <div className='fixed bottom-0 left-0 right-0 flex justify-around py-3' style={{ backgroundColor: '#16213e' }}>
                {navItems.map(({ label, path, icon: Icon }) => (
                    <button key={path} onClick={() => navigate(path)}
                        className='flex flex-col items-center gap-1 cursor-pointer'
                        style={{ color: location.pathname === path ? '#e94560' : '#ffffff70' }}>
                        <Icon size={22} />
                        <span className='text-xs'>{label}</span>
                    </button>
                ))}
            </div>
        </div>
    )
}

export default SystemLayout
