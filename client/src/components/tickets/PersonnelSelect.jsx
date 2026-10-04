import { useId } from 'react'
import { useSelector } from 'react-redux'

export default function PersonnelSelect({ workers, positions = [], value, onChange, loading, error, disabled, onRetry, currentName }) {
    const theme = useSelector(state => state.theme)
    const id = useId()
    const available = workers.filter(worker =>
        ['extension_worker', 'lgu_personnel'].includes(worker.role) && worker.isActive !== false && !worker.isPending
    ).sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))
    const selected = available.find(worker => worker.id === value)

    return (
        <div className='flex flex-col gap-2' style={{ color: theme.textColor }}>
            <label htmlFor={id} className='text-sm font-semibold'>Assign to LGU personnel <span aria-hidden='true'>*</span></label>
            <select id={id} value={value || ''} onChange={event => onChange(event.target.value)}
                required disabled={disabled || loading || !!error || available.length === 0}
                aria-describedby={`${id}-help`} aria-invalid={!!error}
                className='w-full rounded-lg border bg-white px-3 py-3 text-sm outline-none focus:ring-2 disabled:opacity-60'
                style={{ borderColor: theme.secondaryColor, '--tw-ring-color': `${theme.primaryColor}40` }}>
                <option value=''>{loading ? 'Loading personnel...' : 'Select responsible personnel'}</option>
                {value && !selected && <option value={value} disabled>{currentName || 'Selected personnel'} (unavailable)</option>}
                {available.map(worker => {
                    const position = positions.find(item => item.id === worker.positionId)?.name
                    return <option key={worker.id} value={worker.id}>{worker.firstName} {worker.lastName}{position ? ` — ${position}` : ''}</option>
                })}
            </select>
            <p id={`${id}-help`} className='text-xs opacity-70'>The selected person will receive this concern and respond through the ticket conversation.</p>
            {error ? <div role='alert' className='text-xs text-red-700'>{error} {onRetry && <button type='button' disabled={disabled} onClick={onRetry} className='font-semibold underline'>Try again</button>}</div>
                : !loading && available.length === 0 && <p role='status' className='text-xs text-amber-800'>No active, approved LGU personnel are available. Please try again later.</p>}
            {selected && <div className='rounded-lg px-3 py-2 text-sm' style={{ backgroundColor: `${theme.primaryColor}12` }}>
                <span className='text-xs opacity-70'>Selected personnel</span>
                <p className='font-semibold'>{selected.firstName} {selected.lastName}{positions.find(item => item.id === selected.positionId)?.name && <span className='font-normal opacity-70'> – {positions.find(item => item.id === selected.positionId)?.name}</span>}</p>
            </div>}
        </div>
    )
}
