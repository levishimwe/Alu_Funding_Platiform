import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PublicLayout from './layouts/PublicLayout';
import AppShell from './layouts/AppShell';
import RequireAuth from './components/RequireAuth';
import { EmptyState } from './components/ui';
import Home from './pages/Home';
import { ForgotPassword, PasswordUpdated, Register, ResetPassword, SignIn, VerifyEmail } from './pages/auth';
import GraduateOverview from './pages/GraduateOverview';

function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24">
      <EmptyState title="Page not found" action={<Link to="/" className="btn-cta">Go home</Link>}>
        The page you are looking for does not exist or has moved.
      </EmptyState>
    </div>
  );
}

// Temporary placeholder for screens delivered in later build phases.
function Upcoming({ title }) {
  return <EmptyState title={title}>This screen is part of a later build phase.</EmptyState>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="signin" element={<SignIn />} />
            <Route path="register" element={<Register />} />
            <Route path="verify-email" element={<VerifyEmail />} />
            <Route path="forgot-password" element={<ForgotPassword />} />
            <Route path="reset-password" element={<ResetPassword />} />
            <Route path="password-updated" element={<PasswordUpdated />} />
            <Route path="ventures" element={<Upcoming title="Public ventures" />} />
            <Route path="verify" element={<Upcoming title="Verify a Project" />} />
            <Route path="opportunities" element={<Upcoming title="Opportunities" />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="app" element={<RequireAuth><AppShell /></RequireAuth>}>
            <Route element={<RequireAuth roles={['graduate']} />}>
              <Route index element={<GraduateOverview />} />
            </Route>
            <Route path="*" element={<Upcoming title="Coming soon" />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
