import { useSelector } from 'react-redux'
import { useNavigate, useLocation } from 'react-router-dom'
import { IoNotificationsOutline } from 'react-icons/io5'
import Header from './Header'
import Footer from './Footer'

const Topbar = ({ children, notificationCount = 0, navLinks = [] }) => {
    const theme = useSelector((state) => state.theme)
    const navigate = useNavigate()
    const location = useLocation()

    const allLinks = [...navLinks, { label: 'Notifications', path: '/notifications', icon: IoNotificationsOutline, badge: notificationCount }]

    return (
        <div className='min-h-screen flex flex-col' style={{ backgroundColor: theme.backgroundColor }}>
            {/* Header */}
            <Header notificationCount={notificationCount} />

            {/* Nav Links — desktop only */}
            <nav className='hidden items-center justify-end gap-1.5 px-6 py-2.5 shadow-sm md:flex' style={{ backgroundColor: theme.primaryColor, borderTop: `1px solid rgba(255,255,255,0.1)` }} aria-label='Primary navigation'>
                {navLinks.map(({ label, path, icon: Icon, tone }) => {
                    const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`)
                    return (
                        <button key={path} onClick={() => navigate(path)}
                            aria-current={isActive ? 'page' : undefined}
                            className='app-nav-link flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold hover:bg-white/10'
                            style={{
                                backgroundColor: isActive && tone === 'ticketing' ? '#2563eb' : isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                                borderColor: isActive ? (tone === 'ticketing' ? '#60a5fa' : 'rgba(255,255,255,0.22)') : 'transparent',
                                color: '#fff',
                                opacity: isActive ? 1 : 0.75,
                            }}>
                            <Icon size={16} />
                            {label}
                        </button>
                    )
                })}
            </nav>

            {/* Page Content */}
            <main className='flex-1 bg-white/30 p-4 pb-24 md:p-8 md:pb-8'>
                <div key={location.key} className='page-transition'>
                    {children}
                </div>
            </main>

            {/* Footer — desktop only */}
            <div className='hidden md:block'><Footer /></div>

            {/* Mobile Bottom Nav */}
            <div className='fixed bottom-0 left-0 right-0 z-[60] flex items-center gap-1 overflow-x-auto px-2 py-2 shadow-lg md:hidden'
                style={{ backgroundColor: theme.primaryColor, borderTop: '1px solid rgba(255,255,255,0.15)' }}>
                {allLinks.map(({ label, path, icon: Icon, badge, tone }) => {
                    const isActive = location.pathname === path
                    const shortLabel = ({ Notifications: 'Notifs', 'Extension Workers': 'Workers', 'Knowledge Base': 'Knowledge', 'Ticket Repository': 'Tickets' })[label] || label
                    return (
                        <button key={path} onClick={() => navigate(path)} aria-label={label} aria-current={isActive ? 'page' : undefined}
                            className='app-nav-link flex min-w-[62px] flex-1 flex-col items-center gap-0.5 rounded-xl px-2 py-1 transition-all'
                            style={{ color: '#fff', opacity: isActive ? 1 : 0.6, backgroundColor: isActive && tone === 'ticketing' ? '#2563eb' : isActive ? 'rgba(255,255,255,0.16)' : 'transparent' }}>
                            <div className='relative'>
                                <Icon size={20} />
                                {badge > 0 && (
                                    <span className='absolute -top-1 -right-1 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full'
                                        style={{ backgroundColor: theme.dangerColor, fontSize: '9px' }}>
                                        {badge > 99 ? '99+' : badge}
                                    </span>
                                )}
                            </div>
                            <span className='text-xs'>{shortLabel}</span>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

export default Topbar
