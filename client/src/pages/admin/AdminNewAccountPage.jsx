import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { createAccount } from '../../api/admin.js';
import { AdminNav } from '../../components/AdminNav.jsx';
import { FormField } from '../../components/FormField.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { useForm } from '../../hooks/useForm.js';
import { errorMessage } from '../../utils/errors.js';
import { suggestPassword } from '../../utils/password.js';
import { rules } from '../../utils/validation.js';

const SCHEMA = {
  fullName: [rules.required('Name'), rules.fullName],
  email: [rules.required('Email'), rules.email],
  department: [rules.maxLength(100, 'Department')],
  password: [rules.required('Password'), rules.newPassword],
};

const EMPTY = { fullName: '', email: '', role: 'organizer', department: '', password: '' };

// Students sign up themselves; this page is for society and staff accounts.
export function AdminNewAccountPage() {
  useDocumentTitle('New account');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const form = useForm(EMPTY, SCHEMA);
  const [formError, setFormError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      const created = await form.submitWith((values) =>
        createAccount({
          fullName: values.fullName,
          email: values.email.trim(),
          role: values.role,
          department: values.department,
          password: values.password,
        }),
      );
      if (created) {
        showToast({ type: 'success', message: `Account created for ${form.values.fullName.trim()}.` });
        navigate('/admin/users');
      }
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  // Goes through the normal change handler, so validation stays in step.
  function fillSuggestedPassword() {
    form.field('password').onChange({ target: { name: 'password', value: suggestPassword() } });
  }

  return (
    <>
      <h1>Admin</h1>
      <AdminNav />
      <section className="card narrow-form">
        <h2>New organizer or admin account</h2>
        <p className="page-intro">
          Students create their own accounts. Pass the password on to the new user privately; they can change it on
          their profile page.
        </p>
        <form onSubmit={handleSubmit} noValidate>
          {formError && (
            <p className="form-error" role="alert">
              {formError}
            </p>
          )}
          <FormField label="Name" hint="A person, or a society such as “Photography Club”." {...form.field('fullName')} />
          <FormField label="Email" type="email" autoComplete="off" {...form.field('email')} />
          <FormField label="Role" as="select" {...form.field('role')}>
            <option value="organizer">Organizer: creates and runs their own events</option>
            <option value="admin">Admin: manages every event, user and category</option>
          </FormField>
          <FormField label="Department (optional)" {...form.field('department')} />
          {/* Shown as plain text: the admin has to copy it and pass it on. */}
          <FormField
            label="Starting password"
            autoComplete="new-password"
            spellCheck={false}
            hint="At least 8 characters, with upper and lower case letters and a number."
            {...form.field('password')}
          />
          <div className="form-actions">
            <button type="button" className="button" onClick={fillSuggestedPassword}>
              Suggest a password
            </button>
            <Link to="/admin/users" className="button button--ghost">
              Cancel
            </Link>
            <button type="submit" className="button button--primary" disabled={form.submitting}>
              {form.submitting ? 'Creating…' : 'Create account'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
