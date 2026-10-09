import { useEffect, useMemo, useState } from 'react'
import { MdAdd, MdArticle, MdBlock, MdCheckCircle, MdDelete, MdEdit, MdMenuBook, MdPending, MdSearch, MdTune, MdVerifiedUser } from 'react-icons/md'
import { useSelector } from 'react-redux'
import AdminLayout from '../../components/layout/AdminLayout'
import ExtensionWorkerLayout from '../../components/layout/ExtensionWorkerLayout'
import Dialog from '../../components/ui/Dialog'
import Button from '../../components/ui/Button'
import KnowledgeSource from '../../components/knowledge/KnowledgeSource'
import api from '../../services/api'

const blank = {
    title: '', question: '', answer: '', category: 'General', keywords: '',
    sourceName: '', sourceUrl: '',
}

const statusOf = entry => entry.validationStatus || 'pending'

const statusStyle = {
    validated: { label: 'Validated', color: '#166534', background: '#dcfce7', icon: MdCheckCircle },
    pending: { label: 'Pending Validation', color: '#92400e', background: '#fef3c7', icon: MdPending },
    rejected: { label: 'Needs revision', color: '#991b1b', background: '#fee2e2', icon: MdBlock },
}

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
    const [reviewing, setReviewing] = useState(null)
    const [reviewEntry, setReviewEntry] = useState(null)
    const [reviewNote, setReviewNote] = useState('')
    const [error, setError] = useState('')
    const [canValidate, setCanValidate] = useState(false)
    const [reviewers, setReviewers] = useState([])
    const [reviewerBusy, setReviewerBusy] = useState(null)
    const [sourceVerified, setSourceVerified] = useState(false)
    const [localVerified, setLocalVerified] = useState(false)
    const loadReviewers = () => api.get('/knowledge/reviewers/').then(({ data }) => {
        setCanValidate(data.canValidate)
        setReviewers(data.reviewers)
    }).catch(() => { setCanValidate(false); setError('Unable to load reviewer permissions.') })
    const designate = async (person, enabled) => {
        setReviewerBusy(person.id)
        setError('')
        try { await api.patch('/knowledge/reviewers/', { userId: person.id, enabled }); await loadReviewers() }
        catch (err) { setError(err.response?.data?.error || 'Unable to update reviewer designation.') }
        finally { setReviewerBusy(null) }
    }
    const mayReview = entry => canValidate && ![entry.createdBy, entry.lastEditedBy, ...(entry.contributorIds || [])].includes(String(user?.id))

    const load = () => api.get('/knowledge/').then(res => setEntries(res.data)).catch(() => setError('Unable to load the knowledge base.'))
    useEffect(() => { load(); loadReviewers() }, [])

    const stats = useMemo(() => ({
        total: entries.length,
        published: entries.filter(entry => statusOf(entry) === 'validated' && entry.isPublished !== false).length,
        pending: entries.filter(entry => statusOf(entry) === 'pending').length,
        categories: new Set(entries.map(entry => entry.category).filter(Boolean)).size,
    }), [entries])

    const shown = entries.filter(entry => {
        const status = statusOf(entry)
        const matchesFilter = filter === 'all'
            || (filter === 'published' && status === 'validated' && entry.isPublished !== false)
            || (filter === 'pending' && status === 'pending')
            || (filter === 'rejected' && status === 'rejected')
        const needle = query.toLowerCase()
        return matchesFilter && `${entry.title} ${entry.question} ${entry.answer} ${entry.category} ${entry.sourceName}`.toLowerCase().includes(needle)
    })

    const openCreate = () => { setEditing(null); setForm(blank); setError(''); setOpen(true) }
    const openEdit = (entry) => { setEditing(entry.id); setForm({ ...blank, ...entry, keywords: (entry.keywords || []).join(', ') }); setError(''); setOpen(true) }

    const save = async event => {
        event.preventDefault()
        setSaving(true)
        setError('')
        try {
            const payload = {
                title: form.title.trim(), question: form.question.trim(), answer: form.answer.trim(),
                category: form.category.trim(), keywords: form.keywords.split(',').map(value => value.trim()).filter(Boolean),
                sourceName: form.sourceName.trim(), sourceUrl: form.sourceUrl.trim(),
            }
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

    const validateEntry = async (entry, action) => {
        setReviewing(`${entry.id}:${action}`)
        setError('')
        try {
            await api.post(`/knowledge/${entry.id}/validate/`, { action, note: reviewNote.trim(), sourceVerified, localApplicabilityVerified: localVerified, reviewedUpdatedAt: entry.updatedAt })
            setReviewEntry(null)
            setReviewNote('')
            await load()
        } catch (err) {
            setError(err.response?.data?.error || 'The validation action could not be completed.')
        } finally { setReviewing(null) }
    }

    const remove = async id => {
        if (!window.confirm('Delete this knowledge entry?')) return
        try { await api.delete(`/knowledge/${id}/`); load() } catch { setError('Could not delete this entry.') }
    }

    const Layout = user?.role === 'extension_worker' || user?.role === 'lgu_personnel' ? ExtensionWorkerLayout : AdminLayout

    return (
        <Layout>
            <div className='app-page flex flex-col gap-6'>
                <header className='flex flex-col justify-between gap-4 rounded-2xl p-6 shadow-sm md:flex-row md:items-center' style={{ background: `linear-gradient(120deg, ${theme.primaryColor}, ${theme.primaryColor}dc)` }}>
                    <div className='flex items-start gap-4'><div className='flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white'><MdMenuBook size={27} /></div><div><p className='text-xs font-semibold uppercase tracking-[0.18em] text-white/70'>Paniqui LGU · AgriXa</p><h1 className='mt-1 text-2xl font-bold text-white'>Knowledge Base</h1><p className='mt-1 max-w-xl text-sm text-white/75'>Submit sourced agricultural guidance for Paniqui LGU validation. Authorized LGU personnel or an Admin reviews each entry before publication.</p></div></div>
                    <Button onClick={openCreate} style={{ backgroundColor: '#fff', color: theme.primaryColor, whiteSpace: 'nowrap' }}><span className='flex items-center gap-2'><MdAdd size={18} /> New article</span></Button>
                </header>

                <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                    {[
                        ['Published', stats.published, MdCheckCircle, '#15803d'],
                        ['Pending Validation', stats.pending, MdPending, '#b45309'],
                        ['Categories', stats.categories, MdTune, '#2563eb'],
                        ['Total articles', stats.total, MdMenuBook, theme.primaryColor],
                    ].map(([label, value, Icon, color]) => <div key={label} className='app-card p-4'><div className='flex items-center justify-between'><p className='text-xs font-medium text-slate-500'>{label}</p><Icon size={18} color={color} /></div><p className='mt-2 text-2xl font-bold text-slate-800'>{value}</p></div>)}
                </div>

                {user?.role === 'admin' && <section className='app-card p-5' aria-labelledby='reviewer-heading'>
                    <h2 id='reviewer-heading' className='text-lg font-bold text-slate-800'>Designated knowledge reviewers</h2>
                    <p className='mt-1 text-sm text-slate-600'>Designate authorized Paniqui LGU personnel to review agricultural sources and local recommendations. Admins can also review. Authors and contributors must ask another reviewer.</p>
                    <div className='mt-4 grid gap-3 md:grid-cols-2'>{reviewers.map(person => <label key={person.id} className='flex items-center gap-3 rounded-xl border p-3 text-sm'>
                        <input type='checkbox' checked={person.enabled} disabled={reviewerBusy !== null || (!person.enabled && (!person.isActive || person.isPending))} onChange={event => designate(person, event.target.checked)} />
                        <span><strong>{person.name}</strong><span className='block text-xs text-slate-500'>{!person.isActive || person.isPending ? 'Account must be active and approved' : person.enabled ? 'Designated reviewer' : 'Can submit articles; cannot approve'}</span></span>
                    </label>)}</div>
                </section>}

                <section className='app-card p-4 md:p-5'>
                    <div className='flex flex-col gap-3 md:flex-row md:items-center md:justify-between'><div><h2 className='text-lg font-bold' style={{ color: theme.textColor }}>Repository entries</h2><p className='text-xs text-slate-500'>Only validated entries are searchable by farmers.</p></div><div className='relative w-full md:max-w-xs'><MdSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-slate-400' size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder='Search articles or sources...' className='app-control h-10 w-full bg-slate-50 pl-9 pr-3 text-sm text-slate-700 outline-none focus:bg-white' /></div></div>
                    <div className='mt-5 flex gap-2 overflow-x-auto border-b pb-3' style={{ borderColor: `${theme.secondaryColor}45` }}>{[['all', 'All'], ['published', 'Published'], ['pending', 'Pending Validation'], ['rejected', 'Needs revision']].map(([value, label]) => <button key={value} onClick={() => setFilter(value)} className='whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition' style={{ backgroundColor: filter === value ? theme.primaryColor : `${theme.primaryColor}12`, color: filter === value ? '#fff' : theme.primaryColor }}>{label}</button>)}</div>
                    {error && <p role='alert' className='mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600'>{error}</p>}
                    {shown.length === 0 ? <div className='flex flex-col items-center gap-2 py-16 text-center'><div className='flex h-14 w-14 items-center justify-center rounded-2xl' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}><MdArticle size={28} /></div><p className='mt-2 font-semibold' style={{ color: theme.textColor }}>{query ? 'No matching articles' : 'Your knowledge base is empty'}</p><p className='max-w-sm text-xs text-slate-500'>{query ? 'Try a different search term.' : 'Add a sourced answer for authorized review.'}</p>{!query && <Button size='sm' onClick={openCreate}><span className='flex items-center gap-1'><MdAdd /> Add first article</span></Button>}</div>
                        : <div className='mt-4 grid gap-4 lg:grid-cols-2'>{shown.map(entry => {
                            const state = statusStyle[statusOf(entry)] || statusStyle.pending
                            const StateIcon = state.icon
                            return <article key={entry.id} className='app-card group p-5 transition hover:-translate-y-0.5 hover:shadow-lg' style={{ borderColor: `${theme.secondaryColor}45` }}>
                                <div className='flex items-start justify-between gap-3'><div className='min-w-0'><div className='flex flex-wrap items-center gap-2'><span className='rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wider' style={{ backgroundColor: `${theme.primaryColor}12`, color: theme.primaryColor }}>{entry.category || 'General'}</span><span className='flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold' style={{ color: state.color, backgroundColor: state.background }}><StateIcon size={13} />{state.label}</span></div><h3 className='mt-3 line-clamp-2 font-bold text-slate-800'>{entry.title}</h3></div><div className='flex shrink-0 gap-1 opacity-60 transition group-hover:opacity-100'><button aria-label='Edit article' onClick={() => openEdit(entry)} className='rounded-lg p-2 transition hover:bg-slate-100'><MdEdit size={17} color={theme.primaryColor} /></button><button aria-label='Delete article' onClick={() => remove(entry.id)} className='rounded-lg p-2 transition hover:bg-red-50'><MdDelete size={17} color={theme.dangerColor} /></button></div></div>
                                <p className='mt-2 line-clamp-3 text-sm leading-6 text-slate-600'>{entry.answer}</p>
                                <KnowledgeSource article={entry} />
                                {mayReview(entry) && statusOf(entry) === 'pending' && <div className='mt-4 flex justify-end border-t pt-3' style={{ borderColor: `${theme.secondaryColor}35` }}><Button size='sm' onClick={() => { setReviewEntry(entry); setReviewNote(''); setSourceVerified(false); setLocalVerified(false); setError('') }}><MdVerifiedUser size={15} /> Review submission</Button></div>}
                                <div className='mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-slate-400' style={{ borderColor: `${theme.secondaryColor}35` }}><span>{entry.keywords?.length || 0} keywords</span><span>{entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently added'}</span></div>
                            </article>
                        })}</div>}
                </section>
            </div>

            <Dialog isOpen={open} onClose={() => setOpen(false)} title={editing ? 'Edit knowledge article' : 'Create knowledge article'} icon={MdMenuBook} className='sm:max-w-[650px]'>
                <form onSubmit={save} className='flex w-[min(560px,85vw)] flex-col gap-4'>
                    <div className='rounded-lg px-3 py-2 text-xs' style={{ backgroundColor: `${theme.primaryColor}10`, color: theme.textColor }}><strong>Review required:</strong> include a credible HTTPS reference. Saving a new or edited article sends it to authorized LGU personnel or Admin review before it becomes searchable by farmers.</div>
                    <div className='grid gap-3 sm:grid-cols-2'><label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Article title<input required value={form.title} onChange={event => setForm({ ...form, title: event.target.value })} placeholder='e.g. Treating yellowing rice leaves' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label><label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Category<input required value={form.category} onChange={event => setForm({ ...form, category: event.target.value })} placeholder='Crops, pests, soil...' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label></div>
                    <label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Common question<input value={form.question} onChange={event => setForm({ ...form, question: event.target.value })} placeholder='What might a farmer ask?' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label>
                    <label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Recommended solution<textarea required value={form.answer} onChange={event => setForm({ ...form, answer: event.target.value })} placeholder='Explain the recommendation and when to contact the LGU...' rows={6} className='mt-1 resize-none rounded-lg border px-3 py-2.5 text-sm font-normal leading-6 outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label>
                    <label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Search keywords<span className='font-normal text-slate-400'>Separate keywords with commas</span><input value={form.keywords} onChange={event => setForm({ ...form, keywords: event.target.value })} placeholder='yellow leaves, rice, nitrogen' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label>
                    <div className='grid gap-3 sm:grid-cols-2'><label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>Source / reference name<input required value={form.sourceName} onChange={event => setForm({ ...form, sourceName: event.target.value })} placeholder='DA-PhilRice, IRRI, FAO...' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label><label className='flex flex-col gap-1 text-xs font-semibold' style={{ color: theme.textColor }}>HTTPS source link<input required type='url' value={form.sourceUrl} onChange={event => setForm({ ...form, sourceUrl: event.target.value })} placeholder='https://...' className='mt-1 rounded-lg border px-3 py-2.5 text-sm font-normal outline-none' style={{ borderColor: `${theme.secondaryColor}90` }} /></label></div>
                    <div className='flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900'><MdVerifiedUser className='mt-0.5 shrink-0' size={16} />Published recommendations must be based on a verifiable government, academic, FAO, or IRRI source and approved by authorized LGU personnel or an Admin.</div>
                    {error && <p role='alert' className='text-xs text-red-600'>{error}</p>}
                    <div className='flex justify-end gap-2 border-t pt-4' style={{ borderColor: `${theme.secondaryColor}40` }}><Button type='button' variant='ghost' onClick={() => setOpen(false)}>Cancel</Button><Button type='submit' loading={saving}>{editing ? 'Save for review' : 'Submit for review'}</Button></div>
                </form>
            </Dialog>

            <Dialog isOpen={Boolean(reviewEntry)} onClose={() => { if (!reviewing) setReviewEntry(null) }} title='Paniqui LGU validation' icon={MdVerifiedUser} className='sm:max-w-[700px]'>
                {reviewEntry && <div className='flex w-[min(600px,85vw)] flex-col gap-4'>
                    <p className='rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900'>Review the complete recommendation and open its reference to verify accuracy and relevance to local farming conditions. Approving makes this entry visible to farmers.</p>
                    <div><p className='text-xs font-semibold text-slate-500'>{reviewEntry.category || 'General'}</p><h2 className='mt-1 text-lg font-bold text-slate-800'>{reviewEntry.title}</h2></div>
                    {reviewEntry.question && <p className='text-sm text-slate-700'><strong>Farmer question: </strong>{reviewEntry.question}</p>}
                    <div className='max-h-[35vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4'><p className='whitespace-pre-wrap text-sm leading-6 text-slate-700'>{reviewEntry.answer}</p></div>
                    <KnowledgeSource article={reviewEntry} />
                    <label className='flex flex-col gap-1 text-xs font-semibold text-slate-700'>Review notes<textarea value={reviewNote} onChange={event => setReviewNote(event.target.value)} rows={3} placeholder='Explain required corrections or record your validation findings...' className='rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal' /></label>
                    <label className='flex items-start gap-2 text-sm text-slate-700'><input type='checkbox' checked={sourceVerified} onChange={event => setSourceVerified(event.target.checked)} />I opened the reference and verified that it supports this recommendation.</label>
                    <label className='flex items-start gap-2 text-sm text-slate-700'><input type='checkbox' checked={localVerified} onChange={event => setLocalVerified(event.target.checked)} />I checked applicability to local crops, conditions, and safety requirements.</label>
                    {error && <p role='alert' className='text-xs text-red-600'>{error}</p>}
                    <div className='flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4'><Button variant='ghost' disabled={Boolean(reviewing)} onClick={() => setReviewEntry(null)}>Cancel</Button><Button variant='secondary' disabled={Boolean(reviewing)} loading={reviewing === `${reviewEntry.id}:reject`} onClick={() => validateEntry(reviewEntry, 'reject')}><MdBlock size={16} /> Return for revision</Button><Button disabled={Boolean(reviewing) || !sourceVerified || !localVerified || !reviewNote.trim()} loading={reviewing === `${reviewEntry.id}:approve`} onClick={() => validateEntry(reviewEntry, 'approve')}><MdVerifiedUser size={16} /> Approve and publish</Button></div>
                </div>}
            </Dialog>
        </Layout>
    )
}

export default KnowledgeBase
