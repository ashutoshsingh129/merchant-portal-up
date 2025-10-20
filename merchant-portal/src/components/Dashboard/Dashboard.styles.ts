import { styled } from '@mui/material/styles';
import { Box, Card, TableContainer } from '@mui/material';

export const StyledContainer = styled(Box)(({ theme }) => ({
    padding: theme.spacing(3),
    maxWidth: '1200px',
    margin: '0 auto',
}));

export const StyledCard = styled(Card)(({ theme }) => ({
    marginTop: theme.spacing(3),
}));

export const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
    marginTop: theme.spacing(2),
    maxHeight: 400,
})) as typeof TableContainer;
