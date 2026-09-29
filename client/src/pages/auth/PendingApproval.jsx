import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { MdPendingActions } from 'react-icons/md'
import heroMinecraft from '../../assets/hero-minecraft.jpg'
import Button from '../../components/ui/Button'

const PendingApproval = () => {
    const navigate = useNavigate()
    const theme = useSelector((state) => state.theme)

    return (
        <div className='min-h-screen flex items-center justify-center relative'
            style={{ backgroundImage: `url(${theme.minecraftHero ? heroMinecraft : ''})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
            <div className='absolute inset-0' style={{ backgroundColor: 'rgba(0,0,0,0.55)' }} />

            <div className='relative z-10 w-full max-w-md mx-4'>
                {/* Logo */}
                <div className='flex flex-col items-center gap-2 mb-6'>
                    <span className='text-8xl font-bold text-white tracking-wide'>
                        Agri<span style={{ color: theme.secondaryColor }}>Care</span>
                    </span>
                </div>

                {/* Card */}
                <div className='rounded-xl p-8 shadow-2xl flex flex-col items-center gap-4 text-center' style={{ backgroundColor: theme.backgroundColor }}>
                    <MdPendingActions size={56} color={theme.primaryColor} />
                    <span className='text-4xl font-semibold' style={{ color: theme.textColor }}>Pending Approval</span>
                    <p className='text-sm opacity-70' style={{ color: theme.textColor }}>
                        Your Extension Worker account is currently under review. Please wait for the admin to approve your account before you can login.
                    </p>
                    <p className='text-xs opacity-50' style={{ color: theme.textColor }}>
                        You will be notified once your account has been approved.
                    </p>
                    <Button variant='secondary' onClick={() => navigate('/')}>← Back to Home</Button>
                </div>
            </div>
        </div>
    )
}

export default PendingApproval
