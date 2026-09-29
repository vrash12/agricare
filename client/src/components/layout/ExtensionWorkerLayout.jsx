import { useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MdConfirmationNumber, MdDashboard, MdMenuBook } from 'react-icons/md'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import api from '../../services/api'

const extensionWorkerNavLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: MdDashboard },
    { label: 'Tickets', path: '/extension-worker/tickets', icon: MdConfirmationNumber },
    { label: 'Knowledge Base', path: '/extension-worker/knowledge-base', icon: MdMenuBook },
]

const ExtensionWorkerLayout = ({ children }) => {
    const layout = useSelector((state) => state.layout.layout)
    const { user } = useSelector((state) => state.auth)
    const [unreadCount, setUnreadCount] = useState(0)
    const wsRef = useRef(null)

    useEffect(() => {
        api.get('/users/notifications/').then(res => {
            setUnreadCount(res.data.filter(n => !n.isRead).length)
        }).catch(() => {})
    }, [])

    useEffect(() => {
        if (!user?.id) return
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/notifications/${user.id}/`)
        ws.onmessage = () => setUnreadCount(prev => prev + 1)
        ws.onerror = () => ws.close()
        wsRef.current = ws
        return () => ws.close()
    }, [user?.id])

    return layout === 'sidebar'
        ? <Sidebar navLinks={extensionWorkerNavLinks} notificationCount={unreadCount}>{children}</Sidebar>
        : <Topbar navLinks={extensionWorkerNavLinks} notificationCount={unreadCount}>{children}</Topbar>
}

export default ExtensionWorkerLayout
