import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MdSearch, MdMenuBook, MdPushPin, MdClose, MdInsertDriveFile, MdDelete } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import AdminLayout from '../../components/layout/AdminLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import TicketAssignment from '../../components/tickets/TicketAssignment'
import api from '../../services/api'
import TicketCapacity from '../../components/tickets/TicketCapacity'

const STATUS_TABS = ['all', 'pending', 'ongoing', 'waiting_for_feedback', 'resolved']
const STATUS_LABEL = {
    all: 'All',
    pending: 'Pending',
    ongoing: 'Ongoing',
    waiting_for_feedback: 'Waiting for Feedback',
    resolved: 'Resolved',
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const statusStyle = {
    pending:              { bg: '#fef9c3', color: '#ca8a04' },
    ongoing:              { bg: '#dbeafe', color: '#1d4ed8' },
    waiting_for_feedback: { bg: '#fce7f3', color: '#be185d' },
    resolved:             { bg: '#dcfce7', color: '#16a34a' },
}

const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const getMondayOfWeek = (year, month, day) => {
    const d = new Date(year, month, day)
    const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
    d.setDate(d.getDate() + diff)
    return d
}

const toISODate = (d) => d.toISOString().split('T')[0]

const AdminKnowledgeRepository = () => {
    const theme = useSelector((state) => state.theme)
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [activeTab, setActiveTab] = useState('all')
    const [selected, setSelected] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [deletingMsgId, setDeletingMsgId] = useState(null)
    const [confirmDelete, setConfirmDelete] = useState(null)
    const [lightboxSrc, setLightboxSrc] = useState(null)
    const messagesEndRef = useRef(null)
    const wsRef = useRef(null)
    const selectedIdRef = useRef(null)
    const refetchRef = useRef(null)
    const msgRefs = useRef({})

    const now = new Date()
    const initMonday = getMondayOfWeek(now.getFullYear(), now.getMonth(), now.getDate())
    const [weekStart, setWeekStart] = useState(initMonday)
    const weekStartRef = useRef(initMonday)
    const [filterMonth, setFilterMonth] = useState(initMonday.getMonth())
    const [filterYear, setFilterYear] = useState(initMonday.getFullYear())
    const [weekLabel, setWeekLabel] = useState('')
    const [availableYears, setAvailableYears] = useState([])

    const fetchTickets = async (monday) => {
        weekStartRef.current = monday
        try {
            const res = await api.get(`/tickets/?week_start=${toISODate(monday)}`)
            setTickets(res.data.tickets)
            setWeekLabel(res.data.weekLabel)
            setFilterMonth(res.data.month - 1)
            setFilterYear(res.data.year)
            if (res.data.availableYears?.length) setAvailableYears(res.data.availableYears)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchTickets(initMonday)
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/ticket-updates/`)
        ws.onmessage = () => fetchTickets(weekStartRef.current)
        ws.onerror = () => ws.close()
        return () => ws.close()
    }, [])

    const handleWeekNav = (dir) => {
        setLoading(true)
        const next = new Date(weekStart)
        next.setDate(next.getDate() + dir * 7)
        setWeekStart(next)
        fetchTickets(next)
    }

    const handleMonthChange = (monthIndex) => {
        setLoading(true)
        const monday = getMondayOfWeek(filterYear, monthIndex, 1)
        setWeekStart(monday)
        fetchTickets(monday)
    }

    const handleYearChange = (year) => {
        setLoading(true)
        const monday = getMondayOfWeek(year, filterMonth, 1)
        setWeekStart(monday)
        fetchTickets(monday)
    }

    const sorted = [...tickets].sort((a, b) => new Date(b.date) - new Date(a.date))

    const filtered = sorted.filter(t => {
        const matchTab = activeTab === 'all' || t.status === activeTab
        const matchSearch = `${t.concern} ${t.extensionWorkerName} ${t.categoryName || ""}`.toLowerCase().includes(search.toLowerCase())
        return matchTab && matchSearch
    })

    const handleView = async (ticket) => {
        setSelected({ ...ticket, messages: [] })
        setDetailLoading(true)
        try {
            const res = await api.get(`/tickets/${ticket.id}/`)
            setSelected(res.data)
        } finally {
            setDetailLoading(false)
        }
    }

    const refetchSelected = async (ticketId) => {
        const res = await api.get(`/tickets/${ticketId}/`)
        setSelected(res.data)
    }

    useEffect(() => { refetchRef.current = refetchSelected }, [tickets])

    useEffect(() => {
        selectedIdRef.current = selected?.id ?? null
    }, [selected?.id])

    useEffect(() => {
        if (!selected) {
            if (wsRef.current) { wsRef.current.close(); wsRef.current = null }
            return
        }
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/tickets/${selected.id}/`)
        ws.onmessage = () => {
            if (selectedIdRef.current && refetchRef.current) refetchRef.current(selectedIdRef.current)
        }
        ws.onerror = () => ws.close()
        wsRef.current = ws
        return () => { ws.close(); wsRef.current = null }
    }, [selected?.id])

    useEffect(() => {
        if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }, [selected?.messages])

    const handleStatusUpdate = async (newStatus) => {
        if (!selected) return
        setUpdatingStatus(true)
        try {
            await api.patch(`/tickets/${selected.id}/status/`, { status: newStatus })
            setSelected(prev => ({ ...prev, status: newStatus }))
            setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, status: newStatus } : t))
        } finally {
            setUpdatingStatus(false)
        }
    }

    const handleDelete = async (ticketId) => {
        const id = ticketId || selected?.id
        if (!id) return
        setDeleting(true)
        try {
            await api.delete(`/tickets/${id}/delete/`)
            setTickets(prev => prev.filter(t => t.id !== id))
            if (selected?.id === id) setSelected(null)
            setConfirmDelete(null)
        } finally {
            setDeleting(false)
        }
    }

    const handleDeleteMessage = async (msgId) => {
        if (!window.confirm('Delete this message?')) return
        setDeletingMsgId(msgId)
        try {
            await api.delete(`/tickets/${selected.id}/messages/${msgId}/delete/`)
        } finally {
            setDeletingMsgId(null)
        }
    }

    return (
        <AdminLayout>
            <div className='mx-auto flex w-full max-w-6xl flex-col gap-5'>
                <div><p className='text-xs font-semibold uppercase tracking-[0.16em]' style={{ color: theme.primaryColor }}>Support operations</p><h1 className='mt-1 text-2xl font-bold' style={{ color: theme.textColor }}>Ticket Repository</h1><p className='mt-1 text-sm opacity-60' style={{ color: theme.textColor }}>Review, filter, and manage farmer conversations.</p></div>

                {/* Filters */}
                <div className='flex flex-wrap items-center gap-2 rounded-xl p-3' style={{ backgroundColor: `${theme.primaryColor}08` }}>
                    {/* Week nav */}
                    <div className='flex items-center gap-1 text-sm' style={{ color: theme.textColor }}>
                        <button onClick={() => handleWeekNav(-1)}
                            className='px-2 py-1 rounded border hover:opacity-70'
                            style={{ borderColor: theme.secondaryColor }}>‹</button>
                        <span className='text-xs opacity-60 whitespace-nowrap px-1'>{weekLabel}</span>
                        <button onClick={() => handleWeekNav(1)}
                            className='px-2 py-1 rounded border hover:opacity-70'
                            style={{ borderColor: theme.secondaryColor }}>›</button>
                    </div>
                    {/* Month dropdown */}
                    <select value={filterMonth} onChange={e => handleMonthChange(Number(e.target.value))}
                        className='text-sm border rounded-lg px-3 py-1.5 outline-none'
                        style={{ borderColor: theme.secondaryColor, color: theme.textColor, backgroundColor: '#fff' }}>
                        {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
                    </select>
                    {/* Year dropdown */}
                    <select value={filterYear} onChange={e => handleYearChange(Number(e.target.value))}
                        className='text-sm border rounded-lg px-3 py-1.5 outline-none'
                        style={{ borderColor: theme.secondaryColor, color: theme.textColor, backgroundColor: '#fff' }}>
                        {(availableYears.length ? availableYears : [filterYear]).map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                </div>

                {/* Search */}
                <div className='relative'>
                    <MdSearch size={18} className='absolute left-3 top-1/2 -translate-y-1/2 opacity-50' color={theme.textColor} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search by concern or worker...'
                        className='w-full pl-9 pr-4 py-2.5 text-sm outline-none border rounded-lg'
                        style={{ borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                </div>

                {/* Status Tabs */}
                <div className='flex gap-2 overflow-x-auto pb-1'>
                    {STATUS_TABS.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className='px-3 py-1 rounded-full text-xs font-medium transition-all'
                            style={{
                                backgroundColor: activeTab === tab ? theme.primaryColor : theme.primaryColor + '18',
                                color: activeTab === tab ? '#fff' : theme.primaryColor,
                            }}>
                            {STATUS_LABEL[tab]}
                        </button>
                    ))}
                </div>

                {/* Ticket List */}
                {loading ? (
                    <div className='flex justify-center py-16'>
                        <AiOutlineLoading3Quarters className='animate-spin' size={28} color={theme.primaryColor} />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className='flex flex-col items-center gap-2 py-16 opacity-40'>
                        <MdMenuBook size={40} color={theme.textColor} />
                        <p className='text-sm' style={{ color: theme.textColor }}>No tickets found</p>
                    </div>
                ) : (
                    <div className='flex flex-col gap-3'>
                        {filtered.map(ticket => (
                            <div key={ticket.id} onClick={() => handleView(ticket)}
                                className='flex items-start gap-2 p-4 rounded-xl cursor-pointer transition-all hover:shadow-md'
                                style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}` }}>
                                <div className='flex flex-col gap-2 flex-1 min-w-0'>
                                    <div className='flex items-start justify-between gap-2'>
                                        <p className='text-sm font-semibold line-clamp-1' style={{ color: theme.textColor }}>{ticket.title || ticket.concern}</p>
                                        <span className='shrink-0 px-2 py-0.5 rounded-full text-xs font-medium'
                                            style={{ backgroundColor: statusStyle[ticket.status]?.bg, color: statusStyle[ticket.status]?.color }}>
                                            {STATUS_LABEL[ticket.status] ?? ticket.status}
                                        </span>
                                    </div>
                                    <TicketCapacity ticket={ticket} compact />
                                {ticket.categoryName && <p className='text-xs font-semibold' style={{ color: theme.primaryColor }}>{ticket.categoryName}</p>}
                                {ticket.title && <p className='text-xs opacity-60 line-clamp-1' style={{ color: theme.textColor }}>{ticket.concern}</p>}
                                    <div className='flex items-center justify-between'>
                                        <p className='text-xs font-medium' style={{ color: theme.primaryColor }}>Assigned to: {ticket.extensionWorkerName || 'Unassigned'}</p>
                                        <p className='text-xs opacity-40' style={{ color: theme.textColor }}>{formatDate(ticket.date)}</p>
                                    </div>
                                </div>
                                <button onClick={e => { e.stopPropagation(); setConfirmDelete(ticket) }}
                                    className='shrink-0 opacity-40 hover:opacity-100 transition-opacity'>
                                    <MdDelete size={18} color='#ef4444' />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title='Ticket Details' mobileMaxH='max-h-[95vh]'>
                {selected && (
                    <div className='flex flex-col gap-4 w-full sm:w-[min(800px,90vw)]'>
                        {/* Header */}
                        <div className='flex items-start justify-between gap-3'>
                            <div className='flex flex-col gap-0.5'>
                                <p className='text-xs opacity-50' style={{ color: theme.textColor }}>Assigned to</p>
                                <p className='text-sm font-medium' style={{ color: theme.textColor }}>{selected.extensionWorkerName || 'Unassigned'}</p>
                            </div>
                            <span className='shrink-0 px-2 py-0.5 rounded-full text-xs font-medium'
                                style={{ backgroundColor: statusStyle[selected.status]?.bg, color: statusStyle[selected.status]?.color }}>
                                {STATUS_LABEL[selected.status] ?? selected.status}
                            </span>
                        </div>

                        {!detailLoading && <TicketAssignment key={selected.id} ticket={selected} onAssigned={updated => {
                            setSelected(current => current?.id === updated.id ? { ...current, ...updated } : current)
                            setTickets(current => current.map(ticket => ticket.id === updated.id ? { ...ticket, ...updated } : ticket))
                        }} />}

                        <TicketCapacity ticket={selected} />
                        {selected.categoryName && <p className='text-sm' style={{ color: theme.textColor }}><strong>Category:</strong> {selected.categoryName}</p>}
                        {/* Title + Concern */}
                        <div className='flex flex-col gap-1'>
                            {selected.title && <p className='text-base font-semibold' style={{ color: theme.textColor }}>{selected.title}</p>}
                            <p className='text-xs opacity-50' style={{ color: theme.textColor }}>Concern</p>
                            <p className='text-sm p-3 rounded-lg' style={{ backgroundColor: theme.primaryColor + '10', color: theme.textColor }}>
                                {selected.concern}
                            </p>
                        </div>

                        {/* Pinned Message */}
                        {(() => {
                            const pinned = selected.messages?.find(m => m.isPinned)
                            return pinned ? (
                                <div className='flex flex-col gap-1 cursor-pointer'
                                    onClick={() => msgRefs.current[pinned.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                                    <div className='flex items-center gap-1'>
                                        <MdPushPin size={12} color={theme.primaryColor} />
                                        <p className='text-xs font-medium' style={{ color: theme.primaryColor }}>Pinned Answer</p>
                                    </div>
                                    <div className='text-sm p-3 rounded-lg' style={{ backgroundColor: theme.primaryColor + '18', color: theme.textColor, outline: `1px solid ${theme.primaryColor}40` }}>
                                        {pinned.message && <p>{pinned.message}</p>}
                                        {pinned.fileData && pinned.fileType?.startsWith('image/') && (
                                            <span className='flex items-center gap-1 text-xs mt-1 underline cursor-pointer'
                                                style={{ color: theme.primaryColor }}
                                                onClick={e => { e.stopPropagation(); setLightboxSrc(pinned.fileData) }}>
                                                <MdInsertDriveFile size={14} />{pinned.fileName}
                                            </span>
                                        )}
                                        {pinned.fileData && !pinned.fileType?.startsWith('image/') && (
                                            <a href={pinned.fileData} download={pinned.fileName}
                                                className='flex items-center gap-1 text-xs mt-1 underline'
                                                style={{ color: theme.primaryColor }}
                                                onClick={e => e.stopPropagation()}>
                                                <MdInsertDriveFile size={14} />{pinned.fileName}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ) : null
                        })()}

                        <hr style={{ borderColor: theme.secondaryColor }} />

                        {/* Messages */}
                        <div className='flex flex-col gap-1'>
                            <p className='text-xs opacity-50 mb-1' style={{ color: theme.textColor }}>Conversation</p>
                            {detailLoading ? (
                                <div className='flex justify-center py-6'>
                                    <AiOutlineLoading3Quarters className='animate-spin' size={20} color={theme.primaryColor} />
                                </div>
                            ) : selected.messages?.length === 0 ? (
                                <p className='text-xs opacity-40 text-center py-4' style={{ color: theme.textColor }}>No messages yet</p>
                            ) : (
                                <div className='flex flex-col gap-2 max-h-80 sm:max-h-60 overflow-y-auto pr-1'>
                                    {selected.messages?.map(msg => (
                                        <div key={msg.id} ref={el => msgRefs.current[msg.id] = el}
                                            className='flex flex-col gap-0.5 p-3 rounded-lg'
                                            style={{
                                                backgroundColor: msg.senderRole === 'extension_worker' ? theme.primaryColor + '18' : '#f3f4f6',
                                                alignSelf: msg.senderRole === 'extension_worker' ? 'flex-end' : 'flex-start',
                                                maxWidth: '85%',
                                                outline: msg.isPinned ? `2px solid ${theme.primaryColor}` : 'none',
                                            }}>
                                            <div className='flex items-center justify-between gap-4'>
                                                <p className='text-xs font-medium opacity-60' style={{ color: theme.textColor }}>
                                                    {msg.senderName} · <span className='capitalize'>{msg.senderRole.replace('_', ' ')}</span>
                                                </p>
                                                <button onClick={() => handleDeleteMessage(msg.id)}
                                                    className='opacity-40 hover:opacity-100 transition-opacity'
                                                    disabled={deletingMsgId === msg.id}>
                                                    {deletingMsgId === msg.id
                                                        ? <AiOutlineLoading3Quarters className='animate-spin' size={12} color='#ef4444' />
                                                        : <MdDelete size={13} color='#ef4444' />}
                                                </button>
                                            </div>
                                            {msg.message && <p className='text-sm' style={{ color: theme.textColor }}>{msg.message}</p>}
                                            {msg.fileData && msg.fileType?.startsWith('image/') && (
                                                <img src={msg.fileData} alt={msg.fileName}
                                                    className='max-w-[200px] rounded-lg cursor-pointer mt-1'
                                                    onClick={() => setLightboxSrc(msg.fileData)} />
                                            )}
                                            {msg.fileData && !msg.fileType?.startsWith('image/') && (
                                                <a href={msg.fileData} download={msg.fileName}
                                                    className='flex items-center gap-1 text-xs mt-1 underline'
                                                    style={{ color: theme.primaryColor }}>
                                                    <MdInsertDriveFile size={14} />{msg.fileName}
                                                </a>
                                            )}
                                            <p className='text-xs opacity-40 text-right' style={{ color: theme.textColor }}>{formatDate(msg.date)}</p>
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className='flex justify-between items-center'>
                            <div className='flex gap-2'>
                                {selected.status === 'pending' && (
                                    <Button size='sm' onClick={() => handleStatusUpdate('ongoing')} loading={updatingStatus}>
                                        Mark as Ongoing
                                    </Button>
                                )}
                                {selected.status === 'ongoing' && (
                                    <Button size='sm' onClick={() => handleStatusUpdate('waiting_for_feedback')} loading={updatingStatus}>
                                        Mark as Resolved
                                    </Button>
                                )}
                                {selected.status === 'waiting_for_feedback' && (
                                    <Button size='sm' onClick={() => handleStatusUpdate('resolved')} loading={updatingStatus}>
                                        Force Resolve
                                    </Button>
                                )}
                            </div>
                            <Button size='sm' variant='ghost' onClick={() => setSelected(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Confirm Delete Dialog */}
            <Dialog isOpen={!!confirmDelete} onClose={() => setConfirmDelete(null)} title='Delete Ticket'>
                {confirmDelete && (
                    <div className='flex flex-col gap-4 w-[min(360px,90vw)]'>
                        <p className='text-sm' style={{ color: theme.textColor }}>
                            Delete this ticket and all its messages? This cannot be undone.
                        </p>
                        <p className='text-sm font-medium line-clamp-2' style={{ color: theme.textColor }}>{confirmDelete.title || confirmDelete.concern}</p>
                        <div className='flex justify-end gap-2'>
                            <Button size='sm' variant='ghost' onClick={() => setConfirmDelete(null)}>Cancel</Button>
                            <Button size='sm' variant='danger' onClick={() => handleDelete(confirmDelete.id)} loading={deleting}>Delete</Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Lightbox */}
            {lightboxSrc && (
                <div className='fixed inset-0 z-[70] flex items-center justify-center'
                    style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
                    onClick={() => setLightboxSrc(null)}>
                    <button className='absolute top-4 right-4 text-white opacity-70 hover:opacity-100'
                        onClick={() => setLightboxSrc(null)}>
                        <MdClose size={32} />
                    </button>
                    <img src={lightboxSrc} className='max-w-[90vw] max-h-[90vh] object-contain rounded-lg'
                        onClick={e => e.stopPropagation()} />
                </div>
            )}
        </AdminLayout>
    )
}

export default AdminKnowledgeRepository
