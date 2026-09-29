import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'

const Dialog = ({ isOpen, onClose, title, icon: Icon, children, actions, className, mobileMaxH = 'max-h-[70vh]' }) => {
    const theme = useSelector((state) => state.theme)
    const [visible, setVisible] = useState(false)
    const [animate, setAnimate] = useState(false)
    const [frozenChildren, setFrozenChildren] = useState(null)

    useEffect(() => {
        if (isOpen) {
            setFrozenChildren(children)
            setVisible(true)
            const t = setTimeout(() => setAnimate(true), 10)
            return () => clearTimeout(t)
        } else {
            setAnimate(false)
            const t = setTimeout(() => { setVisible(false); setFrozenChildren(null) }, 250)
            return () => clearTimeout(t)
        }
    }, [isOpen])

    useEffect(() => {
        if (isOpen) setFrozenChildren(children)
    }, [children, isOpen])

    if (!visible) return null

    return (
        <div className='fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity duration-250'
            style={{ backgroundColor: 'rgba(0,0,0,0.5)', opacity: animate ? 1 : 0 }}
            onClick={onClose}>
            <div className={`w-full sm:w-fit sm:max-w-[90vw] ${mobileMaxH} sm:max-h-[90vh] overflow-y-auto shadow-lg p-5 sm:p-6 mb-16 sm:mb-0 rounded-t-2xl sm:rounded-xl transition-all duration-250${className ? ' ' + className : ''}`}
                style={{
                    backgroundColor: theme.backgroundColor,
                    transform: animate ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.97)',
                    opacity: animate ? 1 : 0,
                }}
                onClick={e => e.stopPropagation()}>
                <div className='flex flex-col items-center text-center gap-3 mb-4'>
                    {Icon && <Icon size={40} color={theme.primaryColor} />}
                    {title && <h2 className='text-lg font-semibold m-0' style={{ color: theme.textColor }}>{title}</h2>}
                </div>
                <div style={{ color: theme.textColor }}>
                    {frozenChildren}
                </div>
                {actions && (
                    <div className='flex gap-2 justify-end mt-6'>
                        {actions}
                    </div>
                )}
            </div>
        </div>
    )
}

export default Dialog
