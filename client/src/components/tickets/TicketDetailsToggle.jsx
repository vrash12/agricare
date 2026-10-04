import { MdInfoOutline } from 'react-icons/md'

const TicketDetailsToggle = ({ open, onToggle, theme, children }) => (
    <div className='flex flex-col gap-3'>
        <button
            type='button'
            aria-expanded={open}
            onClick={onToggle}
            className='flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-sm font-semibold transition hover:-translate-y-0.5 hover:shadow-sm'
            style={{ borderColor: `${theme.secondaryColor}80`, color: theme.primaryColor, backgroundColor: `${theme.primaryColor}08` }}>
            <span className='flex items-center gap-2'><MdInfoOutline size={18} />{open ? 'Hide Ticket Details' : 'View Ticket Details'}</span>
            <span aria-hidden='true' className='text-lg leading-none'>{open ? '−' : '+'}</span>
        </button>
        {open && <section aria-label='Ticket details' className='flex flex-col gap-3 rounded-xl border bg-slate-50 p-4' style={{ borderColor: `${theme.secondaryColor}65` }}>
            {children}
        </section>}
    </div>
)

export default TicketDetailsToggle
