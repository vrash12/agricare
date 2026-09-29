import { useCallback, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { MdPeople, MdPersonOff, MdMenuBook, MdConfirmationNumber, MdPending, MdCheckCircle, MdArrowForward, MdAssignment } from 'react-icons/md'
import AdminLayout from '../../components/layout/AdminLayout'
import FarmerLayout from '../../components/layout/FarmerLayout'
import ExtensionWorkerLayout from '../../components/layout/ExtensionWorkerLayout'
import api from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const Avatar = ({ user }) => (
    <div className='h-16 w-16 shrink-0 overflow-hidden rounded-2xl flex items-center justify-center text-xl font-bold sm:h-24 sm:w-24 sm:text-3xl'
        style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#fff' }}>
        {user?.profilePicture
            ? <img src={user.profilePicture} className='w-full h-full object-cover' />
            : `${user?.firstName?.[0] ?? ''}${user?.lastName?.[0] ?? ''}`}
    </div>
)

const HeroBanner = ({ user, badge, actionLabel, actionIcon: ActionIcon, actionPath }) => {
    const theme = useSelector((state) => state.theme)
    const navigate = useNavigate()
    return (
        <div className='relative overflow-hidden rounded-2xl p-6 shadow-sm sm:p-8'
            style={{ background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})` }}>
            <div className='relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4'>
                <div className='flex items-center gap-4'>
                    <Avatar user={user} />
                    <div>
                        <p className='text-white/70 text-sm font-medium mb-1'>Welcome{user?.role === 'farmer' ? ',' : ' back,'}</p>
                        <h1 className='text-2xl sm:text-3xl font-bold text-white'>{user?.firstName} {user?.lastName}</h1>
                        {badge && (
                            <span className='inline-block mt-2 px-3 py-1 rounded-full text-xs font-semibold'
                                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                                {badge}
                            </span>
                        )}
                    </div>
                </div>
                <button onClick={() => navigate(actionPath)}
                    className='flex items-center gap-2 self-start rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:self-auto'
                    style={{ backgroundColor: '#fff', color: theme.primaryColor }}>
                    <ActionIcon size={18} />
                    {actionLabel}
                    <MdArrowForward size={16} />
                </button>
            </div>
            <div className='absolute -top-8 -right-8 w-40 h-40 rounded-full' style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <div className='absolute -bottom-10 -right-4 w-56 h-56 rounded-full' style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
        </div>
    )
}

const StatCards = ({ items }) => {
    const theme = useSelector((state) => state.theme)
    return (
        <div className={`grid gap-4 ${items.length === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-1 sm:grid-cols-3'}`}>
            {items.map(({ icon: Icon, label, value, color }) => (
                <div key={label} className='relative overflow-hidden rounded-xl p-5 shadow-sm'
                    style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}20` }}>
                    <div className='flex items-center justify-between'>
                        <div>
                            <p className='text-sm font-semibold opacity-50 mb-1' style={{ color: theme.textColor }}>{label}</p>
                            <p className='text-3xl font-bold' style={{ color: theme.textColor }}>{value ?? '...'}</p>
                        </div>
                        <div className='p-3 rounded-xl' style={{ backgroundColor: color + '15' }}>
                            <Icon size={26} color={color} />
                        </div>
                    </div>
                    <div className='absolute bottom-0 left-0 h-1 w-full rounded-b-xl' style={{ backgroundColor: color + '60' }} />
                </div>
            ))}
        </div>
    )
}

const TicketChart = ({ data, theme, title = 'Ticket Activity' }) => (
    <div className='p-6 rounded-xl shadow-sm' style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}20`, height: '260px' }}>
        <Bar
            data={{
                labels: ['Today', 'This Week', 'This Month'],
                datasets: [{
                    label: 'Tickets',
                    data,
                    backgroundColor: [theme.primaryColor + 'cc', theme.secondaryColor + 'cc', theme.primaryColor + '88'],
                    borderRadius: 8,
                }]
            }}
            options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: title, color: theme.textColor, font: { size: 14, weight: 'bold' } },
                },
                scales: {
                    y: { beginAtZero: true, ticks: { color: theme.textColor, precision: 0 }, grid: { color: theme.textColor + '10' } },
                    x: { ticks: { color: theme.textColor }, grid: { display: false } },
                },
            }}
        />
    </div>
)

