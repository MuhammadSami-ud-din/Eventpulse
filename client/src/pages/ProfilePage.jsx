import { changePassword, updateProfile } from '../api/auth.js';
import { FormField } from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useForm } from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { rules } from '../utils/validation.js';

const PROFILE_SCHEMA = {
  fullName: [rules.required('Full name'), rules.fullName],
  department: [rules.maxLength(100, 'Department')],
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

const EMPTY_PASSWORDS = { currentPassword: '', newPassword: '', confirmPassword: '' };

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
    <>
      <h1>Profile</h1>
      <section className="card profile-section" aria-labelledby="account-heading">
        <h2 id="account-heading">Account</h2>
        <dl className="facts">
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Account type</dt>
            <dd>{ROLE_LABELS[user.role]}</dd>
          </div>
          {user.studentNumber && (
            <div>
              <dt>Student number</dt>
              <dd>{user.studentNumber}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="card profile-section" aria-labelledby="details-heading">
        <h2 id="details-heading">Your details</h2>
        <form onSubmit={saveProfile} noValidate>
          <FormField label="Full name" autoComplete="name" {...profile.field('fullName')} />
          <FormField label="Department" {...profile.field('department')} />
          <button type="submit" className="button button--primary" disabled={profile.submitting}>
            {profile.submitting ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="card profile-section" aria-labelledby="password-heading">
        <h2 id="password-heading">Change password</h2>
        <p className="field__hint">This logs you out on every other device.</p>
        <form onSubmit={savePassword} noValidate>
          <FormField label="Current password" type="password" autoComplete="current-password" {...password.field('currentPassword')} />
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
    </>
  );
}
