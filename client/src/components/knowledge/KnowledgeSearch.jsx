import { useEffect, useMemo, useRef, useState } from 'react'
import { MdArrowForward, MdClose, MdExpandLess, MdExpandMore, MdLightbulb, MdMenuBook, MdSearch, MdSupportAgent } from 'react-icons/md'
import { useSelector } from 'react-redux'
import { useLocation, useNavigate } from 'react-router-dom'
import api from '../../services/api'
import Button from '../ui/Button'
import KnowledgeSource from './KnowledgeSource'

const KnowledgeSearch = () => {
    const theme = useSelector((state) => state.theme)
    const navigate = useNavigate()
    const location = useLocation()
    const searchInput = useRef(null)
    const requestId = useRef(0)
    const [query, setQuery] = useState('')
    const [submittedQuery, setSubmittedQuery] = useState('')
    const [articles, setArticles] = useState([])
    const [results, setResults] = useState([])
    const [category, setCategory] = useState('All topics')
    const [expanded, setExpanded] = useState(null)
    const [showAll, setShowAll] = useState(false)
    const [loading, setLoading] = useState(false)
    const [libraryLoading, setLibraryLoading] = useState(true)
    const [error, setError] = useState('')

    useEffect(() => {
        let active = true
        api.get('/knowledge/').then(res => { if (active) setArticles(res.data) })
            .catch(() => { if (active) setError('Articles are temporarily unavailable. Please try again.') })
            .finally(() => { if (active) setLibraryLoading(false) })
        return () => { active = false }
    }, [])

    useEffect(() => {
        if (location.state?.focusSearch) searchInput.current?.focus()
    }, [location.key, location.state?.focusSearch])

    const categories = useMemo(() => ['All topics', ...new Set(articles.map(article => article.category).filter(Boolean))], [articles])
    const visibleArticles = submittedQuery ? results : articles.filter(article => category === 'All topics' || article.category === category)
    const displayedArticles = showAll ? visibleArticles : visibleArticles.slice(0, 4)

    const matchStyle = (percentage) => {
        if (percentage >= 81) return { label: 'Highest match', color: '#166534', background: '#dcfce7', border: '#86efac' }
        if (percentage >= 50) return { label: 'Moderate match', color: '#1d4ed8', background: '#dbeafe', border: '#93c5fd' }
        return { label: 'Low match', color: '#b91c1c', background: '#fee2e2', border: '#fca5a5' }
    }

    const search = async (value = query) => {
        const question = value.trim()
        if (!question) { searchInput.current?.focus(); return }
        const id = ++requestId.current
        setQuery(question)
        setLoading(true)
        setError('')
        setExpanded(null)
        setShowAll(false)
        try {
            const res = await api.get('/knowledge/', { params: { q: question } })
            if (id === requestId.current) { setResults(res.data); setSubmittedQuery(question) }
        } catch {
            if (id === requestId.current) setError('We could not search the knowledge base. Please try again.')
        } finally {
            if (id === requestId.current) setLoading(false)
        }
    }

    const reset = () => {
        requestId.current += 1
        setSubmittedQuery('')
        setQuery('')
        setResults([])
        setExpanded(null)
        setShowAll(false)
        setError('')
        setLoading(false)
        searchInput.current?.focus()
    }

    return (
        <section aria-labelledby='agr-ixa-title' className='app-card overflow-hidden' style={{ borderColor: `${theme.secondaryColor}55` }}>
            <div className='relative overflow-hidden p-5 md:p-8' style={{ background: `linear-gradient(120deg, ${theme.primaryColor}, ${theme.primaryColor}e8 64%, ${theme.secondaryColor})` }}>
                <div className='pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full border-[28px] border-white/10' />
                <div className='pointer-events-none absolute -bottom-24 right-32 h-44 w-44 rounded-full bg-white/5' />
                <div className='relative max-w-3xl'>
                    <div className='flex items-start gap-3'><div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white'><MdLightbulb size={26} /></div><div><p className='text-xs font-bold uppercase tracking-[0.18em] text-white/70'>AgriXa answers</p><h2 id='agr-ixa-title' className='mt-1 text-2xl font-bold leading-tight text-white md:text-3xl'>What would you like to know?</h2><p className='mt-2 max-w-2xl text-sm leading-6 text-white/80'>Find agricultural advice from your community knowledge base. If there is no relevant answer, we’ll help you contact an extension worker.</p></div></div>
                    <form className='mt-6 flex flex-col gap-2 sm:flex-row' onSubmit={event => { event.preventDefault(); search() }}>
                        <label className='relative flex-1'><span className='sr-only'>Ask AgriXa a question in English or Tagalog</span><MdSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-slate-400' size={21} /><input ref={searchInput} value={query} onChange={event => setQuery(event.target.value)} placeholder='Ask in English or Tagalog, e.g. Bakit naninilaw ang dahon ng palay?' className='h-12 w-full rounded-xl border-0 bg-white pl-11 pr-10 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-white/80' />{query && <button type='button' aria-label='Clear question' onClick={reset} className='absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100'><MdClose size={17} /></button>}</label>
                        <Button type='submit' disabled={loading} className='min-h-12' style={{ backgroundColor: '#173b19' }}>{loading ? 'Finding answers...' : 'Search'} <MdArrowForward size={17} /></Button>
                    </form>
                    {!submittedQuery && articles.length > 0 && <div className='mt-4 flex flex-wrap items-center gap-2'><span className='text-xs text-white/70'>Popular questions</span>{articles.slice(0, 3).map(article => <button key={article.id} type='button' onClick={() => search(article.question || article.title)} className='max-w-full truncate rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs text-white transition hover:bg-white/20'>{article.question || article.title}</button>)}</div>}
                </div>
            </div>

            <div className='p-5 md:p-7'>
                {error && <div role='alert' className='mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900'><span>{error}</span><button type='button' onClick={() => submittedQuery ? search(submittedQuery) : api.get('/knowledge/').then(res => { setArticles(res.data); setError('') }).catch(() => {})} className='font-semibold underline'>Try again</button></div>}
                {submittedQuery ? <div className='flex flex-wrap items-end justify-between gap-3'><div><p className='text-xs font-semibold uppercase tracking-wider' style={{ color: theme.primaryColor }}>Search results</p><h3 className='mt-1 text-lg font-bold' style={{ color: theme.textColor }}>{results.length ? `${results.length} ${results.length === 1 ? 'answer' : 'answers'} for “${submittedQuery}”` : `No answer found for “${submittedQuery}”`}</h3><div className='mt-3 flex flex-wrap gap-2' aria-label='Match percentage legend'>{[['81–100%', matchStyle(100)], ['50–80%', matchStyle(50)], ['1–49%', matchStyle(1)]].map(([range, style]) => <span key={range} className='flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold' style={{ color: style.color, backgroundColor: style.background }}><span className='h-1.5 w-1.5 rounded-full' style={{ backgroundColor: style.color }} />{range} {style.label}</span>)}</div></div><button type='button' onClick={reset} className='text-xs font-semibold underline' style={{ color: theme.primaryColor }}>Browse all articles</button></div> : <div><p className='text-xs font-semibold uppercase tracking-wider' style={{ color: theme.primaryColor }}>Explore the library</p><h3 className='mt-1 text-lg font-bold' style={{ color: theme.textColor }}>Browse practical answers</h3><p className='mt-1 text-xs text-slate-500'>Select a topic or open an article to read the full guidance.</p></div>}

                {!submittedQuery && categories.length > 1 && <div className='mt-4 flex gap-2 overflow-x-auto pb-1' role='group' aria-label='Filter articles by topic'>{categories.map(topic => <button key={topic} type='button' aria-pressed={category === topic} onClick={() => { setCategory(topic); setShowAll(false); setExpanded(null) }} className='shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition' style={{ backgroundColor: category === topic ? theme.primaryColor : `${theme.primaryColor}12`, color: category === topic ? '#fff' : theme.primaryColor }}>{topic}</button>)}</div>}

                {submittedQuery && results.length === 0 && !loading && !error && <div className='mt-5 flex flex-col gap-3 rounded-xl border border-dashed p-5 sm:flex-row sm:items-center sm:justify-between' style={{ borderColor: `${theme.primaryColor}55`, backgroundColor: `${theme.primaryColor}08` }}><div className='flex items-start gap-3'><MdSupportAgent size={25} className='shrink-0' color={theme.primaryColor} /><div><p className='font-semibold' style={{ color: theme.textColor }}>Ask an extension worker</p><p className='mt-1 max-w-md text-xs leading-5 text-slate-600'>Choose a concern category in the ticket form. AgriCare will automatically assign the appropriate LGU personnel.</p></div></div><Button size='sm' onClick={() => navigate('/farmer/submit-ticket', { state: { concern: submittedQuery, title: submittedQuery.slice(0, 100) } })}>Submit Ticket <MdArrowForward size={16} /></Button></div>}

                {submittedQuery && <p className='mt-3 text-xs leading-5 text-slate-500'>Matching percentages describe query relevance, not answer accuracy. English and Tagalog terms are matched to the article topic and supporting text. Read the full advice and source before applying it.</p>}

                {displayedArticles.length > 0 && <div className='mt-5 grid gap-4 md:grid-cols-2'>{displayedArticles.map((article, index) => {
                    const percentage = Number(article.matchPercentage)
                    const match = submittedQuery && Number.isFinite(percentage) ? matchStyle(percentage) : null
                    const isTopMatch = Boolean(match && index === 0)
                    return <article key={article.id} className='self-start overflow-hidden rounded-2xl border bg-white transition hover:-translate-y-0.5 hover:shadow-lg' style={{ borderColor: match ? match.border : `${theme.secondaryColor}65`, boxShadow: isTopMatch ? `0 0 0 2px ${match.border}55` : undefined }}>
                        <button type='button' aria-expanded={expanded === article.id} onClick={() => setExpanded(expanded === article.id ? null : article.id)} className='flex w-full items-start justify-between gap-3 p-5 text-left'>
                            <div className='min-w-0 flex-1'><div className='flex flex-wrap items-center gap-2'><span className='text-[10px] font-bold uppercase tracking-[0.12em]' style={{ color: theme.primaryColor }}>{article.category || 'General'}</span>{isTopMatch && <span className='rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide' style={{ color: match.color, backgroundColor: match.background }}>Best result</span>}</div><h4 className='mt-1 font-semibold leading-6 text-slate-800'>{article.title}</h4>{article.question && article.question !== article.title && <p className='mt-1 text-xs text-slate-500'>{article.question}</p>}</div>
                            <div className='flex shrink-0 flex-col items-end gap-1'>{match && <span aria-label={`${percentage}% ${match.label}`} className='rounded-full px-2.5 py-1 text-xs font-bold' style={{ color: match.color, backgroundColor: match.background }}>{percentage}%</span>}{expanded === article.id ? <MdExpandLess className='mt-1' color={theme.primaryColor} size={21} /> : <MdExpandMore className='mt-1' color={theme.primaryColor} size={21} />}</div>
                        </button>
                        {match && <div className='px-5 pb-4 text-[11px] font-medium' style={{ color: match.color }}><div className='flex items-center gap-2'><span className='h-2 w-2 rounded-full' style={{ backgroundColor: match.color }} />{match.label}<span className='ml-auto font-bold'>{percentage}% relevance</span></div><div className='mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100'><div className='h-full rounded-full transition-all' style={{ width: `${Math.max(1, Math.min(100, percentage))}%`, backgroundColor: match.color }} /></div></div>}
                        <KnowledgeSource article={article} />
                        {expanded === article.id && <div className='border-t px-5 pb-5 pt-4 text-sm leading-6 text-slate-600' style={{ borderColor: `${theme.secondaryColor}45` }}><p className='whitespace-pre-wrap'>{article.answer}</p></div>}
                    </article>
                })}</div>}
                {!submittedQuery && libraryLoading && <div className='mt-5 grid gap-3 md:grid-cols-2' aria-label='Loading knowledge articles'>{[1, 2].map(item => <div key={item} className='h-24 animate-pulse rounded-xl bg-slate-100' />)}</div>}
                {!submittedQuery && !libraryLoading && articles.length === 0 && !error && <div className='mt-5 rounded-xl border border-dashed p-8 text-center' style={{ borderColor: `${theme.secondaryColor}80` }}><MdMenuBook size={30} className='mx-auto' color={theme.primaryColor} /><p className='mt-2 font-semibold' style={{ color: theme.textColor }}>The knowledge library is being prepared</p><p className='mt-1 text-xs text-slate-500'>Check back when your local team has published answers.</p></div>}
                {visibleArticles.length > 4 && <button type='button' onClick={() => setShowAll(!showAll)} className='mt-5 text-sm font-semibold underline' style={{ color: theme.primaryColor }}>{showAll ? 'Show fewer articles' : `Show all ${visibleArticles.length} articles`}</button>}
            </div>
        </section>
    )
}

export default KnowledgeSearch
