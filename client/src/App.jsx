import { Route, Routes } from 'react-router';
import { Layout } from './components/Layout.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { EventDetailPage } from './pages/EventDetailPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { MyRegistrationsPage } from './pages/MyRegistrationsPage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { NotificationsPage } from './pages/NotificationsPage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { TicketPage } from './pages/TicketPage.jsx';
import { TicketStatusPage } from './pages/TicketStatusPage.jsx';
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage.jsx';
import { AdminApprovalsPage } from './pages/admin/AdminApprovalsPage.jsx';
import { AdminCategoriesPage } from './pages/admin/AdminCategoriesPage.jsx';
import { AdminNewAccountPage } from './pages/admin/AdminNewAccountPage.jsx';
import { AdminUsersPage } from './pages/admin/AdminUsersPage.jsx';
import { CheckInPage } from './pages/organizer/CheckInPage.jsx';
import { EditEventPage, NewEventPage } from './pages/organizer/EventEditorPage.jsx';
import { EventRegistrationsPage } from './pages/organizer/EventRegistrationsPage.jsx';
import { ManageEventPage } from './pages/organizer/ManageEventPage.jsx';
import { OrganizerDashboardPage } from './pages/organizer/OrganizerDashboardPage.jsx';

const studentOnly = (page) => <ProtectedRoute roles={['student']}>{page}</ProtectedRoute>;
const signedIn = (page) => <ProtectedRoute>{page}</ProtectedRoute>;
// Admins can use every organizer page (the server lets them manage any event).
const organizerOnly = (page) => <ProtectedRoute roles={['organizer', 'admin']}>{page}</ProtectedRoute>;
const adminOnly = (page) => <ProtectedRoute roles={['admin']}>{page}</ProtectedRoute>;

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="events/:id" element={<EventDetailPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="my/registrations" element={studentOnly(<MyRegistrationsPage />)} />
        <Route path="my/registrations/:id" element={studentOnly(<TicketPage />)} />
        <Route path="notifications" element={signedIn(<NotificationsPage />)} />
        <Route path="profile" element={signedIn(<ProfilePage />)} />
        <Route path="t/:code" element={<TicketStatusPage />} />
        <Route path="organizer" element={organizerOnly(<OrganizerDashboardPage />)} />
        <Route path="organizer/events/new" element={organizerOnly(<NewEventPage />)} />
        <Route path="organizer/events/:id" element={organizerOnly(<ManageEventPage />)} />
        <Route path="organizer/events/:id/edit" element={organizerOnly(<EditEventPage />)} />
        <Route path="organizer/events/:id/registrations" element={organizerOnly(<EventRegistrationsPage />)} />
        <Route path="organizer/events/:id/check-in" element={organizerOnly(<CheckInPage />)} />
        <Route path="admin" element={adminOnly(<AdminApprovalsPage />)} />
        <Route path="admin/users" element={adminOnly(<AdminUsersPage />)} />
        <Route path="admin/users/new" element={adminOnly(<AdminNewAccountPage />)} />
        <Route path="admin/categories" element={adminOnly(<AdminCategoriesPage />)} />
        <Route path="admin/analytics" element={adminOnly(<AdminAnalyticsPage />)} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
