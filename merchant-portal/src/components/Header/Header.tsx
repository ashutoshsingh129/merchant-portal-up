import React from 'react';
import { AppBar, Toolbar, Typography, Avatar } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: '#ffffff',
    color: '#1a202c',
    boxShadow:
        '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    borderBottom: '1px solid #e2e8f0',
}));

const StyledToolbar = styled(Toolbar)(({ theme }) => ({
    padding: theme.spacing(0, 2),
    minHeight: 64,
}));

const Header: React.FC = () => {
    return (
        <StyledAppBar position="static">
            <StyledToolbar>
                <Avatar sx={{ width: 32, height: 32 }}>U</Avatar>
            </StyledToolbar>
        </StyledAppBar>
    );
};

export default Header;
