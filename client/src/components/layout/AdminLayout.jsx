import { useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MdDashboard, MdPeople, MdSupportAgent, MdMenuBook, MdBarChart, MdConfirmationNumber } from 'react-icons/md'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import api from '../../services/api'

const adminNavLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: MdDashboard },
    { label: 'Farmers', path: '/admin/farmers', icon: MdPeople },
    { label: 'Personnel', path: '/admin/extension-workers', icon: MdSupportAgent },
    { label: 'Ticket Repository', path: '/admin/knowledge-repository', icon: MdConfirmationNumber },
    { label: 'Knowledge Base', path: '/admin/knowledge-base', icon: MdMenuBook },
    { label: 'Reports', path: '/admin/reports', icon: MdBarChart },
]

const AdminLayout = ({ children }) => {
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
        ? <Sidebar navLinks={adminNavLinks} notificationCount={unreadCount}>{children}</Sidebar>
        : <Topbar navLinks={adminNavLinks} notificationCount={unreadCount}>{children}</Topbar>
}

export default AdminLayout
