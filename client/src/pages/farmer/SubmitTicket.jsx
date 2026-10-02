import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { MdAttachFile, MdClose, MdConfirmationNumber } from 'react-icons/md'
import FarmerLayout from '../../components/layout/FarmerLayout'
import Button from '../../components/ui/Button'
import api from '../../services/api'
import TicketCapacity from '../../components/tickets/TicketCapacity'

export default function SubmitTicket() {
    const theme = useSelector(state => state.theme)
    const location = useLocation()
    const navigate = useNavigate()
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [categoryError, setCategoryError] = useState('')
    const [categoryId, setCategoryId] = useState('')
    const [title, setTitle] = useState(location.state?.title || '')
    const [concern, setConcern] = useState(location.state?.concern || '')
    const [attachment, setAttachment] = useState(null)
    const [readingFile, setReadingFile] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [review, setReview] = useState(null)
    const fileInput = useRef(null)
    const { user } = useSelector(state => state.auth)
    const category = categories.find(item => item.id === categoryId)
    const ownsExisting = review?.existing && (review.existing.farmerId === user?.id || review.existing.participants?.includes(user?.id))

    const loadCategories = () => {
        api.get('/tickets/categories/').then(({ data }) => { setCategories(data); setCategoryError('') })
            .catch(() => setCategoryError('Concern categories could not be loaded. Please try again.'))
            .finally(() => setLoading(false))
    }
    useEffect(() => { loadCategories() }, [])

    const readFile = event => {
        const file = event.target.files[0]
        event.target.value = ''
        if (!file) return
        if (file.size > 750 * 1024) { setError('Please choose a file smaller than 750 KB.'); return }
        setError('')
        setReadingFile(true)
        const reader = new FileReader()
        reader.onload = () => { setAttachment({ data: reader.result, name: file.name, type: file.type }); setReadingFile(false) }
        reader.onerror = () => { setError('The file could not be read. Please try again.'); setReadingFile(false) }
        reader.readAsDataURL(file)
    }

    const checkTicket = async event => {
        event.preventDefault()
        if (!title.trim() || !concern.trim() || !category?.available || busy || readingFile) return
        setBusy(true)
        setError('')
        try {
            const { data } = await api.post('/tickets/check/', { categoryId, title: title.trim(), concern: concern.trim() })
            setReview({ existing: data.exists ? data.ticket : null })
        } catch (error) {
            setError(error.response?.data?.error || 'Your concern could not be checked. Please try again.')
        } finally { setBusy(false) }
    }

    const submitTicket = async (joinExisting = false) => {
        if (busy) return
        setBusy(true)
        setError('')
        try {
            const { data } = await api.post('/tickets/submit/', {
                categoryId, title: title.trim(), concern: concern.trim(), joinExisting,
                ticketId: joinExisting ? review?.existing?.id : null,
                fileData: attachment?.data || '', fileName: attachment?.name || '', fileType: attachment?.type || '',
            })
            navigate('/farmer/knowledge-repository', { replace: true, state: { ticketId: data.ticketId } })
        } catch (error) {
            setError(error.response?.data?.error || error.response?.data?.detail || 'Your ticket could not be submitted. Please try again.')
        } finally { setBusy(false) }
    }

    const inputStyle = { borderColor: theme.secondaryColor, color: theme.textColor }
    return <FarmerLayout>
        <section className='mx-auto w-full max-w-3xl rounded-2xl border bg-white p-5 shadow-sm sm:p-7' style={{ borderColor: `${theme.secondaryColor}65` }}>
            <div className='mb-6 flex items-start gap-3' style={{ color: theme.textColor }}>
                <MdConfirmationNumber size={30} color={theme.primaryColor} className='shrink-0' />
                <div><h1 className='text-2xl font-bold'>Submit Ticket</h1><p className='mt-1 text-sm opacity-75'>Choose your concern category and describe the problem. AgriCare will automatically assign the appropriate LGU personnel.</p></div>
            </div>
            {categoryError && <div role='alert' className='mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900'>{categoryError} <button onClick={() => { setLoading(true); loadCategories() }} className='font-semibold underline'>Try again</button></div>}
            {error && <p role='alert' className='mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800'>{error}</p>}
            {review ? <div className='space-y-4' style={{ color: theme.textColor }}>
                <h2 className='text-lg font-semibold'>{review.existing ? (ownsExisting ? 'You have a similar ticket' : 'Another farmer has a similar concern') : 'Review your concern'}</h2>
                <div className='rounded-xl bg-slate-50 p-4'><p className='text-xs font-semibold uppercase tracking-wide'>{category?.name}</p><p className='mt-2 font-semibold'>{title}</p><p className='mt-1 whitespace-pre-wrap text-sm'>{concern}</p>{attachment && <p className='mt-2 text-xs'>Attachment: {attachment.name}</p>}</div>
                {review.existing ? <div className='rounded-xl border p-4' style={inputStyle}><p className='font-semibold'>{review.existing.title}</p><p className='mt-1 text-sm'>Assigned to: {review.existing.extensionWorkerName || 'Unassigned'}</p><div className='mt-3'><TicketCapacity ticket={review.existing} /></div><p className='mt-2 text-sm'>{ownsExisting ? 'Continue this conversation, or create a separate ticket for a different issue.' : 'Join this conversation to see the LGU answer and ask your question there, or create a separate ticket for a different issue.'}</p></div>
                    : <p className='text-sm'>Your ticket will be assigned automatically based on this category. You will see the assigned person’s name in your ticket.</p>}
                <div className='flex flex-wrap justify-end gap-2'>
                    <Button variant='ghost' disabled={busy} onClick={() => { setReview(null); setError('') }}>Back</Button>
                    <Button onClick={() => submitTicket(false)} loading={busy}>{review.existing ? 'Create New Ticket' : 'Confirm and Submit'}</Button>
                    {review.existing && <Button variant='secondary' disabled={busy} onClick={() => submitTicket(true)}>{ownsExisting ? 'Continue Existing Ticket' : 'Join Existing Ticket'}</Button>}
                </div>
            </div> : <form onSubmit={checkTicket} className='space-y-5'>
                <fieldset disabled={busy} className='space-y-5'>
                    <div><label htmlFor='concern-category' className='mb-2 block text-sm font-semibold' style={{ color: theme.textColor }}>Concern category <span aria-hidden='true'>*</span></label>
                        <select id='concern-category' required value={categoryId} onChange={event => { setCategoryId(event.target.value); setError('') }} disabled={loading || !!categoryError || busy}
                            aria-describedby='category-help' className='min-h-12 w-full rounded-xl border bg-white px-3 text-sm focus:ring-2' style={inputStyle}>
                            <option value=''>{loading ? 'Loading categories...' : 'Select the category of your concern'}</option>
                            {categories.map(item => <option key={item.id} value={item.id} disabled={!item.available}>{item.name}{item.available ? '' : ' — temporarily unavailable'}</option>)}
                        </select>
                        <p id='category-help' className='mt-2 text-xs text-slate-600'>Personnel are assigned automatically. You do not need to select a person.</p>
                        {!loading && !categoryError && !categories.some(item => item.available) && <p role='status' className='mt-2 text-sm text-amber-800'>No personnel are currently available to receive concerns. Please try again later.</p>}
                    </div>
                    <div><label htmlFor='concern-title' className='mb-2 block text-sm font-semibold' style={{ color: theme.textColor }}>Title <span aria-hidden='true'>*</span></label><input id='concern-title' required maxLength={200} value={title} onChange={event => setTitle(event.target.value)} placeholder='Brief title of your concern' className='min-h-12 w-full rounded-xl border px-4 text-sm' style={inputStyle} /></div>
                    <div><label htmlFor='concern-description' className='mb-2 block text-sm font-semibold' style={{ color: theme.textColor }}>Describe your concern <span aria-hidden='true'>*</span></label><textarea id='concern-description' required rows={5} value={concern} onChange={event => setConcern(event.target.value)} placeholder='Tell us what happened and how we can help.' className='w-full rounded-xl border p-4 text-sm' style={inputStyle} /></div>
                    <input ref={fileInput} type='file' aria-label='Attach a file' className='hidden' onChange={readFile} />
                    {attachment && <div className='flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm'><span className='truncate'>{attachment.name}</span><button type='button' aria-label='Remove attachment' onClick={() => setAttachment(null)}><MdClose size={20} /></button></div>}
                    <div className='flex flex-wrap items-center justify-between gap-4'>
                        <div><Button type='button' variant='secondary' disabled={readingFile} onClick={() => fileInput.current?.click()}><MdAttachFile /> {readingFile ? 'Reading file...' : 'Attach File'}</Button><p className='mt-1 text-xs text-slate-500'>Optional photo or document, up to 750 KB.</p></div>
                        <Button type='submit' loading={busy} disabled={loading || !!categoryError || !category?.available || !title.trim() || !concern.trim() || readingFile}>Submit Ticket</Button>
                    </div>
                </fieldset>
            </form>}
        </section>
    </FarmerLayout>
}
