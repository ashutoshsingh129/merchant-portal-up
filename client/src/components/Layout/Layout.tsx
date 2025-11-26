import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    Typography,
    IconButton,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Tooltip,
} from '@mui/material';
import { AccountCircle, Logout, Settings, VpnKey } from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useAppDispatch, useAppSelector } from '../../store';
import {
    logoutUser,
    clearKeys,
    checkStripeKeysStatus,
} from '../../store/slices/authSlice';
import Sidebar from '../Sidebar';

const StyledRoot = styled(Box)({
    display: 'flex',
    height: '100vh',
    backgroundColor: '#f8fafc',
});

const Header = styled(Box)(({ theme }) => ({
    height: 64,
    backgroundColor: '#1a202c',
    borderBottom: '1px solid #2d3748',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0, 3),
    position: 'sticky',
    top: 0,
    zIndex: 1000,
}));

const HeaderActions = styled(Box)({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
});

const HeaderTitle = styled(Typography)(({ theme }) => ({
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#ffffff',
}));

const MainContent = styled(Box, {
    shouldForwardProp: prop => prop !== 'sidebarOpen',
})<{ sidebarOpen: boolean }>(({ theme, sidebarOpen }) => ({
    flexGrow: 1,
    width: sidebarOpen ? 'calc(100% - 240px)' : 'calc(100% - 64px)',
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    display: 'flex',
    flexDirection: 'column',
}));

const ContentArea = styled(Box)({
    flexGrow: 1,
    overflow: 'auto',
});

interface LayoutProps {
    children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { user, isLoading, hasStripeKeys } = useAppSelector(
        state => state.auth
    );
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [clearKeysDialogOpen, setClearKeysDialogOpen] = useState(false);

    const handleSidebarToggle = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleLogout = async () => {
        try {
            await dispatch(logoutUser()).unwrap();
            handleMenuClose();
            navigate('/login');
        } catch (error) {
            console.error('Logout failed:', error);
        }
    };

    const handleClearKeys = async () => {
        try {
            await dispatch(clearKeys()).unwrap();
            setClearKeysDialogOpen(false);
            handleMenuClose();
            // Refresh keys status
            dispatch(checkStripeKeysStatus());
        } catch (error) {
            console.error('Clear keys failed:', error);
        }
    };

    const handleConfigureKeys = () => {
        handleMenuClose();
        navigate('/stripe-keys');
    };

    return (
        <StyledRoot>
            <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
            <MainContent sidebarOpen={sidebarOpen}>
                <Header>
                    <HeaderTitle>Merchant Portal</HeaderTitle>
                    <HeaderActions>
                        {hasStripeKeys && (
                            <Tooltip title="Configure Stripe Keys">
                                <IconButton
                                    onClick={handleConfigureKeys}
                                    sx={{ color: '#ffffff' }}
                                >
                                    <VpnKey />
                                </IconButton>
                            </Tooltip>
                        )}
                        <IconButton
                            size="large"
                            aria-label="account menu"
                            aria-controls="menu-appbar"
                            aria-haspopup="true"
                            onClick={handleMenuOpen}
                            sx={{ color: '#ffffff' }}
                        >
                            <AccountCircle />
                        </IconButton>
                        <Menu
                            id="menu-appbar"
                            anchorEl={anchorEl}
                            anchorOrigin={{
                                vertical: 'bottom',
                                horizontal: 'right',
                            }}
                            keepMounted
                            transformOrigin={{
                                vertical: 'top',
                                horizontal: 'right',
                            }}
                            open={Boolean(anchorEl)}
                            onClose={handleMenuClose}
                        >
                            <MenuItem disabled>
                                <Typography variant="body2">
                                    {user?.email || user?.username || 'User'}
                                </Typography>
                            </MenuItem>
                            {hasStripeKeys && (
                                <MenuItem
                                    onClick={() => setClearKeysDialogOpen(true)}
                                >
                                    <Settings sx={{ mr: 1 }} />
                                    Clear Configured Keys
                                </MenuItem>
                            )}
                            <MenuItem
                                onClick={handleLogout}
                                disabled={isLoading}
                            >
                                <Logout sx={{ mr: 1 }} />
                                Logout
                            </MenuItem>
                        </Menu>
                    </HeaderActions>
                </Header>
                <ContentArea>{children}</ContentArea>
            </MainContent>

            {/* Clear Keys Confirmation Dialog */}
            <Dialog
                open={clearKeysDialogOpen}
                onClose={() => setClearKeysDialogOpen(false)}
                aria-labelledby="clear-keys-dialog-title"
            >
                <DialogTitle id="clear-keys-dialog-title">
                    Clear Configured Keys
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to clear all configured Stripe
                        keys? This action cannot be undone. You will need to
                        configure keys again to use Stripe features.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setClearKeysDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleClearKeys}
                        color="error"
                        variant="contained"
                        disabled={isLoading}
                    >
                        Clear Keys
                    </Button>
                </DialogActions>
            </Dialog>
        </StyledRoot>
    );
};

export default Layout;
