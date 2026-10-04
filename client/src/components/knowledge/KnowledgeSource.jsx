import { MdCheckCircle, MdSchedule, MdWarning } from 'react-icons/md'

const STATUS = {
    validated: { label: 'Validated by an authorized reviewer', color: '#166534', background: '#dcfce7', icon: MdCheckCircle },
    pending: { label: 'Pending Validation', color: '#92400e', background: '#fef3c7', icon: MdSchedule },
    rejected: { label: 'Needs review before publishing', color: '#991b1b', background: '#fee2e2', icon: MdWarning },
}

const KnowledgeSource = ({ article }) => {
    let sourceUrl = null
    try {
        const parsed = new URL(article.sourceUrl || '')
        if (parsed.protocol === 'https:') sourceUrl = parsed
    } catch { /* The API normally prevents invalid public source links. */ }

    const status = STATUS[article.validationStatus] || STATUS.pending
    const StatusIcon = status.icon
    const validatedAt = article.validatedAt
        ? new Date(article.validatedAt).toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : null

    return (
        <div className='mt-3 flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600'>
            <p>
                <span className='font-semibold text-slate-700'>Source / reference: </span>
                {sourceUrl
                    ? <a href={sourceUrl.href} target='_blank' rel='noopener noreferrer' className='font-medium text-green-800 underline decoration-green-800/30 underline-offset-2 hover:decoration-green-800'>{article.sourceName || sourceUrl.hostname}</a>
                    : <span className='font-medium text-amber-700'>Reference is pending verification</span>}
            </p>
            {article.validationNote && <p><span className='font-semibold text-slate-700'>Review note: </span>{article.validationNote}</p>}
            <p className='flex flex-wrap items-center gap-1.5'>
                <span className='font-semibold text-slate-700'>Validation: </span>
                <span className='inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold' style={{ color: status.color, backgroundColor: status.background }}><StatusIcon size={13} />{status.label}</span>
                {validatedAt && <span className='text-slate-500'>· {validatedAt}</span>}
                {article.validatedByName && status.label.startsWith('Validated') && <span className='text-slate-500'>· by {article.validatedByName}</span>}
                {article.validatedByRole && status.label.startsWith('Validated') && <span className='text-slate-500'>· {article.validatedByRole === 'admin' ? 'Admin' : 'LGU personnel'}</span>}
            </p>
        </div>
    )
}

export default KnowledgeSource
