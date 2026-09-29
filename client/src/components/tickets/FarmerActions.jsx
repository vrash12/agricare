import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { MdSearch, MdConfirmationNumber } from 'react-icons/md'

export default function FarmerActions() {
    const navigate = useNavigate()
    const theme = useSelector(state => state.theme)
    return <nav aria-label='Farmer quick actions' className='mx-auto mb-5 grid w-full max-w-6xl grid-cols-2 gap-3'>
        <button onClick={() => navigate('/farmer/knowledge-repository', { state: { focusSearch: true } })} className='flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 bg-white px-3 py-3 text-base font-bold shadow-sm transition hover:shadow-md focus-visible:ring-2' style={{ borderColor: theme.primaryColor, color: theme.primaryColor }}><MdSearch size={24} />Search</button>
        <button onClick={() => navigate('/farmer/submit-ticket')} className='flex min-h-14 items-center justify-center gap-2 rounded-xl px-3 py-3 text-base font-bold text-white shadow-sm transition hover:shadow-md focus-visible:ring-2' style={{ backgroundColor: theme.primaryColor }}><MdConfirmationNumber size={24} />Submit Ticket</button>
    </nav>
}
