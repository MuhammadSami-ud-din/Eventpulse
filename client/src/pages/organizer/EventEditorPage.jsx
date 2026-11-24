import { useState } from 'react';
import { useNavigate } from 'react-router';
import { fetchCategories } from '../../api/events.js';
import { createEvent, removeCover, updateEvent, uploadCover } from '../../api/organizer.js';
import { EventCover } from '../../components/EventCover.jsx';
import { EventForm } from '../../components/EventForm.jsx';
import { ImageUploader } from '../../components/ImageUploader.jsx';
import { ManagedEventGate } from '../../components/ManagedEventGate.jsx';
import { OrganizerEventHeader } from '../../components/OrganizerEventHeader.jsx';
import { EmptyState, ErrorState, Loading } from '../../components/StateViews.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
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
  const { user } = useAuth();
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
      <p className="page-intro">
        New events start as drafts. Students can’t see them until an admin approves them. You can add a cover image
        after saving the draft.
      </p>
      <EventForm
        initialValues={EMPTY_EVENT_FORM}
        categories={categories.data}
        submitLabel="Save draft"
        onSubmit={handleCreate}
        previewContext={{ organizer: { id: user.id, name: user.fullName, avatarUrl: user.avatarUrl } }}
      />
    </>
  );
}

// Uploading takes effect at once; it does not wait for "Save changes".
function CoverSection({ event, coverUrl, onChange }) {
  return (
    <section className="card cover-editor" aria-labelledby="cover-heading">
      <h2 id="cover-heading" className="event-form__heading">
        Cover image
      </h2>
      <ImageUploader
        label="Cover"
        imageUrl={coverUrl}
        maxSize={1280}
        hint="Shown on the event card and page. Wide pictures work best; it is resized to at most 1280 px and 1 MB."
        preview={(url) => <EventCover eventId={event.id} coverUrl={url} className="cover-editor__preview" />}
        onUpload={async (blob) => onChange(await uploadCover(event.id, blob))}
        onRemove={async () => {
          await removeCover(event.id);
          onChange(null);
        }}
      />
    </section>
  );
}

function EditEventForm({ event, categories }) {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [coverUrl, setCoverUrl] = useState(event.coverUrl);

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
      <CoverSection event={event} coverUrl={coverUrl} onChange={setCoverUrl} />
      <EventForm
        initialValues={toEventFormValues(event)}
        categories={categories}
        submitLabel="Save changes"
        onSubmit={handleSave}
        previewContext={{ eventId: event.id, coverUrl, organizer: event.organizer }}
      />
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
