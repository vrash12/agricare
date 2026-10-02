import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { MdSearch, MdMenuBook, MdPushPin, MdSend, MdAttachFile, MdClose, MdInsertDriveFile } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import FarmerLayout from '../../components/layout/FarmerLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import api from '../../services/api'
import TicketCapacity from '../../components/tickets/TicketCapacity'
import KnowledgeSearch from '../../components/knowledge/KnowledgeSearch'

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
    const d = new Date(iso)
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const FarmerKnowledgeRepository = () => {
    const theme = useSelector((state) => state.theme)
    const { user } = useSelector((state) => state.auth)
    const location = useLocation()
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [topTab, setTopTab] = useState('all')
    const [activeTab, setActiveTab] = useState('all')
    const [selected, setSelected] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [visits, setVisits] = useState(0)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [attachedFile, setAttachedFile] = useState(null)
    const [fileError, setFileError] = useState('')
    const [error, setError] = useState('')
    const [lightboxSrc, setLightboxSrc] = useState(null)
    const messagesContainerRef = useRef(null)
    const wsRef = useRef(null)
    const selectedIdRef = useRef(null)
    const refetchRef = useRef(null)
    const ticketRefs = useRef({})
    const fileInputRef = useRef(null)
    const msgRefs = useRef({})

    const fetchTickets = () => {
        api.get('/tickets/', { params: { repository: '1' } }).then(res => {
            setTickets(res.data)
            setError('')
            setLoading(false)
        }).catch(() => { setError('Unable to load conversations. Please try again.'); setLoading(false) })
    }

    useEffect(() => {
        api.post('/tickets/visits/').then(() => {
            api.get('/tickets/visits/').then(r => setVisits(r.data.visits))
        })
        fetchTickets()
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const refresh = setInterval(() => { if (!document.hidden) fetchTickets() }, 30000)
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/ticket-updates/`)
        ws.onmessage = () => fetchTickets()
        ws.onerror = () => ws.close()
        return () => { clearInterval(refresh); ws.close() }
    }, [])

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

    const topFiltered = topTab === 'resolved'
        ? tickets.filter(t => t.status === 'resolved')
        : topTab === 'current' ? tickets.filter(t => t.status !== 'resolved') : tickets

    const sorted = [...topFiltered].sort((a, b) => new Date(b.date) - new Date(a.date))

    const filtered = sorted.filter(t => {
        const matchTab = activeTab === 'all' || t.status === activeTab
        const matchSearch = `${t.title || ""} ${t.concern} ${t.extensionWorkerName} ${t.categoryName || ""} ${t.answerSearchText || ""}`.toLowerCase().includes(search.toLowerCase())
        return matchTab && matchSearch
    })

    async function handleView(ticket) {
        setSelected({ ...ticket, messages: [] })
        setReply('')
        setAttachedFile(null)
        setFileError('')
        setDetailLoading(true)
        try {
            const res = await api.get(`/tickets/${ticket.id}/`)
            setSelected(res.data)
        } catch {
            setSelected(null)
            setError('Unable to open this conversation. Please try again.')
        } finally {
            setDetailLoading(false)
        }
    }

    const refetchSelected = async (ticketId) => {
        const res = await api.get(`/tickets/${ticketId}/`)
        setSelected(current => current?.id === ticketId ? res.data : current)
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
        const refresh = setInterval(() => {
            if (!document.hidden && selectedIdRef.current) refetchRef.current(selectedIdRef.current).catch(() => {})
        }, 10000)
        return () => { clearInterval(refresh); ws.close(); wsRef.current = null }
    }, [selected?.id])

    const scrollToBottom = () => {
        requestAnimationFrame(() => {
            if (messagesContainerRef.current) messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
        })
    }

    useEffect(() => { scrollToBottom() }, [selected?.messages])

    const handleSendReply = async () => {
        if (sending || (!reply.trim() && !attachedFile)) return
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
            await refetchSelected(selected.id)
            fetchTickets()
            setFileError('')
            setTimeout(() => scrollToBottom(), 300)
        } catch (err) {
            setFileError(err.response?.data?.error || 'Unable to send your reply. Please try again.')
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

    return (
        <FarmerLayout>
            <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
                <KnowledgeSearch />
                <div className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                    <div><p className='text-xs font-semibold uppercase tracking-[0.16em]' style={{ color: theme.primaryColor }}>Your support space</p><h1 className='mt-1 text-2xl font-bold' style={{ color: theme.textColor }}>Conversations & tickets</h1><p className='mt-1 text-sm opacity-60' style={{ color: theme.textColor }}>Follow your concerns and continue conversations with extension workers.</p></div>
                    <span className='flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}><MdMenuBook size={14} /> {visits} knowledge visit{visits !== 1 ? 's' : ''}</span>
                </div>

                {/* Search */}
                <div className='relative'>
                    <MdSearch size={18} className='absolute left-3 top-1/2 -translate-y-1/2 opacity-50' color={theme.textColor} />
                    <input value={search} onChange={e => setSearch(e.target.value)} aria-label='Search past solutions and conversations' placeholder='Search concerns, past solutions, category or LGU personnel...'
                        className='w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:ring-2'
                        style={{ borderColor: `${theme.secondaryColor}80`, color: theme.textColor, '--tw-ring-color': `${theme.primaryColor}35` }} />
                </div>

                {/* Top-level Tabs */}
                <div className='flex flex-wrap gap-2 rounded-xl p-1' style={{ backgroundColor: `${theme.primaryColor}08` }}>
                    {[['all', 'All conversations'], ['current', 'Current conversations'], ['resolved', 'Past solutions']].map(([tab, label]) => (
                        <button key={tab} onClick={() => { setTopTab(tab); setActiveTab('all') }}
                            className='rounded-lg px-4 py-2 text-xs font-semibold transition-all'
                            style={{
                                backgroundColor: topTab === tab ? theme.primaryColor : theme.primaryColor + '18',
                                color: topTab === tab ? '#fff' : theme.primaryColor,
                            }}>
                            {label}
                        </button>
                    ))}
                </div>

                {/* Status Tabs */}
                <div className='flex gap-2 overflow-x-auto pb-1'>
                    {STATUS_TABS.map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className='whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all'
                            style={{
                                backgroundColor: activeTab === tab ? theme.primaryColor : theme.primaryColor + '18',
                                color: activeTab === tab ? '#fff' : theme.primaryColor,
                            }}>
                            {STATUS_LABEL[tab]}
                        </button>
                    ))}
                </div>

                {error && <div role='alert' className='rounded-xl bg-red-50 p-3 text-sm text-red-700'>{error} <button onClick={fetchTickets} className='font-semibold underline'>Try again</button></div>}
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
                            <div key={ticket.id} ref={el => ticketRefs.current[ticket.id] = el}
                                onClick={() => handleView(ticket)}
                                className='group flex cursor-pointer flex-col gap-3 rounded-xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md'
                                style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}70` }}>
                                <div className='flex items-start justify-between gap-2'>
                                    <p className='line-clamp-1 text-sm font-semibold transition-colors group-hover:underline' style={{ color: theme.textColor }}>{ticket.title || ticket.concern}</p>
                                    <span className='shrink-0 px-2 py-0.5 rounded-full text-xs font-medium'
                                        style={{ backgroundColor: statusStyle[ticket.status]?.bg, color: statusStyle[ticket.status]?.color }}>
                                        {STATUS_LABEL[ticket.status] ?? ticket.status}
                                    </span>
                                </div>
                                {ticket.solution && <div className='rounded-lg bg-green-50 p-3 text-sm text-green-950'><p className='text-xs font-semibold'>LGU answer</p><p className='mt-1 line-clamp-3 whitespace-pre-wrap'>{ticket.solution}</p></div>}
                                <button type='button' onClick={event => { event.stopPropagation(); handleView(ticket) }} className='self-start rounded-lg px-3 py-2 text-sm font-semibold' style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}>{ticket.status === 'resolved' ? 'View solution / Continue conversation' : 'Continue conversation'}</button>
                                <TicketCapacity ticket={ticket} compact />
                                {ticket.categoryName && <p className='text-xs font-semibold' style={{ color: theme.primaryColor }}>{ticket.categoryName}</p>}
                                {ticket.title && <p className='text-xs opacity-60 line-clamp-1' style={{ color: theme.textColor }}>{ticket.concern}</p>}
                                <div className='flex items-center justify-between'>
                                    <p className='text-xs font-medium' style={{ color: theme.primaryColor }}>
                                        Assigned to: {ticket.extensionWorkerName || 'Unassigned'}
                                    </p>
                                    <p className='text-xs opacity-40' style={{ color: theme.textColor }}>
                                        {formatDate(ticket.date)}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Detail Dialog */}
            <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title='Ticket Details' mobileMaxH='max-h-[120vh]'>
                {selected && (
                    <div className='flex flex-col gap-4 w-full sm:w-[min(800px,90vw)] sm:min-w-[600px]'>
                        {/* Header */}
                        <div className='flex items-start justify-between gap-3'>
                            <div className='flex flex-col gap-0.5'>
                                <p className='text-xs opacity-50' style={{ color: theme.textColor }}>Assigned to</p>
                                <p className='text-sm font-medium' style={{ color: theme.textColor }}>{selected.extensionWorkerName || 'Unassigned'}</p>
                                <p className='text-xs opacity-60' style={{ color: theme.textColor }}>Contact your assigned personnel in the conversation below.</p>
                            </div>
                            <span className='shrink-0 px-2 py-0.5 rounded-full text-xs font-medium'
                                style={{ backgroundColor: statusStyle[selected.status]?.bg, color: statusStyle[selected.status]?.color }}>
                                {STATUS_LABEL[selected.status] ?? selected.status}
                            </span>
                        </div>

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
                                <div ref={messagesContainerRef} className='flex flex-col gap-2 max-h-80 sm:min-h-100 sm:max-h-60 overflow-y-auto pr-1'>
                                    {selected.messages?.map(msg => (
                                        <div key={msg.id} ref={el => msgRefs.current[msg.id] = el}
                                            className='flex flex-col gap-0.5 p-3 rounded-lg'
                                            style={{
                                                backgroundColor: msg.senderId === user?.id ? theme.primaryColor + '18' : '#f3f4f6',
                                                alignSelf: msg.senderId === user?.id ? 'flex-end' : 'flex-start',
                                                maxWidth: '85%',
                                            }}>
                                            <p className='text-xs font-medium opacity-60' style={{ color: theme.textColor }}>
                                                {msg.senderName} · <span className='capitalize'>{msg.senderRole.replace('_', ' ')}</span>
                                            </p>
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

                        {/* Reply — only for participants */}
                        {(selected.farmerId === user?.id || selected.participants?.includes(user?.id)) && (
                            <div className='flex flex-col gap-2'>
                                {selected.status === 'resolved' && <p className='rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>Need more help with this solution? Send a follow-up below to reopen this ticket for your assigned LGU personnel. Your previous conversation will be kept.</p>}
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
                                    <button onClick={handleSendReply} disabled={(!reply.trim() && !attachedFile) || sending}
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

                        {/* Close */}
                        <div className='flex justify-between items-center'>
                            {selected.status === 'waiting_for_feedback' && selected.participants?.[0] === user?.id && (
                                <Button size='sm' onClick={async () => {
                                    try {
                                        await api.patch(`/tickets/${selected.id}/status/`, { status: 'resolved' })
                                        await refetchSelected(selected.id)
                                        fetchTickets()
                                    } catch { setFileError('Unable to confirm resolution. Please try again.') }
                                }} loading={sending}>
                                    Confirm Resolved
                                </Button>
                            )}
                            <button onClick={() => setSelected(null)}
                                className='ml-auto px-4 py-2 text-sm font-medium opacity-60 hover:opacity-100 transition-opacity'
                                style={{ color: theme.textColor }}>
                                Close
                            </button>
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
        </FarmerLayout>
    )
}

export default FarmerKnowledgeRepository
