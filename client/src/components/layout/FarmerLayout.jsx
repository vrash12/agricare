import { useEffect, useState, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MdMenuBook, MdSupportAgent, MdDashboard, MdConfirmationNumber } from 'react-icons/md'
import Topbar from './Topbar'
import Sidebar from './Sidebar'
import api from '../../services/api'
import FarmerActions from '../tickets/FarmerActions'

const farmerNavLinks = [
    { label: 'Dashboard', path: '/dashboard', icon: MdDashboard },
    { label: 'AgriXa', path: '/farmer/knowledge-repository', icon: MdMenuBook, tone: 'knowledge' },
    { label: 'Ticketing System', path: '/farmer/tickets', icon: MdConfirmationNumber, tone: 'ticketing' },
    { label: 'Extension Workers', path: '/farmer/extension-workers', icon: MdSupportAgent },
]

const FarmerLayout = ({ children }) => {
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
        ? <Sidebar navLinks={farmerNavLinks} notificationCount={unreadCount}><FarmerActions />{children}</Sidebar>
        : <Topbar navLinks={farmerNavLinks} notificationCount={unreadCount}><FarmerActions />{children}</Topbar>
}

export default FarmerLayout
