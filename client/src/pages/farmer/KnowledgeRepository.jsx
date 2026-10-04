import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { useLocation } from 'react-router-dom'
import { MdSearch, MdMenuBook, MdConfirmationNumber, MdPushPin, MdSend, MdAttachFile, MdClose, MdInsertDriveFile } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import FarmerLayout from '../../components/layout/FarmerLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import api from '../../services/api'
import TicketCapacity from '../../components/tickets/TicketCapacity'
import KnowledgeSearch from '../../components/knowledge/KnowledgeSearch'
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
    const d = new Date(iso)
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const formatDateTime = (iso) => {
    if (!iso) return ''
    return new Date(iso).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
}

const FarmerKnowledgeRepository = ({ ticketOnly = false }) => {
    const theme = useSelector((state) => state.theme)
    const { user } = useSelector((state) => state.auth)
    const location = useLocation()
    const [tickets, setTickets] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [topTab, setTopTab] = useState('all')
    const [activeTab, setActiveTab] = useState('all')
    const [selected, setSelected] = useState(null)
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [detailLoading, setDetailLoading] = useState(false)
    const [visits, setVisits] = useState(0)
    const [reply, setReply] = useState('')
    const [sending, setSending] = useState(false)
    const [joining, setJoining] = useState(false)
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

    const isMember = (ticket) => ticket?.farmerId === user?.id || !!ticket?.participants?.includes(user?.id)

    const topFiltered = topTab === 'resolved'
        ? tickets.filter(t => isMember(t) && t.status === 'resolved')
        : topTab === 'my' ? tickets.filter(isMember) : tickets

    const sorted = [...topFiltered].sort((a, b) => new Date(b.date) - new Date(a.date))

    const filtered = sorted.filter(t => {
        const matchTab = activeTab === 'all' || t.status === activeTab
        const matchSearch = `${t.title || ""} ${t.concern} ${t.extensionWorkerName} ${t.categoryName || ""} ${t.farmerName || ""} ${t.barangay || ""} ${t.answerSearchText || ""}`.toLowerCase().includes(search.toLowerCase())
        return matchTab && matchSearch
    })

    async function handleView(ticket) {
        setDetailsOpen(false)
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

    const handleJoin = async () => {
        if (joining || !selected) return
        setJoining(true)
        setFileError('')
        try {
            await api.post(`/tickets/${selected.id}/join/`)
            await refetchSelected(selected.id)
            fetchTickets()
        } catch (err) {
            setFileError(err.response?.data?.error || err.response?.data?.detail || 'Unable to join this conversation. Please try again.')
        } finally {
            setJoining(false)
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
            <div className='app-page flex flex-col gap-6'>
                {!ticketOnly && <KnowledgeSearch />}
                <div className='flex flex-col gap-4 rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-white p-5 md:p-6 sm:flex-row sm:items-end sm:justify-between'>
                    <div><p className='app-kicker flex items-center gap-2 text-blue-700'><MdConfirmationNumber size={15} /> Farmer support</p><h1 className='app-page-title' style={{ color: theme.textColor }}>Ticketing System</h1><p className='app-page-subtitle'>Track concerns, join shared conversations, and continue messages with the assigned LGU personnel.</p></div>
                    {!ticketOnly && <span className='flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}><MdMenuBook size={14} /> {visits} knowledge visit{visits !== 1 ? 's' : ''}</span>}
                </div>

                {/* Search */}
                <div className='relative'>
                    <MdSearch size={18} className='absolute left-3 top-1/2 -translate-y-1/2 opacity-50' color={theme.textColor} />
                    <input value={search} onChange={e => setSearch(e.target.value)} aria-label='Search past solutions and conversations' placeholder='Search concerns, past solutions, category or LGU personnel...'
                        className='app-control w-full bg-white py-3 pl-10 pr-4 text-sm outline-none transition focus:ring-2'
                        style={{ borderColor: `${theme.secondaryColor}80`, color: theme.textColor, '--tw-ring-color': `${theme.primaryColor}35` }} />
                </div>

                {/* Top-level Tabs */}
                <div className='flex flex-wrap gap-1.5 rounded-2xl border p-1.5' style={{ borderColor: `${theme.primaryColor}18`, backgroundColor: `${theme.primaryColor}06` }}>
                    {[['all', 'All Tickets'], ['my', 'My Tickets'], ['resolved', 'My Resolved']].map(([tab, label]) => (
                        <button key={tab} onClick={() => { setTopTab(tab); setActiveTab('all') }}
                            className='rounded-xl px-4 py-2.5 text-xs font-semibold transition-all hover:-translate-y-0.5'
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
                                className='app-card group flex cursor-pointer flex-col gap-3 p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg'
                                style={{ backgroundColor: '#fff', border: `1px solid ${theme.secondaryColor}70` }}>
                                <div className='flex items-start justify-between gap-2'>
                                    <p className='line-clamp-1 text-sm font-semibold transition-colors group-hover:underline' style={{ color: theme.textColor }}>{ticket.title || ticket.concern}</p>
                                    <span className='shrink-0 px-2 py-0.5 rounded-full text-xs font-medium'
                                        style={{ backgroundColor: statusStyle[ticket.status]?.bg, color: statusStyle[ticket.status]?.color }}>
                                        {STATUS_LABEL[ticket.status] ?? ticket.status}
                                    </span>
                                </div>
                                {ticket.solution && <div className='rounded-lg bg-green-50 p-3 text-sm text-green-950'><p className='text-xs font-semibold'>LGU answer</p><p className='mt-1 line-clamp-3 whitespace-pre-wrap'>{ticket.solution}</p></div>}
                                <button type='button' onClick={event => { event.stopPropagation(); handleView(ticket) }} className='self-start rounded-lg px-3 py-2 text-sm font-semibold' style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}>{!isMember(ticket) ? 'View conversation / Join' : ticket.status === 'resolved' ? 'View solution / Continue conversation' : 'Continue conversation'}</button>
                                <TicketCapacity ticket={ticket} compact />
                                {ticket.categoryName && <p className='text-xs font-semibold' style={{ color: theme.primaryColor }}>{ticket.categoryName}</p>}
                                {ticket.title && <p className='text-xs opacity-60 line-clamp-1' style={{ color: theme.textColor }}>{ticket.concern}</p>}
                                {ticket.farmerName && <p className='text-xs opacity-70' style={{ color: theme.textColor }}>Submitted by: {ticket.farmerId === user?.id ? 'You' : ticket.farmerName}{ticket.barangay ? ` · ${ticket.barangay}` : ''}</p>}
                                <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3' style={{ borderColor: `${theme.secondaryColor}35` }}>
                                    <p className='text-xs font-medium' style={{ color: theme.primaryColor }}>
                                        Assigned to: <AssignedPersonnel ticket={ticket} />
                                    </p>
                                    {ticket.acceptedAt && <p className='text-xs opacity-60' style={{ color: theme.textColor }}>Accepted: {formatDateTime(ticket.acceptedAt)}</p>}
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
            <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title='Ticket Conversation' mobileMaxH='max-h-[90dvh]'>
                {selected && (
                    <div className='flex w-full min-w-0 flex-col gap-4 sm:w-[min(800px,82vw)]'>
                        {/* Header */}
                        <ConversationHeader ticket={selected} theme={theme} statusLabel={STATUS_LABEL[selected.status] ?? selected.status} statusStyle={statusStyle[selected.status]} />

                        <TicketDetailsToggle open={detailsOpen} onToggle={() => setDetailsOpen(value => !value)} theme={theme}>
                            <TicketCapacity ticket={selected} />
                            {selected.categoryName && <p className='text-sm' style={{ color: theme.textColor }}><strong>Category:</strong> {selected.categoryName}</p>}
                            {selected.farmerName && <p className='text-sm' style={{ color: theme.textColor }}><strong>Submitted by:</strong> {selected.farmerId === user?.id ? 'You' : selected.farmerName}{selected.barangay ? ` · ${selected.barangay}` : ''}</p>}
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
                            ) : selected.messages?.length === 0 ? (
                                <p className='text-xs opacity-40 text-center py-4' style={{ color: theme.textColor }}>No messages yet</p>
                            ) : (
                                <div ref={messagesContainerRef} className='conversation-messages flex min-h-40 max-h-80 flex-col gap-3 overflow-y-auto rounded-xl bg-slate-50 p-3 sm:max-h-96'>
                                    {selected.messages?.map(msg => (
                                        <div key={msg.id} ref={el => msgRefs.current[msg.id] = el}
                                            className='flex flex-col gap-1 break-words rounded-2xl p-3 shadow-sm'
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
                                            <p className='text-[11px] opacity-60 text-right' style={{ color: theme.textColor }}>{formatDateTime(msg.date)}</p>
                                        </div>
                                    ))}

                                </div>
                            )}
                        </div>

                        {/* Join — other farmers with the same concern can enter the conversation */}
                        {!detailLoading && !isMember(selected) && (
                            <div className='flex flex-col gap-2 rounded-lg p-3' style={{ backgroundColor: theme.primaryColor + '10' }}>
                                <p className='text-sm' style={{ color: theme.textColor }}>
                                    {selected.capacity?.status === 'full'
                                        ? 'This conversation is full. Submit a new ticket if you need help with the same concern.'
                                        : 'Have the same concern? Join this conversation to ask the assigned LGU personnel and receive updates.'}
                                </p>
                                {fileError && <p className='text-xs' style={{ color: theme.dangerColor }}>{fileError}</p>}
                                {selected.capacity?.status !== 'full' && (
                                    <Button size='sm' onClick={handleJoin} loading={joining} className='self-start'>Join this conversation</Button>
                                )}
                            </div>
                        )}

                        {/* Reply — only for participants */}
                        {isMember(selected) && (
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
                                        aria-label='Your reply' className='app-control min-w-0 flex-1 px-3 py-2.5 text-sm outline-none'
                                        style={{ borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                    <button onClick={handleSendReply} disabled={(!reply.trim() && !attachedFile) || sending} aria-label='Send reply'
                                        className='min-h-11 shrink-0 px-3 rounded-lg transition-opacity'
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
                            {selected.status === 'waiting_for_feedback' && (selected.farmerId || selected.participants?.[0]) === user?.id && (
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
