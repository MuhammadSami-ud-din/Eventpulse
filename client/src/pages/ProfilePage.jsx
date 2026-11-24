import { Link } from 'react-router';
import { fetchAccountSummary, removeAvatar, uploadAvatar } from '../api/account.js';
import { changePassword, updateProfile } from '../api/auth.js';
import { Avatar } from '../components/Avatar.jsx';
import { Badge } from '../components/Badge.jsx';
import { FormField } from '../components/FormField.jsx';
import { ImageUploader } from '../components/ImageUploader.jsx';
import { DashboardSkeleton } from '../components/Skeletons.jsx';
import { StatTile } from '../components/StatTile.jsx';
import { ErrorState } from '../components/StateViews.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAsync } from '../hooks/useAsync.js';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useForm } from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { ATTENDANCE_STATUS, EVENT_STATUS, REGISTRATION_STATUS } from '../utils/eventStatus.js';
import { formatDate, formatRate } from '../utils/format.js';
import { rules } from '../utils/validation.js';

const PROFILE_SCHEMA = {
  fullName: [rules.required('Full name'), rules.fullName],
  department: [rules.plainText('Department'), rules.maxLength(100, 'Department')],
};

const PASSWORD_SCHEMA = {
  currentPassword: [rules.required('Current password')],
  newPassword: [
    rules.required('New password'),
    rules.newPassword,
    rules.differsFrom('currentPassword', 'Choose a password different from the current one'),
  ],
  confirmPassword: [rules.matches('newPassword', 'Passwords do not match')],
};

const ROLE_LABELS = { student: 'Student', organizer: 'Organizer', admin: 'Administrator' };
const ROLE_TONES = { student: 'neutral', organizer: 'success', admin: 'warning' };

// What each role is told about, as the server sends it (see notificationMessages.js).
// Notifications appear inside EventPulse only; no emails are sent.
const NOTIFICATIONS_BY_ROLE = {
  student: [
    'Your seat is confirmed',
    'You joined a waitlist, with your place in line',
    'A seat opened up and you moved off the waitlist',
    'Your registration was cancelled',
  ],
  organizer: ['An admin approved your event', 'An admin sent your event back, with their reason'],
  admin: ['An admin approved your event', 'An admin sent your event back, with their reason'],
};

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

