import { useState, useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'
import { MdSearch, MdVisibility, MdToggleOn, MdToggleOff, MdDelete } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

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
import AdminLayout from '../../components/layout/AdminLayout'
import Dialog from '../../components/ui/Dialog'
import Confirmation from '../../components/ui/Confirmation'
import Button from '../../components/ui/Button'
import api from '../../services/api'

const FarmersAccounts = () => {
    const theme = useSelector((state) => state.theme)
    const [farmers, setFarmers] = useState([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [selectedFarmer, setSelectedFarmer] = useState(null)
    const [viewDialog, setViewDialog] = useState(false)
    const [deleteConfirm, setDeleteConfirm] = useState({ open: false, id: null })
    const [toggleConfirm, setToggleConfirm] = useState({ open: false, id: null, isActive: false })

    const fetchFarmers = () => {
        setLoading(true)
        api.get('/users/farmers/').then(res => {
            setFarmers(res.data)
            setLoading(false)
        }).catch(() => setLoading(false))
    }

    useEffect(() => {
        fetchFarmers()
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/admin-updates/`)
        ws.onmessage = (e) => {
            const data = JSON.parse(e.data)
            if (data.type === 'farmer_updated' || data.type === 'new_farmer') fetchFarmers()
        }
        ws.onerror = () => ws.close()
        return () => ws.close()
    }, [])

    const handleView = (farmer) => {
        setSelectedFarmer(farmer)
        setViewDialog(true)
    }

    const handleToggleActive = async () => {
        await api.patch(`/users/farmers/${toggleConfirm.id}/toggle-active/`)
        setToggleConfirm({ open: false, id: null, isActive: false })
        fetchFarmers()
    }

    const handleDelete = async () => {
        await api.delete(`/users/farmers/${deleteConfirm.id}/`)
        setDeleteConfirm({ open: false, id: null })
        fetchFarmers()
    }

    const filtered = farmers.filter(f =>
        `${f.firstName} ${f.lastName} ${f.username} ${f.barangay}`.toLowerCase().includes(search.toLowerCase())
    )
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

    const handleSearch = (val) => { setSearch(val); setPage(1) }

    return (
        <AdminLayout>
            <div className='app-page flex flex-col gap-5'>
                <div className='flex flex-wrap items-end justify-between gap-3'>
                    <header><p className='app-kicker' style={{ color: theme.primaryColor }}>Admin directory</p><h1 className='app-page-title' style={{ color: theme.textColor }}>Farmer Accounts</h1><p className='app-page-subtitle'>Review registered farmers, their barangay, and account status.</p></header>
                    <Button size='sm' variant='outline' onClick={() => exportCSV(
                        ['Name', 'Username', 'Barangay', 'Mobile', 'Status', 'Registered'],
                        filtered.map(f => [
                            `${f.firstName} ${f.lastName}`,
                            f.username,
                            f.barangay,
                            f.mobileNumber,
                            f.isActive ? 'Active' : 'Inactive',
                            new Date(f.date).toLocaleDateString(),
                        ]),
                        'Farmers_Accounts.csv'
                    )}>Export CSV</Button>
                </div>

                {/* Search */}
                <div className='relative'>
                    <MdSearch size={18} className='absolute left-3 top-1/2 -translate-y-1/2 opacity-50' color={theme.textColor} />
                    <input value={search} onChange={e => handleSearch(e.target.value)} placeholder='Search by name, username, barangay...'
                        className='app-control w-full pl-9 pr-4 py-2.5 text-sm outline-none'
                        style={{ borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                </div>

                {/* Table */}
                <div className='app-card overflow-x-auto' style={{ borderColor: theme.secondaryColor }}>
                    <table className='w-full text-sm min-w-[600px]'>
                        <thead style={{ backgroundColor: theme.primaryColor }}>
                            <tr>
                                {['Name', 'Username', 'Barangay', 'Mobile', 'Status', 'Registered', 'Actions'].map(h => (
                                <th key={h} className='px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-white'>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan={7} className='text-center py-8'>
                                    <AiOutlineLoading3Quarters className='animate-spin inline' size={24} color={theme.primaryColor} />
                                </td></tr>
                            ) : filtered.length === 0 ? (
                                <tr><td colSpan={7} className='text-center py-8 opacity-50' style={{ color: theme.textColor }}>No farmers found</td></tr>
                            ) : paginated.map((farmer, i) => (
                                <tr key={farmer.id} style={{ backgroundColor: i % 2 === 0 ? '#fff' : theme.primaryColor + '08' }}>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{farmer.firstName} {farmer.lastName}</td>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{farmer.username}</td>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{farmer.barangay}</td>
                                    <td className='px-4 py-3 whitespace-nowrap' style={{ color: theme.textColor }}>{farmer.mobileNumber}</td>
                                    <td className='px-4 py-3 whitespace-nowrap'>
                                        <span className='px-2 py-1 rounded-full text-xs font-medium'
                                            style={{ backgroundColor: farmer.isActive ? '#dcfce7' : '#fee2e2', color: farmer.isActive ? '#16a34a' : '#dc2626' }}>
                                            {farmer.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </td>
                                    <td className='px-4 py-3 whitespace-nowrap opacity-60' style={{ color: theme.textColor }}>
                                        {new Date(farmer.date).toLocaleDateString()}
                                    </td>
                                    <td className='px-4 py-3 whitespace-nowrap'>
                                        <div className='flex gap-2'>
                                            <button onClick={() => handleView(farmer)} title='View' className='cursor-pointer hover:opacity-70'>
                                                <MdVisibility size={18} color={theme.primaryColor} />
                                            </button>
                                            <button onClick={() => setToggleConfirm({ open: true, id: farmer.id, isActive: farmer.isActive })} title={farmer.isActive ? 'Deactivate' : 'Activate'} className='cursor-pointer hover:opacity-70'>
                                                {farmer.isActive ? <MdToggleOn size={22} color='#16a34a' /> : <MdToggleOff size={22} color='#dc2626' />}
                                            </button>
                                            <button onClick={() => setDeleteConfirm({ open: true, id: farmer.id })} title='Delete' className='cursor-pointer hover:opacity-70'>
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
            <Dialog isOpen={viewDialog} onClose={() => setViewDialog(false)} title='Farmer Details'>
                {selectedFarmer && (
                    <div className='flex flex-col gap-4 text-sm w-full sm:min-w-[280px]'>
                        {/* Avatar + Name + Status */}
                        <div className='flex flex-col items-center gap-2'>
                            {selectedFarmer.profilePicture ? (
                                <img src={selectedFarmer.profilePicture} className='w-16 h-16 rounded-full object-cover' />
                            ) : (
                                <div className='w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold'
                                    style={{ backgroundColor: theme.primaryColor }}>
                                    {selectedFarmer.firstName[0]}{selectedFarmer.lastName[0]}
                                </div>
                            )}
                            <div className='text-center'>
                                <p className='font-semibold text-base' style={{ color: theme.textColor }}>
                                    {selectedFarmer.firstName} {selectedFarmer.lastName}
                                </p>
                                <p className='opacity-50 text-xs' style={{ color: theme.textColor }}>@{selectedFarmer.username}</p>
                            </div>
                            <span className='px-3 py-0.5 rounded-full text-xs font-medium'
                                style={{ backgroundColor: selectedFarmer.isActive ? '#dcfce7' : '#fee2e2', color: selectedFarmer.isActive ? '#16a34a' : '#dc2626' }}>
                                {selectedFarmer.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>

                        <hr style={{ borderColor: theme.secondaryColor }} />

                        {/* Fields */}
                        <div className='grid grid-cols-2 gap-x-6 gap-y-3'>
                            {[
                                ['Barangay', selectedFarmer.barangay],
                                ['Mobile', selectedFarmer.mobileNumber],
                                ['Registered', new Date(selectedFarmer.date).toLocaleDateString()],
                            ].map(([label, value]) => (
                                <div key={label} className='flex flex-col gap-0.5'>
                                    <span className='text-xs opacity-50' style={{ color: theme.textColor }}>{label}</span>
                                    <span className='font-medium' style={{ color: theme.textColor }}>{value}</span>
                                </div>
                            ))}
                        </div>

                        <div className='flex justify-end mt-1'>
                            <Button variant='ghost' onClick={() => setViewDialog(false)}>Close</Button>
                        </div>
                    </div>
                )}
            </Dialog>

            {/* Toggle Active Confirmation */}
            <Confirmation
                isOpen={toggleConfirm.open}
                title={toggleConfirm.isActive ? 'Deactivate Farmer?' : 'Activate Farmer?'}
                message={toggleConfirm.isActive ? 'This farmer will no longer be able to login.' : 'This farmer will be able to login again.'}
                onConfirm={handleToggleActive}
                onCancel={() => setToggleConfirm({ open: false, id: null, isActive: false })}
                confirmText={toggleConfirm.isActive ? 'Deactivate' : 'Activate'}
            />

            {/* Delete Confirmation */}
            <Confirmation
                isOpen={deleteConfirm.open}
                title='Delete Farmer?'
                message='This action cannot be undone. The farmer account will be permanently deleted.'
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm({ open: false, id: null })}
                confirmText='Delete'
            />
        </AdminLayout>
    )
}

export default FarmersAccounts
