import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { store } from './store';
import { useAppSelector } from './store';
import { lightTheme, darkTheme } from './theme';
import Layout from './components/Layout/Layout';
import Dashboard from './components/Dashboard/Dashboard';
import Payments from './components/Payments';
import Payouts from './components/Payouts';
import Customers from './components/Customers';

const AppRoutes: React.FC = () => {
    const theme = useAppSelector(state => state.app.theme);
    const currentTheme = theme === 'dark' ? darkTheme : lightTheme;

    return (
        <ThemeProvider theme={currentTheme}>
            <CssBaseline />
            <Router>
                <Layout>
                    <Routes>
                        <Route path="/" element={<Payments />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/payments" element={<Payments />} />
                        <Route
                            path="/transactions/payouts"
                            element={<Payouts />}
                        />
                        <Route path="/payouts" element={<Payouts />} />
                        <Route path="/customers" element={<Customers />} />
                    </Routes>
                </Layout>
            </Router>
        </ThemeProvider>
    );
};

const App: React.FC = () => {
    return (
        <Provider store={store}>
            <AppRoutes />
        </Provider>
    );
};

export default App;
