import { useNavigate } from 'react-router';
import { fetchCategories } from '../../api/events.js';
import { createEvent, updateEvent } from '../../api/organizer.js';
import { EventForm } from '../../components/EventForm.jsx';
import { ManagedEventGate } from '../../components/ManagedEventGate.jsx';
import { OrganizerEventHeader } from '../../components/OrganizerEventHeader.jsx';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { useAsync } from '../../hooks/useAsync.js';
import { useDocumentTitle } from '../../hooks/useDocumentTitle.js';
import { EMPTY_EVENT_FORM, toEventFormValues } from '../../utils/eventForm.js';
import { hasEventStarted } from '../../utils/eventStatus.js';

function useCategories() {
  return useAsync((signal) => fetchCategories({ signal }), []);
}

export function NewEventPage() {
  useDocumentTitle('New event');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const categories = useCategories();

  if (categories.isLoading) return <Loading />;
  if (categories.error) return <ErrorState error={categories.error} onRetry={categories.reload} />;

  async function handleCreate(payload) {
    const event = await createEvent(payload);
    showToast({ type: 'success', message: 'Draft saved. Submit it for approval when it is ready.' });
    navigate(`/organizer/events/${event.id}`);
  }

  return (
    <>
      <h1>New event</h1>
      <p className="page-intro">New events start as drafts. Students can’t see them until an admin approves them.</p>
      <EventForm initialValues={EMPTY_EVENT_FORM} categories={categories.data} submitLabel="Save draft" onSubmit={handleCreate} />
    </>
  );
}

function EditEventForm({ event, categories }) {
  const navigate = useNavigate();
  const { showToast } = useToast();

  async function handleSave(payload) {
    await updateEvent(event.id, payload);
    showToast({ type: 'success', message: 'Changes saved.' });
    navigate(`/organizer/events/${event.id}`);
  }

  if (hasEventStarted(event)) {
    return <EmptyState icon="clock" title="This event has started" message="Events can’t be edited once they begin." />;
  }
  return (
    <>
      {event.status === 'rejected' && (
        <p className="notice">Saving your changes turns this event back into a draft you can resubmit.</p>
      )}
      <EventForm initialValues={toEventFormValues(event)} categories={categories} submitLabel="Save changes" onSubmit={handleSave} />
    </>
  );
}

export function EditEventPage() {
  useDocumentTitle('Edit event');
  const categories = useCategories();

  return (
    <ManagedEventGate>
      {(event) => (
        <>
          <OrganizerEventHeader event={event} />
          {categories.isLoading && <Loading />}
          {categories.error && <ErrorState error={categories.error} onRetry={categories.reload} />}
          {categories.data && <EditEventForm event={event} categories={categories.data} />}
        </>
      )}
    </ManagedEventGate>
  );
}
