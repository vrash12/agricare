const KnowledgeSource = ({ article }) => {
    if (!article.sourceUrl) return null

    let sourceUrl
    try {
        sourceUrl = new URL(article.sourceUrl)
    } catch {
        return null
    }
    if (sourceUrl.protocol !== 'https:') return null

    return (
        <p className='mt-3 text-xs leading-5 text-slate-500'>
            Source: <a href={sourceUrl.href} target='_blank' rel='noopener noreferrer' className='font-medium text-green-800 underline decoration-green-800/30 underline-offset-2 hover:decoration-green-800'>{article.sourceName || sourceUrl.hostname}</a>
        </p>
    )
}

export default KnowledgeSource
