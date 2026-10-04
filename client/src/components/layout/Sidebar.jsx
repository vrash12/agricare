import { useState } from 'react'
import { useSelector } from 'react-redux'
import { getCookie, setPermCookie } from '../../utils/cookies'
import { useNavigate, useLocation } from 'react-router-dom'
import { GiWheat } from 'react-icons/gi'
import { MdChevronLeft, MdSettings } from 'react-icons/md'
import { IoNotificationsOutline } from 'react-icons/io5'
import logoMinecraft from '../../assets/logo-minecraft.png'
import Footer from './Footer'
import ProfilePanel from './ProfilePanel'

const Sidebar = ({ children, notificationCount = 0, navLinks = [] }) => {
    const theme = useSelector((state) => state.theme)
    const navigate = useNavigate()
    const location = useLocation()
    const [collapsed, setCollapsed] = useState(getCookie('sidebarCollapsed') === 'true')
    const [hovered, setHovered] = useState(false)
    const [profileOpen, setProfileOpen] = useState(false)

    const isOpen = !collapsed || hovered

    const toggleCollapse = () => {
        const next = !collapsed
        setCollapsed(next)
        if (next) setHovered(false)
        setPermCookie('sidebarCollapsed', String(next))
    }

    const allLinks = [...navLinks, { label: 'Notifications', path: '/notifications', icon: IoNotificationsOutline, badge: notificationCount }]

    const btnStyle = (isActive = false, extraOpacity = null) => ({
        display: 'flex',
        alignItems: 'center',
        padding: '0.7rem 0.8rem',
        borderRadius: '0.75rem',
        width: '100%',
        backgroundColor: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
        border: isActive ? '1px solid rgba(255,255,255,0.18)' : '1px solid transparent',
        color: '#fff',
        opacity: extraOpacity ?? (isActive ? 1 : 0.75),
        fontSize: '0.875rem',
        fontWeight: 500,
        cursor: 'pointer',
    })

    const labelStyle = {
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        maxWidth: isOpen ? '200px' : '0px',
        opacity: isOpen ? 1 : 0,
        transition: 'max-width 0.3s ease, opacity 0.2s ease',
        marginLeft: '0.75rem',
    }

    return (
        <>
            <div className='min-h-screen flex' style={{ backgroundColor: theme.backgroundColor }}>
                {/* Sidebar — desktop only */}
                <div
                    className='hidden md:flex flex-col h-screen sticky top-0 shadow-lg overflow-hidden'
                    style={{
                        backgroundColor: theme.primaryColor,
                        width: isOpen ? '256px' : '66px',
                        minWidth: isOpen ? '256px' : '66px',
                        transition: 'width 0.3s ease, min-width 0.3s ease',
                        flexShrink: 0,
                    }}
                    onMouseEnter={() => { if (collapsed) setHovered(true) }}
                    onMouseLeave={() => { if (collapsed) setHovered(false) }}
                    onClick={() => { if (collapsed) { setCollapsed(false); setPermCookie('sidebarCollapsed', 'false'); setHovered(false) } }}>

                    {/* Logo + Collapse Button */}
                    <div className='flex items-center px-3 py-2'>
                        <div className='flex items-center cursor-pointer flex-1 rounded-lg' style={btnStyle(false, 1)} onClick={() => navigate('/dashboard')}>
                            <span className='flex-shrink-0 w-5 flex justify-center'>
                                {theme.minecraftLogo
                                    ? <img src={logoMinecraft} alt='logo' className='h-6 w-6 object-contain' />
                                    : <GiWheat size={22} color='#fff' />
                                }
                            </span>
                            <span className='text-lg font-bold text-white tracking-wide' style={labelStyle}>
                                Agri<span style={{ color: theme.secondaryColor }}>Care</span>
                            </span>
                        </div>
                        {isOpen && (
                            <button onClick={toggleCollapse} className='text-white opacity-75 hover:opacity-100 cursor-pointer flex-shrink-0 mr-2'>
                                <MdChevronLeft size={24} />
                            </button>
                        )}
                    </div>

                    {/* Nav Links */}
                    <nav className='flex flex-col gap-1.5 px-3 py-5 flex-1' aria-label='Primary navigation'>
                        {navLinks.map(({ label, path, icon: Icon, tone }) => {
                            const isActive = location.pathname === path || location.pathname.startsWith(`${path}/`)
                            return (
                                <button key={path} onClick={() => navigate(path)}
                                    aria-current={isActive ? 'page' : undefined}
                                    className='app-nav-link rounded-xl'
                                    style={{ ...btnStyle(isActive), ...(isActive && tone === 'ticketing' ? { backgroundColor: '#2563eb', borderColor: '#60a5fa' } : {}) }}
                                    title={!isOpen ? label : ''}>
                                    <span className='flex-shrink-0 w-5 flex justify-center'><Icon size={18} /></span>
                                    <span style={labelStyle}>{label}</span>
                                </button>
                            )
                        })}
                    </nav>

                    {/* Bottom */}
                    <div className='px-3 py-4 flex flex-col gap-1.5' style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                        <button onClick={() => navigate('/notifications')}
                            className='rounded-lg'
                            style={btnStyle(location.pathname === '/notifications')}
                            title={!isOpen ? 'Notifications' : ''}>
                            <span className='flex-shrink-0 w-5 flex justify-center'>
                                <div className='relative'>
                                    <IoNotificationsOutline size={18} />
                                    {notificationCount > 0 && (
                                        <span className='absolute -top-1 -right-1 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full'
                                            style={{ backgroundColor: theme.dangerColor, fontSize: '10px' }}>
                                            {notificationCount > 99 ? '99+' : notificationCount}
                                        </span>
                                    )}
                                </div>
                            </span>
                            <span style={labelStyle}>Notifications</span>
                        </button>
                        <button onClick={() => setProfileOpen(true)}
                            className='rounded-lg'
                            style={btnStyle(false, 0.75)}
                            title={!isOpen ? 'Settings' : ''}>
                            <span className='flex-shrink-0 w-5 flex justify-center'><MdSettings size={18} /></span>
                            <span style={labelStyle}>Settings</span>
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className='flex-1 flex flex-col min-w-0'>
                    {/* Mobile Header */}
                    <div className='flex md:hidden items-center justify-between px-4 py-3 shadow-sm'
                        style={{ backgroundColor: theme.primaryColor }}>
                        <div className='flex items-center gap-2 cursor-pointer' onClick={() => navigate('/dashboard')}>
                            {theme.minecraftLogo
                                ? <img src={logoMinecraft} alt='logo' className='h-7 w-7 object-contain' />
                                : <GiWheat size={20} color='#fff' />
                            }
                            <span className='text-base font-bold text-white tracking-wide'>
                                Agri<span style={{ color: theme.secondaryColor }}>Care</span>
                            </span>
                        </div>
                        <div className='cursor-pointer' onClick={() => setProfileOpen(true)}>
                            <MdSettings size={22} color='#fff' />
                        </div>
                    </div>

                    <main className='flex-1 bg-white/30 p-4 pb-24 md:p-8 md:pb-8'>
                        <div key={location.key} className='page-transition'>
                            {children}
                        </div>
                    </main>
                    <div className='hidden md:block'><Footer /></div>
                </div>
            </div>

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

            <ProfilePanel isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
        </>
    )
}

export default Sidebar
