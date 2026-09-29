import { MdGroups, MdWarningAmber } from 'react-icons/md'

export default function TicketCapacity({ ticket, compact = false }) {
    const capacity = ticket?.capacity
    if (!capacity) return null
    const { count, limit, remaining, status } = capacity
    const crowded = status === 'near' || status === 'full'
    const full = status === 'full'
    if (!crowded) return <p className='flex items-center gap-1.5 text-xs text-slate-600'><MdGroups size={16} aria-hidden='true' />{count} / {limit} farmers</p>
    return <div role='status' className={`rounded-lg border ${compact ? 'px-3 py-2 text-xs' : 'p-3 text-sm'} ${full ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
        <p className='flex items-center gap-1.5 font-semibold'><MdWarningAmber size={18} className='shrink-0' aria-hidden='true' />{full ? 'Ticket full' : 'Ticket nearing capacity'} — {count} / {limit} farmers</p>
        {!compact && <p className='mt-1'>{full
            ? 'The participant limit has been reached. New farmers must create a separate ticket. Existing participants can continue this conversation.'
            : `Many farmers are already on this ticket. Only ${remaining} ${remaining === 1 ? 'place remains' : 'places remain'} before the ${limit}-farmer limit is reached.`}</p>}
    </div>
}
