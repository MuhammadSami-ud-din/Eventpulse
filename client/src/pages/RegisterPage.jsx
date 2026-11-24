import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { FormField } from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useForm } from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { rules } from '../utils/validation.js';

const SCHEMA = {
  fullName: [rules.required('Full name'), rules.fullName],
  email: [rules.required('Email'), rules.email],
  studentNumber: [rules.required('Student number'), rules.studentNumber],
  department: [rules.plainText('Department'), rules.maxLength(100, 'Department')],
  password: [rules.required('Password'), rules.newPassword],
  confirmPassword: [rules.matches('password', 'Passwords do not match')],
};

const EMPTY = { fullName: '', email: '', studentNumber: '', department: '', password: '', confirmPassword: '' };

export function RegisterPage() {
  useDocumentTitle('Create account');
  const { user, register } = useAuth();
  const { showToast } = useToast();
  const form = useForm(EMPTY, SCHEMA);
  const [formError, setFormError] = useState('');

  // Also handles the redirect right after a successful sign-up.
  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      const created = await form.submitWith((values) =>
        register({
          fullName: values.fullName,
          email: values.email.trim(),
          studentNumber: values.studentNumber,
          department: values.department.trim() || undefined,
          password: values.password,
        }),
      );
      if (created) showToast({ type: 'success', message: 'Welcome to EventPulse! Your account is ready.' });
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <section className="auth card">
      <h1>Create a student account</h1>
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <FormField label="Full name" autoComplete="name" maxLength={100} {...form.field('fullName')} />
        <FormField label="University email" type="email" autoComplete="email" maxLength={255} {...form.field('email')} />
        <FormField label="Student number" hint="As printed on your student card." maxLength={20} {...form.field('studentNumber')} />
        <FormField label="Department (optional)" maxLength={100} {...form.field('department')} />
        <FormField
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with upper and lower case letters and a number."
          {...form.field('password')}
        />
        <FormField label="Confirm password" type="password" autoComplete="new-password" {...form.field('confirmPassword')} />
        <button type="submit" className="button button--primary button--block" disabled={form.submitting}>
          {form.submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="auth__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  );
}
