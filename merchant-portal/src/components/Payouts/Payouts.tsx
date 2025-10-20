import React from 'react';
import { Box, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

const StyledContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(1),
    backgroundColor: '#f8fafc',
    minHeight: '100vh',
}));

const PageTitle = styled(Typography)(({ theme }) => ({
    fontSize: '2rem',
    fontWeight: 600,
    color: '#1a202c',
    marginBottom: theme.spacing(1),
}));

const Payouts: React.FC = () => {
    return (
        <StyledContainer>
            <PageTitle>Payouts</PageTitle>
            <Box
                display="flex"
                justifyContent="center"
                alignItems="center"
                minHeight="400px"
            >
                <Typography variant="h6" color="text.secondary">
                    Payouts - Coming Soon
                </Typography>
            </Box>
        </StyledContainer>
    );
};

export default Payouts;
