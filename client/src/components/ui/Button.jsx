import { useSelector } from 'react-redux'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'

const sizes = {
    sm: 'min-h-9 px-3.5 py-1.5 text-xs',
    md: 'min-h-11 px-5 py-2.5 text-sm',
    lg: 'min-h-12 px-7 py-3.5 text-base',
}

const Button = ({ variant = 'primary', size = 'md', disabled = false, loading = false, onClick, type = 'button', style: customStyle, className = '', children }) => {
    const theme = useSelector((state) => state.theme)

    const variantStyle = {
        primary: { backgroundColor: theme.primaryColor, color: '#fff', border: 'none' },
        secondary: { backgroundColor: 'transparent', color: theme.primaryColor, border: `1px solid ${theme.primaryColor}` },
        danger: { backgroundColor: theme.dangerColor, color: '#fff', border: 'none' },
        ghost: { backgroundColor: 'transparent', color: theme.textColor, border: 'none' },
    }

    const appearance = variant === 'outline' ? 'secondary' : variant

    return (
        <button
            type={type}
            className={`app-button inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 ${sizes[size]} ${disabled || loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:translate-y-0'} ${className}`}
            style={{ ...variantStyle[appearance], borderRadius: theme.borderRadius, boxShadow: disabled || loading || appearance === 'ghost' ? 'none' : '0 2px 6px rgba(32,74,14,0.12)', ...customStyle }}
            onClick={onClick}
            disabled={disabled || loading}
            aria-busy={loading || undefined}
        >
            {loading ? <AiOutlineLoading3Quarters className='animate-spin' /> : children}
        </button>
    )
}

export default Button
