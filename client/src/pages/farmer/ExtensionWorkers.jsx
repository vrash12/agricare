import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { MdSearch, MdSupportAgent } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import FarmerLayout from '../../components/layout/FarmerLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import api from '../../services/api'

export default function FarmerExtensionWorkers() {
    const theme = useSelector(state => state.theme)
    const [workers, setWorkers] = useState([])
    const [positions, setPositions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState(null)
    const fetchWorkers = () => {
        api.get('/users/extension-workers/').then(({ data }) => {
            setWorkers(data.filter(worker => !worker.isPending && worker.isActive !== false))
            setError('')
        }).catch(() => setError('Personnel could not be loaded.')).finally(() => setLoading(false))
    }
    useEffect(() => {
        fetchWorkers()
        api.get('/positions/').then(({ data }) => setPositions(data)).catch(() => {})
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws/admin-updates/`)
        ws.onmessage = fetchWorkers
        ws.onerror = () => ws.close()
        return () => ws.close()
    }, [])
    const positionName = id => positions.find(position => position.id === id)?.name || 'LGU personnel'
    const filtered = workers.filter(worker => `${worker.firstName} ${worker.lastName} ${positionName(worker.positionId)}`.toLowerCase().includes(search.toLowerCase()))
    return <FarmerLayout>
        <div className='mx-auto flex w-full max-w-6xl flex-col gap-5'>
            <div><p className='text-xs font-semibold uppercase tracking-wider' style={{ color: theme.primaryColor }}>Your local support team</p><h1 className='mt-1 text-2xl font-bold' style={{ color: theme.textColor }}>Extension workers</h1><p className='mt-2 text-sm text-slate-600'>Meet your LGU personnel. When you submit a ticket, AgriCare assigns the appropriate person based on your concern category.</p></div>
            <label className='relative'><span className='sr-only'>Search personnel directory</span><MdSearch size={20} className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' /><input value={search} onChange={event => setSearch(event.target.value)} placeholder='Search by name or position...' className='min-h-12 w-full rounded-xl border bg-white pl-10 pr-4 text-sm' style={{ borderColor: theme.secondaryColor }} /></label>
            {error && <p role='alert' className='text-sm text-red-700'>{error} <button onClick={fetchWorkers} className='underline'>Try again</button></p>}
            {loading ? <AiOutlineLoading3Quarters className='mx-auto my-10 animate-spin' size={28} color={theme.primaryColor} />
                : filtered.length === 0 ? <div className='py-12 text-center text-slate-500'><MdSupportAgent size={40} className='mx-auto' /><p className='mt-2'>No personnel found.</p></div>
                    : <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>{filtered.map(worker => <button key={worker.id} onClick={() => setSelected(worker)} className='flex flex-col items-center gap-3 rounded-2xl border bg-white p-6 transition hover:shadow-lg' style={{ borderColor: `${theme.secondaryColor}70` }}>
                        {worker.profilePicture ? <img src={worker.profilePicture} alt='' className='h-16 w-16 rounded-full object-cover' /> : <span className='flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-white' style={{ backgroundColor: theme.primaryColor }}>{worker.firstName?.[0]}{worker.lastName?.[0]}</span>}
                        <span className='text-sm font-semibold' style={{ color: theme.textColor }}>{worker.firstName} {worker.lastName}</span><span className='rounded-full px-3 py-1 text-xs' style={{ backgroundColor: `${theme.primaryColor}15`, color: theme.primaryColor }}>{positionName(worker.positionId)}</span>
                    </button>)}</div>}
        </div>
        <Dialog isOpen={!!selected} onClose={() => setSelected(null)} title='LGU Personnel'>
            {selected && <div className='max-w-sm space-y-3 text-sm' style={{ color: theme.textColor }}><p className='text-lg font-semibold'>{selected.firstName} {selected.lastName}</p><p>{positionName(selected.positionId)}</p><p>Use Submit Ticket and choose your concern category. Your ticket will show the person assigned to assist you.</p><div className='flex justify-end'><Button onClick={() => setSelected(null)}>Close</Button></div></div>}
        </Dialog>
    </FarmerLayout>
}
