import React, { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
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
    padding: theme.spacing(0, 3),
    position: 'sticky',
    top: 0,
    zIndex: 1000,
}));

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
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const handleSidebarToggle = () => {
        setSidebarOpen(!sidebarOpen);
    };

    return (
        <StyledRoot>
            <Sidebar open={sidebarOpen} onToggle={handleSidebarToggle} />
            <MainContent sidebarOpen={sidebarOpen}>
                <Header>
                    <HeaderTitle>Merchant Portal</HeaderTitle>
                </Header>
                <ContentArea>{children}</ContentArea>
            </MainContent>
        </StyledRoot>
    );
};

export default Layout;
