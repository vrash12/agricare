import { useSelector } from 'react-redux'
import Button from './Button'

const Confirmation = ({ isOpen, title, message, icon: Icon, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel' }) => {
    const theme = useSelector((state) => state.theme)

    if (!isOpen) return null

    return (
        <div className='fixed inset-0 z-[75] flex items-center justify-center' style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <div className='w-[90%] max-w-[400px] shadow-lg p-6' style={{ backgroundColor: theme.backgroundColor, borderRadius: theme.borderRadius }}>
                <div className='flex flex-col items-center text-center gap-3'>
                    {Icon && <Icon size={40} color={theme.dangerColor} />}
                    {title && <h2 className='text-lg font-semibold m-0' style={{ color: theme.textColor }}>{title}</h2>}
                    {message && <p className='text-sm m-0 opacity-80' style={{ color: theme.textColor }}>{message}</p>}
                </div>
                <div className='flex gap-2 justify-center mt-6'>
                    <Button variant='ghost' onClick={onCancel}>{cancelText}</Button>
                    <Button variant='danger' onClick={onConfirm}>{confirmText}</Button>
                </div>
            </div>
        </div>
    )
}

export default Confirmation