function ProfileHeader({ user, setUser }) {
  return (
    <section className="card profile-hero" aria-labelledby="profile-name">
      <ImageUploader
        label="Photo"
        imageUrl={user.avatarUrl}
        maxSize={512}
        square
        hint="A square crop of your picture, at most 512 px."
        preview={(url) => <Avatar user={{ ...user, avatarUrl: url }} size={112} />}
        onUpload={async (blob) => setUser({ ...user, avatarUrl: await uploadAvatar(blob) })}
        onRemove={async () => {
          await removeAvatar();
          setUser({ ...user, avatarUrl: null });
        }}
      />
      <div className="profile-hero__identity">
        <h1 id="profile-name" className="profile-hero__name">
          {user.fullName}
        </h1>
        <Badge tone={ROLE_TONES[user.role]}>{ROLE_LABELS[user.role]}</Badge>
        <dl className="profile-hero__facts">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Department</dt>
            <dd>{user.department ?? 'Not set'}</dd>
          </div>
          {user.studentNumber && (
            <div>
              <dt>Student number</dt>
              <dd>{user.studentNumber}</dd>
            </div>
          )}
          <div>
            <dt>Member since</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function EventLine({ to, title, startsAt, badge }) {
  return (
    <li className="mini-list__item">
      <Link to={to} className="mini-list__title">
        {title}
      </Link>
      <span className="mini-list__meta">
        {formatDate(startsAt)} {badge}
      </span>
    </li>
  );
}

function MiniList({ title, empty, children }) {
  const items = children.filter(Boolean);
  return (
    <section className="card" aria-label={title}>
      <h3 className="profile-subheading">{title}</h3>
      {items.length ? <ul className="mini-list">{items}</ul> : <p className="field__hint">{empty}</p>}
    </section>
  );
}

function StudentActivity({ summary }) {
  const { stats } = summary;
  return (
    <>
      <div className="stat-grid stat-grid--four">
        <StatTile label="Upcoming" value={stats.upcoming} detail="seats and waitlist places" />
        <StatTile label="Attended" value={stats.attended} />
        <StatTile label="No-shows" value={stats.noShows} />
        <StatTile label="Attendance rate" value={formatRate(stats.attendanceRate)} detail="of events you were marked at" />
      </div>
      <div className="chart-grid">
        <MiniList title="Coming up" empty="No upcoming registrations. Find something on the events page.">
          {summary.upcoming.map((registration) => (
            <EventLine
              key={registration.id}
              to={registration.status === 'confirmed' ? `/my/registrations/${registration.id}` : `/events/${registration.event.id}`}
              title={registration.event.title}
              startsAt={registration.event.startsAt}
              badge={<Badge tone={REGISTRATION_STATUS[registration.status].tone}>{REGISTRATION_STATUS[registration.status].label}</Badge>}
            />
          ))}
        </MiniList>
        <MiniList title="Recently attended or missed" empty="No past events yet.">
          {summary.recent.map((registration) => (
            <EventLine
              key={registration.id}
              to={`/events/${registration.event.id}`}
              title={registration.event.title}
              startsAt={registration.event.startsAt}
              badge={
                registration.attendance && (
                  <Badge tone={ATTENDANCE_STATUS[registration.attendance.status].tone}>
                    {ATTENDANCE_STATUS[registration.attendance.status].label}
                  </Badge>
                )
              }
            />
          ))}
        </MiniList>
      </div>
    </>
  );
}

function OrganizerActivity({ summary }) {
  const { stats } = summary;
  return (
    <>
      <div className="stat-grid stat-grid--four">
        <StatTile label="Your events" value={stats.total} detail={`${stats.drafts} drafts`} />
        <StatTile label="Published" value={stats.published} />
        <StatTile label="Awaiting approval" value={stats.pending} />
        <StatTile label="Seats taken" value={stats.seatsTaken} detail="across all your events" />
      </div>
      <MiniList title="Your next events" empty="Nothing scheduled. Create an event from the sidebar.">
        {summary.upcomingEvents.map((event) => (
          <EventLine
            key={event.id}
            to={`/organizer/events/${event.id}`}
            title={event.title}
            startsAt={event.startsAt}
            badge={<Badge tone={EVENT_STATUS[event.status].tone}>{EVENT_STATUS[event.status].label}</Badge>}
          />
        ))}
      </MiniList>
    </>
  );
}

function Activity({ user }) {
  const { data, error, isLoading, reload } = useAsync((signal) => fetchAccountSummary({ signal }), []);
  return (
    <section className="profile-section" aria-labelledby="activity-heading">
      <h2 id="activity-heading">Your activity</h2>
      {isLoading && <DashboardSkeleton label="Loading your activity…" tiles={4} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && (user.role === 'student' ? <StudentActivity summary={data} /> : <OrganizerActivity summary={data} />)}
    </section>
  );
}

export function ProfilePage() {
  useDocumentTitle('Profile');
  const { user, setUser } = useAuth();
  const { showToast } = useToast();
  const profile = useForm({ fullName: user.fullName, department: user.department ?? '' }, PROFILE_SCHEMA);
  const password = useForm(EMPTY_PASSWORDS, PASSWORD_SCHEMA);

  // The success toast only shows when the server accepted the change.
  async function submit(form, save, successMessage) {
    try {
      if (await form.submitWith(save)) showToast({ type: 'success', message: successMessage });
    } catch (error) {
      showToast({ type: 'error', message: errorMessage(error) });
    }
  }

  function saveProfile(e) {
    e.preventDefault();
    submit(
      profile,
      async (values) => setUser(await updateProfile({ fullName: values.fullName, department: values.department })),
      'Profile saved.',
    );
  }

  function savePassword(e) {
    e.preventDefault();
    submit(
      password,
      async (values) => {
        setUser(await changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword }));
        password.reset();
      },
      'Password changed.',
    );
  }

  return (
    <div className="profile">
      <ProfileHeader user={user} setUser={setUser} />
      <Activity user={user} />

      <div className="profile__columns">
        <section className="card profile-section" aria-labelledby="details-heading">
          <h2 id="details-heading">Your details</h2>
          <form onSubmit={saveProfile} noValidate>
            <FormField label="Full name" autoComplete="name" maxLength={100} {...profile.field('fullName')} />
            <FormField label="Department" maxLength={100} {...profile.field('department')} />
            <button type="submit" className="button button--primary" disabled={profile.submitting}>
              {profile.submitting ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        </section>

        <section className="card profile-section" aria-labelledby="password-heading">
          <h2 id="password-heading">Change password</h2>
          <p className="field__hint">This logs you out on every other device.</p>
          <form onSubmit={savePassword} noValidate>
            <FormField label="Current password" type="password" autoComplete="current-password" maxLength={128} {...password.field('currentPassword')} />
            <FormField
              label="New password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters, with upper and lower case letters and a number."
              {...password.field('newPassword')}
            />
            <FormField label="Confirm new password" type="password" autoComplete="new-password" {...password.field('confirmPassword')} />
            <button type="submit" className="button button--primary" disabled={password.submitting}>
              {password.submitting ? 'Changing…' : 'Change password'}
            </button>
          </form>
        </section>
      </div>

      <section className="card profile-section" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading">Notifications</h2>
        <p className="field__hint">You are notified inside EventPulse (no emails) when:</p>
        <ul className="check-list">
          {NOTIFICATIONS_BY_ROLE[user.role].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
