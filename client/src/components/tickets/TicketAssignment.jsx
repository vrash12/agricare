import { useEffect, useRef, useState } from 'react'
import PersonnelSelect from './PersonnelSelect'
import Button from '../ui/Button'
import api from '../../services/api'

export default function TicketAssignment({ ticket, onAssigned }) {
    const [workers, setWorkers] = useState([])
    const [positions, setPositions] = useState([])
    const [loading, setLoading] = useState(true)
    const [directoryError, setDirectoryError] = useState('')
    const [draft, setDraft] = useState(null)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const mounted = useRef(false)
    const workerId = draft ?? ticket.extensionWorkerId ?? ''
    const eligible = workers.some(worker => worker.id === workerId && worker.isActive !== false && !worker.isPending && ['extension_worker', 'lgu_personnel'].includes(worker.role))

    const loadPersonnel = () => {
        Promise.allSettled([api.get('/users/extension-workers/'), api.get('/positions/')]).then(([directory, roles]) => {
            if (!mounted.current) return
            if (directory.status === 'fulfilled') setWorkers(directory.value.data)
            else setDirectoryError('Personnel could not be loaded.')
            if (roles.status === 'fulfilled') setPositions(roles.value.data)
            setLoading(false)
        })
    }

    useEffect(() => {
        mounted.current = true
        loadPersonnel()
        return () => { mounted.current = false }
    }, [])

    const saveAssignment = async () => {
        if (!eligible || workerId === ticket.extensionWorkerId || saving) return
        setSaving(true)
        setError('')
        setNotice('')
        try {
            const { data } = await api.patch(`/tickets/${ticket.id}/assignment/`, { extensionWorkerId: workerId })
            if (!mounted.current) return
            onAssigned(data.ticket)
            setDraft(null)
            setNotice(data.message)
        } catch (error) {
            if (mounted.current) setError(error.response?.data?.error || error.response?.data?.detail || 'Assignment could not be saved. Please try again.')
        } finally {
            if (mounted.current) setSaving(false)
        }
    }

    return (
        <section className='rounded-xl border border-slate-200 bg-slate-50 p-4'>
            <PersonnelSelect workers={workers} positions={positions} value={workerId} currentName={ticket.extensionWorkerName}
                onChange={value => { setDraft(value); setError(''); setNotice('') }} loading={loading} error={directoryError}
                disabled={saving} onRetry={() => { setLoading(true); setDirectoryError(''); loadPersonnel() }} />
            <div className='mt-3 flex flex-wrap items-center justify-between gap-3'>
                <p className='text-xs text-slate-500'>Save to notify the assigned person and the farmer.</p>
                <Button onClick={saveAssignment} loading={saving} disabled={loading || !!directoryError || !eligible || workerId === ticket.extensionWorkerId}>Save assignment</Button>
            </div>
            {error && <p role='alert' className='mt-2 text-sm text-red-700'>{error}</p>}
            {notice && <p role='status' className='mt-2 text-sm text-green-800'>{notice}</p>}
        </section>
    )
}
