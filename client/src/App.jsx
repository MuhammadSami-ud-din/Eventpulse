import { useEffect, useState } from 'react';
import { api } from './api/client.js';

const STATUS_LABELS = {
  loading: 'Checking API…',
  ok: 'API and database are up',
  error: 'API or database is unreachable',
};

export default function App() {
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api
      .get('/health')
      .then(() => setStatus('ok'))
      .catch(() => setStatus('error'));
  }, []);

  return (
    <main className="shell">
      <h1>EventHub</h1>
      <p role="status" className={`status status--${status}`}>
        {STATUS_LABELS[status]}
      </p>
    </main>
  );
}
