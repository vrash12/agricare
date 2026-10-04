import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { MdSearch, MdConfirmationNumber } from 'react-icons/md'

export default function FarmerActions() {
    const navigate = useNavigate()
    const theme = useSelector(state => state.theme)
    return <nav aria-label='Farmer quick actions' className='app-page mb-6 grid grid-cols-2 gap-3'>
        <button onClick={() => navigate('/farmer/knowledge-repository', { state: { focusSearch: true } })} className='flex min-h-14 items-center justify-center gap-2 rounded-xl border bg-white px-3 py-3 text-sm font-bold shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:text-base' style={{ borderColor: `${theme.primaryColor}65`, color: theme.primaryColor }}><MdSearch size={22} /><span>Search <span className='hidden sm:inline'>AgriXa</span></span></button>
        <button onClick={() => navigate('/farmer/submit-ticket')} className='flex min-h-14 items-center justify-center gap-2 rounded-xl bg-blue-700 px-3 py-3 text-sm font-bold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md sm:text-base'><MdConfirmationNumber size={22} />Submit Ticket</button>
    </nav>
}
