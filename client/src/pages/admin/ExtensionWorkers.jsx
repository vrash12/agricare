import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { MdSearch, MdVisibility, MdToggleOn, MdToggleOff, MdDelete, MdCheckCircle, MdSettings } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import AdminLayout from '../../components/layout/AdminLayout'
import Dialog from '../../components/ui/Dialog'
import Confirmation from '../../components/ui/Confirmation'
import Button from '../../components/ui/Button'
import SidePanel from '../../components/ui/SidePanel'
import api from '../../services/api'

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

const ExtensionWorkers = () => {
    const theme = useSelector((state) => state.theme)

    const [workers, setWorkers] = useState([])
    const [positions, setPositions] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    const [viewWorker, setViewWorker] = useState(null)
    const [positionDialog, setPositionDialog] = useState({ open: false, id: null, currentPositionId: null })
    const [selectedPosition, setSelectedPosition] = useState('')
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
    const [toggleConfirm, setToggleConfirm] = useState({ open: false, id: null, isActive: false })
    const [approveConfirm, setApproveConfirm] = useState({ open: false, id: null })

    const [positionsOpen, setPositionsOpen] = useState(false)
    const [newPositionName, setNewPositionName] = useState('')
    const [editPosition, setEditPosition] = useState(null)
    const [positionLoading, setPositionLoading] = useState(false)
    const [deletePositionConfirm, setDeletePositionConfirm] = useState({ open: false, id: null })

    const fetchWorkers = () => {
        setLoading(true)
        api.get('/users/extension-workers/').then(res => {
            setWorkers(res.data)
            setLoading(false)
        }).catch(() => setLoading(false))
    }

    const fetchPositions = () => {
        api.get('/positions/').then(res => setPositions(res.data))
    }

    useEffect(() => {
        fetchWorkers()
        fetchPositions()
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/admin-updates/`)
        ws.onmessage = (e) => {
            const data = JSON.parse(e.data)
            if (data.type === 'worker_updated' || data.type === 'new_extension_worker') fetchWorkers()
        }
        ws.onerror = () => ws.close()
        return () => ws.close()
    }, [])

    const getPositionName = (positionId) => positions.find(p => p.id === positionId)?.name ?? 'N/A'

    const filtered = workers.filter(w =>
        `${w.firstName} ${w.lastName} ${w.username}`.toLowerCase().includes(search.toLowerCase())
    )
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

    const handleSearch = (val) => { setSearch(val); setPage(1) }

    const statusStyle = (isPending, isActive) => ({
        backgroundColor: isPending ? '#fef9c3' : isActive ? '#dcfce7' : '#fee2e2',
        color: isPending ? '#ca8a04' : isActive ? '#16a34a' : '#dc2626',
    })

    const statusLabel = (isPending, isActive) => isPending ? 'Pending' : isActive ? 'Active' : 'Inactive'

    const handleToggleActive = async () => {
        await api.patch(`/users/extension-workers/${toggleConfirm.id}/toggle-active/`)
        setToggleConfirm({ open: false, id: null, isActive: false })
        fetchWorkers()
    }

    const handleDelete = async () => {
        await api.delete(`/users/extension-workers/${deleteConfirm.id}/`)
        setDeleteConfirm({ open: false, id: null })
        fetchWorkers()
    }

    const handleApprove = async () => {
        await api.patch(`/users/extension-workers/${approveConfirm.id}/approve/`)
        setApproveConfirm({ open: false, id: null })
        fetchWorkers()
    }

    const handleChangePosition = async () => {
        if (!selectedPosition || selectedPosition === positionDialog.currentPositionId) return
        await api.patch(`/users/extension-workers/${positionDialog.id}/change-position/`, { positionId: selectedPosition })
        setPositionDialog({ open: false, id: null, currentPositionId: null })
        setSelectedPosition('')
        fetchWorkers()
    }

    const handleAddPosition = async () => {
        if (!newPositionName.trim()) return
        setPositionLoading(true)
        await api.post('/positions/', { name: newPositionName.trim() })
        setNewPositionName('')
        fetchPositions()
        setPositionLoading(false)
    }

    const handleEditPosition = async (id) => {
        if (!editPosition.name.trim()) return
        const original = positions.find(p => p.id === id)
        if (original?.name === editPosition.name.trim()) { setEditPosition(null); return }
        setPositionLoading(true)
        await api.patch(`/positions/${id}/`, { name: editPosition.name })
        setEditPosition(null)
        fetchPositions()
        setPositionLoading(false)
    }

    const handleTogglePosition = async (id, isActive) => {
        await api.patch(`/positions/${id}/`, { isActive: !isActive })
        fetchPositions()
    }

    const handleDeletePosition = async () => {
        await api.delete(`/positions/${deletePositionConfirm.id}/`)
        setDeletePositionConfirm({ open: false, id: null })
        fetchPositions()
    }

    return (
        <AdminLayout>
            <div className='flex flex-col gap-4'>
                <div className='flex items-center justify-between'>
                    <h1 className='text-2xl font-bold' style={{ color: theme.textColor }}>Extension Workers</h1>
                    <div className='flex items-center gap-2'>
                        <Button size='sm' variant='outline' onClick={() => exportCSV(
                            ['Name', 'Username', 'Mobile', 'Position', 'Status', 'Registered'],
                            filtered.map(w => [
                                `${w.firstName} ${w.lastName}`,
                                w.username,
                                w.mobileNumber,
                                getPositionName(w.positionId),
                                statusLabel(w.isPending, w.isActive),
                                new Date(w.date).toLocaleDateString(),
                            ]),
                            'Extension_Workers.csv'
                        )}>Export CSV</Button>
                        <Button variant='secondary' onClick={() => setPositionsOpen(true)}>
                            <MdSettings size={16} className='inline mr-1' /> Manage Positions
                        </Button>
                    </div>
                </div>

                <div className='relative'>
                    <MdSearch size={18} className='absolute left-3 top-1/2 -translate-y-1/2 opacity-50' color={theme.textColor} />
                    <input value={search} onChange={e => handleSearch(e.target.value)} placeholder='Search by name, username...'
                        className='w-full pl-9 pr-4 py-2.5 text-sm outline-none border rounded-lg'
                        style={{ borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                </div>

                <div className='rounded-xl shadow-sm overflow-x-auto' style={{ border: `1px solid ${theme.secondaryColor}` }}>
                    <table className='w-full text-sm min-w-[640px]'>
                        <thead style={{ backgroundColor: theme.primaryColor }}>
                            <tr>
                                {['Name', 'Username', 'Mobile', 'Position', 'Status', 'Registered', 'Actions'].map(h => (
                                    <th key={h} className='px-4 py-3 text-left text-white font-medium'>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className='text-center py-8'>
                                    <AiOutlineLoading3Quarters className='animate-spin inline' size={24} color={theme.primaryColor} />
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className='text-center py-8 opacity-50' style={{ color: theme.textColor }}>No extension workers found</td></tr>
                            ) : paginated.map((w, i) => (
                                <tr key={w.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : theme.primaryColor + '08' }}>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{w.firstName} {w.lastName}</td>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{w.username}</td>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{w.mobileNumber}</td>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{getPositionName(w.positionId)}</td>
                                    <td className='px-4 py-3 whitespace-nowrap'>
                                        <span className='px-2 py-1 rounded-full text-xs font-medium' style={statusStyle(w.isPending, w.isActive)}>
                                            {statusLabel(w.isPending, w.isActive)}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 whitespace-nowrap opacity-60' style={{ color: theme.textColor }}>
                                        {new Date(w.date).toLocaleDateString()}
                                    </td>
                                    <td className='px-4 py-3 whitespace-nowrap'>
                                        <div className='flex gap-2'>
                                            <button onClick={() => setViewWorker(w)} title='View' className='cursor-pointer hover:opacity-70'>
                                                <MdVisibility size={18} color={theme.primaryColor} />
                                            </button>
                                            {w.isPending && (
                                                <button onClick={() => setApproveConfirm({ open: true, id: w.id })} title='Approve' className='cursor-pointer hover:opacity-70'>
                                                    <MdCheckCircle size={18} color='#16a34a' />
                                                </button>
                                            )}
                                            {!w.isPending && (
                                                <button onClick={() => setToggleConfirm({ open: true, id: w.id, isActive: w.isActive })} title={w.isActive ? 'Deactivate' : 'Activate'} className='cursor-pointer hover:opacity-70'>
                                                    {w.isActive ? <MdToggleOn size={22} color='#16a34a' /> : <MdToggleOff size={22} color='#dc2626' />}
                                                </button>
                                            )}
                                            <button onClick={() => setDeleteConfirm({ open: true, id: w.id })} title='Delete' className='cursor-pointer hover:opacity-70'>
                                                <MdDelete size={18} color={theme.dangerColor} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className='flex items-center justify-between text-sm flex-wrap gap-2'>
                    <div className='flex items-center gap-2'>
                        <span className='opacity-50' style={{ color: theme.textColor }}>Rows per page:</span>
                        {[10, 50, 100].map(s => (
                            <button key={s} onClick={() => { setPageSize(s); setPage(1) }}
                                className='px-3 py-1 rounded-lg text-sm cursor-pointer'
                                style={{
                                    border: `1px solid ${s === pageSize ? theme.primaryColor : theme.secondaryColor}`,
                                    backgroundColor: s === pageSize ? theme.primaryColor : 'transparent',
                                    color: s === pageSize ? '#fff' : theme.textColor,
                                }}>{s}</button>
                        ))}
                    </div>
                    <div className='flex items-center gap-2'>
                        <span className='opacity-50' style={{ color: theme.textColor }}>
                            {filtered.length === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, filtered.length)}`} of {filtered.length}
                        </span>
                        <div className='flex items-center gap-1'>
                            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                                className='px-3 py-1 rounded-lg text-sm disabled:opacity-30 cursor-pointer'
                                style={{ border: `1px solid ${theme.secondaryColor}`, color: theme.textColor }}>‹</button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                                <button key={p} onClick={() => setPage(p)}
                                    className='px-3 py-1 rounded-lg text-sm cursor-pointer'
                                    style={{
                                        border: `1px solid ${p === page ? theme.primaryColor : theme.secondaryColor}`,
                                        backgroundColor: p === page ? theme.primaryColor : 'transparent',
                                        color: p === page ? '#fff' : theme.textColor,
                                    }}>{p}</button>
                            ))}
                            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                                className='px-3 py-1 rounded-lg text-sm disabled:opacity-30 cursor-pointer'
                                style={{ border: `1px solid ${theme.secondaryColor}`, color: theme.textColor }}>›</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* View Dialog */}
            <Dialog isOpen={!!viewWorker} onClose={() => setViewWorker(null)} title='Extension Worker Details'>
                {viewWorker && (
                    <div className='flex flex-col gap-4 text-sm w-full sm:min-w-[280px]'>
                        <div className='flex flex-col items-center gap-2'>
                            {viewWorker.profilePicture ? (
                                <img src={viewWorker.profilePicture} className='w-16 h-16 rounded-full object-cover' />
                            ) : (
                                <div className='w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold'
                                    style={{ backgroundColor: theme.primaryColor }}>
                                    {viewWorker.firstName[0]}{viewWorker.lastName[0]}
                                </div>
                            )}
                            <div className='text-center'>
                                <p className='font-semibold text-base' style={{ color: theme.textColor }}>{viewWorker.firstName} {viewWorker.lastName}</p>
                                <p className='opacity-50 text-xs' style={{ color: theme.textColor }}>@{viewWorker.username}</p>
                            </div>
                            <span className='px-3 py-0.5 rounded-full text-xs font-medium' style={statusStyle(viewWorker.isPending, viewWorker.isActive)}>
                                {statusLabel(viewWorker.isPending, viewWorker.isActive)}
                            </span>
                        </div>

                        <hr style={{ borderColor: theme.secondaryColor }} />

                        <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
                            {[
                                ['Mobile', viewWorker.mobileNumber],
                                ['Position', getPositionName(viewWorker.positionId)],
                                ['Registered', new Date(viewWorker.date).toLocaleDateString()],
                            ].map(([label, value]) => (
                                <div key={label} className='flex flex-col gap-0.5'>
                                    <span className='text-xs opacity-50' style={{ color: theme.textColor }}>{label}</span>
                                    <span className='font-medium' style={{ color: theme.textColor }}>{value}</span>
                                </div>
                            ))}
                        </div>

                        <div className='flex justify-end gap-2 mt-1'>
                            {viewWorker.isPending ? (
                                <Button variant='secondary' onClick={() => {
                                    setViewWorker(null)
                                    setApproveConfirm({ open: true, id: viewWorker.id })
                                }}>Approve</Button>
                            ) : (
                                <Button variant='secondary' onClick={() => {
                                    setPositionDialog({ open: true, id: viewWorker.id, currentPositionId: viewWorker.positionId })
                                    setSelectedPosition(viewWorker.positionId || '')
                                    setViewWorker(null)
                                }}>Change Position</Button>
                            )}
                            <Button variant='ghost' onClick={() => setViewWorker(null)}>Close</Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Change Position Dialog */}
            <Dialog isOpen={positionDialog.open} onClose={() => setPositionDialog({ open: false, id: null, currentPositionId: null })} title='Change Position'>
                <div className='flex flex-col gap-4 w-full sm:min-w-[260px]'>
                    <select value={selectedPosition} onChange={e => setSelectedPosition(e.target.value)}
                        className='w-full px-4 py-2.5 text-sm outline-none border rounded-lg'
                        style={{ borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }}>
                        <option value={positionDialog.currentPositionId} disabled>
                            {getPositionName(positionDialog.currentPositionId)} (current)
                        </option>
                        {positions.filter(p => p.id !== positionDialog.currentPositionId).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                    <div className='flex justify-end gap-2'>
                        <Button variant='ghost' onClick={() => setPositionDialog({ open: false, id: null, currentPositionId: null })}>Cancel</Button>
                        <Button onClick={handleChangePosition} disabled={!selectedPosition || selectedPosition === positionDialog.currentPositionId}>Save</Button>
                    </div>
                </div>
            </Dialog>

            {/* Confirmations */}
            <Confirmation isOpen={approveConfirm.open} title='Approve Extension Worker?'
                message='This extension worker will be able to login and handle tickets.'
                onConfirm={handleApprove} onCancel={() => setApproveConfirm({ open: false, id: null })} confirmText='Approve' />

            <Confirmation isOpen={toggleConfirm.open}
                title={toggleConfirm.isActive ? 'Deactivate Extension Worker?' : 'Activate Extension Worker?'}
                message={toggleConfirm.isActive ? 'This worker will no longer be able to login.' : 'This worker will be able to login again.'}
                onConfirm={handleToggleActive} onCancel={() => setToggleConfirm({ open: false, id: null, isActive: false })}
                confirmText={toggleConfirm.isActive ? 'Deactivate' : 'Activate'} />

            <Confirmation isOpen={deleteConfirm.open} title='Delete Extension Worker?'
                message='This action cannot be undone. The extension worker account will be permanently deleted.'
                onConfirm={handleDelete} onCancel={() => setDeleteConfirm({ open: false, id: null })} confirmText='Delete' />

            {/* Manage Positions SidePanel */}
            <SidePanel isOpen={positionsOpen} onClose={() => setPositionsOpen(false)} title='Manage Positions'>
                <div className='flex gap-2'>
                    <input value={newPositionName} onChange={e => setNewPositionName(e.target.value)}
                        placeholder='New position name'
                        className='flex-1 px-3 py-2 text-sm outline-none border'
                        style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                    <Button onClick={handleAddPosition} loading={positionLoading} size='sm'>Add</Button>
                </div>

                {positions.length === 0 ? (
                    <p className='text-sm opacity-50 text-center' style={{ color: theme.textColor }}>No positions yet</p>
                ) : positions.map(p => (
                    <div key={p.id} className='flex flex-col gap-2 p-3 rounded-xl'
                        style={{ border: `1px solid ${theme.secondaryColor}`, backgroundColor: theme.primaryColor + '08' }}>
                        {editPosition?.id === p.id ? (
                            <>
                                <input value={editPosition.name} onChange={e => setEditPosition({ ...editPosition, name: e.target.value })}
                                    className='w-full px-2 py-1 text-sm outline-none border'
                                    style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                                <div className='flex items-center justify-between'>
                                    <span className='text-xs px-2 py-0.5 rounded-full'
                                        style={{ backgroundColor: p.isActive ? '#dcfce7' : '#fee2e2', color: p.isActive ? '#16a34a' : '#dc2626' }}>
                                        {p.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                    <div className='flex items-center gap-2'>
                                        <button onClick={() => setEditPosition(null)} className='cursor-pointer opacity-60'>
                                            <MdDelete size={16} color={theme.dangerColor} />
                                        </button>
                                        <button onClick={() => handleEditPosition(p.id)} className='cursor-pointer' style={{ color: theme.primaryColor }}>
                                            <MdCheckCircle size={18} />
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className='flex items-center gap-2'>
                                <span className='flex-1 text-sm font-medium truncate' style={{ color: theme.textColor }}>{p.name}</span>
                                <span className='text-xs px-2 py-0.5 rounded-full flex-shrink-0'
                                    style={{ backgroundColor: p.isActive ? '#dcfce7' : '#fee2e2', color: p.isActive ? '#16a34a' : '#dc2626' }}>
                                    {p.isActive ? 'Active' : 'Inactive'}
                                </span>
                                <button onClick={() => setEditPosition({ id: p.id, name: p.name })} className='cursor-pointer opacity-60 hover:opacity-100 flex-shrink-0'>
                                    <MdSettings size={16} color={theme.primaryColor} />
                                </button>
                                <button onClick={() => handleTogglePosition(p.id, p.isActive)} className='cursor-pointer flex-shrink-0'>
                                    {p.isActive ? <MdToggleOn size={22} color='#16a34a' /> : <MdToggleOff size={22} color='#dc2626' />}
                                </button>
                                <button onClick={() => setDeletePositionConfirm({ open: true, id: p.id })} className='cursor-pointer hover:opacity-70 flex-shrink-0'>
                                    <MdDelete size={18} color={theme.dangerColor} />
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </SidePanel>

            <Confirmation isOpen={deletePositionConfirm.open} title='Delete Position?'
                message='This action cannot be undone.'
                onConfirm={handleDeletePosition} onCancel={() => setDeletePositionConfirm({ open: false, id: null })} confirmText='Delete' />
        </AdminLayout>
    )
}

export default ExtensionWorkers
