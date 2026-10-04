import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { MdSearch, MdConfirmationNumber, MdSend, MdPushPin, MdAttachFile, MdClose, MdInsertDriveFile } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import ExtensionWorkerLayout from '../../components/layout/ExtensionWorkerLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import api from '../../services/api'
import TicketCapacity from '../../components/tickets/TicketCapacity'
import AssignedPersonnel from '../../components/tickets/AssignedPersonnel'
import TicketDetailsToggle from '../../components/tickets/TicketDetailsToggle'
import ConversationHeader from '../../components/tickets/ConversationHeader'

const STATUS_TABS = ['all', 'pending', 'ongoing', 'waiting_for_feedback', 'resolved']
const STATUS_LABEL = {
    all: 'All',
    pending: 'Pending',
    ongoing: 'Ongoing',
    waiting_for_feedback: 'Waiting for Feedback',
    resolved: 'Resolved',
}

const statusStyle = {
    pending:             { bg: '#fef9c3', color: '#ca8a04' },
    ongoing:             { bg: '#dbeafe', color: '#1d4ed8' },
    waiting_for_feedback:{ bg: '#fce7f3', color: '#be185d' },
    resolved:            { bg: '#dcfce7', color: '#16a34a' },
}

const formatDate = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatDateTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

const ExtensionWorkerTickets = () => {
    const theme = useSelector((state) => state.theme)
    const { user } = useSelector((state) => state.auth)
    const location = useLocation()
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [barangay, setBarangay] = useState('')
    const [month, setMonth] = useState('')
    const [exportIds, setExportIds] = useState([])
    const [exportNotice, setExportNotice] = useState('')
    const [activeTab, setActiveTab] = useState('all')
    const [selected, setSelected] = useState(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [updatingStatus, setUpdatingStatus] = useState(false)
    const [attachedFile, setAttachedFile] = useState(null)
    const [fileError, setFileError] = useState('')
    const [accessNotice, setAccessNotice] = useState('')
    const [lightboxSrc, setLightboxSrc] = useState(null)
    const messagesContainerRef = useRef(null)
    const wsRef = useRef(null)
    const selectedIdRef = useRef(null)
    const refetchRef = useRef(null)
    const ticketRefs = useRef({})
    const fileInputRef = useRef(null)
    const msgRefs = useRef({})

    const fetchTickets = () => {
        api.get('/tickets/').then(res => {
            setTickets(res.data)
            setLoading(false)
        }).catch(() => setLoading(false))
    }

    useEffect(() => {
        fetchTickets()
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/ticket-updates/`)
        ws.onmessage = () => fetchTickets()
        ws.onerror = () => ws.close()
        return () => ws.close()
    }, [])

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        })
    }

    useEffect(() => { scrollToBottom() }, [selected?.messages])

    useEffect(() => {
        const ticketId = location.state?.ticketId
        if (!ticketId || tickets.length === 0) return
        const ticket = tickets.find(t => t.id === ticketId)
        if (ticket) {
            handleView(ticket)
            setTimeout(() => {
                ticketRefs.current[ticketId]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }, 100)
        } else {
            api.get(`/tickets/${ticketId}/`).then(res => {
                handleView(res.data)
            }).catch(() => {})
        }
    }, [location.state?.ticketId, tickets.length])

    const sorted = [...tickets].sort((a, b) => new Date(b.date) - new Date(a.date))

    const filtered = sorted.filter(t => {
        const matchTab = activeTab === 'all' || t.status === activeTab
        const matchSearch = t.concern.toLowerCase().includes(search.toLowerCase())
        const date = new Date(t.date?.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(t.date || '') ? t.date : `${t.date}Z`)
        const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(Number.isNaN(date.getTime()) ? 0 : date)
        const ticketMonth = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}`
        return matchTab && matchSearch && (!barangay || (t.barangay || 'Unspecified') === barangay) && (!month || ticketMonth === month)
    })

    const resolved = filtered.filter(t => t.status === 'resolved')
    const chosen = resolved.filter(t => exportIds.includes(t.id))
    const exportResolved = () => {
        const cell = value => { const text = String(value ?? ''); return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""') + '"' }
        const rows = [['Ticket ID', 'Title', 'Concern', 'Barangay', 'Category', 'Assigned personnel', 'Submitted date', 'Status'], ...chosen.map(t => [t.id, t.title, t.concern, t.barangay, t.categoryName, t.extensionWorkerName, t.date, t.status])]
        const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n')], {type: 'text/csv;charset=utf-8'}))
        const link = document.createElement('a'); link.href = url; link.download = `resolved-concerns-${month || 'all-months'}.csv`; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        setExportNotice(`Exported ${chosen.length} resolved concern(s).`)
    }

    async function handleView(ticket) {
        setAccessNotice('')
        setSelected({ ...ticket, messages: [] })
        setDetailsOpen(false)
        setReply('')
        setAttachedFile(null)
        setFileError('')
        setDetailLoading(true)
        try {
            const res = await api.get(`/tickets/${ticket.id}/`)
            setSelected(current => current?.id === ticket.id ? res.data : current)
        } catch (error) {
            setSelected(null)
            setAccessNotice([403, 404].includes(error.response?.status) ? 'This ticket is no longer available to you. Its assignment may have changed.' : 'This ticket could not be loaded. Please try again.')
            fetchTickets()
        } finally {
            setDetailLoading(false)
        }
    }

    const refetchSelected = async (ticketId) => {
        try {
            const res = await api.get(`/tickets/${ticketId}/`)
            setSelected(current => current?.id === ticketId ? res.data : current)
            setTickets(prev => prev.map(t => t.id === ticketId ? { ...t, ...res.data } : t))
        } catch (error) {
            if ([403, 404].includes(error.response?.status)) {
                setSelected(current => current?.id === ticketId ? null : current)
                setAccessNotice('This ticket is no longer available to you. Its assignment may have changed.')
                fetchTickets()
            }
        }
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
        ws.onclose = event => {
            if (event.code === 4403) {
                setSelected(current => current?.id === selected.id ? null : current)
                setAccessNotice('This ticket is no longer available to you. Its assignment may have changed.')
                fetchTickets()
            }
        }
        ws.onerror = () => ws.close()
        wsRef.current = ws
        return () => { ws.close(); wsRef.current = null }
    }, [selected?.id])

    const handleSendReply = async () => {
        if (!reply.trim() && !attachedFile) return
        setSending(true)
        try {
            await api.post(`/tickets/${selected.id}/messages/`, {
                message: reply.trim(),
                fileData: attachedFile?.data || '',
                fileName: attachedFile?.name || '',
                fileType: attachedFile?.type || '',
            })
            setReply('')
            setAttachedFile(null)
            setTimeout(() => scrollToBottom(), 300)
        } finally {
            setSending(false)
        }
    }

    const handleFileChange = (e) => {
        const file = e.target.files[0]
        if (!file) return
        if (file.size > 750 * 1024) { setFileError('File must be under 1MB.'); e.target.value = ''; return }
        setFileError('')
        const reader = new FileReader()
        reader.onload = (ev) => setAttachedFile({ data: ev.target.result, name: file.name, type: file.type })
        reader.readAsDataURL(file)
        e.target.value = ''
    }

    const handlePin = async (e, msgId) => {
        e.stopPropagation()
        if (!selected) return
        await api.patch(`/tickets/${selected.id}/messages/${msgId}/pin/`)
    }

    const handleStatusUpdate = async (newStatus) => {
        if (!selected) return
        setUpdatingStatus(true)
        try {
            const response = await api.patch(`/tickets/${selected.id}/status/`, { status: newStatus })
            const updated = response.data?.ticket || { status: newStatus }
            setSelected(prev => ({ ...prev, ...updated }))
            setTickets(prev => prev.map(t => t.id === selected.id ? { ...t, ...updated } : t))
        } finally {
            setUpdatingStatus(false)
        }
    }

    return (
        <ExtensionWorkerLayout>
            <div className='app-page flex flex-col gap-5'>
                <header><p className='app-kicker' style={{ color: theme.primaryColor }}>LGU personnel workspace</p><h1 className='app-page-title' style={{ color: theme.textColor }}>My Tickets</h1><p className='app-page-subtitle'>Review assigned farmer concerns, filter ticket history, and respond from one focused workspace.</p></header>
                {accessNotice && <p role='status' className='rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>{accessNotice}</p>}

                {/* Search */}
                <div className='relative'>
                    <MdSearch size={18} className='absolute left-3 top-1/2 -translate-y-1/2 opacity-50' color={theme.textColor} />
                    <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search by concern...'
                        className='app-control w-full pl-9 pr-4 py-2.5 text-sm outline-none'
                        style={{ borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                </div>

                <section className='app-card flex flex-col gap-4 p-5' style={{borderColor: theme.secondaryColor}}>
                    <h2 className='font-semibold'>Ticket history filters</h2>
                    <div className='flex flex-wrap gap-3 items-end'>
                        <label className='text-sm flex flex-col gap-1'>Barangay<select className='border rounded-lg p-2' value={barangay} onChange={e => {setBarangay(e.target.value); setExportIds([])}}><option value=''>All barangays</option>{[...new Set(tickets.map(t => t.barangay || 'Unspecified'))].sort().map(b => <option key={b}>{b}</option>)}</select></label>
                        <label className='text-sm flex flex-col gap-1'>Submitted month<input type='month' className='border rounded-lg p-2' value={month} onChange={e => {setMonth(e.target.value); setExportIds([])}} /></label>
                        <Button size='sm' variant='outline' onClick={() => {setBarangay(''); setMonth(''); setSearch(''); setActiveTab('all'); setExportIds([])}}>Reset filters</Button>
                    </div>
                    <p className='text-sm'>{filtered.length} matching tickets · {resolved.length} resolved</p>
                    <div className='flex flex-wrap gap-3 items-center'>
                        <label className='text-sm flex gap-2'><input type='checkbox' disabled={!resolved.length} checked={resolved.length > 0 && chosen.length === resolved.length} onChange={e => setExportIds(e.target.checked ? resolved.map(t => t.id) : [])} />Select all matching resolved concerns</label>
                        <Button size='sm' disabled={!chosen.length || loading} onClick={exportResolved}>Export selected ({chosen.length})</Button>
                    </div>
                    {exportNotice && <p role='status' className='text-sm text-green-800'>{exportNotice}</p>}
                </section>
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
                        <MdConfirmationNumber size={40} color={theme.textColor} />
                        <p className='text-sm' style={{ color: theme.textColor }}>No tickets found</p>
                    </div>
                ) : (
                    <div className='flex flex-col gap-3'>
                        {filtered.map(ticket => (
                            <div key={ticket.id} ref={el => ticketRefs.current[ticket.id] = el}
                                onClick={() => handleView(ticket)}
                            className='app-card flex cursor-pointer flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg'
                                style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}` }}>
                                <div className='flex items-start justify-between gap-2'>
                                    <p className='text-sm font-semibold line-clamp-1' style={{ color: theme.textColor }}>{ticket.title || ticket.concern}</p>
                                    <span className='shrink-0 px-2 py-0.5 rounded-full text-xs font-medium'
                                        style={{ backgroundColor: statusStyle[ticket.status]?.bg, color: statusStyle[ticket.status]?.color }}>
                                        {STATUS_LABEL[ticket.status] ?? ticket.status}
                                    </span>
                                </div>
                                {ticket.status === 'resolved' && <label className='flex items-center gap-2 text-sm' onClick={e => e.stopPropagation()}><input type='checkbox' checked={exportIds.includes(ticket.id)} onChange={e => setExportIds(ids => e.target.checked ? [...ids, ticket.id] : ids.filter(id => id !== ticket.id))} />Select for export</label>}
                                <p className='text-xs'>Barangay: {ticket.barangay || 'Unspecified'}</p>
                                <TicketCapacity ticket={ticket} compact />
                                {ticket.categoryName && <p className='text-xs font-semibold' style={{ color: theme.primaryColor }}>{ticket.categoryName}</p>}
                                {ticket.title && <p className='text-xs opacity-60 line-clamp-1' style={{ color: theme.textColor }}>{ticket.concern}</p>}
                                <p className='text-xs font-medium' style={{ color: theme.primaryColor }}>Assigned to: <AssignedPersonnel ticket={ticket} /></p>
                                {ticket.acceptedAt && <p className='text-xs opacity-60' style={{ color: theme.textColor }}>Accepted: {formatDateTime(ticket.acceptedAt)}</p>}
                                <div className='flex items-center justify-between'>
                                    <p className='text-xs opacity-50' style={{ color: theme.textColor }}>
                                        {ticket.categoryName || 'Agricultural concern'}
                                    </p>
                                    <p className='text-xs opacity-40' style={{ color: theme.textColor }}>{formatDate(ticket.date)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title='Ticket Conversation' mobileMaxH='max-h-[90dvh]'>
                {selected && (
                    <div className='flex w-full min-w-0 flex-col gap-4 sm:w-[min(800px,82vw)]'>
                        {/* Header */}
                        <ConversationHeader ticket={selected} theme={theme} statusLabel={STATUS_LABEL[selected.status] ?? selected.status} statusStyle={statusStyle[selected.status]} />

                        <TicketDetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen(value => !value)} theme={theme}>
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
                        </TicketDetailsToggle>

                        <hr style={{ borderColor: theme.secondaryColor }} />

                        {/* Messages */}
                        <div className='flex flex-col gap-1'>
                            <p className='text-xs opacity-50 mb-1' style={{ color: theme.textColor }}>Conversation</p>
                            {detailLoading ? (
                                <div className='flex justify-center py-6'>
                                    <AiOutlineLoading3Quarters className='animate-spin' size={20} color={theme.primaryColor} />
                                </div>
                            ) : (
                                <div ref={messagesContainerRef} className={`flex flex-col gap-2 ${selected.status === 'resolved' ? 'max-h-85 pb-4' : 'max-h-80'} sm:min-h-100 sm:max-h-52 overflow-y-auto pr-1`}>
                                    {selected.messages?.length === 0 && (
                                        <p className='text-xs opacity-40 text-center py-4' style={{ color: theme.textColor }}>No messages yet</p>
                                    )}
                                    {selected.messages?.map(msg => (
                                        <div key={msg.id} ref={el => msgRefs.current[msg.id] = el}
                                            className='flex flex-col gap-0.5 p-3 rounded-lg relative'
                                            style={{
                                                backgroundColor: msg.senderId === user?.id ? theme.primaryColor + '18' : '#f3f4f6',
                                                alignSelf: msg.senderId === user?.id ? 'flex-end' : 'flex-start',
                                                maxWidth: '85%',
                                                outline: msg.isPinned ? `2px solid ${theme.primaryColor}` : 'none',
                                            }}>
                                            <div className='flex items-center justify-between gap-4'>
                                                <p className='text-xs font-medium opacity-60' style={{ color: theme.textColor }}>
                                                    {msg.senderName} · <span className='capitalize'>{msg.senderRole.replace('_', ' ')}</span>
                                                </p>
                                                <button onClick={(e) => handlePin(e, msg.id)} title={msg.isPinned ? 'Pinned' : 'Pin this message'}
                                                    className='opacity-40 hover:opacity-100 transition-opacity'>
                                                    <MdPushPin size={13} color={msg.isPinned ? theme.primaryColor : theme.textColor}
                                                        style={{ transform: msg.isPinned ? 'none' : 'rotate(45deg)' }} />
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
                                </div>
                            )}
                        </div>

                        {/* Reply Input */}
                        {selected.status !== 'resolved' && (
                            <div className='flex flex-col gap-2 pb-2'>
                                {attachedFile && (
                                    <div className='flex items-center gap-2 px-3 py-2 rounded-lg text-xs'
                                        style={{ backgroundColor: theme.primaryColor + '10', border: `1px solid ${theme.secondaryColor}` }}>
                                        {attachedFile.type.startsWith('image/') ? (
                                            <img src={attachedFile.data} className='w-10 h-10 rounded object-cover' />
                                        ) : (
                                            <MdInsertDriveFile size={20} color={theme.primaryColor} />
                                        )}
                                        <span className='flex-1 truncate' style={{ color: theme.textColor }}>{attachedFile.name}</span>
                                        <button onClick={() => setAttachedFile(null)}><MdClose size={14} color={theme.textColor} /></button>
                                    </div>
                                )}
                                <div className='flex gap-2'>
                                    <input ref={fileInputRef} type='file' className='hidden' onChange={handleFileChange} />
                                    <div className='flex flex-col gap-0.5'>
                                        <button onClick={() => fileInputRef.current?.click()}
                                            className='flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all hover:opacity-80'
                                            style={{ color: theme.primaryColor, borderColor: theme.primaryColor, backgroundColor: theme.primaryColor + '10' }}>
                                            <MdAttachFile size={15} /> Attach
                                        </button>
                                        <p className='text-xs opacity-40 text-center' style={{ color: theme.textColor }}>1MB</p>
                                    </div>
                                    {fileError && <p className='text-xs self-center' style={{ color: theme.dangerColor }}>{fileError}</p>}
                                    <input value={reply} onChange={e => { setReply(e.target.value); setFileError('') }}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendReply()}
                                        placeholder='Type a reply...'
                                        className='flex-1 px-4 py-2.5 text-sm outline-none border rounded-lg'
                                        style={{ borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                    <button onClick={handleSendReply} disabled={!reply.trim() && !attachedFile || sending}
                                        className='px-3 rounded-lg transition-opacity'
                                        style={{ backgroundColor: theme.primaryColor, opacity: (!reply.trim() && !attachedFile) || sending ? 0.5 : 1, borderRadius: theme.borderRadius }}>
                                        {sending
                                            ? <AiOutlineLoading3Quarters className='animate-spin' size={16} color='#fff' />
                                            : <MdSend size={16} color='#fff' />
                                        }
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Status Actions */}
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
                                    <Button size='sm' variant='outline' onClick={() => handleStatusUpdate('cancel_resolution')} loading={updatingStatus}>
                                        Cancel Resolution
                                    </Button>
                                )}
                            </div>
                            <Button size='sm' variant='ghost' onClick={() => setSelected(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Lightbox */}
            {lightboxSrc && (
                <div className='fixed inset-0 z-[60] flex items-center justify-center'
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
        </ExtensionWorkerLayout>
    )
}

export default ExtensionWorkerTickets