const Dashboard = () => {
    const theme = useSelector((state) => state.theme)
    const { user } = useSelector((state) => state.auth)
    const [stats, setStats] = useState(null)
    const navigate = useNavigate()

    const role = user?.role
    const fetchStats = useCallback(() => {
        if (role === 'admin') api.get('/dashboard/stats/').then(res => setStats(res.data))
        else if (role === 'farmer') api.get('/dashboard/farmer-stats/').then(res => setStats(res.data))
        else if (role === 'extension_worker') api.get('/dashboard/worker-stats/').then(res => setStats(res.data))
    }, [role])

    useEffect(() => {
        fetchStats()
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/admin-updates/`)
        ws.onmessage = () => fetchStats()
        ws.onerror = () => ws.close()
        return () => ws.close()
    }, [fetchStats])

    const adminContent = (
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
            <HeroBanner user={user} badge='Administrator' actionLabel='Manage Knowledge' actionIcon={MdMenuBook} actionPath='/admin/knowledge-base' />
            <StatCards items={[
                { icon: MdPeople, label: 'Active Workers', value: stats?.workers?.active, color: '#22c55e' },
                { icon: MdPersonOff, label: 'Inactive Workers', value: stats?.workers?.inactive, color: '#ef4444' },
                { icon: MdMenuBook, label: 'AgriXa Visits', value: stats?.knowledgeRepositoryVisits, color: theme.primaryColor },
                { icon: MdConfirmationNumber, label: 'Tickets Today', value: stats?.tickets?.today, color: theme.secondaryColor },
            ]} />
            <TicketChart theme={theme} title='Ticket Overview'
                data={stats ? [stats.tickets?.today ?? 0, stats.tickets?.weekly ?? 0, stats.tickets?.monthly ?? 0] : [0, 0, 0]} />
        </div>
    )

    const extensionWorkerContent = (
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
            <HeroBanner user={user} badge={user?.positionName} actionLabel='View Tickets' actionIcon={MdAssignment} actionPath='/extension-worker/tickets' />
            <StatCards items={[
                { icon: MdConfirmationNumber, label: 'Total Tickets', value: stats?.total, color: theme.primaryColor },
                { icon: MdPending, label: 'Pending', value: stats?.pending, color: '#f59e0b' },
                { icon: MdCheckCircle, label: 'Resolved', value: stats?.resolved, color: '#22c55e' },
            ]} />
            <TicketChart theme={theme} data={stats ? [stats.today, stats.weekly, stats.monthly] : [0, 0, 0]} />
        </div>
    )

    const farmerContent = (
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
            <HeroBanner user={user} badge='Farmer' actionLabel='Ask AgriXa' actionIcon={MdMenuBook} actionPath='/farmer/knowledge-repository' />
            <div className='flex flex-col items-start justify-between gap-3 rounded-xl border bg-white p-5 shadow-sm sm:flex-row sm:items-center' style={{ borderColor: `${theme.secondaryColor}55` }}><div><p className='font-semibold' style={{ color: theme.textColor }}>Start with an answer</p><p className='mt-1 text-sm opacity-60' style={{ color: theme.textColor }}>Ask AgriXa about common farming concerns. Use Submit Ticket for additional help. Choose a category and AgriCare will assign the appropriate LGU personnel.</p></div><button onClick={() => navigate('/farmer/knowledge-repository')} className='flex shrink-0 items-center gap-1 text-sm font-semibold' style={{ color: theme.primaryColor }}>Explore answers <MdArrowForward size={17} /></button></div>
            <StatCards items={[
                { icon: MdConfirmationNumber, label: 'Total Tickets', value: stats?.total, color: theme.primaryColor },
                { icon: MdPending, label: 'Pending', value: stats?.pending, color: '#f59e0b' },
                { icon: MdCheckCircle, label: 'Resolved', value: stats?.resolved, color: '#22c55e' },
            ]} />
            <TicketChart theme={theme} data={stats ? [stats.today, stats.weekly, stats.monthly] : [0, 0, 0]} />
        </div>
    )

    if (user?.role === 'admin') return <AdminLayout>{adminContent}</AdminLayout>
    if (user?.role === 'farmer') return <FarmerLayout>{farmerContent}</FarmerLayout>
    if (user?.role === 'extension_worker') return <ExtensionWorkerLayout>{extensionWorkerContent}</ExtensionWorkerLayout>
    return null
}

export default Dashboard
