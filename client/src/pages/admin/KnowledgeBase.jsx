import { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdArticle, MdCheckCircle, MdDelete, MdEdit, MdMenuBook, MdSearch, MdTune } from 'react-icons/md'
import { useSelector } from 'react-redux'
import AdminLayout from '../../components/layout/AdminLayout'
import ExtensionWorkerLayout from '../../components/layout/ExtensionWorkerLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import KnowledgeSource from '../../components/knowledge/KnowledgeSource'
import api from '../../services/api'

const blank = { title: '', question: '', answer: '', category: 'General', keywords: '', isPublished: true }

const KnowledgeBase = () => {
    const theme = useSelector((state) => state.theme)
    const user = useSelector((state) => state.auth.user)
    const [entries, setEntries] = useState([])
    const [query, setQuery] = useState('')
    const [filter, setFilter] = useState('all')
    const [form, setForm] = useState(blank)
    const [editing, setEditing] = useState(null)
    const [open, setOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    const load = () => api.get('/knowledge/').then(res => setEntries(res.data)).catch(() => setError('Unable to load the knowledge base.'))
    useEffect(() => { load() }, [])

    const stats = useMemo(() => ({
        total: entries.length,
        published: entries.filter(entry => entry.isPublished).length,
        drafts: entries.filter(entry => !entry.isPublished).length,
        categories: new Set(entries.map(entry => entry.category).filter(Boolean)).size,
    }), [entries])

    const shown = entries.filter(entry => {
        const matchesFilter = filter === 'all' || (filter === 'published' ? entry.isPublished : !entry.isPublished)
        const needle = query.toLowerCase()
        return matchesFilter && `${entry.title} ${entry.question} ${entry.answer} ${entry.category}`.toLowerCase().includes(needle)
    })

    const openCreate = () => { setEditing(null); setForm(blank); setError(''); setOpen(true) }
    const openEdit = (entry) => { setEditing(entry.id); setForm({ ...blank, ...entry, keywords: (entry.keywords || []).join(', ') }); setError(''); setOpen(true) }
    const save = async (event) => {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const payload = { ...form, keywords: form.keywords.split(',').map(value => value.trim()).filter(Boolean) }
            if (editing) await api.patch(`/knowledge/${editing}/`, payload)
            else await api.post('/knowledge/', payload)
            setOpen(false)
            setEditing(null)
            setForm(blank)
            load()
        } catch (err) {
            setError(err.response?.data?.error || 'Could not save this entry.')
        } finally { setSaving(false) }
    }
    const remove = async (id) => {
        if (!window.confirm('Delete this knowledge entry?')) return
        try { await api.delete(`/knowledge/${id}/`); load() } catch { setError('Could not delete this entry.') }
    }

    const Layout = user?.role === 'extension_worker' || user?.role === 'lgu_personnel' ? ExtensionWorkerLayout : AdminLayout
    return (
        <Layout>
            <div className='mx-auto flex w-full max-w-6xl flex-col gap-6'>
                <header className='flex flex-col justify-between gap-4 rounded-2xl p-6 shadow-sm md:flex-row md:items-center' style={{ background: `linear-gradient(120deg, ${theme.primaryColor}, ${theme.primaryColor}dc)` }}>
                    <div className='flex items-start gap-4'><div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white'><MdMenuBook size={27} /></div><div><p className='text-xs font-semibold uppercase tracking-[0.18em] text-white/70'>AgriXa administration</p><h1 className='mt-1 text-2xl font-bold text-white'>Knowledge Base</h1><p className='mt-1 max-w-xl text-sm text-white/75'>Create trusted answers that help farmers solve common concerns before they need a support ticket.</p></div></div>
                    <Button onClick={openCreate} style={{ backgroundColor: '#fff', color: theme.primaryColor, whiteSpace: 'nowrap' }}><span className='flex items-center gap-2'><MdAdd size={18} /> New article</span></Button>
                </header>

                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                    {[['Published', stats.published, MdCheckCircle, '#15803d'], ['Drafts', stats.drafts, MdArticle, '#b45309'], ['Categories', stats.categories, MdTune, '#2563eb'], ['Total articles', stats.total, MdMenuBook, theme.primaryColor]].map(([label, value, Icon, color]) => <div key={label} className='rounded-xl bg-white p-4 shadow-sm' style={{ border: `1px solid ${theme.secondaryColor}45` }}><div className='flex items-center justify-between'><p className='text-xs font-medium text-slate-500'>{label}</p><Icon size={18} color={color} /></div><p className='mt-2 text-2xl font-bold text-slate-800'>{value}</p></div>)}
                </div>

                <section className='rounded-2xl bg-white p-4 shadow-sm md:p-5' style={{ border: `1px solid ${theme.secondaryColor}45` }}>
                    <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'><div><h2 className='text-lg font-bold' style={{ color: theme.textColor }}>Your articles</h2><p className='text-xs text-slate-500'>Keep answers short, practical, and easy to scan.</p></div><div className='relative w-full md:max-w-xs'><MdSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder='Search articles...' className='h-10 w-full rounded-lg border bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:bg-white' style={{ borderColor: `${theme.secondaryColor}70` }} /></div></div>
                    <div className='mt-5 flex gap-2 overflow-x-auto border-b pb-3' style={{ borderColor: `${theme.secondaryColor}45` }}>{[['all', 'All articles'], ['published', 'Published'], ['drafts', 'Drafts']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className='whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition' style={{ backgroundColor: filter === value ? theme.primaryColor : `${theme.primaryColor}12`, color: filter === value ? '#fff' : theme.primaryColor }}>{label}</button>)}</div>
                    {error && <p className='mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600'>{error}</p>}
                    {shown.length === 0 ? <div className='flex flex-col items-center gap-2 py-16 text-center'><div className='flex h-14 w-14 items-center justify-center rounded-2xl' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}><MdArticle size={28} /></div><p className='mt-2 font-semibold' style={{ color: theme.textColor }}>{query ? 'No matching articles' : 'Your knowledge base is empty'}</p><p className='max-w-sm text-xs text-slate-500'>{query ? 'Try a different search term.' : 'Add your first verified answer to help farmers find solutions faster.'}</p>{!query && <Button size='sm' onClick={openCreate}><span className='flex items-center gap-1'><MdAdd /> Add first article</span></Button>}</div> : <div className='mt-4 grid gap-3 lg:grid-cols-2'>{shown.map(entry => <article key={entry.id} className='group rounded-xl p-4 transition hover:-translate-y-0.5 hover:shadow-md' style={{ border: `1px solid ${theme.secondaryColor}45`, backgroundColor: '#fff' }}><div className='flex items-start justify-between gap-3'><div className='min-w-0'><div className='flex flex-wrap items-center gap-2'><span className='rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}>{entry.category || 'General'}</span><span className='flex items-center gap-1 text-[10px] font-medium' style={{ color: entry.isPublished ? '#15803d' : '#b45309' }}><span className='h-1.5 w-1.5 rounded-full' style={{ backgroundColor: entry.isPublished ? '#22c55e' : '#f59e0b' }} />{entry.isPublished ? 'Published' : 'Draft'}</span></div><h3 className='mt-3 line-clamp-2 font-bold text-slate-800'>{entry.title}</h3></div><div className='flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100'><button aria-label='Edit article' onClick={() => openEdit(entry)} className='rounded-lg p-2 transition hover:bg-slate-100'><MdEdit size={17} color={theme.primaryColor} /></button><button aria-label='Delete article' onClick={() => remove(entry.id)} className='rounded-lg p-2 transition hover:bg-red-50'><MdDelete size={17} color={theme.dangerColor} /></button></div></div><p className='mt-2 line-clamp-3 text-sm leading-6 text-slate-600'>{entry.answer}</p><KnowledgeSource article={entry} /><div className='mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-slate-400' style={{ borderColor: `${theme.secondaryColor}35` }}><span>{entry.keywords?.length || 0} keywords</span><span>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently added'}</span></div></article>)}</div>}
                </section>
            </div>

            <Dialog isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit knowledge article' : 'Create knowledge article'} icon={MdMenuBook} className='sm:max-w-[620px]'>
                <form onSubmit={save} className='flex w-[min(520px,85vw)] flex-col gap-4'>
                    <div className='rounded-lg px-3 py-2 text-xs' style={{ backgroundColor: `${theme.primaryColor}10`, color: theme.textColor }}>Write the answer the way you would explain it to a farmer. Use the question and keywords to improve search results.</div>
                    <div className='grid gap-3 sm:grid-cols-2'><label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Article title<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder='e.g. Treating yellowing rice leaves' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label><label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Category<input required value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder='Crops, pests, soil...' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label></div>
                    <label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Common question<input value={form.question} onChange={event => setForm({ ...form, question: event.target.value })} placeholder='What might a farmer ask?' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label>
                    <label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Verified answer<textarea required value={form.answer} onChange={event => setForm({ ...form, answer: event.target.value })} placeholder='Explain the recommended solution...' rows={6} className='mt-1 resize-none rounded-lg border px-3 py-2.5 text-sm font-normal leading-6 outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label>
                    <label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Search keywords<span className='font-normal text-slate-400'>Separate keywords with commas</span><input value={form.keywords} onChange={event => setForm({ ...form, keywords: event.target.value })} placeholder='yellow leaves, rice, nitrogen' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label>
                    <label className='flex cursor-pointer items-center gap-2 text-sm' style={{ color: theme.textColor }}><input type='checkbox' checked={form.isPublished} onChange={event => setForm({ ...form, isPublished: event.target.checked })} /> Publish and make searchable by farmers</label>
                    {error && <p className='text-xs text-red-600'>{error}</p>}
                    <div className='flex justify-end gap-2 border-t pt-4' style={{ borderColor: `${theme.secondaryColor}40` }}><Button type='button' variant='ghost' onClick={() => setOpen(false)}>Cancel</Button><Button type='submit' loading={saving}>{editing ? 'Save changes' : form.isPublished ? 'Publish article' : 'Save draft'}</Button></div>
                </form>
            </Dialog>
        </Layout>
    )
}

export default KnowledgeBase
