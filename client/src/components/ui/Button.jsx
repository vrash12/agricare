import { useSelector } from 'react-redux'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
}

const Button = ({ variant = 'primary', size = 'md', disabled = false, loading = false, onClick, type = 'button', style: customStyle, className = '', children }) => {
    const theme = useSelector((state) => state.theme)

    const variantStyle = {
        primary: { backgroundColor: theme.primaryColor, color: '#fff', border: 'none' },
        secondary: { backgroundColor: 'transparent', color: theme.primaryColor, border: `1px solid ${theme.primaryColor}` },
        danger: { backgroundColor: theme.dangerColor, color: '#fff', border: 'none' },
        ghost: { backgroundColor: 'transparent', color: theme.textColor, border: 'none' },
    }

    return (
        <button
            type={type}
            className={`app-button inline-flex items-center justify-center gap-2 font-medium transition-all duration-200 ${sizes[size]} ${disabled || loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md'} ${className}`}
            style={{ ...variantStyle[variant], borderRadius: theme.borderRadius, boxShadow: disabled || loading ? 'none' : '0 2px 6px rgba(32,74,14,0.12)', ...customStyle }}
            onClick={onClick}
            disabled={disabled || loading}
        >
            {loading ? <AiOutlineLoading3Quarters className='animate-spin' /> : children}
        </button>
    )
}

export default Button
