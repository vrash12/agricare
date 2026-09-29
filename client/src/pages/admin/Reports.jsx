import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { Bar } from 'react-chartjs-2'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js'
import { MdSupportAgent, MdCheckCircle, MdCancel, MdDeleteForever } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import AdminLayout from '../../components/layout/AdminLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import api from '../../services/api'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

const exportCSV = (columns, rows, filename) => {
    const escape = (val) => `"${String(val).replace(/"/g, '""')}"`
    const csv = [columns, ...rows].map(row => row.map(escape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
}

const Reports = () => {
    const theme = useSelector((state) => state.theme)
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [dialog, setDialog] = useState(null)
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
    const [yearLoading, setYearLoading] = useState(false)
    const [farmerYear, setFarmerYear] = useState(new Date().getFullYear())
    const [farmerLoading, setFarmerLoading] = useState(false)
    const [visitsMode, setVisitsMode] = useState('weekly')
    const [visitsYear, setVisitsYear] = useState(new Date().getFullYear())
    const [visitsWeekOffset, setVisitsWeekOffset] = useState(0)
    const [visitsWeekLabel, setVisitsWeekLabel] = useState('')
    const [visitsLoading, setVisitsLoading] = useState(false)
    const [workerMode, setWorkerMode] = useState('weekly')
    const [workerYear, setWorkerYear] = useState(new Date().getFullYear())
    const [weekOffset, setWeekOffset] = useState(0)
    const [workerWeekLabel, setWorkerWeekLabel] = useState('')
    const [workerLoading, setWorkerLoading] = useState(false)
    const [onlineWorkers, setOnlineWorkers] = useState(null)
    const [onlineLoading, setOnlineLoading] = useState(false)

    const fetchStats = () => {
        api.get('/dashboard/reports/').then(res => {
            setStats(res.data)
            setLoading(false)
        }).catch(() => setLoading(false))
    }

    useEffect(() => {
        fetchStats()
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/admin-updates/`)
        ws.onmessage = () => fetchStats()
        ws.onerror = () => ws.close()
        return () => ws.close()
    }, [])

    const chartOptions = (title) => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: { display: true, text: title, color: theme.textColor, font: { size: 13 } },
        },
        scales: {
            y: { beginAtZero: true, ticks: { color: theme.textColor, stepSize: 1 } },
            x: { ticks: { color: theme.textColor } },
        },
    })

    const openMonthlyDialog = (title, labels, data, colLabel, type = 'simple', availableYears = []) => setDialog({
        type,
        title,
        columns: ['Month', colLabel],
        rows: (labels ?? []).map((label, i) => [label, data?.[i] ?? 0]).reverse(),
        availableYears,
    })

    const handleFarmerYearChange = async (year) => {
        setFarmerYear(year)
        setFarmerLoading(true)
        try {
            const res = await api.get(`/dashboard/reports/farmers-by-month/?year=${year}`)
            setDialog(prev => ({
                ...prev,
                rows: res.data.labels.map((label, i) => [label, res.data.data[i]]).reverse(),
            }))
        } finally {
            setFarmerLoading(false)
        }
    }

    const fetchVisitsLog = async (mode, year, offset) => {
        setVisitsLoading(true)
        try {
            const params = mode === 'monthly'
                ? `mode=monthly&year=${year}`
                : `mode=weekly&year=${year}&week_offset=${offset}`
            const res = await api.get(`/dashboard/reports/visits-log/?${params}`)
            setDialog(prev => ({ ...prev, rows: res.data.rows, weekLabel: res.data.weekLabel ?? '' }))
            if (res.data.weekLabel) setVisitsWeekLabel(res.data.weekLabel)
        } finally {
            setVisitsLoading(false)
        }
    }

    const openVisitsDialog = async () => {
        const initMode = 'weekly'
        const initYear = new Date().getFullYear()
        setVisitsMode(initMode)
        setVisitsYear(initYear)
        setVisitsWeekOffset(0)
        setVisitsLoading(true)
        try {
            const res = await api.get(`/dashboard/reports/visits-log/?mode=weekly&year=${initYear}&week_offset=0`)
            setVisitsWeekLabel(res.data.weekLabel ?? '')
            setDialog({
                type: 'visits',
                title: 'Monthly AgriXa Visits',
                columns: ['Day / Month', 'Visits'],
                rows: res.data.rows,
                weekLabel: res.data.weekLabel ?? '',
                availableVisitYears: stats?.availableVisitYears ?? [initYear],
            })
        } finally {
            setVisitsLoading(false)
        }
    }

    const handleVisitsModeChange = (mode) => {
        setVisitsMode(mode)
        setVisitsWeekOffset(0)
        fetchVisitsLog(mode, visitsYear, 0)
    }

    const handleVisitsYearChange = (year) => {
        setVisitsYear(year)
        setVisitsWeekOffset(0)
        fetchVisitsLog(visitsMode, year, 0)
    }

    const handleVisitsWeekNav = (dir) => {
        const newOffset = visitsWeekOffset + dir
        setVisitsWeekOffset(newOffset)
        fetchVisitsLog('weekly', visitsYear, newOffset)
    }

    const openTicketsByPositionDialog = () => {
        const { months, positions, matrix } = stats?.ticketsByPosition ?? { months: [], positions: [], matrix: {} }
        setDialog({
            type: 'tickets',
            title: 'Monthly Tickets by Position',
            columns: ['Month', ...positions],
            rows: months.map(month => [month, ...positions.map(pos => matrix[month]?.[pos] ?? 0)]).reverse(),
            availableYears: stats?.availableYears ?? [],
        })
    }

    const handleYearChange = async (year) => {
        setSelectedYear(year)
        setYearLoading(true)
        try {
            const res = await api.get(`/dashboard/reports/tickets-by-position/?year=${year}`)
            const { months, positions, matrix } = res.data
            setDialog(prev => ({
                ...prev,
                columns: ['Month', ...positions],
                rows: months.map(month => [month, ...positions.map(pos => matrix[month]?.[pos] ?? 0)]).reverse(),
            }))
        } finally {
            setYearLoading(false)
        }
    }

    const WORKER_COLUMNS = ['Day / Month', 'Online', 'Offline', 'Deleted', 'Total']

    const fetchWorkerLogs = async (mode, year, offset) => {
        setWorkerLoading(true)
        try {
            const params = mode === 'monthly'
                ? `mode=monthly&year=${year}`
                : `mode=weekly&year=${year}&week_offset=${offset}`
            const res = await api.get(`/dashboard/reports/worker-logs/?${params}`)
            setDialog(prev => ({ ...prev, rows: res.data.rows, weekLabel: res.data.weekLabel ?? '' }))
            if (res.data.weekLabel) setWorkerWeekLabel(res.data.weekLabel)
        } finally {
            setWorkerLoading(false)
        }
    }

    const openWorkerDialog = async () => {
        const initMode = 'weekly'
        const initYear = new Date().getFullYear()
        const initOffset = 0
        setWorkerMode(initMode)
        setWorkerYear(initYear)
        setWeekOffset(initOffset)
        setWorkerLoading(true)
        try {
            const res = await api.get(`/dashboard/reports/worker-logs/?mode=weekly&year=${initYear}&week_offset=0`)
            setWorkerWeekLabel(res.data.weekLabel ?? '')
            setDialog({
                type: 'workers',
                title: 'Extension Worker Status',
                columns: WORKER_COLUMNS,
                rows: res.data.rows,
                weekLabel: res.data.weekLabel ?? '',
                availableWorkerYears: stats?.availableWorkerYears ?? [initYear],
            })
        } finally {
            setWorkerLoading(false)
        }
    }

    const handleWorkerModeChange = (mode) => {
        setWorkerMode(mode)
        setWeekOffset(0)
        fetchWorkerLogs(mode, workerYear, 0)
    }

    const handleWorkerYearChange = (year) => {
        setWorkerYear(year)
        setWeekOffset(0)
        fetchWorkerLogs(workerMode, year, 0)
    }

    const handleWeekNav = (dir) => {
        const newOffset = weekOffset + dir
        setWeekOffset(newOffset)
        fetchWorkerLogs('weekly', workerYear, newOffset)
    }

    const handleOnlineCardClick = async (e) => {
        e.stopPropagation()
        setOnlineLoading(true)
        setOnlineWorkers([])
        try {
            const res = await api.get('/dashboard/reports/online-workers/')
            setOnlineWorkers(res.data.workers)
        } finally {
            setOnlineLoading(false)
        }
    }

    const workerInnerCards = [
        { label: 'Total E-Workers', value: stats?.workers.total ?? 0, icon: MdSupportAgent, color: theme.primaryColor, onClick: null },
        { label: 'Online', value: stats?.workers.active ?? 0, icon: MdCheckCircle, color: '#22c55e', onClick: handleOnlineCardClick },
        { label: 'Offline', value: stats?.workers.inactive ?? 0, icon: MdCancel, color: '#ef4444', onClick: null },
        { label: 'Deleted', value: stats?.workers.deleted ?? 0, icon: MdDeleteForever, color: '#6b7280', onClick: null },
    ]

    return (
        <AdminLayout>
            <div className='flex flex-col gap-6'>
                <h1 className='text-2xl font-bold' style={{ color: theme.textColor }}>Reports & Analytics</h1>

                {loading ? (
                    <div className='flex justify-center py-16'>
                        <AiOutlineLoading3Quarters className='animate-spin' size={28} color={theme.primaryColor} />
                    </div>
                ) : (
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>

                        {/* Monthly Tickets Chart */}
                        <div onClick={openTicketsByPositionDialog}
                            className='p-6 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
                            style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}`, height: '280px' }}>
                            <Bar
                                data={{ labels: stats?.tickets.labels ?? [], datasets: [{ label: 'Tickets', data: stats?.tickets.data ?? [], backgroundColor: theme.primaryColor + 'cc', borderRadius: 8 }] }}
                                options={chartOptions('Monthly Tickets')}
                            />
                        </div>

                        {/* Monthly New Farmers Chart */}
                        <div onClick={() => openMonthlyDialog('Monthly New Farmers', stats?.farmers.labels, stats?.farmers.data, 'Farmers', 'farmers', stats?.availableFarmerYears ?? [])}
                            className='p-6 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
                            style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}`, height: '280px' }}>
                            <Bar
                                data={{ labels: stats?.farmers.labels ?? [], datasets: [{ label: 'Farmers', data: stats?.farmers.data ?? [], backgroundColor: '#3b82f6cc', borderRadius: 8 }] }}
                                options={chartOptions('Monthly New Farmers')}
                            />
                        </div>

                        {/* Extension Worker Status Card */}
                        <div onClick={openWorkerDialog}
                            className='p-6 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-4'
                            style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}` }}>
                            <p className='text-sm font-medium opacity-60' style={{ color: theme.textColor }}>Extension Worker Status</p>
                            <div className='grid grid-cols-2 gap-3'>
                                {workerInnerCards.map(card => (
                                    <div key={card.label}
                                        onClick={card.onClick ?? undefined}
                                        className={`flex items-center gap-3 p-3 rounded-lg ${card.onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
                                        style={{ backgroundColor: card.color + '12', border: `1px solid ${card.color}30` }}>
                                        <card.icon size={20} color={card.color} />
                                        <div>
                                            <p className='text-xs opacity-60' style={{ color: theme.textColor }}>{card.label}</p>
                                            <p className='text-xl font-bold' style={{ color: theme.textColor }}>{card.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Monthly AgriXa Visits Chart */}
                        <div onClick={openVisitsDialog}
                            className='p-6 rounded-xl shadow-sm cursor-pointer hover:shadow-md transition-shadow'
                            style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}`, height: '280px' }}>
                            <Bar
                                data={{ labels: stats?.visits.labels ?? [], datasets: [{ label: 'Visits', data: stats?.visits.data ?? [], backgroundColor: '#f59e0bcc', borderRadius: 8 }] }}
                                options={chartOptions('Monthly AgriXa Visits')}
                            />
                        </div>

                    </div>
                )}
            </div>

            {/* Table Dialog */}
            <Dialog isOpen={!!dialog} onClose={() => { setDialog(null); setSelectedYear(new Date().getFullYear()); setWeekOffset(0); setFarmerYear(new Date().getFullYear()); setVisitsWeekOffset(0) }} title={dialog?.title ?? ''}>
                {dialog && (
                    <div className='flex flex-col gap-4 w-full sm:w-[min(700px,90vw)]'>

                        {/* Top bar */}
                        <div className='flex items-center justify-between gap-3 flex-wrap'>
                            <div className='flex items-center gap-2 flex-wrap'>
                                {/* Tickets: year filter */}
                                {dialog.type === 'tickets' && (
                                    <select value={selectedYear} onChange={e => handleYearChange(Number(e.target.value))}
                                        className='text-sm border rounded-lg px-3 py-1.5 outline-none'
                                        style={{ borderColor: theme.secondaryColor, color: theme.textColor, backgroundColor: '#fff' }}>
                                        {(dialog.availableYears?.length ? dialog.availableYears : [new Date().getFullYear()]).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                )}
                                {/* Farmers: year filter */}
                                {dialog.type === 'farmers' && (
                                    <select value={farmerYear} onChange={e => handleFarmerYearChange(Number(e.target.value))}
                                        className='text-sm border rounded-lg px-3 py-1.5 outline-none'
                                        style={{ borderColor: theme.secondaryColor, color: theme.textColor, backgroundColor: '#fff' }}>
                                        {(dialog.availableYears?.length ? dialog.availableYears : [new Date().getFullYear()]).map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                    </select>
                                )}
                                {/* Workers: mode toggle + year + week nav */}
                                {dialog.type === 'workers' && (
                                    <>
                                        <div className='flex rounded-lg overflow-hidden border text-sm'
                                            style={{ borderColor: theme.secondaryColor }}>
                                            {['weekly', 'monthly'].map(m => (
                                                <button key={m} onClick={() => handleWorkerModeChange(m)}
                                                    className='px-3 py-1.5 capitalize transition-colors'
                                                    style={{
                                                        backgroundColor: workerMode === m ? theme.primaryColor : '#fff',
                                                        color: workerMode === m ? '#fff' : theme.textColor,
                                                    }}>{m}</button>
                                            ))}
                                        </div>
                                        <select value={workerYear} onChange={e => handleWorkerYearChange(Number(e.target.value))}
                                            className='text-sm border rounded-lg px-3 py-1.5 outline-none'
                                            style={{ borderColor: theme.secondaryColor, color: theme.textColor, backgroundColor: '#fff' }}>
                                            {(dialog.availableWorkerYears?.length ? dialog.availableWorkerYears : [new Date().getFullYear()]).map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                        {workerMode === 'weekly' && (
                                            <div className='flex items-center gap-1 text-sm' style={{ color: theme.textColor }}>
                                                <button onClick={() => handleWeekNav(-1)}
                                                    className='px-2 py-1 rounded border hover:opacity-70'
                                                    style={{ borderColor: theme.secondaryColor }}>‹</button>
                                                <span className='text-xs opacity-60 whitespace-nowrap'>{workerWeekLabel}</span>
                                                <button onClick={() => handleWeekNav(1)}
                                                    className='px-2 py-1 rounded border hover:opacity-70'
                                                    style={{ borderColor: theme.secondaryColor }}>›</button>
                                            </div>
                                        )}
                                    </>
                                )}
                                {/* Visits: mode toggle + year + week nav */}
                                {dialog.type === 'visits' && (
                                    <>
                                        <div className='flex rounded-lg overflow-hidden border text-sm'
                                            style={{ borderColor: theme.secondaryColor }}>
                                            {['weekly', 'monthly'].map(m => (
                                                <button key={m} onClick={() => handleVisitsModeChange(m)}
                                                    className='px-3 py-1.5 capitalize transition-colors'
                                                    style={{
                                                        backgroundColor: visitsMode === m ? theme.primaryColor : '#fff',
                                                        color: visitsMode === m ? '#fff' : theme.textColor,
                                                    }}>{m}</button>
                                            ))}
                                        </div>
                                        <select value={visitsYear} onChange={e => handleVisitsYearChange(Number(e.target.value))}
                                            className='text-sm border rounded-lg px-3 py-1.5 outline-none'
                                            style={{ borderColor: theme.secondaryColor, color: theme.textColor, backgroundColor: '#fff' }}>
                                            {(dialog.availableVisitYears?.length ? dialog.availableVisitYears : [new Date().getFullYear()]).map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                        {visitsMode === 'weekly' && (
                                            <div className='flex items-center gap-1 text-sm' style={{ color: theme.textColor }}>
                                                <button onClick={() => handleVisitsWeekNav(-1)}
                                                    className='px-2 py-1 rounded border hover:opacity-70'
                                                    style={{ borderColor: theme.secondaryColor }}>‹</button>
                                                <span className='text-xs opacity-60 whitespace-nowrap'>{visitsWeekLabel}</span>
                                                <button onClick={() => handleVisitsWeekNav(1)}
                                                    className='px-2 py-1 rounded border hover:opacity-70'
                                                    style={{ borderColor: theme.secondaryColor }}>›</button>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <Button size='sm' variant='outline'
                                onClick={() => exportCSV(
                                    dialog.columns,
                                    dialog.rows,
                                    `${dialog.title.replace(/\s+/g, '_')}_${dialog.type === 'tickets' ? selectedYear : dialog.type === 'farmers' ? farmerYear : dialog.type === 'workers' ? (workerMode === 'weekly' ? workerWeekLabel.replace(/\s/g, '_') : workerYear) : dialog.type === 'visits' ? (visitsMode === 'weekly' ? visitsWeekLabel.replace(/\s/g, '_') : visitsYear) : ''}.csv`
                                )}>
                                Export CSV
                            </Button>
                        </div>

                        {/* Table */}
                        <div className='overflow-x-auto'>
                            {(yearLoading || workerLoading || farmerLoading || visitsLoading) ? (
                                <div className='flex justify-center py-8'>
                                    <AiOutlineLoading3Quarters className='animate-spin' size={22} color={theme.primaryColor} />
                                </div>
                            ) : (
                                <table className='w-full text-sm border-collapse'>
                                    <thead>
                                        <tr style={{ borderBottom: `2px solid ${theme.secondaryColor}` }}>
                                            {dialog.columns.map(col => (
                                                <th key={col} className='text-left py-2 px-3 font-medium opacity-60 whitespace-nowrap'
                                                    style={{ color: theme.textColor }}>{col}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dialog.rows.map((row, i) => (
                                            <tr key={i} style={{ borderBottom: `1px solid ${theme.secondaryColor}40` }}>
                                                {row.map((cell, j) => (
                                                    <td key={j} className='py-2 px-3 whitespace-nowrap' style={{ color: theme.textColor }}>{cell}</td>
                                                ))}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        <div className='flex justify-end'>
                            <Button size='sm' variant='ghost' onClick={() => { setDialog(null); setSelectedYear(new Date().getFullYear()); setWeekOffset(0); setFarmerYear(new Date().getFullYear()); setVisitsWeekOffset(0) }}>Close</Button>
                        </div>
                    </div>
                )}
            </Dialog>
            {/* Online Workers Dialog */}
            <Dialog isOpen={onlineWorkers !== null} onClose={() => setOnlineWorkers(null)} title='Online Extension Workers'>
                <div className='flex flex-col gap-4 w-full sm:w-[min(400px,90vw)]'>
                    {onlineLoading ? (
                        <div className='flex justify-center py-8'>
                            <AiOutlineLoading3Quarters className='animate-spin' size={22} color={theme.primaryColor} />
                        </div>
                    ) : onlineWorkers?.length === 0 ? (
                        <p className='text-sm text-center opacity-50 py-4' style={{ color: theme.textColor }}>No online workers</p>
                    ) : (
                        <div className='flex flex-col gap-2'>
                            {onlineWorkers?.map(w => (
                                <div key={w.id} className='flex items-center justify-between px-3 py-2 rounded-lg'
                                    style={{ backgroundColor: '#22c55e12', border: '1px solid #22c55e30' }}>
                                    <div className='flex items-center gap-2'>
                                        <MdCheckCircle size={16} color='#22c55e' />
                                        <p className='text-sm font-medium' style={{ color: theme.textColor }}>{w.name}</p>
                                    </div>
                                    <p className='text-xs opacity-50' style={{ color: theme.textColor }}>{w.position}</p>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className='flex justify-end'>
                        <Button size='sm' variant='ghost' onClick={() => setOnlineWorkers(null)}>Close</Button>
                    </div>
                </div>
            </Dialog>
        </AdminLayout>
    )
}

export default Reports
