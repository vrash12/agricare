import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setSessionExpired, setUnauthorized, setAppLoading } from '../../store/slices/appSlice'
import { clearCredentials } from '../../store/slices/authSlice'
import { deleteCookie } from '../../utils/cookies'

const SessionExpiredDialog = () => {
    const theme = useSelector((state) => state.theme)
    const sessionExpired = useSelector((state) => state.app.sessionExpired)
    const unauthorized = useSelector((state) => state.app.unauthorized)
    const dispatch = useDispatch()
    const navigate = useNavigate()

    const isVisible = sessionExpired || unauthorized
    if (!isVisible) return null

    const handleLogin = () => {
        dispatch(setSessionExpired(false))
        dispatch(setUnauthorized(false))
        dispatch(setAppLoading(true))
        setTimeout(() => {
            dispatch(clearCredentials())
            deleteCookie('token')
            navigate('/')
        }, 100)
    }

    return (
        <div className='fixed inset-0 z-[200] flex items-center justify-center' style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
            <div className='rounded-xl p-8 shadow-2xl text-center flex flex-col gap-4 mx-4' style={{ backgroundColor: theme.backgroundColor, maxWidth: '360px', width: '100%' }}>
                <span className='text-4xl'>{sessionExpired ? '⏰' : '🔒'}</span>
                <h2 className='text-lg font-bold' style={{ color: theme.textColor }}>
                    {sessionExpired ? 'Session Expired' : 'Unauthorized'}
                </h2>
                <p className='text-sm opacity-60' style={{ color: theme.textColor }}>
                    {sessionExpired
                        ? 'Your session has expired. Please login again to continue.'
                        : 'You are not authorized to access this resource. Please login to continue.'}
                </p>
                <button
                    className='w-full py-2.5 rounded-lg font-medium text-sm text-white cursor-pointer'
                    style={{ backgroundColor: theme.primaryColor, borderRadius: theme.borderRadius }}
                    onClick={handleLogin}
                >
                    Login Again
                </button>
            </div>
        </div>
    )
}

export default SessionExpiredDialog
