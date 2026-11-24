import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router';
import { FormField } from '../components/FormField.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useDocumentTitle } from '../hooks/useDocumentTitle.js';
import { useForm } from '../hooks/useForm.js';
import { errorMessage } from '../utils/errors.js';
import { rules } from '../utils/validation.js';

const SCHEMA = {
  email: [rules.required('Email'), rules.email],
  password: [rules.required('Password')],
};

// `from` is a router location saved by ProtectedRoute or a "Log in" link,
// never a URL from the query string, so it cannot send users to another site.
function returnPath(state) {
  const from = state?.from;
  return from ? `${from.pathname}${from.search ?? ''}` : '/';
}

export function LoginPage() {
  useDocumentTitle('Log in');
  const { user, login } = useAuth();
  const location = useLocation();
  const form = useForm({ email: '', password: '' }, SCHEMA);
  const [formError, setFormError] = useState('');

  // Also handles the redirect right after a successful login.
  if (user) return <Navigate to={returnPath(location.state)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      await form.submitWith((values) => login({ email: values.email.trim(), password: values.password }));
    } catch (error) {
      setFormError(errorMessage(error));
    }
  }

  return (
    <section className="auth card">
      <h1>Log in</h1>
      <form onSubmit={handleSubmit} noValidate>
        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}
        <FormField label="Email" type="email" autoComplete="email" {...form.field('email')} />
        <FormField label="Password" type="password" autoComplete="current-password" {...form.field('password')} />
        <button type="submit" className="button button--primary button--block" disabled={form.submitting}>
          {form.submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
      <p className="auth__switch">
        New here? <Link to="/register">Create a student account</Link>
      </p>
    </section>
  );
}
