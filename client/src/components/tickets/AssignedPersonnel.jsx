const AssignedPersonnel = ({ ticket, className = '' }) => {
    const name = ticket?.extensionWorkerName || 'Unassigned'
    const detail = ticket?.extensionWorkerPosition || ticket?.extensionWorkerRole || ''

    return (
        <span className={className}>
            {name}
            {detail && <span className='font-normal opacity-70'> – {detail}</span>}
        </span>
    )
}

export default AssignedPersonnel
