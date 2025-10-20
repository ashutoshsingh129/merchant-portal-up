import { styled } from '@mui/material/styles';
import { Box, AppBar, Typography, Container } from '@mui/material';

export const StyledRoot = styled(Box)(({ theme }) => ({
    flexGrow: 1,
    minHeight: '100vh',
    backgroundColor: theme.palette.background.default,
}));

export const StyledAppBar = styled(AppBar)(({ theme }) => ({
    backgroundColor: theme.palette.primary.main,
}));

export const StyledTitle = styled(Typography)(() => ({
    flexGrow: 1,
})) as typeof Typography;

export const StyledThemeToggle = styled(Box)(({ theme }) => ({
    marginLeft: theme.spacing(2),
}));

export const StyledContainer = styled(Container)(({ theme }) => ({
    paddingTop: theme.spacing(3),
    paddingBottom: theme.spacing(3),
})) as typeof Container;
