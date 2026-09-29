import { useState, useEffect } from 'react'
import { useSelector } from 'react-redux'
import { MdClose } from 'react-icons/md'

const SidePanel = ({ isOpen, onClose, title, children, header, footer }) => {
    const theme = useSelector((state) => state.theme)
    const [visible, setVisible] = useState(false)
    const [animate, setAnimate] = useState(false)

    useEffect(() => {
        if (isOpen) {
            setVisible(true)
            const t = setTimeout(() => setAnimate(true), 10)
            return () => clearTimeout(t)
        } else {
            setAnimate(false)
            const t = setTimeout(() => setVisible(false), 300)
            return () => clearTimeout(t)
        }
    }, [isOpen])

    if (!visible) return null

    return (
        <>
            <div className='fixed inset-0 z-[65] transition-opacity duration-300'
                style={{ backgroundColor: 'rgba(0,0,0,0.4)', opacity: animate ? 1 : 0 }}
                onClick={onClose} />
            <div className='fixed top-0 right-0 h-screen w-80 z-[65] shadow-2xl flex flex-col transition-transform duration-300'
                style={{
                    backgroundColor: theme.backgroundColor,
                    borderLeft: `1px solid ${theme.secondaryColor}`,
                    transform: animate ? 'translateX(0)' : 'translateX(100%)',
                }}>
                <div className='flex items-center justify-between p-4' style={{ backgroundColor: theme.primaryColor }}>
                    <h2 className='text-white font-semibold'>{title}</h2>
                    <button onClick={onClose} className='text-white cursor-pointer opacity-80 hover:opacity-100'>
                        <MdClose size={20} />
                    </button>
                </div>
                {header && <div style={{ borderBottom: `1px solid ${theme.secondaryColor}` }}>{header}</div>}
                <div className='flex-1 p-4 flex flex-col gap-3 overflow-y-auto'>
                    {children}
                </div>
                {footer && <div style={{ borderTop: `1px solid ${theme.secondaryColor}` }}>{footer}</div>}
            </div>
        </>
    )
}

export default SidePanel
