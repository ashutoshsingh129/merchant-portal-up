import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AppBar,
    Toolbar,
    Typography,
    Button,
    Box,
    Tooltip,
} from '@mui/material';
import { Logout, VpnKey } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useAppDispatch, useAppSelector } from '../../store';
import { logoutUser } from '../../store/slices/authSlice';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: '#1a202c',
    color: '#ffffff',
    boxShadow:
        '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    borderBottom: '1px solid #2d3748',
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
    padding: theme.spacing(0, 3),
    minHeight: 64,
    display: 'flex',
    justifyContent: 'space-between',
}));

const HeaderActions = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

interface AuthHeaderProps {
    showConfigureKeys?: boolean;
    currentPage?: 'login' | 'stripe-keys';
}

const AuthHeader: React.FC<AuthHeaderProps> = ({
    showConfigureKeys = false,
    currentPage,
}) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { isLoading, isAuthenticated, hasStripeKeys } = useAppSelector(
        state => state.auth
    );
    const [logoutLoading, setLogoutLoading] = React.useState(false);

    const handleLogout = async () => {
        try {
            setLogoutLoading(true);
            await dispatch(logoutUser()).unwrap();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
            // Even if logout fails, try to navigate to login
            navigate('/login');
        } finally {
            setLogoutLoading(false);
        }
    };

    const handleConfigureKeys = () => {
        navigate('/stripe-keys');
    };

    // Only show header actions if user is authenticated
    if (!isAuthenticated) {
        return null;
    }

    return (
        <StyledAppBar position="static">
            <StyledToolbar>
                <Typography
                    variant="h6"
                    component="div"
                    sx={{ fontWeight: 600 }}
                >
                    Merchant Portal
                </Typography>
                <HeaderActions>
                    {showConfigureKeys &&
                        currentPage !== 'stripe-keys' &&
                        hasStripeKeys === false && (
                            <Tooltip title="Configure Stripe Keys">
                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<VpnKey />}
                                    onClick={handleConfigureKeys}
                                    disabled={logoutLoading || isLoading}
                                    sx={{
                                        borderColor: 'rgba(255, 255, 255, 0.3)',
                                        '&:hover': {
                                            borderColor:
                                                'rgba(255, 255, 255, 0.5)',
                                            backgroundColor:
                                                'rgba(255, 255, 255, 0.1)',
                                        },
                                    }}
                                >
                                    Configure Keys
                                </Button>
                            </Tooltip>
                        )}
                    <Tooltip title="Logout">
                        <Button
                            variant="outlined"
                            color="inherit"
                            startIcon={<Logout />}
                            onClick={handleLogout}
                            disabled={logoutLoading || isLoading}
                            sx={{
                                borderColor: 'rgba(255, 255, 255, 0.3)',
                                '&:hover': {
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                },
                            }}
                        >
                            {logoutLoading ? 'Logging out...' : 'Logout'}
                        </Button>
                    </Tooltip>
                </HeaderActions>
            </StyledToolbar>
        </StyledAppBar>
    );
};

export default AuthHeader;
