import { MdCheckCircle, MdSchedule, MdSupportAgent } from 'react-icons/md'
import AssignedPersonnel from './AssignedPersonnel'

const ConversationHeader = ({ ticket, theme, statusLabel, statusStyle }) => {
    const accepted = ticket.acceptedAt
        ? new Date(ticket.acceptedAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })
        : null

    return (
        <section aria-label='Assigned personnel and ticket status' className='rounded-2xl border bg-white p-4' style={{ borderColor: `${theme.primaryColor}25` }}>
            <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='flex min-w-0 flex-1 items-start gap-3'>
                    <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}><MdSupportAgent size={24} /></span>
                    <div className='min-w-0'>
                        <p className='text-[11px] font-bold uppercase tracking-wider text-slate-500'>Assigned LGU personnel</p>
                        <p className='mt-1 break-words text-sm font-semibold leading-6' style={{ color: theme.textColor }}><AssignedPersonnel ticket={ticket} /></p>
                    </div>
                </div>
                <span className='rounded-full px-3 py-1.5 text-xs font-semibold' style={{ backgroundColor: statusStyle?.bg, color: statusStyle?.color }}>{statusLabel}</span>
            </div>
            <div className='mt-3 flex items-start gap-2 border-t pt-3 text-xs leading-5' style={{ borderColor: `${theme.primaryColor}15`, color: accepted ? '#166534' : '#64748b' }}>
                {accepted ? <MdCheckCircle className='mt-0.5 shrink-0' size={16} /> : <MdSchedule className='mt-0.5 shrink-0' size={16} />}
                <p>{accepted ? <>Accepted on <strong className='font-semibold'>{accepted}</strong></> : ticket.status === 'pending' ? 'Awaiting personnel acceptance' : 'Acceptance time not recorded'}</p>
            </div>
        </section>
    )
}

export default ConversationHeader
