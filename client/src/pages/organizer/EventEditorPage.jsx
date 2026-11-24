import { useEffect, useState } from 'react';
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
import { errorMessage } from '../../utils/errors.js';
import { hasEventStarted } from '../../utils/eventStatus.js';

function useCategories() {
  return useAsync((signal) => fetchCategories({ signal }), []);
}

// A cover chosen before the event exists: kept in the browser as { blob, url }
// until the draft is saved. The temporary preview URL is released when the
// cover is replaced or the page closes.
function usePendingCover() {
  const [cover, setCover] = useState(null);
  useEffect(() => () => cover && URL.revokeObjectURL(cover.url), [cover]);
  return {
    cover,
    choose: (blob) => setCover({ blob, url: URL.createObjectURL(blob) }),
    clear: () => setCover(null),
  };
}

export function NewEventPage() {
  useDocumentTitle('New event');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = useAuth();
  const categories = useCategories();
  const pending = usePendingCover();

  if (categories.isLoading) return <Loading />;
  if (categories.error) return <ErrorState error={categories.error} onRetry={categories.reload} />;

  async function handleCreate(payload) {
    const event = await createEvent(payload);
    if (pending.cover) {
      try {
        await uploadCover(event.id, pending.cover.blob);
      } catch (error) {
        // The draft itself is saved; only the picture failed, so send the
        // organizer to the editor where they can try the upload again.
        showToast({ type: 'error', message: `Draft saved, but the cover was not uploaded: ${errorMessage(error)} Try again here.` });
        navigate(`/organizer/events/${event.id}/edit`);
        return;
      }
    }
    showToast({ type: 'success', message: 'Draft saved. Submit it for approval when it is ready.' });
    navigate(`/organizer/events/${event.id}`);
  }

  return (
    <>
      <h1>New event</h1>
      <p className="page-intro">
        New events start as drafts. Students can’t see them until an admin approves them.
      </p>
      <CoverSection
        eventId="new"
        coverUrl={pending.cover?.url ?? null}
        deferred
        hint="Optional. Without one, the event gets a colourful generated cover. Wide pictures work best; it is resized to at most 1280 px and 1 MB, and uploaded when you save the draft."
        onUpload={async (blob) => pending.choose(blob)}
        onRemove={async () => pending.clear()}
      />
      <EventForm
        initialValues={EMPTY_EVENT_FORM}
        categories={categories.data}
        submitLabel="Save draft"
        onSubmit={handleCreate}
        previewContext={{ coverUrl: pending.cover?.url, organizer: { id: user.id, name: user.fullName, avatarUrl: user.avatarUrl } }}
      />
    </>
  );
}

const COVER_HINT = 'Shown on the event card and page. Wide pictures work best; it is resized to at most 1280 px and 1 MB.';

function CoverSection({ eventId, coverUrl, deferred = false, hint = COVER_HINT, onUpload, onRemove }) {
  return (
    <section className="card cover-editor" aria-labelledby="cover-heading">
      <h2 id="cover-heading" className="event-form__heading">
        Cover image
      </h2>
      <ImageUploader
        label="Cover"
        imageUrl={coverUrl}
        maxSize={1280}
        deferred={deferred}
        hint={hint}
        preview={(url) => <EventCover eventId={eventId} coverUrl={url} className="cover-editor__preview" />}
        onUpload={onUpload}
        onRemove={onRemove}
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
      {/* Uploading takes effect at once; it does not wait for "Save changes". */}
      <CoverSection
        eventId={event.id}
        coverUrl={coverUrl}
        onUpload={async (blob) => setCoverUrl(await uploadCover(event.id, blob))}
        onRemove={async () => {
          await removeCover(event.id);
          setCoverUrl(null);
        }}
      />
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
