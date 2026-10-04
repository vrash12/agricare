import { MdConfirmationNumber, MdMenuBook } from 'react-icons/md'
import { useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import FarmerLayout from '../../components/layout/FarmerLayout'
import KnowledgeSearch from '../../components/knowledge/KnowledgeSearch'

export default function FarmerAgriXa() {
    const theme = useSelector(state => state.theme)
    const navigate = useNavigate()
    return (
        <FarmerLayout>
            <div className='app-page flex flex-col gap-6'>
                <header className='flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
                    <div>
                        <p className='app-kicker' style={{ color: theme.primaryColor }}>AgriXa knowledge assistant</p>
                        <h1 className='app-page-title' style={{ color: theme.textColor }}>Find trusted agricultural answers first</h1>
                        <p className='app-page-subtitle'>Search the knowledge repository in English or Tagalog. When an answer is not available, move to the Ticketing System and send your concern to the LGU team.</p>
                    </div>
                    <span className='flex w-fit items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold' style={{ borderColor: `${theme.primaryColor}35`, backgroundColor: `${theme.primaryColor}0b`, color: theme.primaryColor }}><MdMenuBook size={15} /> Knowledge first</span>
                </header>
                <KnowledgeSearch />
                <section className='app-card overflow-hidden p-5 md:p-6' style={{ borderColor: `${theme.secondaryColor}70` }}>
                    <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                        <div className='flex items-start gap-3'>
                            <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl' style={{ backgroundColor: `${theme.primaryColor}14`, color: theme.primaryColor }}><MdMenuBook size={24} /></span>
                            <div><p className='text-xs font-semibold uppercase tracking-[0.16em]' style={{ color: theme.primaryColor }}>Need personal assistance?</p><h2 className='mt-1 text-xl font-bold' style={{ color: theme.textColor }}>Connect with your LGU team</h2><p className='mt-1 max-w-2xl text-sm leading-6 text-slate-600'>If the knowledge repository has not resolved your concern, open the Ticketing System to contact the appropriate personnel.</p></div>
                        </div>
                        <button type='button' onClick={() => navigate('/farmer/tickets')} className='flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md'><MdConfirmationNumber size={19} />Open Ticketing System</button>
                    </div>
                </section>
            </div>
        </FarmerLayout>
    )
}
