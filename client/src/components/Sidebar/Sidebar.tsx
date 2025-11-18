import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    Divider,
    Typography,
    Box,
    Collapse,
} from '@mui/material';
import {
    ChevronLeft,
    ChevronRight,
    Home,
    AccountBalance,
    Receipt,
    People,
    Inventory,
    Analytics,
    Assessment,
    AccountBalanceWallet,
    ConnectWithoutContact,
    Payment,
    TrendingUp,
    ExpandLess,
    ExpandMore,
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const drawerWidth = 240;
const collapsedWidth = 64;

const StyledDrawer = styled(Drawer, {
    shouldForwardProp: prop => prop !== 'open',
})<{ open: boolean }>(({ theme, open }) => ({
    width: open ? drawerWidth : collapsedWidth,
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    '& .MuiDrawer-paper': {
        width: open ? drawerWidth : collapsedWidth,
        transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        overflowX: 'hidden',
        backgroundColor: '#f7fafc',
        color: '#2d3748',
        borderRight: '1px solid #e2e8f0',
    },
}));

const DrawerHeader = styled('div')(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    padding: theme.spacing(2),
    ...theme.mixins.toolbar,
    justifyContent: 'center',
    minHeight: '64px',
    height: '64px',
}));

const SectionTitle = styled(Typography)(({ theme }) => ({
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#4a5568',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: theme.spacing(1, 2),
    marginTop: theme.spacing(2),
}));

const StyledListItemButton = styled(ListItemButton)(({ theme }) => ({
    borderRadius: theme.spacing(1),
    margin: theme.spacing(0.5, 1),
    display: 'flex',
    alignItems: 'center',
    width: '100%',
    '&:hover': {
        backgroundColor: 'rgba(74, 85, 104, 0.1)',
    },
    '&.Mui-selected': {
        backgroundColor: 'transparent',
        color: '#7c3aed',
        borderLeft: '3px solid #7c3aed',
        '&:hover': {
            backgroundColor: 'rgba(124, 58, 237, 0.1)',
        },
    },
}));

const StyledListItemIcon = styled(ListItemIcon)({
    minWidth: 40,
    color: 'inherit',
});

const StyledListItemText = styled(ListItemText)({
    '& .MuiListItemText-primary': {
        fontSize: '0.875rem',
        fontWeight: 500,
    },
});

const ToggleButton = styled(IconButton)(({ theme }) => ({
    padding: theme.spacing(1),
    borderRadius: theme.spacing(1),
    backgroundColor: 'transparent',
    color: '#4a5568',
    '&:hover': {
        backgroundColor: 'rgba(74, 85, 104, 0.1)',
    },
    transition: 'all 0.2s ease-in-out',
}));

const ExpandIcon = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '24px',
    height: '24px',
    color: '#6b7280',
    transition: 'color 0.2s ease-in-out',
    marginLeft: 'auto',
    '&:hover': {
        color: '#4a5568',
    },
}));

interface SidebarProps {
    open: boolean;
    onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ open, onToggle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [selectedItem, setSelectedItem] = useState(location.pathname);
    const [transactionsOpen, setTransactionsOpen] = useState(true);

    // Sync selectedItem with current pathname
    useEffect(() => {
        setSelectedItem(location.pathname);
    }, [location.pathname]);

    const mainMenuItems = [
        {
            id: 'transactions',
            label: 'Transactions',
            icon: <Receipt />,
            path: '/transactions',
            subItems: [
                {
                    id: 'payments',
                    label: 'Payments',
                    icon: <Payment />,
                    path: '/payments',
                },
                {
                    id: 'payouts',
                    label: 'Payouts',
                    icon: <AccountBalance />,
                    path: '/transactions/payouts',
                },
            ],
        },
    ];

    const handleItemClick = (itemId: string, path: string) => {
        setSelectedItem(path);
        navigate(path);
    };

    const handleTransactionsToggle = () => {
        setTransactionsOpen(!transactionsOpen);
    };

    return (
        <StyledDrawer variant="permanent" open={open}>
            <DrawerHeader>
                <ToggleButton onClick={onToggle}>
                    {open ? <ChevronLeft /> : <ChevronRight />}
                </ToggleButton>
            </DrawerHeader>

            <List>
                {/* Dashboard Item */}
                <ListItem disablePadding>
                    <StyledListItemButton
                        selected={selectedItem === '/dashboard'}
                        onClick={() =>
                            handleItemClick('dashboard', '/dashboard')
                        }
                        sx={{ pl: 2 }}
                    >
                        <StyledListItemIcon>
                            <Home />
                        </StyledListItemIcon>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <StyledListItemText primary="Dashboard" />
                        </Collapse>
                    </StyledListItemButton>
                </ListItem>

                {mainMenuItems.map(item => (
                    <React.Fragment key={item.id}>
                        {/* Main Transactions Item */}
                        <ListItem disablePadding>
                            <StyledListItemButton
                                onClick={handleTransactionsToggle}
                                sx={{ pl: 2 }}
                            >
                                <Box
                                    sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        flex: 1,
                                    }}
                                >
                                    <StyledListItemIcon>
                                        {item.icon}
                                    </StyledListItemIcon>
                                    <Collapse
                                        in={open}
                                        timeout="auto"
                                        unmountOnExit
                                    >
                                        <StyledListItemText
                                            primary={item.label}
                                        />
                                    </Collapse>
                                </Box>
                                {open && (
                                    <ExpandIcon>
                                        {transactionsOpen ? (
                                            <ExpandLess fontSize="small" />
                                        ) : (
                                            <ExpandMore fontSize="small" />
                                        )}
                                    </ExpandIcon>
                                )}
                            </StyledListItemButton>
                        </ListItem>

                        {/* Sub Items */}
                        <Collapse
                            in={transactionsOpen && open}
                            timeout="auto"
                            unmountOnExit
                        >
                            <List component="div" disablePadding>
                                {item.subItems?.map(subItem => (
                                    <ListItem key={subItem.id} disablePadding>
                                        <StyledListItemButton
                                            selected={
                                                selectedItem === subItem.path
                                            }
                                            onClick={() =>
                                                handleItemClick(
                                                    subItem.id,
                                                    subItem.path
                                                )
                                            }
                                            sx={{ pl: 4 }}
                                        >
                                            <StyledListItemIcon>
                                                {subItem.icon}
                                            </StyledListItemIcon>
                                            <StyledListItemText
                                                primary={subItem.label}
                                            />
                                        </StyledListItemButton>
                                    </ListItem>
                                ))}
                            </List>
                        </Collapse>
                    </React.Fragment>
                ))}

                {/* Customers Item - Not part of Transactions submenu */}
                <ListItem disablePadding>
                    <StyledListItemButton
                        selected={selectedItem === '/customers'}
                        onClick={() =>
                            handleItemClick('customers', '/customers')
                        }
                        sx={{ pl: 2 }}
                    >
                        <StyledListItemIcon>
                            <People />
                        </StyledListItemIcon>
                        <Collapse in={open} timeout="auto" unmountOnExit>
                            <StyledListItemText primary="Customers" />
                        </Collapse>
                    </StyledListItemButton>
                </ListItem>
            </List>
        </StyledDrawer>
    );
};

export default Sidebar;
