import { useState, useRef } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import supabase from '../../services/supabase'
import { MdLock, MdLogout, MdDashboard, MdViewSidebar, MdCameraAlt } from 'react-icons/md'
import { AiOutlineLoading3Quarters } from 'react-icons/ai'
import { clearCredentials, updateProfilePicture } from '../../store/slices/authSlice'
import { deleteCookie } from '../../utils/cookies'
import useLayout from '../../hooks/useLayout'
import Confirmation from '../ui/Confirmation'
import SidePanel from '../ui/SidePanel'
import api from '../../services/api'
import { setAppLoading, setSessionExpired, setUnauthorized } from '../../store/slices/appSlice'

const ProfilePanel = ({ isOpen, onClose }) => {
    const theme = useSelector((state) => state.theme)
    const { user } = useSelector((state) => state.auth)
    const dispatch = useDispatch()
    const navigate = useNavigate()
    const { layout, toggleLayout } = useLayout()

    const [logoutConfirm, setLogoutConfirm] = useState(false)
    const [changePassOpen, setChangePassOpen] = useState(false)
    const [currentPassword, setCurrentPassword] = useState('')
    const [newPassword, setNewPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [success, setSuccess] = useState(null)

    const handleLogout = () => {
        setLogoutConfirm(false)
        onClose()
        dispatch(clearCredentials())
        deleteCookie('token')
        dispatch(setSessionExpired(false))
        dispatch(setUnauthorized(false))
        dispatch(setAppLoading(false))
        supabase.auth.signOut({ scope: 'local' }).catch(() => {})
        navigate('/', { replace: true })
    }

    const handleChangePassword = () => {
        setError(null)
        setSuccess(null)
        setChangePassOpen(true)
    }

    const handleResetPassword = async () => {
        if (!currentPassword) return setError('Enter your current password.')
        if (newPassword.length < 8) return setError('New password must be at least 8 characters.')
        if (newPassword === currentPassword) return setError('Choose a different new password.')
        if (newPassword !== confirmPassword) return setError('Passwords do not match.')
        setLoading(true)
        setError(null)
        try {
            await api.post('/auth/change-password/', { currentPassword, newPassword })
            setSuccess('Password changed successfully!')
            setChangePassOpen(false)
            setCurrentPassword('')
            setNewPassword('')
            setConfirmPassword('')
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to change password.')
        } finally {
            setLoading(false)
        }
    }

    const fileInputRef = useRef(null)
    const initials = user ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() : 'U'

    const handleAvatarClick = () => fileInputRef.current?.click()

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const bitmap = await createImageBitmap(file)
        const size = 200
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        const scale = Math.max(size / bitmap.width, size / bitmap.height)
        const x = (size - bitmap.width * scale) / 2
        const y = (size - bitmap.height * scale) / 2
        ctx.drawImage(bitmap, x, y, bitmap.width * scale, bitmap.height * scale)
        const base64 = canvas.toDataURL('image/jpeg', 0.7)
        try {
            await api.post('/users/profile-picture/', { profilePicture: base64 })
            dispatch(updateProfilePicture(base64))
        } catch {
            setError('Could not upload profile picture.')
        }
        e.target.value = ''
    }

    return (
        <>
            <SidePanel
                isOpen={isOpen}
                onClose={onClose}
                title='Profile'
                header={
                    <div className='flex items-center gap-3 p-6'>
                        <input ref={fileInputRef} type='file' accept='image/*' className='hidden' onChange={handleFileChange} />
                        <div className='relative w-14 h-14 cursor-pointer' onClick={handleAvatarClick}>
                            {user?.profilePicture ? (
                                <img src={user.profilePicture} className='w-14 h-14 rounded-full object-cover' />
                            ) : (
                                <div className='w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold'
                                    style={{ backgroundColor: theme.primaryColor, color: '#fff' }}>
                                    {initials}
                                </div>
                            )}
                            <div className='absolute bottom-0 right-0 w-5 h-5 rounded-full flex items-center justify-center'
                                style={{ backgroundColor: theme.primaryColor }}>
                                <MdCameraAlt size={12} color='#fff' />
                            </div>
                        </div>
                        <div>
                            <p className='font-semibold' style={{ color: theme.textColor }}>{user?.firstName} {user?.lastName}</p>
                            <p className='text-xs opacity-60 capitalize' style={{ color: theme.textColor }}>{user?.role?.replace('_', ' ')}</p>
                        </div>
                    </div>
                }
                footer={!changePassOpen && (
                    <div className='p-4'>
                        <button onClick={() => setLogoutConfirm(true)}
                            className='flex items-center gap-3 p-4 rounded-xl w-full text-left cursor-pointer'
                            style={{ backgroundColor: theme.dangerColor + '10', border: `1px solid ${theme.dangerColor}40` }}>
                            <MdLogout size={18} color={theme.dangerColor} />
                            <span className='text-sm font-medium' style={{ color: theme.dangerColor }}>Logout</span>
                        </button>
                    </div>
                )}
            >
                {success && (
                    <div className='p-3 rounded text-sm text-green-600' style={{ backgroundColor: '#dcfce7' }}>
                        {success}
                    </div>
                )}

                {error && (
                    <div className='p-3 rounded text-sm text-red-600' style={{ backgroundColor: '#fee2e2' }}>
                        {error}
                    </div>
                )}

                {/* Layout Toggle */}
                {!changePassOpen && (
                    <div className='hidden md:block p-4 rounded-xl' style={{ backgroundColor: theme.primaryColor + '10', border: `1px solid ${theme.secondaryColor}` }}>
                        <p className='text-sm font-semibold mb-3' style={{ color: theme.textColor }}>Layout</p>
                        <div className='flex gap-2'>
                            <button onClick={() => toggleLayout('topbar')}
                                className='flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer'
                                style={{ backgroundColor: layout === 'topbar' ? theme.primaryColor : 'transparent', color: layout === 'topbar' ? '#fff' : theme.textColor, border: `1px solid ${theme.secondaryColor}` }}>
                                <MdDashboard size={16} className='mx-auto mb-1' />
                                Topbar
                            </button>
                            <button onClick={() => toggleLayout('sidebar')}
                                className='flex-1 py-2 rounded-lg text-xs font-medium cursor-pointer'
                                style={{ backgroundColor: layout === 'sidebar' ? theme.primaryColor : 'transparent', color: layout === 'sidebar' ? '#fff' : theme.textColor, border: `1px solid ${theme.secondaryColor}` }}>
                                <MdViewSidebar size={16} className='mx-auto mb-1' />
                                Sidebar
                            </button>
                        </div>
                    </div>
                )}

                {/* Change Password */}
                {!changePassOpen && (
                    <button onClick={handleChangePassword} disabled={loading}
                        className='flex items-center gap-3 p-4 rounded-xl w-full text-left cursor-pointer'
                        style={{ backgroundColor: theme.primaryColor + '10', border: `1px solid ${theme.secondaryColor}` }}>
                        {loading ? <AiOutlineLoading3Quarters size={18} className='animate-spin' color={theme.primaryColor} /> : <MdLock size={18} color={theme.primaryColor} />}
                        <span className='text-sm font-medium' style={{ color: theme.textColor }}>Change Password</span>
                    </button>
                )}

                {changePassOpen && (
                    <form onSubmit={e => { e.preventDefault(); handleResetPassword() }} className='flex flex-col gap-3'>
                        <p className='text-sm font-semibold' style={{ color: theme.textColor }}>Change Password</p>
                        <p className='text-xs opacity-60' style={{ color: theme.textColor }}>Enter your current password to confirm this change.</p>
                        <label className='text-xs font-medium' style={{ color: theme.textColor }}>Current password
                            <input type='password' autoComplete='current-password' value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required
                                className='mt-1 w-full px-4 py-2.5 text-sm outline-none border'
                                style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                        </label>
                        <label className='text-xs font-medium' style={{ color: theme.textColor }}>New password
                            <input type='password' autoComplete='new-password' value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required
                                className='mt-1 w-full px-4 py-2.5 text-sm outline-none border'
                                style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                        </label>
                        <label className='text-xs font-medium' style={{ color: theme.textColor }}>Confirm new password
                            <input type='password' autoComplete='new-password' value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} required
                                className='mt-1 w-full px-4 py-2.5 text-sm outline-none border'
                                style={{ borderRadius: theme.borderRadius, borderColor: theme.secondaryColor, backgroundColor: '#fff', color: theme.textColor }} />
                        </label>
                        <div className='flex gap-2'>
                            <button type='button' onClick={() => { setChangePassOpen(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); setError(null) }}
                                className='flex-1 py-2 rounded-lg text-sm cursor-pointer'
                                style={{ border: `1px solid ${theme.secondaryColor}`, color: theme.textColor }}>Cancel</button>
                            <button type='submit' disabled={loading}
                                className='flex-1 py-2 rounded-lg text-sm text-white cursor-pointer'
                                style={{ backgroundColor: theme.primaryColor }}>
                                {loading ? <AiOutlineLoading3Quarters size={16} className='animate-spin mx-auto' /> : 'Save password'}
                            </button>
                        </div>
                    </form>
                )}
            </SidePanel>

            <Confirmation
                isOpen={logoutConfirm}
                title='Logout'
                message="Are you sure you want to logout? You will need to login again to access your account."
                onConfirm={handleLogout}
                onCancel={() => setLogoutConfirm(false)}
                confirmText='Logout'
            />
        </>
    )
}

export default ProfilePanel
